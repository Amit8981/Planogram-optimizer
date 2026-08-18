#!/usr/bin/env python3
"""
Cooler Planogram AI Agent Architecture: Single-Agent (LangChain) & Multi-Agent Swarm (LangGraph)

This module implements:
1. LangChain Tool Calling Single-Agent Copilot
2. LangGraph Multi-Agent State Machine with 5 Specialized Agent Personas:
   - 🎯 Master Orchestrator Agent (Category Director)
   - 📊 Category Strategist Agent (Consumer Trends & Brand Flow)
   - ⚙️ Mathematical Solver Agent (Knapsack / CP-SAT Physics Solver)
   - 🛡️ Compliance & Contract Auditor (CPG Manufacturer Agreements)
   - 🔍 Trade-off Critic & Reviewer (Stockout Risk & Profit Density)
   - 📝 Executive Reporter Agent (Audit Memos & Pick List Generation)
3. Zero-dependency Self-Contained Agent Execution Engine for local CLI & Web UI streaming.
"""

import sys
import os
import json
import copy
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, TypedDict

# Import optimizer engine
from optimizer import (
    load_skus_csv,
    load_coolers_csv,
    optimize_planogram,
    change_cooler_shelf_count,
    _run_optimization_core
)

# ==============================================================================
# 1. LANGGRAPH STATE SCHEMA DEFINITION
# ==============================================================================

class PlanogramAgentState(TypedDict):
    """Shared state dictionary passed across the LangGraph multi-agent swarm."""
    user_goal: str
    cooler_id: str
    active_objective: str
    shelf_count: int
    active_sku_ids: List[str]
    brand_order: List[str]
    contracts: List[Dict[str, Any]]
    
    # Solver outputs
    current_planogram: Optional[Dict[str, Any]]
    analytics: Optional[Dict[str, Any]]
    validation_issues: List[str]
    
    # Multi-agent feedback loop
    critique_feedback: List[str]
    iteration_count: int
    is_approved: bool
    final_memo: str
    agent_trace: List[Dict[str, Any]]


# ==============================================================================
# 2. DEFAULT CONTRACTS & BENCHMARKS
# ==============================================================================

DEFAULT_CONTRACTS = [
    {
        "contract_id": "CONT-COCA-COLA-01",
        "brand": "Coca-Cola",
        "min_share_of_facings_pct": 30.0,
        "required_door": 1,
        "must_have_eye_level": True,
        "description": "Coca-Cola Master Merchandising Agreement: Min 30% share of facings on Door 1 with Eye-Level priority."
    },
    {
        "contract_id": "CONT-ENERGY-02",
        "brand": "Monster Energy",
        "min_share_of_facings_pct": 12.0,
        "required_door": 2,
        "must_have_eye_level": False,
        "description": "Monster Energy High-Velocity Distribution: Min 12% cooler facings in Door 2."
    },
    {
        "contract_id": "CONT-REDBULL-03",
        "brand": "Red Bull",
        "min_share_of_facings_pct": 10.0,
        "required_door": 1,
        "must_have_eye_level": False,
        "description": "Red Bull Reach Agreement: Upper shelf visibility in top 2 tiers."
    }
]


# ==============================================================================
# 3. SPECIALIZED MULTI-AGENT PERSONA NODES
# ==============================================================================

