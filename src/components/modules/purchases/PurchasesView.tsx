import { createSignal, onMount, For, Show } from "solid-js";
import { api, Vendor, PurchaseBookRow, ExpenseRecord, CoaAccount, ProductView, WarehouseView } from "../../../api/client";
import { IconPlus, IconRefresh, IconAlert, IconCheck } from "../../ui/Icons";

export function PurchasesView() {
  const [activeTab, setActiveTab] = createSignal<"purchase_book" | "expenses" | "vendors">("purchase_book");
  const [purchaseBook, setPurchaseBook] = createSignal<PurchaseBookRow[]>([]);
  const [expenses, setExpenses] = createSignal<ExpenseRecord[]>([]);
  const [vendors, setVendors] = createSignal<Vendor[]>([]);
  const [accounts, setAccounts] = createSignal<CoaAccount[]>([]);
  const [products, setProducts] = createSignal<ProductView[]>([]);
  const [warehouses, setWarehouses] = createSignal<WarehouseView[]>([]);

  const [showBillModal, setShowBillModal] = createSignal(false);
  const [showExpenseModal, setShowExpenseModal] = createSignal(false);

  // Bill Form State
  const [billNo, setBillNo] = createSignal(`BILL-${Date.now().toString().slice(-6)}`);
  const [selectedVendorId, setSelectedVendorId] = createSignal("");
  const [selectedWarehouseId, setSelectedWarehouseId] = createSignal("");
  const [selectedProductId, setSelectedProductId] = createSignal("");
  const [quantity, setQuantity] = createSignal(1);
  const [unitCost, setUnitCost] = createSignal(0);

  // Expense Form State
  const [expenseNo, setExpenseNo] = createSignal(`EXP-${Date.now().toString().slice(-6)}`);
  const [expenseAccountId, setExpenseAccountId] = createSignal("");
  const [expenseTitle, setExpenseTitle] = createSignal("");
  const [expenseTaxable, setExpenseTaxable] = createSignal(50000); // 50,000 NPR
  const [hasVat, setHasVat] = createSignal(false);
  const [tdsRateBps, setTdsRateBps] = createSignal(1000); // 10% Office rent default
  const [paymentMode, setPaymentMode] = createSignal("Bank");

  const loadData = async () => {
    try {
      const [book, exps, vends, accs, prods, whs] = await Promise.all([
        api.getPurchaseBook(),
        api.getOperatingExpenses(),
        api.getVendors(),
        api.getCoaAccounts(),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setPurchaseBook(book);
      setExpenses(exps);
      setVendors(vends);
      setAccounts(accs.filter((a) => a.account_type === "Expense"));
      setProducts(prods);
      setWarehouses(whs);

      if (vends.length > 0 && !selectedVendorId()) setSelectedVendorId(vends[0].id);
      if (whs.length > 0 && !selectedWarehouseId()) setSelectedWarehouseId(whs[0].id);
      if (prods.length > 0 && !selectedProductId()) {
        setSelectedProductId(prods[0].id);
        setUnitCost(prods[0].purchase_cost_paisa / 100);
      }
      if (accs.length > 0 && !expenseAccountId()) setExpenseAccountId(accs[0].id);
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

  const handleCreateBill = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createPurchaseBill({
        vendor_id: selectedVendorId(),
        bill_number: billNo(),
        bill_date: new Date().toISOString().split("T")[0],
        warehouse_id: selectedWarehouseId(),
        items: [
          {
            product_id: selectedProductId(),
            quantity: Number(quantity()),
            unit_cost_paisa: Math.round(Number(unitCost()) * 100),
            is_vat_exempt: false,
          },
        ],
        recorded_by: "admin",
      });
      setShowBillModal(false);
      setBillNo(`BILL-${Date.now().toString().slice(-6)}`);
      loadData();
    } catch (err: any) {
      alert("Failed to record bill: " + err.message);
    }
  };

  const handleRecordExpense = async (e: Event) => {
    e.preventDefault();
    const basePaisa = Math.round(Number(expenseTaxable()) * 100);
    const vatP = hasVat() ? Math.round(basePaisa * 0.13) : 0;
    const tdsP = Math.round((basePaisa * Number(tdsRateBps())) / 10000);
    const netP = basePaisa + vatP - tdsP;

    try {
      await api.recordExpense({
        expense_number: expenseNo(),
        account_id: expenseAccountId(),
        vendor_id: selectedVendorId() || undefined,
        title: expenseTitle(),
        date: new Date().toISOString().split("T")[0],
        taxable_paisa: basePaisa,
        vat_paisa: vatP,
        tds_rate_bps: Number(tdsRateBps()),
        tds_paisa: tdsP,
        net_payable_paisa: netP,
        payment_mode: paymentMode(),
        recorded_by: "admin",
      });
      setShowExpenseModal(false);
      setExpenseNo(`EXP-${Date.now().toString().slice(-6)}`);
      setExpenseTitle("");
      loadData();
    } catch (err: any) {
      alert("Failed to record expense: " + err.message);
    }
  };

  const totalPurchasePaisa = () => purchaseBook().reduce((acc, row) => acc + row.total_amount_paisa, 0);
  const totalClaimableVatPaisa = () => purchaseBook().reduce((acc, row) => acc + row.vat_amount_paisa, 0);
  const totalTdsWithheldPaisa = () => expenses().reduce((acc, e) => acc + e.tds_paisa, 0);

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
      {/* Top Header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ "font-size": "18px", "font-weight": "700", "letter-spacing": "-0.01em" }}>
            Purchases, IRD Purchase Book (खरिद खाता) & TDS
          </h2>
          <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
            Vendor procurement, input VAT reconciliation, and statutory TDS withholding
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <div class="erp-tabs">
            <button
              class={`erp-tab-btn ${activeTab() === "purchase_book" ? "active" : ""}`}
              onClick={() => setActiveTab("purchase_book")}
            >
              Purchase Book
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "expenses" ? "active" : ""}`}
              onClick={() => setActiveTab("expenses")}
            >
              Expenses & TDS
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "vendors" ? "active" : ""}`}
              onClick={() => setActiveTab("vendors")}
            >
              Suppliers / Vendors
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
            onClick={() => setShowExpenseModal(true)}
          >
            <IconPlus size={14} />
            <span>+ Record Expense / TDS</span>
          </button>

          <button
            type="button"
            class="erp-btn erp-btn-primary"
            onClick={() => setShowBillModal(true)}
          >
            <IconPlus size={14} />
            <span>+ Receive Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div class="erp-kpi-grid">
        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Total Purchases Invoiced</div>
          <div class="erp-kpi-value tabular-nums">
            NPR {formatNpr(totalPurchasePaisa())}
          </div>
          <div class="erp-kpi-subtext">Vendor stock procurement</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Claimable Input VAT (13%)</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-success)" }}>
            NPR {formatNpr(totalClaimableVatPaisa())}
          </div>
          <div class="erp-kpi-subtext">Deductible against Sales VAT</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">TDS Tax Withheld</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-warning)" }}>
            NPR {formatNpr(totalTdsWithheldPaisa())}
          </div>
          <div class="erp-kpi-subtext">Rent (10%), Services (15%), PAN (1.5%)</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Registered Suppliers</div>
          <div class="erp-kpi-value tabular-nums">{vendors().length}</div>
          <div class="erp-kpi-subtext">Active vendor accounts</div>
        </div>
      </div>

      {/* Purchase Book Tab */}
      <Show when={activeTab() === "purchase_book"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">IRD Statutory Purchase Register (अनुसूची १२ - खरिद खाता)</div>
              <div class="erp-card-subtitle">Official input VAT register for Nepal tax department</div>
            </div>
            <div class="erp-badge erp-badge-neutral">{purchaseBook().length} Invoices</div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Date (मिति)</th>
                  <th>Bill # (बिल नं)</th>
                  <th>Vendor / Supplier (आपूर्तिकर्ता)</th>
                  <th>PAN (स्थायी लेखा नं)</th>
                  <th style={{ "text-align": "right" }}>Total Amount (जम्मा)</th>
                  <th style={{ "text-align": "right" }}>Exempt (छुट)</th>
                  <th style={{ "text-align": "right" }}>Taxable (करयोग्य)</th>
                  <th style={{ "text-align": "right" }}>13% VAT (कर)</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={purchaseBook()}
                  fallback={
                    <tr>
                      <td colspan="8">
                        <div class="erp-empty-state">
                          <p>No purchase bills recorded yet. Click "+ Receive Purchase Bill" to log stock entry.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(row) => (
                    <tr>
                      <td class="tabular-nums" style={{ color: "var(--erp-text-secondary)" }}>{row.bill_date}</td>
                      <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{row.bill_no}</td>
                      <td style={{ "font-weight": "500" }}>{row.seller_name}</td>
                      <td class="tabular-nums" style={{ color: "var(--erp-text-muted)" }}>{row.seller_pan || "—"}</td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(row.total_amount_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>
                        {formatNpr(row.exempt_amount_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>
                        {formatNpr(row.taxable_amount_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600", color: "var(--erp-success)" }}>
                        {formatNpr(row.vat_amount_paisa)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Expenses & TDS Tab */}
      <Show when={activeTab() === "expenses"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Operating Expenses & Statutory TDS Withholdings</div>
              <div class="erp-card-subtitle">Automatic TDS withholding entries (Office Rent, Consultancy, Contracts)</div>
            </div>
            <div class="erp-badge erp-badge-neutral">{expenses().length} Records</div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref #</th>
                  <th>Description</th>
                  <th>Payment</th>
                  <th style={{ "text-align": "right" }}>Gross Expense</th>
                  <th style={{ "text-align": "right" }}>TDS Withheld</th>
                  <th style={{ "text-align": "right" }}>Net Disbursed</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={expenses()}
                  fallback={
                    <tr>
                      <td colspan="7">
                        <div class="erp-empty-state">
                          <p>No operational expenses recorded. Click "+ Record Expense / TDS" to log rent or utilities.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(exp) => (
                    <tr>
                      <td class="tabular-nums">{exp.date}</td>
                      <td style={{ "font-weight": "600" }}>{exp.expense_number}</td>
                      <td style={{ "font-weight": "500" }}>{exp.title}</td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{exp.payment_mode}</span>
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(exp.taxable_paisa + exp.vat_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-warning)", "font-weight": "600" }}>
                        {formatNpr(exp.tds_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)", "font-weight": "600" }}>
                        {formatNpr(exp.net_payable_paisa)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Vendors Tab */}
      <Show when={activeTab() === "vendors"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Approved Supplier Directory</div>
              <div class="erp-card-subtitle">Registered manufacturers and local spare part distributors</div>
            </div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>PAN / VAT</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                <For each={vendors()}>
                  {(v) => (
                    <tr>
                      <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{v.company_name}</td>
                      <td>{v.contact_person}</td>
                      <td class="tabular-nums">{v.phone}</td>
                      <td class="tabular-nums">{v.pan_number || "—"}</td>
                      <td style={{ color: "var(--erp-text-secondary)" }}>{v.address}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Receive Purchase Bill Modal */}
      <Show when={showBillModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "620px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Log Vendor Purchase Bill</div>
                <div class="erp-card-subtitle">Receives inventory into godown and updates 13% Input VAT</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowBillModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBill}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "1rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Bill / Invoice Reference #</label>
                    <input
                      type="text"
                      required
                      class="erp-input"
                      value={billNo()}
                      onInput={(e) => setBillNo(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Destination Godown</label>
                    <select
                      class="erp-select"
                      value={selectedWarehouseId()}
                      onChange={(e) => setSelectedWarehouseId(e.currentTarget.value)}
                    >
                      <For each={warehouses()}>
                        {(wh) => <option value={wh.id}>{wh.name} ({wh.location})</option>}
                      </For>
                    </select>
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Supplier / Vendor</label>
                  <select
                    class="erp-select"
                    value={selectedVendorId()}
                    onChange={(e) => setSelectedVendorId(e.currentTarget.value)}
                  >
                    <For each={vendors()}>
                      {(v) => <option value={v.id}>{v.company_name} (PAN: {v.pan_number})</option>}
                    </For>
                  </select>
                </div>

                <div class="erp-card" style={{ background: "var(--erp-bg-subtle)", padding: "1rem" }}>
                  <div style={{ "font-size": "12px", "font-weight": "600", "margin-bottom": "0.75rem" }}>
                    Bill Line Item
                  </div>
                  <div style={{ display: "grid", "grid-template-columns": "2fr 1fr 1fr", gap: "0.75rem" }}>
                    <div class="erp-form-group">
                      <label class="erp-label">Product / Spare Part</label>
                      <select
                        class="erp-select"
                        value={selectedProductId()}
                        onChange={(e) => setSelectedProductId(e.currentTarget.value)}
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
                        value={quantity()}
                        onInput={(e) => setQuantity(Number(e.currentTarget.value))}
                      />
                    </div>

                    <div class="erp-form-group">
                      <label class="erp-label">Unit Cost (NPR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        class="erp-input tabular-nums"
                        value={unitCost()}
                        onInput={(e) => setUnitCost(Number(e.currentTarget.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowBillModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Post Purchase Bill & Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Record Expense Modal */}
      <Show when={showExpenseModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "560px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Record Expense with Nepal TDS Withholding</div>
                <div class="erp-card-subtitle">Applies IRD statutory withholding rates with immediate ledger posting</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowExpenseModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordExpense}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Expense Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Office Rent - Kartik 2081"
                    class="erp-input"
                    value={expenseTitle()}
                    onInput={(e) => setExpenseTitle(e.currentTarget.value)}
                  />
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Expense Ledger Account</label>
                    <select
                      class="erp-select"
                      value={expenseAccountId()}
                      onChange={(e) => setExpenseAccountId(e.currentTarget.value)}
                    >
                      <For each={accounts()}>
                        {(acc) => <option value={acc.id}>{acc.code} - {acc.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Payment Mode</label>
                    <select
                      class="erp-select"
                      value={paymentMode()}
                      onChange={(e) => setPaymentMode(e.currentTarget.value)}
                    >
                      <option value="Bank">Bank Transfer (Nabil)</option>
                      <option value="Cash">Cash Account (1010)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Taxable Amount (NPR)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      class="erp-input tabular-nums"
                      value={expenseTaxable()}
                      onInput={(e) => setExpenseTaxable(Number(e.currentTarget.value))}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Statutory TDS Rate</label>
                    <select
                      class="erp-select"
                      value={tdsRateBps()}
                      onChange={(e) => setTdsRateBps(Number(e.currentTarget.value))}
                    >
                      <option value={1000}>10.0% - Office Space Rent</option>
                      <option value={1500}>15.0% - Consultant & Legal Fees</option>
                      <option value={150}>1.5% - Contract Works / PAN Goods</option>
                      <option value={0}>0.0% - Exempt / No Withholding</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    id="expVat"
                    checked={hasVat()}
                    onChange={(e) => setHasVat(e.currentTarget.checked)}
                    style={{ width: "auto" }}
                  />
                  <label for="expVat" style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)", cursor: "pointer" }}>
                    Vendor issued 13% VAT Tax Invoice
                  </label>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowExpenseModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Save & Post TDS Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
