/**
 * Cooler Planogram Optimizer
 * Implements mathematical space optimization, brand blocking, adjacency sequencing,
 * and multi-constraint satisfaction for retail beverage coolers.
 */

import { PlanogramValidator } from './validator.js';
import { PlanogramAnalytics } from './analytics.js';

export class PlanogramOptimizer {
  constructor(skus, coolerSpecs, rules) {
    this.skus = skus;
    this.coolerSpecs = coolerSpecs;
    this.rules = rules;
    this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
  }

  /**
   * Runs the complete optimization workflow
   * @param {string} coolerId - Selected cooler ID (defaults to first available)
   * @param {Object} options - Override parameters or custom weights
   * @returns {Object} Optimized planogram with validation and analytics
   */
  optimize(coolerId = null, options = {}) {
    const cooler = (coolerId ? this.coolerSpecs.find(c => c.cooler_id === coolerId) : null) || this.coolerSpecs[0];
    const rules = { ...this.rules, ...(options.rulesOverride || {}) };
    const weights = rules.engine_weights || {
      profit_weight: 1.0,
      velocity_weight: 0.8,
      eye_level_margin_boost: 0.4,
      space_elasticity_gamma: 0.20
    };

    // Flatten all shelves with door metadata
    const allShelves = cooler.bays.flatMap(bay => 
      bay.shelves.map(shelf => ({
        ...shelf,
        door_index: bay.door_index,
        door_label: bay.door_label
      }))
    );

    // Build brand priority & adjacency lookup
    const brandOrderList = rules.brand_order || [];
    const brandPriorityMap = new Map(brandOrderList.map((b, idx) => [b.brand, { ...b, priority_rank: idx + 1 }]));
    const flavorOrder = rules.flavor_sequence || ["Original", "Zero Sugar", "Diet", "Cherry", "Citrus", "Berry", "Tropical"];
    const flavorRankMap = new Map(flavorOrder.map((f, idx) => [f, idx]));

    // Build category preference lookup
    const categoryPrefMap = new Map((rules.shelf_preferences || []).map(p => [p.category, p]));

    // Step 1: Assign SKUs to their ideal shelf candidates
    const shelfSkuCandidates = new Map(); // shelf_id -> Array of candidate SKUs with affinity score
    for (const shelf of allShelves) {
      shelfSkuCandidates.set(shelf.shelf_id, []);
    }

    for (const sku of this.skus) {
      const brandInfo = brandPriorityMap.get(sku.brand);
      const catPref = categoryPrefMap.get(sku.category);

      for (const shelf of allShelves) {
        // Physical height check
        if (sku.dimensions_mm.height > shelf.clearance_height_mm) {
          continue; // Cannot fit physically
        }

        // Category forbidden check
        if (catPref && catPref.forbidden_tiers && catPref.forbidden_tiers.includes(shelf.tier)) {
          continue;
        }

        // Strict / Strong Door preference check
        let doorAffinity = 1.0;
        if (brandInfo && brandInfo.preferred_doors && brandInfo.preferred_doors.length > 0) {
          if (brandInfo.preferred_doors.includes(shelf.door_index)) {
            doorAffinity = 2.5;
          } else {
            doorAffinity = 0.05; // heavily discourage crossing into non-preferred door
          }
        }

        // Tier preference score
        let tierAffinity = 1.0;
        if (catPref && catPref.preferred_tiers) {
          if (catPref.preferred_tiers.includes(shelf.tier)) {
            tierAffinity = 2.0 * (catPref.priority_weight || 1.0);
          } else {
            tierAffinity = 0.3;
          }
        }

        // High margin boost at eye-level
        let marginEyeBoost = 1.0;
        if (shelf.eye_level_score > 0.8) {
          marginEyeBoost = 1.0 + (sku.margin / 2.0) * weights.eye_level_margin_boost;
        }

        // Overall SKU-to-shelf affinity score
        const score = (sku.sales_velocity_units_day * weights.velocity_weight + sku.margin * 35 * weights.profit_weight)
          * doorAffinity
          * tierAffinity
          * marginEyeBoost;

        if (doorAffinity >= 0.1) {
          shelfSkuCandidates.get(shelf.shelf_id).push({
            sku,
            affinityScore: score,
            brandPriority: brandInfo ? brandInfo.priority_rank : 99,
            flavorRank: flavorRankMap.has(sku.flavor) ? flavorRankMap.get(sku.flavor) : 99
          });
        }
      }
    }

    // Step 2: Shelf-by-Shelf Facing Allocation & Knapsack Optimization
    const planogramShelves = [];

    for (const shelf of allShelves) {
      let candidates = shelfSkuCandidates.get(shelf.shelf_id) || [];
      
      // If no candidates matched due to door filtering, fallback to all feasible SKUs
      if (candidates.length === 0) {
        candidates = this.skus
          .filter(s => s.dimensions_mm.height <= shelf.clearance_height_mm)
          .map(sku => ({
            sku,
            affinityScore: sku.sales_velocity_units_day * sku.margin,
            brandPriority: brandPriorityMap.get(sku.brand)?.priority_rank || 99,
            flavorRank: flavorRankMap.has(sku.flavor) ? flavorRankMap.get(sku.flavor) : 99
          }));
      }

      // Sort candidates by brand grouping and affinity score
      candidates.sort((a, b) => {
        if (a.brandPriority !== b.brandPriority) return a.brandPriority - b.brandPriority;
        if (a.sku.brand !== b.sku.brand) return a.sku.brand.localeCompare(b.sku.brand);
        if (a.flavorRank !== b.flavorRank) return a.flavorRank - b.flavorRank;
        return b.affinityScore - a.affinityScore;
      });

      const selectedSkus = [];
      let currentWidth = 0;
      let currentWeightKg = 0;

      // First pass: Allocate min_facings to highest affinity SKUs
      for (const cand of candidates) {
        const sku = cand.sku;
        const requiredWidth = sku.min_facings * sku.dimensions_mm.width;
        const unitsDeep = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
        const requiredWeightKg = (sku.min_facings * unitsDeep * sku.weight_g) / 1000.0;

        if (currentWidth + requiredWidth <= shelf.usable_width_mm &&
            currentWeightKg + requiredWeightKg <= shelf.max_weight_kg) {
          
          selectedSkus.push({
            sku,
            facings: sku.min_facings,
            affinityScore: cand.affinityScore,
            brandPriority: cand.brandPriority,
            flavorRank: cand.flavorRank,
            unitsDeep
          });

          currentWidth += requiredWidth;
          currentWeightKg += requiredWeightKg;
        }
      }

      // Second pass: Marginal Space Elasticity Greedy Expansion
      let improved = true;
      while (improved) {
        improved = false;
        let bestCandidateIndex = -1;
        let highestMarginalYield = -1;

        for (let i = 0; i < selectedSkus.length; i++) {
          const item = selectedSkus[i];
          const sku = item.sku;

          if (item.facings < sku.max_facings) {
            const addedWidth = sku.dimensions_mm.width;
            const addedWeightKg = (item.unitsDeep * sku.weight_g) / 1000.0;

            if (currentWidth + addedWidth <= shelf.usable_width_mm &&
                currentWeightKg + addedWeightKg <= shelf.max_weight_kg) {

              const currentYield = sku.sales_velocity_units_day * Math.pow(item.facings, weights.space_elasticity_gamma) * sku.margin;
              const nextYield = sku.sales_velocity_units_day * Math.pow(item.facings + 1, weights.space_elasticity_gamma) * sku.margin;
              const marginalYield = (nextYield - currentYield) / (addedWidth / 10.0);

              if (marginalYield > highestMarginalYield) {
                highestMarginalYield = marginalYield;
                bestCandidateIndex = i;
              }
            }
          }
        }

        if (bestCandidateIndex !== -1) {
          const item = selectedSkus[bestCandidateIndex];
          item.facings += 1;
          currentWidth += item.sku.dimensions_mm.width;
          currentWeightKg += (item.unitsDeep * item.sku.weight_g) / 1000.0;
          improved = true;
        }
      }

      // Step 3: Horizontal Sequencing - Brand Blocking & Adjacency Path
      const brandGroups = new Map();
      for (const item of selectedSkus) {
        if (!brandGroups.has(item.sku.brand)) {
          brandGroups.set(item.sku.brand, []);
        }
        brandGroups.get(item.sku.brand).push(item);
      }

      // Order brand groups according to brand priority
      const sortedBrands = Array.from(brandGroups.keys()).sort((b1, b2) => {
        const p1 = brandPriorityMap.get(b1)?.priority_rank || 99;
        const p2 = brandPriorityMap.get(b2)?.priority_rank || 99;
        return p1 - p2;
      });

      // Within each brand group, sort by flavor sequence
      const finalPlacements = [];
      let xOffsetMm = 0;

      for (const brand of sortedBrands) {
        const brandItems = brandGroups.get(brand);
        brandItems.sort((a, b) => a.flavorRank - b.flavorRank);

        for (const item of brandItems) {
          const placementWidth = item.facings * item.sku.dimensions_mm.width;
          finalPlacements.push({
            sku_id: item.sku.sku_id,
            sku_name: item.sku.name,
            brand: item.sku.brand,
            flavor: item.sku.flavor,
            category: item.sku.category,
            facings: item.facings,
            width_mm: item.sku.dimensions_mm.width,
            height_mm: item.sku.dimensions_mm.height,
            depth_mm: item.sku.dimensions_mm.depth,
            weight_g: item.sku.weight_g,
            unit_price: item.sku.unit_price,
            margin: item.sku.margin,
            sales_velocity: item.sku.sales_velocity_units_day,
            total_placement_width_mm: placementWidth,
            x_offset_mm: xOffsetMm,
            color_hex: item.sku.color_hex,
            image_emoji: item.sku.image_emoji
          });
          xOffsetMm += placementWidth;
        }
      }

      planogramShelves.push({
        shelf_id: shelf.shelf_id,
        shelf_index: shelf.shelf_index,
        door_index: shelf.door_index,
        door_label: shelf.door_label,
        tier: shelf.tier,
        tier_label: shelf.tier_label,
        usable_width_mm: shelf.usable_width_mm,
        usable_depth_mm: shelf.usable_depth_mm,
        clearance_height_mm: shelf.clearance_height_mm,
        max_weight_kg: shelf.max_weight_kg,
        placements: finalPlacements
      });
    }

    const planogram = {
      planogram_id: `PLANO-${cooler.cooler_id}-${Date.now().toString(36).toUpperCase()}`,
      cooler_id: cooler.cooler_id,
      cooler_name: cooler.name,
      doors: cooler.doors,
      timestamp: new Date().toISOString(),
      shelves: planogramShelves
    };

    // Run Validation and Analytics
    const validator = new PlanogramValidator(this.skus, this.coolerSpecs, rules);
    const validation = validator.validate(planogram);

    const analyticsEngine = new PlanogramAnalytics(this.skus, this.coolerSpecs, rules);
    const analytics = analyticsEngine.computeAnalytics(planogram);

    return {
      planogram,
      validation,
      analytics
    };
  }
}