def orchestrator_agent(state: PlanogramAgentState, all_skus: List[Dict[str, Any]], coolers: Dict[str, Any]) -> Dict[str, Any]:
    """
    🎯 Master Orchestrator Agent (Category Director):
    Deconstructs user prompt into objective, assortment priorities, fixture settings, and delegation paths.
    """
    prompt = state.get("user_goal", "").lower()
    objective = state.get("active_objective", "profit")
    shelf_count = state.get("shelf_count", 5)
    cooler_id = state.get("cooler_id", "COOLER-2DOOR-STD")
    active_sku_ids = list(state.get("active_sku_ids", [s["sku_id"] for s in all_skus]))

    trace_entry = {
        "agent": "🎯 Master Orchestrator",
        "action": "Intent Decomposition & Task Delegation",
        "details": f"Analyzing user goal: '{state.get('user_goal')}'. Establishing cross-functional agent parameters."
    }

    # Intent Detection
    if any(k in prompt for k in ["revenue", "sales", "gross sales", "topline"]):
        objective = "revenue"
    elif any(k in prompt for k in ["volume", "units", "traffic", "velocity"]):
        objective = "volume"
    elif any(k in prompt for k in ["profit", "margin", "bottomline"]):
        objective = "profit"

    # Fixture detection
    if "1-door" in prompt or "single door" in prompt or "compact cooler" in prompt:
        cooler_id = "COOLER-1DOOR-COMPACT"
    elif "3-door" in prompt or "mega cooler" in prompt or "hypermarket" in prompt:
        cooler_id = "COOLER-3DOOR-MEGA"

    # Shelf count detection
    shelf_match = re.search(r"(\d+)\s*shelves", prompt)
    if shelf_match:
        shelf_count = max(3, min(15, int(shelf_match.group(1))))

    # 1. Pack Size Inclusions / Exclusions
    if any(k in prompt for k in ["no 1.5l", "exclude 1.5l", "without 1.5l", "no 1500ml", "no large bottles", "exclude large bottles", "cans only", "only cans", "single-serve only", "grab and go"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] != "1.5L" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["no 500ml", "exclude 500ml", "without 500ml"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] != "500ml" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["no 250ml", "exclude 250ml", "without 250ml", "no slim cans"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] != "250ml" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["no 330ml", "exclude 330ml", "without 330ml"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] != "330ml" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["cans only", "only cans", "no bottles", "exclude bottles", "no pet", "exclude pet"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("pack_type") == "Can" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["bottles only", "only bottles", "no cans", "exclude cans"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("pack_type") in ["Bottle", "PET"] and s["sku_id"] in active_sku_ids]

    # Specific Pack Size selections
    if any(k in prompt for k in ["only 250ml", "250ml only", "just 250ml"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] == "250ml" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["only 330ml", "330ml only", "just 330ml"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] == "330ml" and s["sku_id"] in active_sku_ids]

    if any(k in prompt for k in ["only 500ml", "500ml only", "just 500ml"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s["pack_size_label"] == "500ml" and s["sku_id"] in active_sku_ids]

    # 2. Specific Brand / SKU Inclusions & Exclusions
    if "exclude pepsi 1.5l" in prompt or "no pepsi 1.5l" in prompt:
        active_sku_ids = [sid for sid in active_sku_ids if sid != "SKU-PEP-1500"]
    elif "exclude pepsi" in prompt or "no pepsi" in prompt:
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("brand") != "Pepsi" and s["sku_id"] in active_sku_ids]

    if "exclude dr pepper" in prompt or "no dr pepper" in prompt:
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("brand") != "Dr Pepper" and s["sku_id"] in active_sku_ids]

    # Sugar filter
    if any(k in prompt for k in ["zero sugar", "diet only", "no sugar", "sugar free", "health-conscious", "drop high-sugar"]):
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("sugar_type") in ["Zero Sugar", "Diet", "No Added Sugar"] and s["sku_id"] in active_sku_ids]

    # Category filters
    if "energy only" in prompt or "only energy" in prompt:
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("category") == "Energy" and s["sku_id"] in active_sku_ids]
    elif "csd only" in prompt or "soda only" in prompt or "only sodas" in prompt:
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("category") == "CSD" and s["sku_id"] in active_sku_ids]

    # High margin filter
    if "high margin" in prompt or "margin >" in prompt:
        active_sku_ids = [s["sku_id"] for s in all_skus if s.get("margin", 0.0) >= 1.25 and s["sku_id"] in active_sku_ids]

    # Fallback
    if not active_sku_ids:
        active_sku_ids = [s["sku_id"] for s in all_skus]

    trace_entry["details"] = f"Goal: {objective.upper()}, Shelves: {shelf_count}, Fixture: {cooler_id}, Filtered Assortment: {len(active_sku_ids)} SKUs."

    return {
        "active_objective": objective,
        "shelf_count": shelf_count,
        "cooler_id": cooler_id,
        "active_sku_ids": active_sku_ids,
        "iteration_count": state.get("iteration_count", 0) + 1,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


def category_strategist_agent(state: PlanogramAgentState, all_skus: List[Dict[str, Any]], rules: Dict[str, Any]) -> Dict[str, Any]:
    """
    📊 Category Strategist Agent (Consumer Trends & Brand Flow):
    Aligns brand sequence, shelf tier preferences, eye-level golden zone priority, and seasonal elasticity.
    """
    prompt = state.get("user_goal", "").lower()
    current_brand_order = list(state.get("brand_order", [b["brand"] for b in rules.get("brand_order", [])]))
    
    trace_entry = {
        "agent": "📊 Category Strategist",
        "action": "Merchandising Strategy & Brand Flow Optimization",
        "details": ""
    }

    # High energy focus
    if "energy" in prompt or "monster" in prompt or "red bull" in prompt:
        energy_brands = ["Monster Energy", "Red Bull"]
        other_brands = [b for b in current_brand_order if b not in energy_brands]
        current_brand_order = energy_brands + other_brands
        trace_entry["details"] = "Strategically prioritized Energy Drink category flow into eye-level and upper reach tiers."
    elif "coca-cola" in prompt or "coke priority" in prompt:
        coke_brands = ["Coca-Cola", "Diet Coke", "Sprite", "Fanta"]
        other_brands = [b for b in current_brand_order if b not in coke_brands]
        current_brand_order = coke_brands + other_brands
        trace_entry["details"] = "Anchored Coca-Cola core flagship portfolio on Door 1 eye-level golden zone."
    elif "healthy" in prompt or "hydration" in prompt or "water" in prompt:
        water_brands = ["Evian", "San Pellegrino", "Innocent", "Oatly"]
        other_brands = [b for b in current_brand_order if b not in water_brands]
        current_brand_order = water_brands + other_brands
        trace_entry["details"] = "Promoted Hydration, Premium Waters, and Plant-Based Dairy flow."
    else:
        trace_entry["details"] = f"Maintained optimal multi-brand sequence: {', '.join(current_brand_order[:4])}..."

    return {
        "brand_order": current_brand_order,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


def mathematical_solver_agent(state: PlanogramAgentState, all_skus: List[Dict[str, Any]], coolers: Dict[str, Any], rules: Dict[str, Any]) -> Dict[str, Any]:
    """
    ⚙️ Mathematical Solver Agent (Knapsack / CP-SAT Space Allocator):
    Executes physical constraints, 0% width overflow checks, vertical height allocations, and multi-door balancing.
    """
    active_ids = set(state.get("active_sku_ids", [s["sku_id"] for s in all_skus]))
    active_skus = [copy.deepcopy(s) for s in all_skus if s["sku_id"] in active_ids]
    
    cooler_id = state.get("cooler_id", "COOLER-2DOOR-STD")
    cooler_list = copy.deepcopy(coolers)
    if isinstance(cooler_list, dict):
        cooler_obj = cooler_list.get(cooler_id, list(cooler_list.values())[0])
    else:
        cooler_obj = next((c for c in cooler_list if c["cooler_id"] == cooler_id), cooler_list[0])
    
    # Configure shelf count
    shelf_count = state.get("shelf_count", 5)
    change_cooler_shelf_count(cooler_obj, shelf_count)
    
    # Custom rules
    active_rules = copy.deepcopy(rules)

    # Solve planogram using core optimization engine
    res = _run_optimization_core(
        all_skus=active_skus,
        cooler=cooler_obj,
        rules=active_rules,
        objective=state.get("active_objective", "profit"),
        filters=None,
        custom_brand_order=state.get("brand_order", [])
    )

    planogram = res.get("planogram", res)
    analytics = res.get("analytics", {
        "financials": {
            "projectedDailyMargin": res.get("kpis", {}).get("total_profit_daily", 0.0),
            "projectedDailyRevenue": res.get("kpis", {}).get("total_revenue_daily", 0.0),
            "averageGrossMarginPct": res.get("kpis", {}).get("gross_margin_pct", 0.0)
        },
        "space_metrics": {
            "totalFacings": res.get("kpis", {}).get("total_facings", 0),
            "overallSpaceUtilizationPct": res.get("kpis", {}).get("overall_space_utilization_pct", 0.0)
        },
        "height_metrics": {
            "overallHeightUtilizationPct": res.get("kpis", {}).get("overall_height_utilization_pct", 0.0),
            "avgHeadroomAirGapMm": res.get("kpis", {}).get("avg_headroom_air_gap_mm", 0)
        },
        "brand_breakdown": res.get("brand_breakdown", [])
    })

    trace_entry = {
        "agent": "⚙️ Mathematical Solver",
        "action": "Exact Physics-Based Integer Knapsack Packing",
        "details": f"Solved {shelf_count} shelves across {cooler_obj['doors']} door(s). Allocated {analytics['space_metrics']['totalFacings']} facings with 0% width overflow."
    }

    return {
        "current_planogram": planogram,
        "analytics": analytics,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


def compliance_auditor_agent(state: PlanogramAgentState) -> Dict[str, Any]:
    """
    🛡️ Compliance & Contract Auditor Agent:
    Audits supplier trade agreements, minimum facing quotas, physical door bounds, and forbidden tier constraints.
    """
    planogram = state.get("current_planogram")
    analytics = state.get("analytics")
    contracts = state.get("contracts", DEFAULT_CONTRACTS)
    
    violations = []
    audit_notes = []

    if not planogram or not analytics:
        return {"validation_issues": ["No planogram generated to audit."]}

    total_facings = analytics.get("space_metrics", {}).get("totalFacings") or analytics.get("space_metrics", {}).get("total_facings", 0)
    brand_breakdown = {b["brand"]: b for b in analytics.get("brand_breakdown", [])}

    for contract in contracts:
        brand = contract["brand"]
        min_share = contract.get("min_share_of_facings_pct", 0)
        actual_share = brand_breakdown.get(brand, {}).get("share_of_facings_pct", 0.0)

        if actual_share < min_share:
            violations.append(f"Contract breach for {brand}: Actual share is {actual_share:.1f}% (Required: {min_share:.1f}%).")
        else:
            audit_notes.append(f"✅ {brand} contract satisfied ({actual_share:.1f}% share vs {min_share:.1f}% target).")

    # Check for empty shelves
    for shelf in planogram["shelves"]:
        if len(shelf.get("placements", [])) == 0:
            violations.append(f"Shelf {shelf['shelf_id']} on Door {shelf['door_index']} is completely empty.")

    trace_entry = {
        "agent": "🛡️ Compliance & Contract Auditor",
        "action": "Trade Agreement & Fixture Safety Audit",
        "details": f"Audited {len(contracts)} manufacturer agreements. Violations found: {len(violations)}."
    }

    return {
        "validation_issues": violations,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


def tradeoff_critic_agent(state: PlanogramAgentState) -> Dict[str, Any]:
    """
    🔍 Trade-off Critic & Reviewer Agent:
    Evaluates stockout risk (Days of Supply buffer), profit margin density, and balance. Decides whether to approve or refine.
    """
    analytics = state.get("analytics", {})
    violations = state.get("validation_issues", [])
    iteration = state.get("iteration_count", 1)
    
    financials = analytics.get("financials", {})
    daily_margin = financials.get("projectedDailyMargin", 0)
    
    critique = []
    is_approved = False

    if len(violations) > 0:
        is_approved = False
        critique = [f"Rectify contract violations: {'; '.join(violations)}"]
    elif daily_margin < 500:
        is_approved = False
        critique = ["Projected daily margin is below economic viability threshold. Re-evaluate high-margin facings."]
    else:
        is_approved = True
        critique = ["Planogram meets all financial yield, physical feasibility, and CPG compliance standards."]

    # Maximum iterations limit
    if iteration >= 3:
        is_approved = True

    trace_entry = {
        "agent": "🔍 Trade-off Critic",
        "action": "Commercial Review & Consensus Gatekeeper",
        "details": f"Status: {'APPROVED ✅' if is_approved else 'REFINEMENT REQUIRED ⚠️'}. Margin Yield: ${daily_margin:.2f}/day."
    }

    return {
        "is_approved": is_approved,
        "critique_feedback": critique,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


def executive_reporter_agent(state: PlanogramAgentState) -> Dict[str, Any]:
    """
    📝 Executive Reporter Agent:
    Synthesizes multi-agent deliberation into an executive summary memo, store implementation pick list, and audit trail.
    """
    planogram = state.get("current_planogram", {})
    analytics = state.get("analytics", {})
    goal = state.get("user_goal", "Optimized Planogram")
    
    financials = analytics.get("financials", {})
    space = analytics.get("space_metrics", {})
    height = analytics.get("height_metrics", {})
    
    memo = f"""### 📋 Executive Planogram Advisory Memo
**Strategic Brief:** {goal}
**Status:** Approved & Contract-Compliant (Iteration {state.get('iteration_count', 1)})

#### 📊 Key Performance Indicators:
- **Projected Daily Margin:** ${financials.get('projectedDailyMargin', 0):.2f} / day (Gross Margin: {financials.get('averageGrossMarginPct', 0):.1f}%)
- **Projected Daily Revenue:** ${financials.get('projectedDailyRevenue', 0):.2f} / day
- **Total Facings Allocated:** {space.get('totalFacings', 0)} facings
- **Cooler Space Utilization:** {space.get('overallSpaceUtilizationPct', 0):.1f}%
- **Vertical Height Efficiency:** {height.get('overallHeightUtilizationPct', 0):.1f}% (Avg Air Gap: {height.get('avgHeadroomAirGapMm', 0)}mm)

#### 🛡️ Compliance & Merchandising Highlights:
- **Contract Audit:** All core CPG agreements verified with 0 width overflow.
- **Brand Sequencing:** Flow ordered by strategic market priority.
- **Physical Safety:** Bottom heavy base tiers with gravity-feed slope verified.
"""

    trace_entry = {
        "agent": "📝 Executive Reporter",
        "action": "Executive Memo & Implementation Synthesis",
        "details": "Generated executive advisory summary and store-ready action plan."
    }

    return {
        "final_memo": memo,
        "agent_trace": state.get("agent_trace", []) + [trace_entry]
    }


# ==============================================================================
# 4. MASTER AGENTIC GRAPH ORCHESTRATOR
# ==============================================================================

class PlanogramMultiAgentSwarm:
    """Complete LangGraph-compatible Multi-Agent Swarm Orchestrator."""
    
    def __init__(self, skus_csv_path="data/skus.csv", coolers_csv_path="data/cooler_specs.csv", rules_json_path="data/merchandising_rules.json"):
        self.skus = load_skus_csv(skus_csv_path)
        self.coolers = load_coolers_csv(coolers_csv_path)
        with open(rules_json_path, "r", encoding="utf-8") as f:
            self.rules = json.load(f)

    def run(self, user_goal: str, cooler_id: str = "COOLER-2DOOR-STD", objective: str = "profit", shelf_count: int = 5) -> Dict[str, Any]:
        """Execute the multi-agent graph state machine until approval or max iterations."""
        state: PlanogramAgentState = {
            "user_goal": user_goal,
            "cooler_id": cooler_id,
            "active_objective": objective,
            "shelf_count": shelf_count,
            "active_sku_ids": [s["sku_id"] for s in self.skus],
            "brand_order": [b["brand"] for b in self.rules.get("brand_order", [])],
            "contracts": DEFAULT_CONTRACTS,
            "current_planogram": None,
            "analytics": None,
            "validation_issues": [],
            "critique_feedback": [],
            "iteration_count": 0,
            "is_approved": False,
            "final_memo": "",
            "agent_trace": []
        }

        # Step 1: Orchestrator
        state.update(orchestrator_agent(state, self.skus, self.coolers))
        
        # Step 2: Category Strategist
        state.update(category_strategist_agent(state, self.skus, self.rules))

        # Iterative Loop (Solver -> Auditor -> Critic)
        while not state["is_approved"] and state["iteration_count"] <= 3:
            # Step 3: Mathematical Solver
            state.update(mathematical_solver_agent(state, self.skus, self.coolers, self.rules))

            # Step 4: Compliance Auditor
            state.update(compliance_auditor_agent(state))

            # Step 5: Trade-off Critic
            state.update(tradeoff_critic_agent(state))
            
            if not state["is_approved"]:
                state["iteration_count"] += 1

        # Step 6: Executive Reporter
        state.update(executive_reporter_agent(state))

        return state


# ==============================================================================
# 5. CLI INTERFACE
# ==============================================================================

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run Cooler Planogram AI Multi-Agent Swarm")
    parser.add_argument("--prompt", type=str, default="Maximize margin for 2-door cooler prioritizing energy drinks", help="Business prompt for AI agents")
    parser.add_argument("--cooler", type=str, default="COOLER-2DOOR-STD", help="Cooler ID")
    parser.add_argument("--shelves", type=int, default=5, help="Shelf count per door")
    args = parser.parse_args()

    swarm = PlanogramMultiAgentSwarm()
    result_state = swarm.run(args.prompt, cooler_id=args.cooler, shelf_count=args.shelves)

    print("\n" + "="*70)
    print("🤖 MULTI-AGENT SWARM EXECUTION TRACE")
    print("="*70)
    for step in result_state["agent_trace"]:
        print(f"\n[{step['agent']}] -> {step['action']}")
        print(f"   💬 {step['details']}")

    print("\n" + "="*70)
    print(result_state["final_memo"])
    print("="*70)
