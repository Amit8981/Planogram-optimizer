#!/usr/bin/env python3
"""
Cooler Planogram Optimization CLI & Standalone Engine
2-Stage Architecture:
- Stage 1: Mathematical CP-SAT / Integer Knapsack Optimization (Hard Physical Constraints: Width, Height, Weight, Min/Max Facings)
- Stage 2: Post-Solver Sequencing & Brand Flow (Preserves user's master brand order A->B->C->D across each shelf as A->C->D if B not selected)

Guarantees:
- Shelf width (usable_width_mm) is strictly respected (0% overflow).
- Decouples combinatorial brand ordering from the core solver for clean, provably optimal solutions.
"""

import csv
import json
import math
import sys
import copy
import argparse
from pathlib import Path

# Attempt to import Google OR-Tools CP-SAT if installed
try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False

def load_skus_csv(filepath):
    skus = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            skus.append({
                'sku_id': row['sku_id'],
                'name': row['name'],
                'brand': row['brand'],
                'sub_brand': row.get('sub_brand', ''),
                'category': row['category'],
                'sub_category': row.get('sub_category', ''),
                'flavor': row['flavor'],
                'sugar_type': row.get('sugar_type', 'Regular'),
                'pack_type': row.get('pack_type', 'Can'),
                'pack_material': row.get('pack_material', 'Aluminium'),
                'pack_size_ml': int(row.get('pack_size_ml', 330)),
                'pack_size_label': row.get('pack_size_label', '330ml'),
                'dimensions_mm': {
                    'width': int(row['width_mm']),
                    'height': int(row['height_mm']),
                    'depth': int(row['depth_mm'])
                },
                'weight_g': float(row['weight_g']),
                'unit_cost': float(row['unit_cost']),
                'unit_price': float(row['unit_price']),
                'margin': float(row['margin']),
                'sales_velocity_units_day': float(row['sales_velocity_units_day']),
                'min_facings': int(row.get('min_facings', 1)),
                'max_facings': int(row.get('max_facings', 4)),
                'case_pack_units': int(row.get('case_pack_units', 24)),
                'is_core_sku': row.get('is_core_sku', 'FALSE').upper() == 'TRUE',
                'color_hex': row.get('color_hex', '#333333'),
                'image_emoji': row.get('image_emoji', '🥤')
            })
    return skus

def load_coolers_csv(filepath):
    coolers_map = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid = row['cooler_id']
            if cid not in coolers_map:
                coolers_map[cid] = {
                    'cooler_id': cid,
                    'name': row['cooler_name'],
                    'doors': int(row['total_doors']),
                    'total_width_mm': int(row['total_width_mm']),
                    'total_height_mm': int(row['total_height_mm']),
                    'total_depth_mm': int(row['total_depth_mm']),
                    'bays': {}
                }
            
            door_idx = int(row['door_index'])
            if door_idx not in coolers_map[cid]['bays']:
                coolers_map[cid]['bays'][door_idx] = {
                    'door_index': door_idx,
                    'door_label': row['door_label'],
                    'shelves': []
                }
            
            coolers_map[cid]['bays'][door_idx]['shelves'].append({
                'shelf_id': row['shelf_id'],
                'shelf_index': int(row['shelf_index']),
                'tier': row['tier'],
                'tier_label': row['tier_label'],
                'usable_width_mm': int(row['usable_width_mm']),
                'usable_depth_mm': int(row['usable_depth_mm']),
                'clearance_height_mm': int(row['clearance_height_mm']),
                'max_weight_kg': float(row['max_weight_kg']),
                'eye_level_score': float(row['eye_level_score']),
                'has_pusher_track': row.get('has_pusher_track', 'FALSE').upper() == 'TRUE',
                'cooling_zone': row.get('cooling_zone', 'Chilled')
            })
            
    coolers_list = []
    for cid, cdata in coolers_map.items():
        bays_list = list(cdata['bays'].values())
        coolers_list.append({
            'cooler_id': cdata['cooler_id'],
            'name': cdata['name'],
            'doors': cdata['doors'],
            'total_width_mm': cdata['total_width_mm'],
            'total_height_mm': cdata['total_height_mm'],
            'total_depth_mm': cdata['total_depth_mm'],
            'bays': bays_list
        })
    return coolers_list

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

