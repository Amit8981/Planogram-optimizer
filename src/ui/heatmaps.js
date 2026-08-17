/**
 * Heatmap Engine for Cooler Visualizer
 * Calculates color scales and gradient overlays for various merchandising dimensions.
 */

export class HeatmapEngine {
  constructor() {
    this.currentMode = 'none'; // 'none' | 'margin' | 'velocity' | 'dos' | 'eye_level'
  }

  setMode(mode) {
    this.currentMode = mode;
  }

  /**
   * Computes item background color and border style based on active heatmap mode
   */
  getItemStyle(placement, sku, shelf, analytics) {
    if (this.currentMode === 'none') {
      return {
        background: placement.color_hex || '#333',
        textColor: '#FFFFFF',
        badge: null
      };
    }

    if (this.currentMode === 'margin') {
      // High margin (> 1.50) -> Bright Emerald, Low (< 1.05) -> Teal / Indigo
      const margin = sku.margin || 1.0;
      if (margin >= 1.60) {
        return { background: 'linear-gradient(135deg, #059669, #10B981)', textColor: '#FFFFFF', badge: `+$${margin.toFixed(2)}` };
      } else if (margin >= 1.20) {
        return { background: 'linear-gradient(135deg, #0D9488, #14B8A6)', textColor: '#FFFFFF', badge: `+$${margin.toFixed(2)}` };
      } else {
        return { background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', textColor: '#FFFFFF', badge: `+$${margin.toFixed(2)}` };
      }
    }

    if (this.currentMode === 'velocity') {
      // High velocity (> 35) -> Bright Orange/Red, Moderate (20-35) -> Amber, Low (< 20) -> Slate
      const vel = sku.sales_velocity_units_day || 20;
      if (vel >= 35) {
        return { background: 'linear-gradient(135deg, #DC2626, #EF4444)', textColor: '#FFFFFF', badge: `${vel}u/d 🔥` };
      } else if (vel >= 22) {
        return { background: 'linear-gradient(135deg, #D97706, #F59E0B)', textColor: '#FFFFFF', badge: `${vel}u/d` };
      } else {
        return { background: 'linear-gradient(135deg, #475569, #64748B)', textColor: '#FFFFFF', badge: `${vel}u/d` };
      }
    }

    if (this.currentMode === 'dos') {
      // Days of supply
      const unitsDeep = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
      const totalUnits = placement.facings * unitsDeep;
      const dos = sku.sales_velocity_units_day > 0 ? totalUnits / sku.sales_velocity_units_day : 99;

      if (dos < 1.5) {
        return { background: 'linear-gradient(135deg, #991B1B, #DC2626)', textColor: '#FFFFFF', badge: `${dos.toFixed(1)}d ⚠️ OOS` };
      } else if (dos > 4.5) {
        return { background: 'linear-gradient(135deg, #312E81, #4338CA)', textColor: '#FFFFFF', badge: `${dos.toFixed(1)}d 📦 Over` };
      } else {
        return { background: 'linear-gradient(135deg, #065F46, #059669)', textColor: '#FFFFFF', badge: `${dos.toFixed(1)}d ✅` };
      }
    }

    if (this.currentMode === 'eye_level') {
      const score = shelf.eye_level_score || 0.5;
      if (score >= 0.9) {
        return { background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', textColor: '#FFFFFF', badge: 'GOLDEN 👑' };
      } else if (score >= 0.7) {
        return { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', textColor: '#FFFFFF', badge: 'REACH ⭐' };
      } else {
        return { background: 'linear-gradient(135deg, #334155, #475569)', textColor: '#94A3B8', badge: 'BASE' };
      }
    }

    return { background: placement.color_hex, textColor: '#FFF', badge: null };
  }

  getLegend() {
    const legends = {
      none: [],
      margin: [
        { color: '#10B981', label: 'High Margin (>$1.60)' },
        { color: '#14B8A6', label: 'Medium Margin ($1.20 - $1.60)' },
        { color: '#3B82F6', label: 'Core / Standard Margin (<$1.20)' }
      ],
      velocity: [
        { color: '#EF4444', label: 'High Velocity (>35 units/day)' },
        { color: '#F59E0B', label: 'Medium Velocity (22-35 units/day)' },
        { color: '#64748B', label: 'Slow Mover (<22 units/day)' }
      ],
      dos: [
        { color: '#DC2626', label: 'Stockout Risk (<1.5 Days Supply)' },
        { color: '#059669', label: 'Optimal Buffer (1.5 - 4.5 Days)' },
        { color: '#4338CA', label: 'Overstock (>4.5 Days Supply)' }
      ],
      eye_level: [
        { color: '#8B5CF6', label: 'Eye-Level Golden Zone (Score 1.0)' },
        { color: '#3B82F6', label: 'Upper Reach Zone (Score 0.85)' },
        { color: '#475569', label: 'Base / Low Zone (Score 0.40)' }
      ]
    };
    return legends[this.currentMode] || [];
  }
}
