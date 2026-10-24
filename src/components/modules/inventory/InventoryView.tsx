import { createSignal, onMount, For, Show } from "solid-js";
import { api, ProductView, WarehouseView, WarehouseStock } from "../../../api/client";
import { IconPlus, IconRefresh, IconAlert, IconCheck, IconBuilding } from "../../ui/Icons";

export function InventoryView() {
  const [activeTab, setActiveTab] = createSignal<"stock" | "catalog" | "warehouses">("stock");
  const [products, setProducts] = createSignal<ProductView[]>([]);
  const [warehouses, setWarehouses] = createSignal<WarehouseView[]>([]);
  const [stockLevels, setStockLevels] = createSignal<WarehouseStock[]>([]);

  const [showProductModal, setShowProductModal] = createSignal(false);
  const [showTransferModal, setShowTransferModal] = createSignal(false);

  // New Product Form State
  const [sku, setSku] = createSignal("");
  const [name, setName] = createSignal("");
  const [category, setCategory] = createSignal("Machinery");
  const [unit, setUnit] = createSignal("Pcs");
  const [purchaseCost, setPurchaseCost] = createSignal(0);
  const [sellingPrice, setSellingPrice] = createSignal(0);
  const [isVatExempt, setIsVatExempt] = createSignal(false);
  const [minAlert, setMinAlert] = createSignal(5);

  // Stock Transfer State
  const [transferNo, setTransferNo] = createSignal(`TRF-${Date.now().toString().slice(-6)}`);
  const [fromWhId, setFromWhId] = createSignal("");
  const [toWhId, setToWhId] = createSignal("");
  const [transferProdId, setTransferProdId] = createSignal("");
  const [transferQty, setTransferQty] = createSignal(1);

  const loadData = async () => {
    try {
      const [prods, whs, stock] = await Promise.all([
        api.getProducts(),
        api.getWarehouses(),
        api.getStockLevels(),
      ]);
      setProducts(prods);
      setWarehouses(whs);
      setStockLevels(stock);

      if (whs.length >= 2) {
        if (!fromWhId()) setFromWhId(whs[0].id);
        if (!toWhId()) setToWhId(whs[1].id);
      }
      if (prods.length > 0 && !transferProdId()) setTransferProdId(prods[0].id);
    } catch (err: any) {
      console.error(err);
    }
  };

  onMount(loadData);

  const formatNpr = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleCreateProduct = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createProduct({
        sku: sku(),
        name: name(),
        category: category(),
        unit: unit(),
        purchase_cost_paisa: Math.round(Number(purchaseCost()) * 100),
        selling_price_paisa: Math.round(Number(sellingPrice()) * 100),
        is_vat_exempt: isVatExempt(),
        min_stock_alert: Number(minAlert()),
      });
      setShowProductModal(false);
      setSku("");
      setName("");
      loadData();
    } catch (err: any) {
      alert("Failed to create product: " + err.message);
    }
  };

  const handleTransfer = async (e: Event) => {
    e.preventDefault();
    if (fromWhId() === toWhId()) {
      alert("Source and Destination Godowns must be distinct!");
      return;
    }
    try {
      await api.transferStock({
        transfer_number: transferNo(),
        from_warehouse_id: fromWhId(),
        to_warehouse_id: toWhId(),
        items: [
          {
            product_id: transferProdId(),
            quantity: Number(transferQty()),
          },
        ],
        initiated_by: "admin",
      });
      setShowTransferModal(false);
      setTransferNo(`TRF-${Date.now().toString().slice(-6)}`);
      loadData();
    } catch (err: any) {
      alert("Transfer failed: " + err.message);
    }
  };

  const totalCatalogItems = () => products().length;
  const totalStockUnits = () => stockLevels().reduce((acc, s) => acc + s.quantity, 0);
  const lowStockAlerts = () => stockLevels().filter((s) => s.quantity < 5).length;

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
      {/* Title & Quick Actions */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ "font-size": "18px", "font-weight": "700", "letter-spacing": "-0.01em" }}>
            Multi-Godown Inventory & Stock Control
          </h2>
          <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
            Real-time stock on hand, inter-godown transfers, and catalog management
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <div class="erp-tabs">
            <button
              class={`erp-tab-btn ${activeTab() === "stock" ? "active" : ""}`}
              onClick={() => setActiveTab("stock")}
            >
              Stock by Godown
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "catalog" ? "active" : ""}`}
              onClick={() => setActiveTab("catalog")}
            >
              Product Catalog
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "warehouses" ? "active" : ""}`}
              onClick={() => setActiveTab("warehouses")}
            >
              Godown Locations
            </button>
          </div>

          <button
            type="button"
            class="erp-btn erp-btn-secondary"
            onClick={loadData}
            title="Refresh Data"
          >
            <IconRefresh size={14} />
          </button>

          <button
            type="button"
            class="erp-btn erp-btn-secondary"
            onClick={() => setShowTransferModal(true)}
          >
            <IconPlus size={14} />
            <span>+ Inter-Godown Transfer</span>
          </button>

          <button
            type="button"
            class="erp-btn erp-btn-primary"
            onClick={() => setShowProductModal(true)}
          >
            <IconPlus size={14} />
            <span>+ Register SKU</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div class="erp-kpi-grid">
        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Total SKUs in Catalog</div>
          <div class="erp-kpi-value tabular-nums">{totalCatalogItems()}</div>
          <div class="erp-kpi-subtext">Active machines and spare parts</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Physical Units on Hand</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-success)" }}>
            {totalStockUnits()}
          </div>
          <div class="erp-kpi-subtext">Across all active godowns</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Low Stock Warnings</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: lowStockAlerts() > 0 ? "var(--erp-warning)" : "var(--erp-text-main)" }}>
            {lowStockAlerts()}
          </div>
          <div class="erp-kpi-subtext">Items below minimum threshold</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Operational Godowns</div>
          <div class="erp-kpi-value tabular-nums">{warehouses().length}</div>
          <div class="erp-kpi-subtext">Central Birgunj & Hubs</div>
        </div>
      </div>

      {/* Stock Levels by Godown Tab */}
      <Show when={activeTab() === "stock"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Live Physical Stock Balance</div>
              <div class="erp-card-subtitle">Real-time inventory levels by product and fulfillment facility</div>
            </div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th>Category</th>
                  <th>Godown Facility</th>
                  <th style={{ "text-align": "right" }}>Quantity on Hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={stockLevels()}
                  fallback={
                    <tr>
                      <td colspan="5">
                        <div class="erp-empty-state">
                          <p>No inventory stock records found. Receive purchase bills to populate stock.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(stock) => (
                    <tr>
                      <td>
                        <div style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{stock.product_name}</div>
                        <div class="tabular-nums" style={{ "font-size": "11px", color: "var(--erp-text-muted)" }}>{stock.product_code}</div>
                      </td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{stock.category}</span>
                      </td>
                      <td style={{ "font-weight": "500" }}>{stock.warehouse_name}</td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "700", "font-size": "14px" }}>
                        {stock.quantity}
                      </td>
                      <td>
                        <Show
                          when={stock.quantity >= 5}
                          fallback={
                            <span class="erp-badge erp-badge-warning">
                              <IconAlert size={12} />
                              <span>Low Stock</span>
                            </span>
                          }
                        >
                          <span class="erp-badge erp-badge-success">
                            <IconCheck size={12} />
                            <span>In Stock</span>
                          </span>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Product Catalog Tab */}
      <Show when={activeTab() === "catalog"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Master Product & Spare Parts Catalog</div>
              <div class="erp-card-subtitle">Complete list of registered equipment, spares, and pricing</div>
            </div>
            <div class="erp-badge erp-badge-neutral">{products().length} Products</div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Code / SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ "text-align": "right" }}>Purchase Cost</th>
                  <th style={{ "text-align": "right" }}>Selling Price</th>
                  <th>Tax Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={products()}>
                  {(prod) => (
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{prod.code}</td>
                      <td style={{ "font-weight": "500" }}>{prod.name}</td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{prod.category}</span>
                      </td>
                      <td>{prod.unit}</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>
                        NPR {formatNpr(prod.purchase_cost_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        NPR {formatNpr(prod.selling_price_paisa)}
                      </td>
                      <td>
                        <span class={`erp-badge ${prod.is_vat_exempt ? "erp-badge-neutral" : "erp-badge-info"}`}>
                          {prod.is_vat_exempt ? "VAT Exempt" : "13% VAT Taxable"}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Godown Locations Tab */}
      <Show when={activeTab() === "warehouses"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Storage Facilities & Godown Hubs</div>
              <div class="erp-card-subtitle">Logistics depots across Nepal</div>
            </div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Godown Name</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={warehouses()}>
                  {(wh) => (
                    <tr>
                      <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{wh.name}</td>
                      <td>{wh.location}</td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{wh.is_central ? "Central Godown" : "Regional Depot"}</span>
                      </td>
                      <td>
                        <span class="erp-badge erp-badge-success">Operational</span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Register Product Modal */}
      <Show when={showProductModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "540px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Register New Product / Spare Part</div>
                <div class="erp-card-subtitle">Assign SKU, category, and standard pricing</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowProductModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div style={{ display: "grid", "grid-template-columns": "1fr 2fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">SKU / Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AG-102"
                      class="erp-input tabular-nums"
                      value={sku()}
                      onInput={(e) => setSku(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tractor Hydraulic Pump"
                      class="erp-input"
                      value={name()}
                      onInput={(e) => setName(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Category</label>
                    <select
                      class="erp-select"
                      value={category()}
                      onChange={(e) => setCategory(e.currentTarget.value)}
                    >
                      <option value="Machinery">Machinery & Equipment</option>
                      <option value="Spare Parts">Spare Parts</option>
                      <option value="Tools">Field Tools</option>
                      <option value="Consumables">Consumables & Lubricants</option>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Unit of Measure</label>
                    <input
                      type="text"
                      required
                      class="erp-input"
                      value={unit()}
                      onInput={(e) => setUnit(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Purchase Cost (NPR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      class="erp-input tabular-nums"
                      value={purchaseCost()}
                      onInput={(e) => setPurchaseCost(Number(e.currentTarget.value))}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Selling Price (NPR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      class="erp-input tabular-nums"
                      value={sellingPrice()}
                      onInput={(e) => setSellingPrice(Number(e.currentTarget.value))}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    id="vatEx"
                    checked={isVatExempt()}
                    onChange={(e) => setIsVatExempt(e.currentTarget.checked)}
                    style={{ width: "auto" }}
                  />
                  <label for="vatEx" style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)", cursor: "pointer" }}>
                    Nepal VAT Exempt (छुट वस्तु)
                  </label>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Save Product SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Stock Transfer Modal */}
      <Show when={showTransferModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "500px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Inter-Godown Stock Transfer</div>
                <div class="erp-card-subtitle">Relocate units between central and regional depots</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowTransferModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransfer}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Transfer Reference #</label>
                  <input
                    type="text"
                    required
                    class="erp-input tabular-nums"
                    value={transferNo()}
                    onInput={(e) => setTransferNo(e.currentTarget.value)}
                  />
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Source Godown (From)</label>
                    <select
                      class="erp-select"
                      value={fromWhId()}
                      onChange={(e) => setFromWhId(e.currentTarget.value)}
                    >
                      <For each={warehouses()}>
                        {(wh) => <option value={wh.id}>{wh.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Destination Godown (To)</label>
                    <select
                      class="erp-select"
                      value={toWhId()}
                      onChange={(e) => setToWhId(e.currentTarget.value)}
                    >
                      <For each={warehouses()}>
                        {(wh) => <option value={wh.id}>{wh.name}</option>}
                      </For>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "2fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Product / Spare Part</label>
                    <select
                      class="erp-select"
                      value={transferProdId()}
                      onChange={(e) => setTransferProdId(e.currentTarget.value)}
                    >
                      <For each={products()}>
                        {(p) => <option value={p.id}>{p.code} - {p.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      class="erp-input tabular-nums"
                      value={transferQty()}
                      onInput={(e) => setTransferQty(Number(e.currentTarget.value))}
                    />
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Execute Stock Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