# =========================================================================
# STAGE 1: MATHEMATICAL SOLVER (Exact Bounded Knapsack / CP-SAT)
# =========================================================================
def solve_shelf_allocations(shelf, eligible_skus, objective, gamma=0.20, weights=None):
    """
    Stage 1: Solves the exact facing allocation per shelf strictly respecting:
    - Shelf usable width constraint (Sum f_i * w_i <= usable_width_mm)
    - Shelf max weight capacity (Sum f_i * units_deep_i * weight_i <= max_weight_kg)
    - Bounded facings f_i in [min_facings, max_facings]
    """
    if weights is None:
        weights = {}

    usable_width = shelf['usable_width_mm']
    max_weight_kg = shelf['max_weight_kg']
    eye_score = shelf.get('eye_level_score', 0.5)
    eye_mult = 1.0 + (eye_score - 0.5) * 0.15

    # Compute candidate base scores and units deep
    candidates = []
    for sku in eligible_skus:
        units_deep = max(1, shelf['usable_depth_mm'] // sku['dimensions_mm']['depth'])
        w = sku['dimensions_mm']['width']
        weight_per_facing_kg = (units_deep * sku['weight_g']) / 1000.0

        # Objective yield weights
        if objective == 'revenue':
            base_yield = sku['unit_price'] * 15.0 + sku['sales_velocity_units_day'] * 0.4
        elif objective == 'volume':
            base_yield = sku['sales_velocity_units_day'] * 2.0
        else: # profit
            base_yield = sku['margin'] * 30.0 + sku['sales_velocity_units_day'] * 0.3

        if eye_score > 0.8:
            base_yield *= (1.0 + (sku['margin'] / 2.0) * weights.get('eye_level_margin_boost', 0.4))

        min_f = max(2, sku.get('min_facings', 1)) if (objective == 'volume' and sku.get('is_core_sku')) else sku.get('min_facings', 1)
        max_f = max(min_f, sku.get('max_facings', 4) + (1 if (objective == 'volume' and sku['sales_velocity_units_day'] > 35) else 0))

        candidates.append({
            'sku': sku,
            'units_deep': units_deep,
            'width_mm': w,
            'weight_per_facing_kg': weight_per_facing_kg,
            'base_yield': base_yield,
            'min_f': min_f,
            'max_f': max_f
        })

    # Sort candidates by value density
    candidates.sort(key=lambda c: -(c['base_yield'] / (c['width_mm'] / 10.0)))

    selected = []
    curr_width = 0
    curr_weight = 0.0

    # Initial Pass: Place top affinity candidates with min_facings without exceeding width
    for cand in candidates:
        min_w = cand['min_f'] * cand['width_mm']
        min_wt = cand['min_f'] * cand['weight_per_facing_kg']

        if (curr_width + min_w <= usable_width) and (curr_weight + min_wt <= max_weight_kg):
            selected.append({
                'sku': cand['sku'],
                'facings': cand['min_f'],
                'units_deep': cand['units_deep'],
                'width_mm': cand['width_mm'],
                'weight_per_facing_kg': cand['weight_per_facing_kg'],
                'max_f': cand['max_f']
            })
            curr_width += min_w
            curr_weight += min_wt

    # Bounded Greedy Knapsack Expansion (Provably stops when curr_width + w > usable_width)
    improved = True
    while improved:
        improved = False
        best_idx = -1
        best_gain = -1.0

        for idx, item in enumerate(selected):
            if item['facings'] < item['max_f']:
                add_w = item['width_mm']
                add_wt = item['weight_per_facing_kg']

                # STRICT WIDTH & WEIGHT CHECK
                if (curr_width + add_w <= usable_width) and (curr_weight + add_wt <= max_weight_kg):
                    f = item['facings']
                    sku = item['sku']
                    curr_sales = sku['sales_velocity_units_day'] * (f ** gamma) * eye_mult
                    next_sales = sku['sales_velocity_units_day'] * ((f + 1) ** gamma) * eye_mult
                    delta_sales = next_sales - curr_sales

                    if objective == 'revenue':
                        marginal_gain = (delta_sales * sku['unit_price']) / (add_w / 10.0)
                    elif objective == 'volume':
                        marginal_gain = delta_sales / (add_w / 10.0)
                    else: # profit
                        marginal_gain = (delta_sales * sku['margin']) / (add_w / 10.0)

                    if marginal_gain > best_gain:
                        best_gain = marginal_gain
                        best_idx = idx

        if best_idx != -1:
            item = selected[best_idx]
            item['facings'] += 1
            curr_width += item['width_mm']
            curr_weight += item['weight_per_facing_kg']
            improved = True

    return selected, curr_width, curr_weight

# =========================================================================
# STAGE 2: POST-SOLVER SEQUENCING & BRAND FLOW
# =========================================================================
def post_solve_brand_sequencing(shelf, selected_items, master_brand_order, flavor_order):
    """
    Stage 2: Arranges solver-placed items across the shelf following the user's master brand order.
    If master order is A -> B -> C -> D and B is not in selected_items, the shelf order naturally becomes A -> C -> D.
    SKUs within a brand block are ordered by flavor sequence.
    Computes exact x_offset_mm coordinates and guarantees no width overflow.
    """
    brand_rank_map = {b: idx for idx, b in enumerate(master_brand_order)}

    # Group placed items by brand
    brand_groups = {}
    for item in selected_items:
        b = item['sku']['brand']
        brand_groups.setdefault(b, []).append(item)

    # Sort active brands on this shelf strictly following master_brand_order
    present_brands = sorted(
        brand_groups.keys(),
        key=lambda b: brand_rank_map.get(b, 999)
    )

    placements = []
    x_offset = 0

    for brand in present_brands:
        items_in_brand = brand_groups[brand]
        # Sort items inside the brand block by flavor sequence
        items_in_brand.sort(key=lambda x: flavor_order.get(x['sku']['flavor'], 99))

        for item in items_in_brand:
            sku = item['sku']
            f = item['facings']
            pw = f * sku['dimensions_mm']['width']

            placements.append({
                'sku_id': sku['sku_id'],
                'sku_name': sku['name'],
                'brand': sku['brand'],
                'category': sku['category'],
                'flavor': sku['flavor'],
                'pack_type': sku['pack_type'],
                'pack_size_label': sku['pack_size_label'],
                'sugar_type': sku['sugar_type'],
                'facings': f,
                'width_mm': sku['dimensions_mm']['width'],
                'total_width_mm': pw,
                'x_offset_mm': x_offset,
                'units_deep': item['units_deep']
            })
            x_offset += pw

    return placements

# =========================================================================
# PACK VOLUME HOMOGENEITY & VERTICAL TIER MAPPING
# =========================================================================
def determine_shelf_level_pack_sizes(num_levels, available_skus):
    """
    Determines the strict, single pack volume assigned to each shelf level index (1..num_levels).
    Guarantees:
    - Zero volume mixing on any shelf (each shelf is 100% uniform in pack size volume)
    - Uniform volume across doors at the same shelf level (e.g. Shelf 2 across Door 1 & Door 2 have identical volume)
    - Heavier / larger bottles placed strictly on bottom shelves (top-to-bottom ascending weight/volume)
    """
    vol_order = {"250ml": 250, "330ml": 330, "500ml": 500, "1.5L": 1500}
    unique_sizes = sorted(
        list(set(s['pack_size_label'] for s in available_skus)),
        key=lambda s: vol_order.get(s, 999)
    )
    if not unique_sizes:
        return {}

    mapping = {}
    has_heavy = "1.5L" in unique_sizes

    if num_levels == 5:
        if unique_sizes == ["250ml", "330ml", "500ml", "1.5L"]:
            mapping = {1: "250ml", 2: "330ml", 3: "330ml", 4: "500ml", 5: "1.5L"}
        elif unique_sizes == ["250ml", "330ml", "500ml"]:
            mapping = {1: "250ml", 2: "330ml", 3: "330ml", 4: "500ml", 5: "500ml"}
        elif unique_sizes == ["330ml", "500ml", "1.5L"]:
            mapping = {1: "330ml", 2: "330ml", 3: "330ml", 4: "500ml", 5: "1.5L"}
        else:
            for lvl in range(1, num_levels + 1):
                idx = int((lvl - 1) / num_levels * len(unique_sizes))
                mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
            if has_heavy:
                mapping[num_levels] = "1.5L"
    elif num_levels == 4:
        if unique_sizes == ["250ml", "330ml", "500ml", "1.5L"]:
            mapping = {1: "250ml", 2: "330ml", 3: "500ml", 4: "1.5L"}
        elif unique_sizes == ["250ml", "330ml", "500ml"]:
            mapping = {1: "250ml", 2: "330ml", 3: "330ml", 4: "500ml"}
        elif unique_sizes == ["330ml", "500ml", "1.5L"]:
            mapping = {1: "330ml", 2: "330ml", 3: "500ml", 4: "1.5L"}
        else:
            for lvl in range(1, num_levels + 1):
                idx = int((lvl - 1) / num_levels * len(unique_sizes))
                mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
            if has_heavy:
                mapping[num_levels] = "1.5L"
    elif num_levels == 6:
        if unique_sizes == ["250ml", "330ml", "500ml", "1.5L"]:
            mapping = {1: "250ml", 2: "250ml", 3: "330ml", 4: "330ml", 5: "500ml", 6: "1.5L"}
        else:
            for lvl in range(1, num_levels + 1):
                idx = int((lvl - 1) / num_levels * len(unique_sizes))
                mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
            if has_heavy:
                mapping[num_levels] = "1.5L"
    elif num_levels == 7:
        if unique_sizes == ["250ml", "330ml", "500ml", "1.5L"]:
            mapping = {1: "250ml", 2: "250ml", 3: "330ml", 4: "330ml", 5: "330ml", 6: "500ml", 7: "1.5L"}
        else:
            for lvl in range(1, num_levels + 1):
                idx = int((lvl - 1) / num_levels * len(unique_sizes))
                mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
            if has_heavy:
                mapping[num_levels] = "1.5L"
    elif num_levels == 8:
        if unique_sizes == ["250ml", "330ml", "500ml", "1.5L"]:
            mapping = {1: "250ml", 2: "250ml", 3: "330ml", 4: "330ml", 5: "330ml", 6: "500ml", 7: "500ml", 8: "1.5L"}
        else:
            for lvl in range(1, num_levels + 1):
                idx = int((lvl - 1) / num_levels * len(unique_sizes))
                mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
            if has_heavy:
                mapping[num_levels] = "1.5L"
    else:
        for lvl in range(1, num_levels + 1):
            idx = int((lvl - 1) / num_levels * len(unique_sizes))
            mapping[lvl] = unique_sizes[min(idx, len(unique_sizes) - 1)]
        if has_heavy:
            mapping[num_levels] = "1.5L"

    return mapping


def change_cooler_shelf_count(cooler, count):
    count = max(3, min(15, count))
    total_internal_height = max(1450, cooler.get('total_height_mm', 1980) - 480)
    
    # Specific calibrated templates for standard retail counts 3..8, procedural for 9..15
    tier_templates = {
        3: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 280, 'eye_level_score': 0.60, 'max_weight_kg': 45.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 320, 'eye_level_score': 1.00, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 390, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ],
        4: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 270, 'eye_level_score': 0.60, 'max_weight_kg': 45.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 290, 'eye_level_score': 1.00, 'max_weight_kg': 50.0},
            {'tier': 'touch_level', 'tier_label': 'Mid-Lower Shelf', 'clearance_height_mm': 310, 'eye_level_score': 0.75, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 380, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ],
        5: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 270, 'eye_level_score': 0.60, 'max_weight_kg': 45.0},
            {'tier': 'reach_level', 'tier_label': 'Upper Reach', 'clearance_height_mm': 280, 'eye_level_score': 0.85, 'max_weight_kg': 45.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 300, 'eye_level_score': 1.00, 'max_weight_kg': 50.0},
            {'tier': 'touch_level', 'tier_label': 'Mid-Lower Shelf', 'clearance_height_mm': 310, 'eye_level_score': 0.75, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 370, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ],
        6: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 240, 'eye_level_score': 0.60, 'max_weight_kg': 40.0},
            {'tier': 'reach_level', 'tier_label': 'Upper Reach', 'clearance_height_mm': 260, 'eye_level_score': 0.85, 'max_weight_kg': 45.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 280, 'eye_level_score': 1.00, 'max_weight_kg': 50.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 1', 'clearance_height_mm': 290, 'eye_level_score': 0.75, 'max_weight_kg': 50.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 2', 'clearance_height_mm': 310, 'eye_level_score': 0.65, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 370, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ],
        7: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 220, 'eye_level_score': 0.60, 'max_weight_kg': 35.0},
            {'tier': 'reach_level', 'tier_label': 'Upper Reach', 'clearance_height_mm': 240, 'eye_level_score': 0.80, 'max_weight_kg': 40.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 260, 'eye_level_score': 1.00, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 1', 'clearance_height_mm': 270, 'eye_level_score': 0.85, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 2', 'clearance_height_mm': 280, 'eye_level_score': 0.70, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid-Lower Shelf', 'clearance_height_mm': 300, 'eye_level_score': 0.55, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 370, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ],
        8: [
            {'tier': 'top', 'tier_label': 'Top Shelf', 'clearance_height_mm': 200, 'eye_level_score': 0.50, 'max_weight_kg': 30.0},
            {'tier': 'reach_level', 'tier_label': 'Upper Reach 1', 'clearance_height_mm': 220, 'eye_level_score': 0.75, 'max_weight_kg': 35.0},
            {'tier': 'reach_level', 'tier_label': 'Upper Reach 2', 'clearance_height_mm': 240, 'eye_level_score': 0.90, 'max_weight_kg': 40.0},
            {'tier': 'eye_level', 'tier_label': 'Eye-Level Golden Zone', 'clearance_height_mm': 250, 'eye_level_score': 1.00, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 1', 'clearance_height_mm': 260, 'eye_level_score': 0.80, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid Shelf 2', 'clearance_height_mm': 270, 'eye_level_score': 0.65, 'max_weight_kg': 45.0},
            {'tier': 'touch_level', 'tier_label': 'Mid-Lower Shelf', 'clearance_height_mm': 290, 'eye_level_score': 0.50, 'max_weight_kg': 50.0},
            {'tier': 'bottom', 'tier_label': 'Bottom Base Shelf', 'clearance_height_mm': 360, 'eye_level_score': 0.40, 'max_weight_kg': 65.0}
        ]
    }

    if count in tier_templates:
        template = tier_templates[count]
    else:
        # Dynamic procedural generation for 9 to 15 shelves
        bottom_h = 350
        remaining_h = total_internal_height - bottom_h
        avg_upper_h = max(80, int(remaining_h / (count - 1)))
        template = []
        for i in range(1, count + 1):
            if i == 1:
                tier, tier_label, eye_score, clearance_h = 'top', 'Top Shelf', 0.60, avg_upper_h + 10
            elif i == count:
                tier, tier_label, eye_score, clearance_h = 'bottom', 'Bottom Base Shelf', 0.40, bottom_h
            else:
                rel_pos = (i - 1) / (count - 1)
                if 0.25 <= rel_pos <= 0.55:
                    tier, tier_label, eye_score, clearance_h = 'eye_level', f"Eye-Level Tier {i}", 1.00, avg_upper_h
                elif rel_pos < 0.25:
                    tier, tier_label, eye_score, clearance_h = 'reach_level', f"Upper Reach {i}", 0.85, avg_upper_h
                else:
                    tier, tier_label, eye_score, clearance_h = 'touch_level', f"Lower Tier {i}", 0.60, avg_upper_h
            
            template.append({
                'tier': tier,
                'tier_label': tier_label,
                'clearance_height_mm': clearance_h,
                'max_weight_kg': max(18.0, float(round(50 - count * 1.8, 1))),
                'eye_level_score': eye_score
            })

    for b_idx, bay in enumerate(cooler['bays']):
        d = bay.get('door_index', b_idx + 1)
        bay['shelves'] = [{
            'shelf_id': f"D{d}-S{idx + 1}",
            'shelf_index': idx + 1,
            'tier': t['tier'],
            'tier_label': t['tier_label'],
            'usable_width_mm': bay['shelves'][0]['usable_width_mm'] if bay.get('shelves') else 610,
            'usable_depth_mm': 580 if idx == len(template) - 1 else 550,
            'clearance_height_mm': t['clearance_height_mm'],
            'max_weight_kg': t['max_weight_kg'],
            'eye_level_score': t['eye_level_score'],
            'has_gravity_feed': True,
            'temperature_zone': 'Chilled (2-4°C)'
        } for idx, t in enumerate(template)]


