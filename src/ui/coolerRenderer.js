/**
 * Cooler Visual Canvas & Renderer
 * Handles rendering the cooler bays, shelves, beverage items, drag-and-drop interactions,
 * and live facing adjustments.
 */

export class CoolerRenderer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.heatmapEngine = options.heatmapEngine;
    this.onPlanogramModified = options.onPlanogramModified || (() => {});
    this.draggedItem = null;
    this.draggedSourceShelfId = null;
  }

  /**
   * Renders the complete cooler layout
   * @param {Object} planogram
   * @param {Object} validation
   * @param {Object} analytics
   * @param {Array} skus
   * @param {Array} coolerSpecs
   */
  render(planogram, validation, analytics, skus, coolerSpecs) {
    this.planogram = planogram;
    this.validation = validation;
    this.analytics = analytics;
    this.skus = skus;
    this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
    this.coolerSpecs = coolerSpecs;

    const cooler = coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || coolerSpecs[0];
    this.container.innerHTML = '';

    // Create Main Cooler Fixture Container
    const coolerFixture = document.createElement('div');
    coolerFixture.className = 'cooler-fixture';
    coolerFixture.setAttribute('data-doors', cooler.doors);

    // Cooler Top Header / Canopy (Illuminated Brand Header)
    const headerCanopy = document.createElement('div');
    headerCanopy.className = 'cooler-header-canopy';
    headerCanopy.innerHTML = `
      <div class="cooler-header-brand">
        <span class="cooler-logo-icon">❄️</span>
        <span class="cooler-header-title">${cooler.name}</span>
      </div>
      <div class="cooler-header-stats">
        <span class="badge-tag"><i class="tag-dot green"></i> LED Illumination Active</span>
        <span class="badge-tag">Width: ${cooler.total_width_mm}mm</span>
        <span class="badge-tag">Doors: ${cooler.doors}</span>
      </div>
    `;
    coolerFixture.appendChild(headerCanopy);

    // Bays Grid Container (Doors side-by-side)
    const baysGrid = document.createElement('div');
    baysGrid.className = 'cooler-bays-grid';

    for (let d = 1; d <= cooler.doors; d++) {
      const bayShelves = planogram.shelves.filter(s => s.door_index === d);
      const bayElement = document.createElement('div');
      bayElement.className = 'cooler-bay';
      bayElement.innerHTML = `
        <div class="bay-header">
          <span class="bay-door-label">Door ${d}: ${d === 1 ? 'Core & Flavour' : 'Energy & Hydration'}</span>
          <span class="bay-door-handle"></span>
        </div>
      `;

      const shelvesContainer = document.createElement('div');
      shelvesContainer.className = 'bay-shelves-container';

      for (const shelf of bayShelves) {
        const shelfElement = this.createShelfElement(shelf);
        shelvesContainer.appendChild(shelfElement);
      }

      bayElement.appendChild(shelvesContainer);
      baysGrid.appendChild(bayElement);
    }

    coolerFixture.appendChild(baysGrid);

    // Cooler Base / Compressor Grill
    const baseGrill = document.createElement('div');
    baseGrill.className = 'cooler-base-grill';
    baseGrill.innerHTML = `
      <div class="grill-slits"></div>
      <div class="temp-display">🌡️ 3.4°C | Optimal Chill</div>
    `;
    coolerFixture.appendChild(baseGrill);

    this.container.appendChild(coolerFixture);
  }

  createShelfElement(shelf) {
    const shelfAnalytics = this.analytics?.shelfAnalytics?.find(s => s.shelf_id === shelf.shelf_id);
    const fillPct = shelfAnalytics ? shelfAnalytics.widthUtilizationPct : 0;
    const isOverflow = fillPct > 100;
    const isUnderfill = fillPct < 75;

    const shelfWrapper = document.createElement('div');
    shelfWrapper.className = `shelf-wrapper tier-${shelf.tier} ${isOverflow ? 'shelf-overflow' : ''}`;
    shelfWrapper.setAttribute('data-shelf-id', shelf.shelf_id);

    // Shelf Header Meta Bar
    const metaBar = document.createElement('div');
    metaBar.className = 'shelf-meta-bar';
    metaBar.innerHTML = `
      <div class="shelf-tier-tag">
        <span class="tier-pill ${shelf.tier}">${shelf.tier_label || shelf.tier}</span>
        <span class="shelf-dim-info">H: ${shelf.clearance_height_mm}mm | W: ${shelf.usable_width_mm}mm</span>
      </div>
      <div class="shelf-utilization-metric">
        <div class="utilization-bar-bg">
          <div class="utilization-bar-fill ${isOverflow ? 'danger' : (fillPct > 90 ? 'optimal' : 'normal')}" style="width: ${Math.min(100, fillPct)}%"></div>
        </div>
        <span class="utilization-text ${isOverflow ? 'text-danger' : ''}">${fillPct}% Full (${shelfAnalytics ? shelfAnalytics.widthUsedMm : 0}mm)</span>
      </div>
    `;
    shelfWrapper.appendChild(metaBar);

    // Shelf Deck Area with Items
    const shelfDeck = document.createElement('div');
    shelfDeck.className = 'shelf-deck';
    shelfDeck.setAttribute('data-shelf-id', shelf.shelf_id);

    // Drag-and-drop listeners on shelf deck
    shelfDeck.addEventListener('dragover', (e) => {
      e.preventDefault();
      shelfDeck.classList.add('drag-hover');
    });

    shelfDeck.addEventListener('dragleave', () => {
      shelfDeck.classList.remove('drag-hover');
    });

    shelfDeck.addEventListener('drop', (e) => {
      e.preventDefault();
      shelfDeck.classList.remove('drag-hover');
      this.handleDropOnShelf(shelf.shelf_id);
    });

    // Placements
    for (let pIdx = 0; pIdx < shelf.placements.length; pIdx++) {
      const placement = shelf.placements[pIdx];
      const sku = this.skuMap.get(placement.sku_id);
      if (!sku) continue;

      const itemCard = this.createItemCard(placement, sku, shelf, pIdx);
      shelfDeck.appendChild(itemCard);
    }

    if (shelf.placements.length === 0) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'empty-shelf-placeholder';
      emptySlot.textContent = '+ Drag SKU here or Optimize';
      shelfDeck.appendChild(emptySlot);
    }

    shelfWrapper.appendChild(shelfDeck);

    // Physical shelf wire rack edge
    const rackEdge = document.createElement('div');
    rackEdge.className = 'shelf-rack-edge';
    shelfWrapper.appendChild(rackEdge);

    return shelfWrapper;
  }

  createItemCard(placement, sku, shelf, placementIndex) {
    const card = document.createElement('div');
    card.className = 'sku-facing-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-sku-id', sku.sku_id);
    card.setAttribute('data-placement-idx', placementIndex);

    // Calculate relative width percentage on shelf
    const totalWidth = placement.facings * sku.dimensions_mm.width;
    const widthPct = (totalWidth / shelf.usable_width_mm) * 100;
    card.style.flex = `${widthPct} 0 auto`;
    card.style.minWidth = `${Math.max(48, placement.facings * 28)}px`;

    // Get styling from heatmap engine
    const style = this.heatmapEngine ? this.heatmapEngine.getItemStyle(placement, sku, shelf, this.analytics) : { background: placement.color_hex };
    card.style.background = style.background;

    // Item content
    card.innerHTML = `
      <div class="sku-card-inner">
        <div class="sku-header-row">
          <span class="sku-emoji">${sku.image_emoji || '🥤'}</span>
          <span class="sku-facings-badge">x${placement.facings}</span>
        </div>
        <div class="sku-info-body">
          <div class="sku-brand-name">${sku.brand}</div>
          <div class="sku-flavor-name">${sku.flavor}</div>
          <div class="sku-size-tag">${sku.package_type || ''}</div>
        </div>
        ${style.badge ? `<div class="sku-heatmap-badge">${style.badge}</div>` : ''}
        <div class="sku-quick-controls">
          <button class="btn-facing-step btn-minus" title="Reduce Facing">-</button>
          <button class="btn-facing-step btn-plus" title="Add Facing">+</button>
        </div>
      </div>
      <div class="sku-hover-tooltip">
        <div class="tooltip-title">${sku.name}</div>
        <div class="tooltip-grid">
          <div><span>Brand:</span> <strong>${sku.brand}</strong></div>
          <div><span>Flavor:</span> <strong>${sku.flavor}</strong></div>
          <div><span>Category:</span> <strong>${sku.category}</strong></div>
          <div><span>Facings:</span> <strong>${placement.facings} (x${sku.dimensions_mm.width}mm)</strong></div>
          <div><span>Daily Velocity:</span> <strong>${sku.sales_velocity_units_day} units</strong></div>
          <div><span>Unit Price:</span> <strong>$${sku.unit_price.toFixed(2)}</strong></div>
          <div><span>Margin / Unit:</span> <strong>$${sku.margin.toFixed(2)}</strong></div>
          <div><span>Pkg Dimensions:</span> <strong>${sku.dimensions_mm.width}W x ${sku.dimensions_mm.height}H x ${sku.dimensions_mm.depth}D</strong></div>
        </div>
      </div>
    `;

    // Button event listeners
    const btnMinus = card.querySelector('.btn-minus');
    const btnPlus = card.querySelector('.btn-plus');

    btnMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modifyFacingCount(shelf.shelf_id, placementIndex, -1);
    });

    btnPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modifyFacingCount(shelf.shelf_id, placementIndex, +1);
    });

    // Drag-and-drop events
    card.addEventListener('dragstart', (e) => {
      this.draggedItem = { shelfId: shelf.shelf_id, placementIndex, placement, sku };
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', sku.sku_id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.draggedItem = null;
    });

    return card;
  }

  modifyFacingCount(shelfId, placementIndex, delta) {
    const shelf = this.planogram.shelves.find(s => s.shelf_id === shelfId);
    if (!shelf || !shelf.placements[placementIndex]) return;

    const p = shelf.placements[placementIndex];
    const newFacings = p.facings + delta;

    if (newFacings <= 0) {
      shelf.placements.splice(placementIndex, 1);
    } else {
      p.facings = newFacings;
      p.total_placement_width_mm = p.facings * p.width_mm;
    }

    // Recompute x_offsets
    let offset = 0;
    for (const item of shelf.placements) {
      item.x_offset_mm = offset;
      offset += item.total_placement_width_mm;
    }

    this.onPlanogramModified(this.planogram);
  }

  handleDropOnShelf(targetShelfId) {
    if (!this.draggedItem) return;
    const sourceShelf = this.planogram.shelves.find(s => s.shelf_id === this.draggedItem.shelfId);
    const targetShelf = this.planogram.shelves.find(s => s.shelf_id === targetShelfId);

    if (!sourceShelf || !targetShelf) return;

    // Move placement
    const [movedPlacement] = sourceShelf.placements.splice(this.draggedItem.placementIndex, 1);
    targetShelf.placements.push(movedPlacement);

    // Recompute offsets on both shelves
    for (const shelf of [sourceShelf, targetShelf]) {
      let offset = 0;
      for (const item of shelf.placements) {
        item.x_offset_mm = offset;
        offset += item.total_placement_width_mm;
      }
    }

    this.onPlanogramModified(this.planogram);
  }
}
