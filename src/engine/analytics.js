/**
 * Planogram Analytics Engine
 * Computes financial performance, space elasticity yields, inventory coverage (Days of Supply),
 * and merchandising share of shelf.
 */

export class PlanogramAnalytics {
  constructor(skus, coolerSpecs, rules) {
    this.skus = skus;
    this.coolerSpecs = coolerSpecs;
    this.rules = rules;
    this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
  }

  /**
   * Calculates detailed analytics for the current planogram
   * @param {Object} planogram
   * @returns {Object} Comprehensive metrics, category breakdown, brand breakdown, shelf metrics
   */
  computeAnalytics(planogram) {
    const cooler = this.coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || this.coolerSpecs[0];
    const allShelves = cooler.bays.flatMap(b => b.shelves.map(s => ({ ...s, door_index: b.door_index })));
    const shelfMap = new Map(allShelves.map(s => [s.shelf_id, s]));

    const gamma = (this.rules.engine_weights && this.rules.engine_weights.space_elasticity_gamma) || 0.20;
    const targetDoS = (this.rules.operational_constraints && this.rules.operational_constraints.target_days_of_supply) || 2.0;

    let totalDailyUnits = 0;
    let totalDailyRevenue = 0;
    let totalDailyMargin = 0;
    let totalInventoryHoldingUnits = 0;
    let totalInventoryHoldingValue = 0;
    let totalFacings = 0;
    let totalEyeLevelFacings = 0;
    let eyeLevelMarginContribution = 0;

    const brandStats = new Map();
    const categoryStats = new Map();
    const skuAnalytics = [];
    const shelfAnalytics = [];

    // Map each placement
    const skuFacingMap = new Map();
    const skuShelfPositions = new Map();

    for (const shelfPlan of planogram.shelves) {
      const shelf = shelfMap.get(shelfPlan.shelf_id);
      if (!shelf) continue;

      let shelfRevenue = 0;
      let shelfMargin = 0;
      let shelfUnits = 0;
      let shelfFacings = 0;
      let shelfWidthUsed = 0;
      let shelfWeightKg = 0;

      for (const p of shelfPlan.placements) {
        const sku = this.skuMap.get(p.sku_id);
        if (!sku) continue;

        const facings = p.facings;
        shelfFacings += facings;
        totalFacings += facings;

        // Space elasticity calculation: S(f) = base_velocity * (f ^ gamma)
        // With diminishing returns per extra facing
        const elasticUnits = sku.sales_velocity_units_day * Math.pow(facings, gamma);
        // Eye level multiplier bonus if on eye level
        const eyeMultiplier = 1.0 + (shelf.eye_level_score - 0.5) * 0.15;
        const projectedDailyUnits = elasticUnits * eyeMultiplier;
        const projectedDailyRevenue = projectedDailyUnits * sku.unit_price;
        const projectedDailyMargin = projectedDailyUnits * sku.margin;

        // Depth capacity: how many units fit front-to-back
        const unitsDeep = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
        const totalHoldingUnits = facings * unitsDeep;
        const daysOfSupply = projectedDailyUnits > 0 ? totalHoldingUnits / projectedDailyUnits : 999;
        const placementWeight = (totalHoldingUnits * sku.weight_g) / 1000.0;

        shelfRevenue += projectedDailyRevenue;
        shelfMargin += projectedDailyMargin;
        shelfUnits += projectedDailyUnits;
        shelfWidthUsed += facings * sku.dimensions_mm.width;
        shelfWeightKg += placementWeight;

        totalDailyUnits += projectedDailyUnits;
        totalDailyRevenue += projectedDailyRevenue;
        totalDailyMargin += projectedDailyMargin;
        totalInventoryHoldingUnits += totalHoldingUnits;
        totalInventoryHoldingValue += totalHoldingUnits * sku.unit_cost;

        if (shelf.tier === 'eye_level' || shelf.tier === 'reach_level') {
          totalEyeLevelFacings += facings;
          eyeLevelMarginContribution += projectedDailyMargin;
        }

        // Aggregate Brand Metrics
        if (!brandStats.has(sku.brand)) {
          brandStats.set(sku.brand, {
            brand: sku.brand,
            facings: 0,
            width_mm: 0,
            projectedDailyRevenue: 0,
            projectedDailyMargin: 0,
            skuCount: 0
          });
        }
        const bStat = brandStats.get(sku.brand);
        bStat.facings += facings;
        bStat.width_mm += facings * sku.dimensions_mm.width;
        bStat.projectedDailyRevenue += projectedDailyRevenue;
        bStat.projectedDailyMargin += projectedDailyMargin;

        // Aggregate Category Metrics
        if (!categoryStats.has(sku.category)) {
          categoryStats.set(sku.category, {
            category: sku.category,
            facings: 0,
            width_mm: 0,
            projectedDailyRevenue: 0,
            projectedDailyMargin: 0
          });
        }
        const cStat = categoryStats.get(sku.category);
        cStat.facings += facings;
        cStat.width_mm += facings * sku.dimensions_mm.width;
        cStat.projectedDailyRevenue += projectedDailyRevenue;
        cStat.projectedDailyMargin += projectedDailyMargin;

        // Aggregate SKU-level analytics
        skuAnalytics.push({
          sku_id: sku.sku_id,
          name: sku.name,
          brand: sku.brand,
          category: sku.category,
          shelf_id: shelf.shelf_id,
          tier: shelf.tier,
          facings,
          unitsDeep,
          totalHoldingUnits,
          projectedDailyUnits: Number(projectedDailyUnits.toFixed(1)),
          projectedDailyRevenue: Number(projectedDailyRevenue.toFixed(2)),
          projectedDailyMargin: Number(projectedDailyMargin.toFixed(2)),
          daysOfSupply: Number(daysOfSupply.toFixed(1)),
          dosStatus: daysOfSupply < targetDoS * 0.7 ? 'OOS_RISK' : (daysOfSupply > targetDoS * 2.5 ? 'OVERSTOCK' : 'OPTIMAL')
        });
      }

      shelfAnalytics.push({
        shelf_id: shelf.shelf_id,
        door_index: shelf.door_index,
        tier: shelf.tier,
        tier_label: shelf.tier_label,
        facings: shelfFacings,
        widthUsedMm: shelfWidthUsed,
        widthCapacityMm: shelf.usable_width_mm,
        widthUtilizationPct: Number(((shelfWidthUsed / shelf.usable_width_mm) * 100).toFixed(1)),
        weightUsedKg: Number(shelfWeightKg.toFixed(1)),
        weightCapacityKg: shelf.max_weight_kg,
        weightUtilizationPct: Number(((shelfWeightKg / shelf.max_weight_kg) * 100).toFixed(1)),
        projectedDailyRevenue: Number(shelfRevenue.toFixed(2)),
        projectedDailyMargin: Number(shelfMargin.toFixed(2))
      });
    }

    // Calculate shares (%)
    const totalCoolerWidthMm = shelfAnalytics.reduce((acc, s) => acc + s.widthCapacityMm, 0);
    const brandBreakdown = Array.from(brandStats.values()).map(b => ({
      ...b,
      shareOfFacingsPct: totalFacings > 0 ? Number(((b.facings / totalFacings) * 100).toFixed(1)) : 0,
      shareOfSpacePct: totalCoolerWidthMm > 0 ? Number(((b.width_mm / totalCoolerWidthMm) * 100).toFixed(1)) : 0,
      marginContributionPct: totalDailyMargin > 0 ? Number(((b.projectedDailyMargin / totalDailyMargin) * 100).toFixed(1)) : 0,
      projectedDailyRevenue: Number(b.projectedDailyRevenue.toFixed(2)),
      projectedDailyMargin: Number(b.projectedDailyMargin.toFixed(2))
    })).sort((a, b) => b.projectedDailyMargin - a.projectedDailyMargin);

    const categoryBreakdown = Array.from(categoryStats.values()).map(c => ({
      ...c,
      shareOfFacingsPct: totalFacings > 0 ? Number(((c.facings / totalFacings) * 100).toFixed(1)) : 0,
      shareOfSpacePct: totalCoolerWidthMm > 0 ? Number(((c.width_mm / totalCoolerWidthMm) * 100).toFixed(1)) : 0,
      marginContributionPct: totalDailyMargin > 0 ? Number(((c.projectedDailyMargin / totalDailyMargin) * 100).toFixed(1)) : 0,
      projectedDailyRevenue: Number(c.projectedDailyRevenue.toFixed(2)),
      projectedDailyMargin: Number(c.projectedDailyMargin.toFixed(2))
    })).sort((a, b) => b.projectedDailyMargin - a.projectedDailyMargin);

    const averageMarginPct = totalDailyRevenue > 0 ? (totalDailyMargin / totalDailyRevenue) * 100 : 0;
    const overallSpaceUtilizationPct = totalCoolerWidthMm > 0 
      ? (shelfAnalytics.reduce((acc, s) => acc + s.widthUsedMm, 0) / totalCoolerWidthMm) * 100 
      : 0;

    return {
      financials: {
        projectedDailyUnits: Math.round(totalDailyUnits),
        projectedDailyRevenue: Number(totalDailyRevenue.toFixed(2)),
        projectedDailyMargin: Number(totalDailyMargin.toFixed(2)),
        projectedMonthlyRevenue: Number((totalDailyRevenue * 30).toFixed(2)),
        projectedMonthlyMargin: Number((totalDailyMargin * 30).toFixed(2)),
        averageGrossMarginPct: Number(averageMarginPct.toFixed(1)),
        inventoryHoldingUnits: totalInventoryHoldingUnits,
        inventoryHoldingValue: Number(totalInventoryHoldingValue.toFixed(2))
      },
      spaceMetrics: {
        totalFacings,
        totalEyeLevelFacings,
        eyeLevelSharePct: totalFacings > 0 ? Number(((totalEyeLevelFacings / totalFacings) * 100).toFixed(1)) : 0,
        overallSpaceUtilizationPct: Number(overallSpaceUtilizationPct.toFixed(1)),
        totalCoolerWidthMm
      },
      brandBreakdown,
      categoryBreakdown,
      shelfAnalytics,
      skuAnalytics
    };
  }
}