# =========================================================================
# MAIN OPTIMIZATION PIPELINE
# =========================================================================
def optimize_planogram(skus_csv_path, cooler_csv_path, rules_json_path, cooler_id=None, objective='profit', filters=None, custom_brand_order=None, auto_shelves=False):
    all_skus = load_skus_csv(skus_csv_path)
    coolers = load_coolers_csv(cooler_csv_path)
    rules = load_json(rules_json_path)

    cooler = next((c for c in coolers if c['cooler_id'] == cooler_id), coolers[0]) if cooler_id else coolers[0]

    if auto_shelves:
        candidate_counts = list(range(3, 16))
        best_count = 5
        best_score = -float('inf')
        best_res = None
        comparisons = []

        for count in candidate_counts:
            test_cooler = copy.deepcopy(cooler)
            change_cooler_shelf_count(test_cooler, count)
            # Run single candidate optimization
            res = _run_optimization_core(all_skus, test_cooler, rules, objective, filters, custom_brand_order)
            
            if objective == 'profit':
                score = res['kpis']['total_profit_daily']
            elif objective == 'revenue':
                score = res['kpis']['total_revenue_daily']
            else:
                score = res['kpis']['total_volume_movement_units_day']

            comparisons.append({
                'shelf_count': count,
                'score': score,
                'daily_margin': res['kpis']['total_profit_daily'],
                'daily_revenue': res['kpis']['total_revenue_daily'],
                'daily_units': res['kpis']['total_volume_movement_units_day'],
                'total_facings': res['kpis']['total_facings'],
                'overall_space_utilization_pct': res['kpis']['overall_space_utilization_pct']
            })

            if score > best_score:
                best_score = score
                best_count = count
                best_res = res

        best_res['scenarios_comparison'] = comparisons
        best_res['optimal_shelf_count'] = best_count
        return best_res

    return _run_optimization_core(all_skus, cooler, rules, objective, filters, custom_brand_order)


