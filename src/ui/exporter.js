/**
 * Planogram Exporter
 * Generates JSON deliverables, CSV store pick-lists, and formatted planogram specs.
 */

export class PlanogramExporter {
  static exportJSON(planogram, analytics, validation) {
    const exportData = {
      planogram,
      validation_summary: {
        is_valid: validation.isValid,
        compliance_score: validation.complianceScore,
        violations_count: validation.violations.length,
        warnings_count: validation.warnings.length
      },
      financial_projections: analytics.financials,
      space_metrics: analytics.spaceMetrics,
      brand_breakdown: analytics.brandBreakdown,
      generated_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${planogram.planogram_id || 'planogram'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static exportCSV(planogram, skus) {
    const skuMap = new Map(skus.map(s => [s.sku_id, s]));
    const headers = [
      'Shelf_ID',
      'Door_Index',
      'Tier',
      'Facing_Sequence',
      'SKU_ID',
      'Product_Name',
      'Brand',
      'Flavor',
      'Facings',
      'Units_Deep',
      'Total_Capacity_Units',
      'Placement_Width_MM',
      'Offset_X_MM'
    ];

    const rows = [headers.join(',')];

    for (const shelf of planogram.shelves) {
      let seq = 1;
      for (const p of shelf.placements) {
        const sku = skuMap.get(p.sku_id);
        const unitsDeep = sku ? Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth)) : 1;
        const totalUnits = p.facings * unitsDeep;

        rows.push([
          `"${shelf.shelf_id}"`,
          shelf.door_index,
          `"${shelf.tier}"`,
          seq++,
          `"${p.sku_id}"`,
          `"${(p.sku_name || '').replace(/"/g, '""')}"`,
          `"${p.brand}"`,
          `"${p.flavor}"`,
          p.facings,
          unitsDeep,
          totalUnits,
          p.total_placement_width_mm,
          p.x_offset_mm
        ].join(','));
      }
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${planogram.planogram_id || 'planogram'}_pick_list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static printLayout() {
    window.print();
  }
}
