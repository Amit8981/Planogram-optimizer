/**
 * Planogram Validator
 * Validates a planogram assignment against physical constraints, weight limits,
 * brand blocking, and merchandising rules.
 */

export class PlanogramValidator {
  constructor(skus, coolerSpecs, rules) {
    this.skus = skus;
    this.coolerSpecs = coolerSpecs;
    this.rules = rules;
    this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
  }

  /**
   * Validates the complete planogram layout
   * @param {Object} planogram - { cooler_id, shelves: [ { shelf_id, placements: [ { sku_id, facings, x_offset_mm } ] } ] }
   * @returns {Object} { isValid: boolean, score: number, violations: Array, warnings: Array, stats: Object }
   */
  validate(planogram) {
    const violations = [];
    const warnings = [];
    let totalFacings = 0;
    let totalWidthUsed = 0;
    let totalWidthAvailable = 0;
    let totalWeightUsed = 0;
    let totalWeightCapacity = 0;
    let brandBlockingViolations = 0;
    let adjacencyMatches = 0;
    let adjacencyTotalChecks = 0;

    const brandOrderMap = new Map((this.rules.brand_order || []).map((b, idx) => [b.brand, { ...b, index: idx }]));
    const shelfPrefMap = new Map((this.rules.shelf_preferences || []).map(p => [p.category, p]));

    // Find cooler spec
    const cooler = this.coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || this.coolerSpecs[0];
    const allShelves = cooler.bays.flatMap(b => b.shelves.map(s => ({ ...s, door_index: b.door_index })));
    const shelfMap = new Map(allShelves.map(s => [s.shelf_id, s]));

    const skuPlacedFacings = new Map();

    for (const shelfPlan of planogram.shelves) {
      const shelf = shelfMap.get(shelfPlan.shelf_id);
      if (!shelf) {
        violations.push({
          type: 'INVALID_SHELF',
          shelf_id: shelfPlan.shelf_id,
          message: `Shelf ${shelfPlan.shelf_id} not found in cooler spec.`
        });
        continue;
      }

      totalWidthAvailable += shelf.usable_width_mm;
      totalWeightCapacity += shelf.max_weight_kg;

      let shelfWidth = 0;
      let shelfWeightKg = 0;
      let prevBrand = null;
      const seenBrandsOnShelf = new Set();
      const brandsSequence = [];

      for (let i = 0; i < shelfPlan.placements.length; i++) {
        const p = shelfPlan.placements[i];
        const sku = this.skuMap.get(p.sku_id);
        if (!sku) {
          violations.push({
            type: 'UNKNOWN_SKU',
            shelf_id: shelf.shelf_id,
            sku_id: p.sku_id,
            message: `Unknown SKU ${p.sku_id} placed on shelf ${shelf.shelf_id}.`
          });
          continue;
        }

        // Track global facings per SKU
        skuPlacedFacings.set(sku.sku_id, (skuPlacedFacings.get(sku.sku_id) || 0) + p.facings);
        totalFacings += p.facings;

        // 1. Height Clearance Check
        if (sku.dimensions_mm.height > shelf.clearance_height_mm) {
          violations.push({
            type: 'HEIGHT_CLEARANCE_EXCEEDED',
            shelf_id: shelf.shelf_id,
            sku_id: sku.sku_id,
            sku_name: sku.name,
            height: sku.dimensions_mm.height,
            clearance: shelf.clearance_height_mm,
            message: `SKU ${sku.name} (H:${sku.dimensions_mm.height}mm) exceeds shelf clearance of ${shelf.clearance_height_mm}mm.`
          });
        }

        // 2. Depth Check & Units per Facing (Deep capacity)
        const unitsPerFacing = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
        const totalUnitsInPlacement = p.facings * unitsPerFacing;
        const placementWeightKg = (totalUnitsInPlacement * sku.weight_g) / 1000.0;

        shelfWidth += p.facings * sku.dimensions_mm.width;
        shelfWeightKg += placementWeightKg;

        // 3. Category Shelf Tier Preferences Check
        const pref = shelfPrefMap.get(sku.category);
        if (pref) {
          if (pref.forbidden_tiers && pref.forbidden_tiers.includes(shelf.tier)) {
            violations.push({
              type: 'FORBIDDEN_TIER',
              shelf_id: shelf.shelf_id,
              sku_id: sku.sku_id,
              category: sku.category,
              tier: shelf.tier,
              message: `${sku.category} is strictly forbidden on ${shelf.tier} tier (${shelf.shelf_id}).`
            });
          } else if (pref.preferred_tiers && !pref.preferred_tiers.includes(shelf.tier)) {
            warnings.push({
              type: 'NON_PREFERRED_TIER',
              shelf_id: shelf.shelf_id,
              sku_id: sku.sku_id,
              category: sku.category,
              tier: shelf.tier,
              message: `${sku.name} (${sku.category}) prefers ${pref.preferred_tiers.join('/')} tier, placed on ${shelf.tier}.`
            });
          }
        }

        // 4. Brand Blocking & Adjacency on this shelf
        if (sku.brand !== prevBrand) {
          if (seenBrandsOnShelf.has(sku.brand)) {
            // Brand was split into multiple non-continuous blocks on the same shelf!
            brandBlockingViolations++;
            violations.push({
              type: 'BRAND_FRAGMENTATION',
              shelf_id: shelf.shelf_id,
              brand: sku.brand,
              message: `Brand ${sku.brand} is split into non-contiguous blocks on shelf ${shelf.shelf_id}.`
            });
          }
          seenBrandsOnShelf.add(sku.brand);
          brandsSequence.push(sku.brand);
          prevBrand = sku.brand;
        }
      }

      // Check brand adjacency transitions on this shelf
      for (let bIdx = 0; bIdx < brandsSequence.length - 1; bIdx++) {
        adjacencyTotalChecks++;
        const currentBrand = brandsSequence[bIdx];
        const nextBrand = brandsSequence[bIdx + 1];
        const brandRule = brandOrderMap.get(currentBrand);
        if (brandRule && brandRule.adjacent_brands && brandRule.adjacent_brands.includes(nextBrand)) {
          adjacencyMatches++;
        } else {
          warnings.push({
            type: 'BRAND_ADJACENCY_MISMATCH',
            shelf_id: shelf.shelf_id,
            currentBrand,
            nextBrand,
            message: `Brand '${nextBrand}' is adjacent to '${currentBrand}' on ${shelf.shelf_id}, but not listed as preferred adjacent brand.`
          });
        }
      }

      // 5. Width Capacity Check
      totalWidthUsed += shelfWidth;
      totalWeightUsed += shelfWeightKg;

      if (shelfWidth > shelf.usable_width_mm) {
        violations.push({
          type: 'SHELF_OVERFLOW_WIDTH',
          shelf_id: shelf.shelf_id,
          used_width: shelfWidth,
          capacity: shelf.usable_width_mm,
          overflow_mm: shelfWidth - shelf.usable_width_mm,
          message: `Shelf ${shelf.shelf_id} overflowed by ${shelfWidth - shelf.usable_width_mm}mm (${shelfWidth}mm / ${shelf.usable_width_mm}mm).`
        });
      }

      // 6. Weight Capacity Check
      if (shelfWeightKg > shelf.max_weight_kg) {
        violations.push({
          type: 'SHELF_OVERWEIGHT',
          shelf_id: shelf.shelf_id,
          weight_kg: shelfWeightKg,
          capacity_kg: shelf.max_weight_kg,
          message: `Shelf ${shelf.shelf_id} exceeds weight capacity (${shelfWeightKg.toFixed(1)}kg / ${shelf.max_weight_kg}kg).`
        });
      }
    }

    // 7. Global SKU Min/Max Facing Bounds Check
    for (const sku of this.skus) {
      const placed = skuPlacedFacings.get(sku.sku_id) || 0;
      if (placed > 0) {
        if (placed < sku.min_facings) {
          warnings.push({
            type: 'BELOW_MIN_FACINGS',
            sku_id: sku.sku_id,
            placed,
            min: sku.min_facings,
            message: `${sku.name} has ${placed} facings, below min required of ${sku.min_facings}.`
          });
        } else if (placed > sku.max_facings) {
          violations.push({
            type: 'EXCEEDS_MAX_FACINGS',
            sku_id: sku.sku_id,
            placed,
            max: sku.max_facings,
            message: `${sku.name} has ${placed} facings, exceeding max allowed of ${sku.max_facings}.`
          });
        }
      }
    }

    const widthFillRatePct = totalWidthAvailable > 0 ? (totalWidthUsed / totalWidthAvailable) * 100 : 0;
    const weightFillRatePct = totalWeightCapacity > 0 ? (totalWeightUsed / totalWeightCapacity) * 100 : 0;
    const adjacencyScorePct = adjacencyTotalChecks > 0 ? (adjacencyMatches / adjacencyTotalChecks) * 100 : 100;
    const complianceScore = Math.max(0, 100 - (violations.length * 15) - (warnings.length * 2));

    return {
      isValid: violations.length === 0,
      complianceScore: Math.round(complianceScore),
      violations,
      warnings,
      stats: {
        totalFacings,
        totalWidthUsedMm: Math.round(totalWidthUsed),
        totalWidthAvailableMm: Math.round(totalWidthAvailable),
        widthFillRatePct: Number(widthFillRatePct.toFixed(1)),
        totalWeightUsedKg: Number(totalWeightUsed.toFixed(1)),
        totalWeightCapacityKg: Number(totalWeightCapacity.toFixed(1)),
        weightFillRatePct: Number(weightFillRatePct.toFixed(1)),
        adjacencyMatches,
        adjacencyTotalChecks,
        adjacencyScorePct: Number(adjacencyScorePct.toFixed(1)),
        brandBlockingViolations
      }
    };
  }
}
