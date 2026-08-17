/**
 * Main Application Controller
 * Orchestrates datasets, optimizer runs, UI rendering, heatmaps, and exports.
 */

import { PlanogramOptimizer } from './engine/optimizer.js';
import { PlanogramValidator } from './engine/validator.js';
import { PlanogramAnalytics } from './engine/analytics.js';
import { HeatmapEngine } from './ui/heatmaps.js';
import { CoolerRenderer } from './ui/coolerRenderer.js';
import { RuleEditor } from './ui/ruleEditor.js';
import { PlanogramExporter } from './ui/exporter.js';

import { DEFAULT_SKUS, DEFAULT_COOLERS, DEFAULT_RULES } from './data/defaults.js';

class CoolerPlanogramApp {
  constructor() {
    this.skus = [...DEFAULT_SKUS];
    this.coolerSpecs = [...DEFAULT_COOLERS];
    this.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    this.activeCoolerId = 'COOLER-2DOOR-STD';
    this.heatmapEngine = new HeatmapEngine();
    this.currentPlanogramResult = null;
  }

  async init() {
    await this.loadDataSources();
    this.setupUI();
    this.runOptimization();
  }

  async loadDataSources() {
    try {
      const [skusRes, coolersRes, rulesRes] = await Promise.all([
        fetch('./data/skus.json'),
        fetch('./data/cooler_specs.json'),
        fetch('./data/merchandising_rules.json')
      ]);
      if (skusRes.ok && coolersRes.ok && rulesRes.ok) {
        this.skus = await skusRes.json();
        this.coolerSpecs = await coolersRes.json();
        this.rules = await rulesRes.json();
        return;
      }
    } catch (e) {
      console.info('Using embedded datasets', e);
    }
  }

