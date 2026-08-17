/**
 * Rule & Data Source Editor
 * Allows inspecting and editing SKUs, Cooler Specs, and Merchandising Rules in real-time.
 */

export class RuleEditor {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.onDataChanged = options.onDataChanged || (() => {});
    this.currentTab = 'rules'; // 'rules' | 'skus' | 'coolers'
  }

  render(skus, coolerSpecs, rules) {
    this.skus = skus;
    this.coolerSpecs = coolerSpecs;
    this.rules = rules;

    this.container.innerHTML = `
      <div class="editor-panel-header">
        <div class="editor-tabs">
          <button class="tab-btn ${this.currentTab === 'rules' ? 'active' : ''}" data-tab="rules">
            📋 Merchandising Config (JSON)
          </button>
          <button class="tab-btn ${this.currentTab === 'skus' ? 'active' : ''}" data-tab="skus">
            🥤 SKU Catalog (${skus.length})
          </button>
          <button class="tab-btn ${this.currentTab === 'coolers' ? 'active' : ''}" data-tab="coolers">
            ❄️ Cooler Fixtures (${coolerSpecs.length})
          </button>
        </div>
        <div class="editor-header-actions">
          <button class="btn-primary-gradient btn-reoptimize" id="btn-reoptimize">
            ⚡ Run Space Optimization
          </button>
        </div>
      </div>

      <div class="editor-panel-body">
        <div class="editor-tab-content ${this.currentTab === 'rules' ? 'active' : ''}" id="tab-rules">
          <div class="json-editor-wrapper">
            <div class="editor-helper-banner">
              💡 <strong>Live Merchandising Config</strong>: Edit brand adjacency graph, vertical tier preferences, or elasticity parameters below.
            </div>
            <textarea class="code-editor-textarea" id="textarea-rules" spellcheck="false">${JSON.stringify(rules, null, 2)}</textarea>
            <div class="editor-footer-row">
              <button class="btn-secondary" id="btn-apply-rules">Apply Rule Changes</button>
              <button class="btn-secondary" id="btn-reset-rules">Reset Defaults</button>
            </div>
          </div>
        </div>

        <div class="editor-tab-content ${this.currentTab === 'skus' ? 'active' : ''}" id="tab-skus">
          <div class="sku-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>SKU ID</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Flavor</th>
                  <th>Dimensions (WxHxD)</th>
                  <th>Weight</th>
                  <th>Velocity</th>
                  <th>Price / Cost</th>
                  <th>Margin</th>
                  <th>Min-Max Facings</th>
                </tr>
              </thead>
              <tbody>
                ${skus.map(s => `
                  <tr>
                    <td><code>${s.sku_id}</code></td>
                    <td><strong>${s.name}</strong></td>
                    <td><span class="brand-pill" style="border-left: 3px solid ${s.color_hex}">${s.brand}</span></td>
                    <td>${s.flavor}</td>
                    <td>${s.dimensions_mm.width} x ${s.dimensions_mm.height} x ${s.dimensions_mm.depth} mm</td>
                    <td>${s.weight_g}g</td>
                    <td><span class="badge-tag">${s.sales_velocity_units_day} u/day</span></td>
                    <td>$${s.unit_price.toFixed(2)} ($${s.unit_cost.toFixed(2)})</td>
                    <td><strong class="text-success">+$${s.margin.toFixed(2)}</strong></td>
                    <td>${s.min_facings} - ${s.max_facings}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="editor-tab-content ${this.currentTab === 'coolers' ? 'active' : ''}" id="tab-coolers">
          <div class="coolers-spec-wrapper">
            ${coolerSpecs.map(c => `
              <div class="cooler-spec-card">
                <div class="spec-card-header">
                  <h3>❄️ ${c.name} (${c.cooler_id})</h3>
                  <span class="badge-tag">${c.doors} Doors | ${c.total_width_mm}W x ${c.total_height_mm}H x ${c.total_depth_mm}D mm</span>
                </div>
                <div class="spec-bays-list">
                  ${c.bays.map(bay => `
                    <div class="spec-bay-block">
                      <h4>Door ${bay.door_index}: ${bay.door_label}</h4>
                      <table class="data-table small">
                        <thead>
                          <tr>
                            <th>Shelf ID</th>
                            <th>Tier Level</th>
                            <th>Usable W x D</th>
                            <th>Clearance Height</th>
                            <th>Weight Limit</th>
                            <th>Eye-Level Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${bay.shelves.map(s => `
                            <tr>
                              <td><code>${s.shelf_id}</code></td>
                              <td><span class="tier-pill ${s.tier}">${s.tier_label || s.tier}</span></td>
                              <td>${s.usable_width_mm} x ${s.usable_depth_mm} mm</td>
                              <td><strong>${s.clearance_height_mm} mm</strong></td>
                              <td>${s.max_weight_kg} kg</td>
                              <td>${s.eye_level_score.toFixed(2)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Tab switching
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.getAttribute('data-tab');
        this.container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        this.container.querySelector(`#tab-${this.currentTab}`)?.classList.add('active');
      });
    });

    // Apply rules button
    const btnApply = this.container.querySelector('#btn-apply-rules');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        try {
          const raw = this.container.querySelector('#textarea-rules').value;
          const parsed = JSON.parse(raw);
          this.rules = parsed;
          this.onDataChanged({ skus: this.skus, coolerSpecs: this.coolerSpecs, rules: this.rules });
          alert('✅ Merchandising rules updated successfully!');
        } catch (err) {
          alert('❌ Invalid JSON in rules editor: ' + err.message);
        }
      });
    }

    // Reoptimize trigger
    const btnReopt = this.container.querySelector('#btn-reoptimize');
    if (btnReopt) {
      btnReopt.addEventListener('click', () => {
        try {
          const raw = this.container.querySelector('#textarea-rules').value;
          const parsed = JSON.parse(raw);
          this.rules = parsed;
        } catch (e) {}
        this.onDataChanged({ skus: this.skus, coolerSpecs: this.coolerSpecs, rules: this.rules, triggerOptimize: true });
      });
    }
  }
}