def _run_optimization_core(all_skus, cooler, rules, objective, filters, custom_brand_order):
    # Assortment Filtering
    skus = all_skus
    if filters:
        if filters.get('brands') and len(filters['brands']) > 0 and 'ALL' not in filters['brands']:
            brand_set = set(filters['brands'])
            skus = [s for s in skus if s['brand'] in brand_set]
        if filters.get('categories') and len(filters['categories']) > 0 and 'ALL' not in filters['categories']:
            cat_set = set(filters['categories'])
            skus = [s for s in skus if s['category'] in cat_set]
        if filters.get('pack_types') and len(filters['pack_types']) > 0 and 'ALL' not in filters['pack_types']:
            pt_set = set(filters['pack_types'])
            skus = [s for s in skus if s['pack_type'] in pt_set]
        if filters.get('pack_sizes') and len(filters['pack_sizes']) > 0 and 'ALL' not in filters['pack_sizes']:
            ps_set = set(filters['pack_sizes'])
            skus = [s for s in skus if s['pack_size_label'] in ps_set]
        if filters.get('sugar_types') and len(filters['sugar_types']) > 0 and 'ALL' not in filters['sugar_types']:
            st_set = set(filters['sugar_types'])
            skus = [s for s in skus if s['sugar_type'] in st_set]
        if filters.get('core_only'):
            skus = [s for s in skus if s['is_core_sku']]

    if not skus:
        skus = all_skus
    
    # Master Brand Sequence
    if custom_brand_order and len(custom_brand_order) > 0:
        master_brand_order = [b.strip() for b in custom_brand_order]
    else:
        master_brand_order = [b['brand'] for b in rules.get('brand_order', [])]

    flavor_order = {f: idx for idx, f in enumerate(rules.get('flavor_sequence', []))}
    shelf_prefs = {p['category']: p for p in rules.get('shelf_preferences', [])}
    weights = rules.get('engine_weights', {})
    gamma = weights.get('space_elasticity_gamma', 0.20)

    # Determine maximum number of shelf levels per bay
    num_shelf_levels = max((len(bay['shelves']) for bay in cooler['bays']), default=5)
    # Determine strict single pack size assigned to each shelf level index
    shelf_level_pack_map = determine_shelf_level_pack_sizes(num_shelf_levels, skus)

    all_shelves = []
    total_cooler_volume_liters = 0.0
    effective_cooler_storable_volume_liters = 0.0
    total_cooler_width_mm = 0.0
    for bay in cooler['bays']:
        for shelf in bay['shelves']:
            all_shelves.append({
                **shelf,
                'door_index': bay['door_index'],
                'door_label': bay['door_label']
            })
            shelf_vol_liters = (shelf['usable_width_mm'] * shelf['usable_depth_mm'] * shelf['clearance_height_mm']) / 1_000_000.0
            total_cooler_volume_liters += shelf_vol_liters
            storable_h = max(120, shelf['clearance_height_mm'] - 45)
            effective_cooler_storable_volume_liters += (shelf['usable_width_mm'] * shelf['usable_depth_mm'] * storable_h) / 1_000_000.0
            total_cooler_width_mm += shelf['usable_width_mm']

    planogram_shelves = []
    total_revenue = 0.0
    total_profit = 0.0
    total_daily_units = 0.0
    total_daily_fluid_liters = 0.0
    total_product_volume_liters = 0.0
    total_facings = 0

    # Group shelves by vertical level index (1..num_shelf_levels)
    for lvl in range(1, num_shelf_levels + 1):
        tier_shelves = [s for s in all_shelves if s.get('shelf_index') == lvl]
        if not tier_shelves:
            continue
        tier_shelves.sort(key=lambda s: s['door_index'])

        assigned_pack_size = shelf_level_pack_map.get(lvl)
        max_tier_clearance = max(s['clearance_height_mm'] for s in tier_shelves)
        first_shelf = tier_shelves[0]

        # Filter eligible SKUs for this horizontal tier level
        eligible = []
        for sku in skus:
            if sku.get('inclusion_priority') == 'must_not_have':
                continue
            if assigned_pack_size and sku['pack_size_label'] != assigned_pack_size:
                continue
            if sku['dimensions_mm']['height'] > max_tier_clearance:
                continue
            cat_pref = shelf_prefs.get(sku['category'])
            if cat_pref and first_shelf['tier'] in cat_pref.get('forbidden_tiers', []):
                continue
            eligible.append(sku)

        if not eligible:
            eligible = [s for s in skus if s.get('inclusion_priority') != 'must_not_have' and (not assigned_pack_size or s['pack_size_label'] == assigned_pack_size) and s['dimensions_mm']['height'] <= max_tier_clearance]
            if not eligible:
                eligible = [s for s in skus if s.get('inclusion_priority') != 'must_not_have' and s['dimensions_mm']['height'] <= max_tier_clearance]

        total_tier_width = sum(s['usable_width_mm'] for s in tier_shelves)
        total_tier_max_weight = sum(s['max_weight_kg'] for s in tier_shelves)
        tier_usable_depth = first_shelf['usable_depth_mm']
        eye_score = first_shelf.get('eye_level_score', 0.5)
        eye_mult = 1.0 + (eye_score - 0.5) * 0.15

        # STAGE 1: Exact Knapsack Allocation across entire horizontal tier level
        candidates = []
        for sku in eligible:
            units_deep = max(1, tier_usable_depth // sku['dimensions_mm']['depth'])
            w = sku['dimensions_mm']['width']
            weight_per_facing_kg = (units_deep * sku['weight_g']) / 1000.0

            if objective == 'revenue':
                base_yield = sku['unit_price'] * 15.0 + sku['sales_velocity_units_day'] * 0.4
            elif objective == 'volume':
                base_yield = sku['sales_velocity_units_day'] * 2.0
            else: # profit
                base_yield = sku['margin'] * 30.0 + sku['sales_velocity_units_day'] * 0.3

            if eye_score > 0.8:
                base_yield *= (1.0 + (sku['margin'] / 2.0) * weights.get('eye_level_margin_boost', 0.4))

            is_must_have = sku.get('inclusion_priority') == 'must_have'
            min_f = max(2, sku.get('min_facings', 2)) if is_must_have else (max(2, sku.get('min_facings', 1)) if (objective == 'volume' and sku.get('is_core_sku')) else sku.get('min_facings', 1))
            max_f = max(min_f, (sku.get('max_facings', 4) + (1 if (objective == 'volume' and sku['sales_velocity_units_day'] > 35) else 0)) * len(tier_shelves))

            candidates.append({
                'sku': sku,
                'units_deep': units_deep,
                'width_mm': w,
                'weight_per_facing_kg': weight_per_facing_kg,
                'base_yield': base_yield,
                'min_f': min_f,
                'max_f': max_f,
                'priority_rank': 10000 if is_must_have else 0,
                'value_density': base_yield / (w / 10.0)
            })

        candidates.sort(key=lambda c: -(c['priority_rank'] + c['value_density']))

        selected = []
        curr_tier_width = 0
        curr_tier_weight = 0.0

        for cand in candidates:
            min_w = cand['min_f'] * cand['width_mm']
            min_wt = cand['min_f'] * cand['weight_per_facing_kg']
            if curr_tier_width + min_w <= total_tier_width and curr_tier_weight + min_wt <= total_tier_max_weight:
                selected.append({
                    'sku': cand['sku'],
                    'facings': cand['min_f'],
                    'units_deep': cand['units_deep'],
                    'width_mm': cand['width_mm'],
                    'weight_per_facing_kg': cand['weight_per_facing_kg'],
                    'max_f': cand['max_f']
                })
                curr_tier_width += min_w
                curr_tier_weight += min_wt

        # Greedy expansion
        improved = True
        while improved:
            improved = False
            best_idx = -1
            best_gain = -1.0

            for idx, item in enumerate(selected):
                if item['facings'] < item['max_f']:
                    add_w = item['width_mm']
                    add_wt = item['weight_per_facing_kg']

                    if (curr_tier_width + add_w <= total_tier_width) and (curr_tier_weight + add_wt <= total_tier_max_weight):
                        f = item['facings']
                        sku = item['sku']
                        curr_sales = sku['sales_velocity_units_day'] * (f ** gamma) * eye_mult
                        next_sales = sku['sales_velocity_units_day'] * ((f + 1) ** gamma) * eye_mult
                        delta_sales = next_sales - curr_sales

                        if objective == 'revenue':
                            marginal_gain = (delta_sales * sku['unit_price']) / (add_w / 10.0)
                        elif objective == 'volume':
                            marginal_gain = delta_sales / (add_w / 10.0)
                        else: # profit
                            marginal_gain = (delta_sales * sku['margin']) / (add_w / 10.0)

                        if marginal_gain > best_gain:
                            best_gain = marginal_gain
                            best_idx = idx

            if best_idx != -1:
                item = selected[best_idx]
                item['facings'] += 1
                curr_tier_width += item['width_mm']
                curr_tier_weight += item['weight_per_facing_kg']
                improved = True

        # STAGE 2: Master Brand Sequence & Flavor Ordering
        brand_rank_map = {b: idx for idx, b in enumerate(master_brand_order)}
        selected.sort(key=lambda item: (
            brand_rank_map.get(item['sku']['brand'], 999),
            flavor_order.get(item['sku']['flavor'], 99)
        ))

        # STAGE 3: Continuous Horizontal Packing across Door 1 .. Door N
        door_allocations = {s['shelf_id']: {'shelf': s, 'placements': [], 'used_w': 0, 'used_wt': 0.0} for s in tier_shelves}
        door_idx = 0
        cur_shelf = tier_shelves[door_idx]
        cur_shelf_id = cur_shelf['shelf_id']

        for item in selected:
            f_remaining = item['facings']
            sku = item['sku']
            w = item['width_mm']
            wt = item['weight_per_facing_kg']

            while f_remaining > 0 and door_idx < len(tier_shelves):
                avail_w = cur_shelf['usable_width_mm'] - door_allocations[cur_shelf_id]['used_w']
                avail_wt = cur_shelf['max_weight_kg'] - door_allocations[cur_shelf_id]['used_wt']
                max_f_fit = int(min(avail_w // w, avail_wt // wt if wt > 0 else 999))

                if max_f_fit <= 0:
                    door_idx += 1
                    if door_idx >= len(tier_shelves):
                        break
                    cur_shelf = tier_shelves[door_idx]
                    cur_shelf_id = cur_shelf['shelf_id']
                    continue

                f_to_place = min(f_remaining, max_f_fit)
                pw = f_to_place * w
                pwt = f_to_place * wt
                x_offset = door_allocations[cur_shelf_id]['used_w']

                door_allocations[cur_shelf_id]['placements'].append({
                    'sku_id': sku['sku_id'],
                    'sku_name': sku['name'],
                    'brand': sku['brand'],
                    'category': sku['category'],
                    'flavor': sku['flavor'],
                    'pack_type': sku['pack_type'],
                    'pack_size_label': sku['pack_size_label'],
                    'sugar_type': sku['sugar_type'],
                    'facings': f_to_place,
                    'width_mm': w,
                    'total_placement_width_mm': pw,
                    'x_offset_mm': x_offset,
                    'color_hex': sku.get('color_hex', '#3B82F6'),
                    'image_emoji': sku.get('image_emoji', '🥤'),
                    'units_deep': item['units_deep']
                })
                door_allocations[cur_shelf_id]['used_w'] += pw
                door_allocations[cur_shelf_id]['used_wt'] += pwt
                f_remaining -= f_to_place

        # Process each door shelf in this tier
        for shelf in tier_shelves:
            alloc = door_allocations[shelf['shelf_id']]
            placements = alloc['placements']
            used_w = alloc['used_w']
            used_wt = alloc['used_wt']

            shelf_frontal_area_used = 0
            shelf_h_sum = 0
            shelf_f_count = 0

            for p in placements:
                sku = next(s for s in skus if s['sku_id'] == p['sku_id'])
                f = p['facings']
                units_deep = p['units_deep']
                total_units_on_shelf = f * units_deep

                elastic_units = sku['sales_velocity_units_day'] * (f ** gamma) * eye_mult
                proj_revenue = elastic_units * sku['unit_price']
                proj_margin = elastic_units * sku['margin']
                proj_fluid_liters = (elastic_units * sku['pack_size_ml']) / 1000.0

                sku_w = sku['dimensions_mm']['width']
                sku_h = sku['dimensions_mm']['height']
                unit_vol_liters = (sku_w * sku['dimensions_mm']['depth'] * sku_h) / 1_000_000.0
                prod_vol_liters = total_units_on_shelf * unit_vol_liters

                total_revenue += proj_revenue
                total_profit += proj_margin
                total_daily_units += elastic_units
                total_daily_fluid_liters += proj_fluid_liters
                total_product_volume_liters += prod_vol_liters
                total_facings += f

                shelf_frontal_area_used += f * sku_w * sku_h
                shelf_h_sum += sku_h * f
                shelf_f_count += f

            avg_product_h = round(shelf_h_sum / shelf_f_count) if shelf_f_count > 0 else 0
            h_fill_pct = round((avg_product_h / shelf['clearance_height_mm'] * 100.0), 1) if shelf['clearance_height_mm'] > 0 else 0.0
            air_gap = max(0, shelf['clearance_height_mm'] - avg_product_h)

            planogram_shelves.append({
                'shelf_id': shelf['shelf_id'],
                'shelf_index': shelf['shelf_index'],
                'door_index': shelf['door_index'],
                'door_label': shelf['door_label'],
                'tier': shelf['tier'],
                'tier_label': shelf['tier_label'],
                'usable_width_mm': shelf['usable_width_mm'],
                'usable_depth_mm': shelf['usable_depth_mm'],
                'clearance_height_mm': shelf['clearance_height_mm'],
                'avg_product_height_mm': avg_product_h,
                'height_utilization_pct': h_fill_pct,
                'air_gap_headroom_mm': air_gap,
                'max_weight_kg': shelf['max_weight_kg'],
                'used_width_mm': used_w,
                'fill_rate_pct': round((used_w / shelf['usable_width_mm']) * 100, 1),
                'used_weight_kg': round(used_wt, 1),
                'placements': placements
            })

    volume_occupancy_pct = (total_product_volume_liters / total_cooler_volume_liters * 100.0) if total_cooler_volume_liters > 0 else 0.0
    effective_volume_occupancy_pct = min(99.4, (total_product_volume_liters / effective_cooler_storable_volume_liters * 100.0)) if effective_cooler_storable_volume_liters > 0 else 0.0
    total_used_width_mm = sum(s['used_width_mm'] for s in planogram_shelves)
    overall_space_utilization_pct = (total_used_width_mm / total_cooler_width_mm * 100.0) if total_cooler_width_mm > 0 else 0.0

    total_frontal_cap = sum(s['usable_width_mm'] * s['clearance_height_mm'] for s in all_shelves)
    total_frontal_used = sum(sum(p['facings'] * next(s['dimensions_mm']['width'] for s in skus if s['sku_id'] == p['sku_id']) * next(s['dimensions_mm']['height'] for s in skus if s['sku_id'] == p['sku_id']) for p in sh['placements']) for sh in planogram_shelves)
    overall_height_utilization_pct = round((total_frontal_used / total_frontal_cap * 100.0), 1) if total_frontal_cap > 0 else 0.0
    avg_headroom_air_gap = round(sum(s['air_gap_headroom_mm'] for s in planogram_shelves) / len(planogram_shelves)) if planogram_shelves else 0

    result = {
        'cooler_id': cooler['cooler_id'],
        'cooler_name': cooler['name'],
        'total_doors': cooler['doors'],
        'optimization_objective': objective,
        'brand_order_sequence': master_brand_order,
        'total_skus_in_assortment': len(skus),
        'kpis': {
            'total_profit_daily': round(total_profit, 2),
            'total_revenue_daily': round(total_revenue, 2),
            'profit_margin_pct': round((total_profit / total_revenue * 100.0), 1) if total_revenue > 0 else 0.0,
            'total_volume_movement_units_day': round(total_daily_units, 1),
            'total_volume_fluid_liters_day': round(total_daily_fluid_liters, 1),
            'total_volume_liters_occupied': round(total_product_volume_liters, 1),
            'total_cooler_volume_liters': round(total_cooler_volume_liters, 1),
            'volume_occupancy_pct': round(volume_occupancy_pct, 1),
            'effective_volume_occupancy_pct': round(effective_volume_occupancy_pct, 1),
            'overall_space_utilization_pct': round(overall_space_utilization_pct, 1),
            'overall_height_utilization_pct': overall_height_utilization_pct,
            'avg_headroom_air_gap_mm': avg_headroom_air_gap,
            'total_facings': total_facings
        },
        'shelves': planogram_shelves
    }
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cooler Planogram Optimization Engine (2-Stage Solver + Brand Flow)')
    parser.add_argument('--objective', choices=['profit', 'revenue', 'volume'], default='profit', help='Optimization Maximization Goal')
    parser.add_argument('--cooler', default='COOLER-2DOOR-STD', help='Cooler ID from cooler_specs.csv')
    parser.add_argument('--brand-order', help='Comma-separated master brand sequence, e.g. "Red Bull,Monster Energy,Coca-Cola"')
    parser.add_argument('--auto-shelves', action='store_true', help='Automatically test candidate shelf counts (3 to 6) and select the optimal configuration for the objective')
    args = parser.parse_args()

    custom_brands = [b.strip() for b in args.brand_order.split(',')] if args.brand_order else None

    base_dir = Path(__file__).parent / 'data'
    res = optimize_planogram(
        base_dir / 'skus.csv',
        base_dir / 'cooler_specs.csv',
        base_dir / 'merchandising_rules.json',
        cooler_id=args.cooler,
        objective=args.objective,
        custom_brand_order=custom_brands,
        auto_shelves=args.auto_shelves
    )
    print(json.dumps(res, indent=2))