  setupUI() {
    // Cooler Select dropdown
    const coolerSelect = document.getElementById('select-cooler-fixture');
    if (coolerSelect) {
      coolerSelect.innerHTML = this.coolerSpecs.map(c => `
        <option value="${c.cooler_id}" ${c.cooler_id === this.activeCoolerId ? 'selected' : ''}>
          ${c.name} (${c.doors} Doors)
        </option>
      `).join('');

      coolerSelect.addEventListener('change', (e) => {
        this.activeCoolerId = e.target.value;
        this.runOptimization();
      });
    }

    // Heatmap Toggle Buttons
    const heatmapBtns = document.querySelectorAll('.heatmap-toggle-btn');
    heatmapBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        heatmapBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        this.heatmapEngine.setMode(mode);
        this.updateHeatmapLegend();
        this.renderCooler();
      });
    });

    // Run Optimization Button
    const btnRunOpt = document.getElementById('btn-run-optimization');
    if (btnRunOpt) {
      btnRunOpt.addEventListener('click', () => {
        this.runOptimization();
      });
    }

    // Export Buttons
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      if (this.currentPlanogramResult) {
        PlanogramExporter.exportJSON(
          this.currentPlanogramResult.planogram,
          this.currentPlanogramResult.analytics,
          this.currentPlanogramResult.validation
        );
      }
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      if (this.currentPlanogramResult) {
        PlanogramExporter.exportCSV(this.currentPlanogramResult.planogram, this.skus);
      }
    });

    document.getElementById('btn-print-spec')?.addEventListener('click', () => {
      PlanogramExporter.printLayout();
    });

    // Initialize Rule Editor
    const editorContainer = document.getElementById('editor-panel-container');
    if (editorContainer) {
      this.ruleEditor = new RuleEditor(editorContainer, {
        onDataChanged: ({ skus, coolerSpecs, rules, triggerOptimize }) => {
          this.skus = skus;
          this.coolerSpecs = coolerSpecs;
          this.rules = rules;
          if (triggerOptimize) {
            this.runOptimization();
          }
        }
      });
      this.ruleEditor.render(this.skus, this.coolerSpecs, this.rules);
    }
  }

  runOptimization() {
    const optimizer = new PlanogramOptimizer(this.skus, this.coolerSpecs, this.rules);
    this.currentPlanogramResult = optimizer.optimize(this.activeCoolerId);

    this.renderCooler();
    this.updateKPIs();
    this.updateValidationDrawer();
    this.updateAnalyticsPanels();
    this.updateHeatmapLegend();
  }

  renderCooler() {
    const canvasContainer = document.getElementById('cooler-canvas-container');
    if (!canvasContainer || !this.currentPlanogramResult) return;

    if (!this.coolerRenderer) {
      this.coolerRenderer = new CoolerRenderer(canvasContainer, {
        heatmapEngine: this.heatmapEngine,
        onPlanogramModified: (modifiedPlanogram) => {
          this.handleManualPlanogramChange(modifiedPlanogram);
        }
      });
    }

    this.coolerRenderer.render(
      this.currentPlanogramResult.planogram,
      this.currentPlanogramResult.validation,
      this.currentPlanogramResult.analytics,
      this.skus,
      this.coolerSpecs
    );
  }

  handleManualPlanogramChange(modifiedPlanogram) {
    const validator = new PlanogramValidator(this.skus, this.coolerSpecs, this.rules);
    const validation = validator.validate(modifiedPlanogram);

    const analyticsEngine = new PlanogramAnalytics(this.skus, this.coolerSpecs, this.rules);
    const analytics = analyticsEngine.computeAnalytics(modifiedPlanogram);

    this.currentPlanogramResult = {
      planogram: modifiedPlanogram,
      validation,
      analytics
    };

    this.renderCooler();
    this.updateKPIs();
    this.updateValidationDrawer();
    this.updateAnalyticsPanels();
  }

  updateKPIs() {
    const { analytics, validation } = this.currentPlanogramResult;
    const fin = analytics.financials;
    const space = analytics.spaceMetrics;

    document.getElementById('kpi-revenue').textContent = `$${fin.projectedDailyRevenue.toFixed(2)}`;
    document.getElementById('kpi-margin').textContent = `$${fin.projectedDailyMargin.toFixed(2)}`;
    document.getElementById('kpi-margin-pct').textContent = `${fin.averageGrossMarginPct}%`;
    document.getElementById('kpi-fill-rate').textContent = `${space.overallSpaceUtilizationPct}%`;
    document.getElementById('kpi-compliance').textContent = `${validation.complianceScore}/100`;
    document.getElementById('kpi-facings').textContent = `${space.totalFacings}`;

    const compEl = document.getElementById('kpi-compliance');
    if (validation.complianceScore >= 90) {
      compEl.className = 'kpi-value text-success';
    } else if (validation.complianceScore >= 70) {
      compEl.className = 'kpi-value text-warning';
    } else {
      compEl.className = 'kpi-value text-danger';
    }
  }

  updateValidationDrawer() {
    const { validation } = this.currentPlanogramResult;
    const violationsContainer = document.getElementById('violations-list');
    const warningsContainer = document.getElementById('warnings-list');

    if (violationsContainer) {
      if (validation.violations.length === 0) {
        violationsContainer.innerHTML = `<div class="status-empty-msg text-success">✅ Zero critical rule violations. Ready for store deployment!</div>`;
      } else {
        violationsContainer.innerHTML = validation.violations.map(v => `
          <div class="audit-item violation">
            <div class="audit-icon">🚫</div>
            <div class="audit-details">
              <strong>${v.type.replace(/_/g, ' ')}</strong>
              <p>${v.message}</p>
            </div>
          </div>
        `).join('');
      }
    }

    if (warningsContainer) {
      if (validation.warnings.length === 0) {
        warningsContainer.innerHTML = `<div class="status-empty-msg text-muted">No merchandising warnings.</div>`;
      } else {
        warningsContainer.innerHTML = validation.warnings.map(w => `
          <div class="audit-item warning">
            <div class="audit-icon">⚠️</div>
            <div class="audit-details">
              <strong>${w.type.replace(/_/g, ' ')}</strong>
              <p>${w.message}</p>
            </div>
          </div>
        `).join('');
      }
    }
  }

  updateAnalyticsPanels() {
    const { analytics } = this.currentPlanogramResult;

    // Brand share table
    const brandTableBody = document.getElementById('brand-share-tbody');
    if (brandTableBody) {
      brandTableBody.innerHTML = analytics.brandBreakdown.map(b => `
        <tr>
          <td><strong>${b.brand}</strong></td>
          <td>${b.facings} facings (${b.shareOfFacingsPct}%)</td>
          <td>
            <div class="mini-progress-bar">
              <div class="mini-progress-fill" style="width: ${Math.min(100, b.shareOfSpacePct * 2.5)}%"></div>
            </div>
            <span class="small-text">${b.shareOfSpacePct}%</span>
          </td>
          <td>$${b.projectedDailyRevenue.toFixed(2)}</td>
          <td><strong class="text-success">+$${b.projectedDailyMargin.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }

    // Category share table
    const catTableBody = document.getElementById('category-share-tbody');
    if (catTableBody) {
      catTableBody.innerHTML = analytics.categoryBreakdown.map(c => `
        <tr>
          <td><strong>${c.category}</strong></td>
          <td>${c.facings} (${c.shareOfFacingsPct}%)</td>
          <td>${c.shareOfSpacePct}%</td>
          <td>$${c.projectedDailyRevenue.toFixed(2)}</td>
          <td><strong class="text-success">+$${c.projectedDailyMargin.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }
  }

  updateHeatmapLegend() {
    const legendContainer = document.getElementById('heatmap-legend-container');
    if (!legendContainer) return;

    const items = this.heatmapEngine.getLegend();
    if (items.length === 0) {
      legendContainer.style.display = 'none';
      legendContainer.innerHTML = '';
      return;
    }

    legendContainer.style.display = 'flex';
    legendContainer.innerHTML = items.map(item => `
      <div class="legend-chip">
        <span class="legend-color-dot" style="background: ${item.color}"></span>
        <span class="legend-chip-label">${item.label}</span>
      </div>
    `).join('');
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CoolerPlanogramApp();
  window.app.init();
});
