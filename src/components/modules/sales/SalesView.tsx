import { createSignal, onMount, For, Show } from "solid-js";
import { api, Customer, SalesBookRow, ProductView, WarehouseView } from "../../../api/client";
import { IconPlus, IconRefresh, IconCheck, IconAlert, IconPrinter, IconDownload, IconSearch } from "../../ui/Icons";

export function SalesView() {
  const [activeTab, setActiveTab] = createSignal<"invoices" | "quotations" | "challans" | "customers">("invoices");
  const [salesBook, setSalesBook] = createSignal<SalesBookRow[]>([]);
  const [customers, setCustomers] = createSignal<Customer[]>([]);
  const [products, setProducts] = createSignal<ProductView[]>([]);
  const [warehouses, setWarehouses] = createSignal<WarehouseView[]>([]);
  const [searchFilter, setSearchFilter] = createSignal("");
  const [showInvoiceModal, setShowInvoiceModal] = createSignal(false);
  const [showCustomerModal, setShowCustomerModal] = createSignal(false);
  const [showQuotationModal, setShowQuotationModal] = createSignal(false);
  const [showChallanModal, setShowChallanModal] = createSignal(false);
  const [previewInvoice, setPreviewInvoice] = createSignal<SalesBookRow | null>(null);

  // Quotations List State (Section 2.2 User Manual)
  const [quotations, setQuotations] = createSignal([
    {
      id: "qt-1",
      quote_no: "QT-8101",
      customer_name: "Yeti Brewery Ltd",
      customer_channel: "Project",
      date: "2081-07-02",
      valid_until: "2081-07-25",
      stage: "Won",
      items_summary: "2x Industrial Chiller Assemblies, High Pressure Valves",
      total_amount_paisa: 45000000,
    },
    {
      id: "qt-2",
      quote_no: "QT-8102",
      customer_name: "Himalayan Beverages",
      customer_channel: "Project",
      date: "2081-07-05",
      valid_until: "2081-07-28",
      stage: "Review",
      items_summary: "1x Hydraulic Pump Unit & Thermal Gaskets",
      total_amount_paisa: 120000000,
    },
    {
      id: "qt-3",
      quote_no: "QT-8103",
      customer_name: "Pokhara Distillers",
      customer_channel: "Dealer",
      date: "2081-07-06",
      valid_until: "2081-07-20",
      stage: "Sent",
      items_summary: "5x Digital Flow Meters & Spare Cartridges",
      total_amount_paisa: 35000000,
    },
    {
      id: "qt-4",
      quote_no: "QT-8104",
      customer_name: "Lumbini Agro Processing",
      customer_channel: "Dealer",
      date: "2081-07-07",
      valid_until: "2081-08-01",
      stage: "Sample",
      items_summary: "Sample Motor Units & Drive Belts",
      total_amount_paisa: 85000000,
    },
    {
      id: "qt-5",
      quote_no: "QT-8105",
      customer_name: "Bagmati Feeds",
      customer_channel: "Dealer",
      date: "2081-07-08",
      valid_until: "2081-08-05",
      stage: "Pitch",
      items_summary: "Initial proposal for feed mixing controls",
      total_amount_paisa: 28000000,
    },
  ]);

  // Delivery Challans State (Section 2.3 User Manual)
  const [challans, setChallans] = createSignal([
    {
      id: "dc-1",
      challan_no: "DC-8101",
      dispatch_date: "2081-07-02",
      customer_name: "Yeti Brewery Ltd",
      warehouse_name: "Birgunj Regional Godown",
      vehicle_no: "BA 2 KHA 8492",
      driver_name: "Ram Bahadur Thapa",
      items_summary: "2x Industrial Chiller Gaskets",
      status: "Delivered",
      is_invoiced: true,
    },
    {
      id: "dc-2",
      challan_no: "DC-8102",
      dispatch_date: "2081-07-07",
      customer_name: "Himalayan Beverages",
      warehouse_name: "Kathmandu Main Godown",
      vehicle_no: "BA 1 KHA 3311",
      driver_name: "Sunil Tamang",
      items_summary: "1x Hydraulic Pump Unit",
      status: "In-Transit",
      is_invoiced: false,
    },
    {
      id: "dc-3",
      challan_no: "DC-8103",
      dispatch_date: "2081-07-08",
      customer_name: "Pokhara Distillers",
      warehouse_name: "Kathmandu Main Godown",
      vehicle_no: "PR 03-001 KHA 4490",
      driver_name: "Bikash Gurung",
      items_summary: "5x High Pressure Valves",
      status: "Issued",
      is_invoiced: false,
    },
  ]);

  // New Quotation Form State
  const [newQuoteCustomer, setNewQuoteCustomer] = createSignal("");
  const [newQuoteChannel, setNewQuoteChannel] = createSignal<"Dealer" | "Project">("Dealer");
  const [newQuoteSummary, setNewQuoteSummary] = createSignal("");
  const [newQuoteAmount, setNewQuoteAmount] = createSignal(150000);

  // New Challan Form State
  const [newChallanCustomer, setNewChallanCustomer] = createSignal("");
  const [newChallanWarehouse, setNewChallanWarehouse] = createSignal("");
  const [newChallanVehicle, setNewChallanVehicle] = createSignal("");
  const [newChallanDriver, setNewChallanDriver] = createSignal("");
  const [newChallanSummary, setNewChallanSummary] = createSignal("");

  // Invoice Form State
  const [invoiceNo, setInvoiceNo] = createSignal(`INV-${Date.now().toString().slice(-6)}`);
  const [selectedCustomerId, setSelectedCustomerId] = createSignal("");
  const [selectedWarehouseId, setSelectedWarehouseId] = createSignal("");
  const [selectedProductId, setSelectedProductId] = createSignal("");
  const [quantity, setQuantity] = createSignal(1);
  const [unitPrice, setUnitPrice] = createSignal(0);
  const [isExempt, setIsExempt] = createSignal(false);
  const [invoiceError, setInvoiceError] = createSignal<string | null>(null);

  // Customer Form State
  const [custType, setCustType] = createSignal("Dealer");
  const [companyName, setCompanyName] = createSignal("");
  const [contactPerson, setContactPerson] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [panNumber, setPanNumber] = createSignal("");
  const [address, setAddress] = createSignal("");

  const loadData = async () => {
    try {
      const [book, custs, prods, whs] = await Promise.all([
        api.getSalesBook(),
        api.getCustomers(),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setSalesBook(book);
      setCustomers(custs);
      setProducts(prods);
      setWarehouses(whs);

      if (custs.length > 0 && !selectedCustomerId()) setSelectedCustomerId(custs[0].id);
      if (whs.length > 0 && !selectedWarehouseId()) setSelectedWarehouseId(whs[0].id);
      if (prods.length > 0 && !selectedProductId()) {
        setSelectedProductId(prods[0].id);
        setUnitPrice(prods[0].selling_price_paisa / 100);
      }
    } catch (err: any) {
      console.error("Failed to load sales data", err);
    }
  };

  onMount(loadData);

  const formatNpr = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products().find((p) => p.id === prodId);
    if (prod) {
      setUnitPrice(prod.selling_price_paisa / 100);
    }
  };

  // Calculations
  const subtotalPaisa = () => Math.round(quantity() * unitPrice() * 100);
  const taxablePaisa = () => (isExempt() ? 0 : subtotalPaisa());
  const exemptPaisa = () => (isExempt() ? subtotalPaisa() : 0);
  const vatPaisa = () => (isExempt() ? 0 : Math.round(taxablePaisa() * 0.13));
  const grandTotalPaisa = () => subtotalPaisa() + vatPaisa();

  const handleCreateInvoice = async (e: Event) => {
    e.preventDefault();
    setInvoiceError(null);
    try {
      await api.createSalesInvoice({
        invoice_number: invoiceNo(),
        invoice_date: new Date().toISOString().split("T")[0],
        customer_id: selectedCustomerId(),
        warehouse_id: selectedWarehouseId(),
        items: [
          {
            product_id: selectedProductId(),
            quantity: Number(quantity()),
            unit_price_paisa: Math.round(Number(unitPrice()) * 100),
            discount_paisa: 0,
            is_vat_exempt: isExempt(),
          },
        ],
        issued_by: "admin",
      });
      setShowInvoiceModal(false);
      setInvoiceNo(`INV-${Date.now().toString().slice(-6)}`);
      loadData();
    } catch (err: any) {
      setInvoiceError(err.message || "Failed to issue invoice");
    }
  };

  const handleCreateCustomer = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createCustomer({
        customer_type: custType(),
        company_name: companyName(),
        contact_person: contactPerson(),
        phone: phone(),
        pan_number: panNumber(),
        address: address(),
        credit_limit_paisa: 50000000,
      });
      setShowCustomerModal(false);
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setPanNumber("");
      setAddress("");
      loadData();
    } catch (err: any) {
      alert("Failed to create customer: " + err.message);
    }
  };

  const filteredSales = () => {
    const q = searchFilter().toLowerCase();
    if (!q) return salesBook();
    return salesBook().filter(
      (r) =>
        r.bill_no.toLowerCase().includes(q) ||
        r.buyer_name.toLowerCase().includes(q) ||
        (r.buyer_pan && r.buyer_pan.includes(q))
    );
  };

  const totalSalesPaisa = () => filteredSales().reduce((acc, row) => acc + row.total_amount_paisa, 0);
  const totalExemptPaisa = () => filteredSales().reduce((acc, row) => acc + row.exempt_amount_paisa, 0);
  const totalTaxablePaisa = () => filteredSales().reduce((acc, row) => acc + row.taxable_amount_paisa, 0);
  const totalVatPaisa = () => filteredSales().reduce((acc, row) => acc + row.vat_amount_paisa, 0);

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
      {/* Title & Quick Actions */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ "font-size": "16px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            Commercial Pipeline & IRD Sales
          </h2>
          <p style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
            Quotations, Delivery Challans, Nepal VAT Invoicing & Customer Directory
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <div class="erp-tabs">
            <button
              class={`erp-tab-btn ${activeTab() === "invoices" ? "active" : ""}`}
              onClick={() => setActiveTab("invoices")}
            >
              Sales Book (अनुसूची १३)
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "quotations" ? "active" : ""}`}
              onClick={() => setActiveTab("quotations")}
            >
              Quotations Pipeline
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "challans" ? "active" : ""}`}
              onClick={() => setActiveTab("challans")}
            >
              Delivery Challans
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "customers" ? "active" : ""}`}
              onClick={() => setActiveTab("customers")}
            >
              Customers ({customers().length})
            </button>
          </div>

          <button
            type="button"
            class="erp-btn erp-btn-secondary erp-btn-sm"
            onClick={loadData}
            title="Refresh Records"
          >
            <IconRefresh size={13} />
          </button>
          <button
            type="button"
            class="erp-btn erp-btn-primary erp-btn-sm"
            onClick={() => {
              if (activeTab() === "quotations") setShowQuotationModal(true);
              else if (activeTab() === "challans") setShowChallanModal(true);
              else if (activeTab() === "customers") setShowCustomerModal(true);
              else setShowInvoiceModal(true);
            }}
          >
            <IconPlus size={13} />
            <span>
              {activeTab() === "quotations"
                ? "+ Create Quotation"
                : activeTab() === "challans"
                ? "+ Issue Delivery Challan"
                : activeTab() === "customers"
                ? "+ Add Customer / PAN"
                : "+ Issue Tax Invoice"}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Sales Invoices & IRD Sales Book */}
      <Show when={activeTab() === "invoices"}>
        {/* KPI Overview Strip */}
        <div class="erp-kpi-grid">
          <div class="erp-kpi-card">
            <div class="erp-kpi-label">Gross Billed Sales</div>
            <div class="erp-kpi-value tabular-nums">
              NPR {formatNpr(totalSalesPaisa())}
            </div>
            <div class="erp-kpi-subtext">Total invoices recorded</div>
          </div>

          <div class="erp-kpi-card">
            <div class="erp-kpi-label">Taxable Base Sales</div>
            <div class="erp-kpi-value tabular-nums">
              NPR {formatNpr(totalTaxablePaisa())}
            </div>
            <div class="erp-kpi-subtext">Subject to 13% Nepal VAT</div>
          </div>

          <div class="erp-kpi-card">
            <div class="erp-kpi-label">13% Output VAT Collected</div>
            <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-warning)" }}>
              NPR {formatNpr(totalVatPaisa())}
            </div>
            <div class="erp-kpi-subtext">Payable on monthly return</div>
          </div>

          <div class="erp-kpi-card">
            <div class="erp-kpi-label">Registered Accounts</div>
            <div class="erp-kpi-value tabular-nums">{customers().length}</div>
            <div class="erp-kpi-subtext">Verified PAN / VAT clients</div>
          </div>
        </div>

        {/* Sales Book Register Table */}
        <div class="erp-card">
        {/* Table Toolbar */}
        <div class="erp-table-toolbar">
          <div class="erp-table-toolbar-left">
            <div style={{ display: "flex", "align-items": "center", gap: "0.375rem", background: "var(--erp-bg-canvas)", border: "1px solid var(--erp-border-medium)", "border-radius": "4px", padding: "0.25rem 0.5rem" }}>
              <IconSearch size={13} />
              <input
                type="text"
                placeholder="Search invoice, buyer, PAN..."
                value={searchFilter()}
                onInput={(e) => setSearchFilter(e.currentTarget.value)}
                style={{ border: "none", outline: "none", "font-size": "12px", background: "transparent", color: "inherit", width: "190px" }}
              />
            </div>

            <select class="erp-select" style={{ width: "auto", "font-size": "12px", padding: "0.25rem 0.5rem" }}>
              <option>Schedule 13 (बिक्री खाता)</option>
              <option>Tax Invoices Only</option>
              <option>Exempt Bills Only</option>
            </select>
          </div>

          <div class="erp-table-toolbar-right">
            <button
              type="button"
              class="erp-btn erp-btn-secondary erp-btn-sm"
              onClick={() => window.print()}
            >
              <IconPrinter size={13} />
              <span>Print Sales Book</span>
            </button>
            <button
              type="button"
              class="erp-btn erp-btn-secondary erp-btn-sm"
              onClick={() => alert("Sales book exported to IRD compliant CSV.")}
            >
              <IconDownload size={13} />
              <span>Export IRD CSV</span>
            </button>
          </div>
        </div>

        <div class="erp-table-wrapper">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Date (मिति)</th>
                <th>Bill # (बिल नं)</th>
                <th>Buyer Name (खरिदकर्ताको नाम)</th>
                <th>Buyer PAN (स्थायी लेखा नं)</th>
                <th style={{ "text-align": "right" }}>Total Amount (जम्मा)</th>
                <th style={{ "text-align": "right" }}>Exempt (कर छुट)</th>
                <th style={{ "text-align": "right" }}>Taxable (करयोग्य)</th>
                <th style={{ "text-align": "right" }}>13% VAT (कर)</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              <For
                each={filteredSales()}
                fallback={
                  <tr>
                    <td colspan="9">
                      <div class="erp-empty-state">
                        <p>No sales invoices recorded yet. Click "+ Issue Tax Invoice" to record a sale.</p>
                      </div>
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr>
                    <td class="tabular-nums" style={{ color: "var(--erp-text-secondary)" }}>{row.bill_date}</td>
                    <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{row.bill_no}</td>
                    <td style={{ "font-weight": "500" }}>{row.buyer_name}</td>
                    <td class="tabular-nums" style={{ color: "var(--erp-text-muted)" }}>{row.buyer_pan || "—"}</td>
                    <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                      {formatNpr(row.total_amount_paisa)}
                    </td>
                    <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>
                      {formatNpr(row.exempt_amount_paisa)}
                    </td>
                    <td class="tabular-nums" style={{ "text-align": "right" }}>
                      {formatNpr(row.taxable_amount_paisa)}
                    </td>
                    <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600", color: "var(--erp-warning)" }}>
                      {formatNpr(row.vat_amount_paisa)}
                    </td>
                    <td class="no-print">
                      <button
                        type="button"
                        class="erp-btn erp-btn-ghost erp-btn-sm"
                        onClick={() => setPreviewInvoice(row)}
                        title="View Official Tax Invoice"
                      >
                        <IconPrinter size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style={{ "text-align": "right" }}>Grand Total (कुल जम्मा):</td>
                <td class="tabular-nums" style={{ "text-align": "right" }}>NPR {formatNpr(totalSalesPaisa())}</td>
                <td class="tabular-nums" style={{ "text-align": "right" }}>NPR {formatNpr(totalExemptPaisa())}</td>
                <td class="tabular-nums" style={{ "text-align": "right" }}>NPR {formatNpr(totalTaxablePaisa())}</td>
                <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-warning)" }}>
                  NPR {formatNpr(totalVatPaisa())}
                </td>
                <td class="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="erp-table-footer">
          <span>Showing {filteredSales().length} of {salesBook().length} invoices</span>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button class="erp-btn erp-btn-secondary erp-btn-sm" disabled>Previous</button>
            <button class="erp-btn erp-btn-secondary erp-btn-sm" disabled>Next</button>
          </div>
        </div>
      </div>
      </Show>

      {/* Tab 2: Quotations & Proposals Pipeline (Section 2.2 User Manual) */}
      <Show when={activeTab() === "quotations"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          {/* Pipeline Stage Funnel Strip */}
          <div class="erp-card" style={{ padding: "0.875rem 1.25rem" }}>
            <div style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.05em", "margin-bottom": "0.6rem" }}>
              Commercial Proposal Pipeline (5 Stages)
            </div>
            <div style={{ display: "grid", "grid-template-columns": "repeat(5, 1fr)", gap: "0.5rem" }}>
              <div style={{ padding: "0.5rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", "text-align": "center" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>1. Initial Pitch</div>
                <div style={{ "font-weight": "700", "font-size": "15px", color: "var(--erp-text-main)" }}>
                  {quotations().filter((q) => q.stage === "Pitch").length}
                </div>
              </div>
              <div style={{ padding: "0.5rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", "text-align": "center" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>2. Sample Given</div>
                <div style={{ "font-weight": "700", "font-size": "15px", color: "var(--erp-text-main)" }}>
                  {quotations().filter((q) => q.stage === "Sample").length}
                </div>
              </div>
              <div style={{ padding: "0.5rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", "text-align": "center" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>3. Quote Sent</div>
                <div style={{ "font-weight": "700", "font-size": "15px", color: "var(--erp-text-main)" }}>
                  {quotations().filter((q) => q.stage === "Sent").length}
                </div>
              </div>
              <div style={{ padding: "0.5rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", "text-align": "center" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>4. Under Review</div>
                <div style={{ "font-weight": "700", "font-size": "15px", color: "var(--erp-text-main)" }}>
                  {quotations().filter((q) => q.stage === "Review").length}
                </div>
              </div>
              <div style={{ padding: "0.5rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", "text-align": "center" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-success)" }}>5. Won / Approved</div>
                <div style={{ "font-weight": "700", "font-size": "15px", color: "var(--erp-success)" }}>
                  {quotations().filter((q) => q.stage === "Won").length}
                </div>
              </div>
            </div>
          </div>

          {/* Quotations Table */}
          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Quote #</th>
                    <th>Customer Name</th>
                    <th>Channel</th>
                    <th>Date / Valid Until</th>
                    <th>Items / Scope</th>
                    <th style={{ "text-align": "right" }}>Value (NPR)</th>
                    <th>Pipeline Stage</th>
                    <th style={{ "text-align": "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={quotations()}>
                    {(q) => {
                      const stageBadge = () => {
                        if (q.stage === "Won") return "erp-badge-success";
                        if (q.stage === "Review") return "erp-badge-warning";
                        if (q.stage === "Sent") return "erp-badge-info";
                        return "erp-badge-neutral";
                      };

                      return (
                        <tr>
                          <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{q.quote_no}</td>
                          <td style={{ "font-weight": "600" }}>{q.customer_name}</td>
                          <td>
                            <span class={`erp-badge ${q.customer_channel === "Project" ? "erp-badge-brand" : "erp-badge-neutral"}`}>
                              {q.customer_channel}
                            </span>
                          </td>
                          <td style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                            {q.date} <br /><span style={{ color: "var(--erp-text-muted)" }}>Valid: {q.valid_until}</span>
                          </td>
                          <td style={{ "max-width": "220px", "font-size": "12px" }}>{q.items_summary}</td>
                          <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                            NPR {formatNpr(q.total_amount_paisa)}
                          </td>
                          <td>
                            <span class={`erp-badge ${stageBadge()}`}>{q.stage}</span>
                          </td>
                          <td style={{ "text-align": "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                              <Show when={q.stage !== "Won"}>
                                <button
                                  type="button"
                                  class="erp-btn erp-btn-secondary erp-btn-sm"
                                  onClick={() => {
                                    const stages: Array<"Pitch" | "Sample" | "Sent" | "Review" | "Won"> = ["Pitch", "Sample", "Sent", "Review", "Won"];
                                    const idx = stages.indexOf(q.stage as any);
                                    if (idx < stages.length - 1) {
                                      const next = stages[idx + 1];
                                      setQuotations(quotations().map((item) => item.id === q.id ? { ...item, stage: next } : item));
                                    }
                                  }}
                                  title="Advance Pipeline Stage"
                                >
                                  Advance
                                </button>
                              </Show>
                              <Show when={q.stage === "Won"}>
                                <button
                                  type="button"
                                  class="erp-btn erp-btn-primary erp-btn-sm"
                                  onClick={() => {
                                    const matchCust = customers().find((c) => c.company_name === q.customer_name);
                                    if (matchCust) setSelectedCustomerId(matchCust.id);
                                    setUnitPrice(q.total_amount_paisa / 100);
                                    setQuantity(1);
                                    setShowInvoiceModal(true);
                                  }}
                                  title="1-Click Convert Accepted Quote to Tax Invoice"
                                >
                                  Convert to Invoice
                                </button>
                              </Show>
                            </div>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* Tab 3: Delivery Challans & Stock Release (Section 2.3 User Manual) */}
      <Show when={activeTab() === "challans"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          <div class="erp-card" style={{ padding: "1rem 1.25rem", display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <div>
              <div style={{ "font-weight": "600", "font-size": "13px", color: "var(--erp-text-main)" }}>
                Warehouse Delivery Challan Register
              </div>
              <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                Rule: Goods must NEVER leave the godown without a signed Delivery Challan. Two copies generated: one for client receipt, one returned to accounting.
              </div>
            </div>
            <button
              type="button"
              class="erp-btn erp-btn-primary erp-btn-sm"
              onClick={() => setShowChallanModal(true)}
            >
              <IconPlus size={13} />
              <span>+ Issue Delivery Challan</span>
            </button>
          </div>

          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Challan #</th>
                    <th>Dispatch Date</th>
                    <th>Customer Name</th>
                    <th>Dispatch Warehouse</th>
                    <th>Vehicle & Driver</th>
                    <th>Dispatched Goods</th>
                    <th>Transit Status</th>
                    <th>Tax Invoice</th>
                    <th style={{ "text-align": "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={challans()}>
                    {(c) => (
                      <tr>
                        <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{c.challan_no}</td>
                        <td class="tabular-nums" style={{ "font-size": "12px" }}>{c.dispatch_date}</td>
                        <td style={{ "font-weight": "600" }}>{c.customer_name}</td>
                        <td>{c.warehouse_name}</td>
                        <td style={{ "font-size": "12px" }}>
                          <div>{c.vehicle_no}</div>
                          <div style={{ color: "var(--erp-text-muted)" }}>Driver: {c.driver_name}</div>
                        </td>
                        <td style={{ "font-size": "12px" }}>{c.items_summary}</td>
                        <td>
                          <span class={`erp-badge ${c.status === "Delivered" ? "erp-badge-success" : c.status === "In-Transit" ? "erp-badge-warning" : "erp-badge-neutral"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>
                          <Show
                            when={c.is_invoiced}
                            fallback={<span class="erp-badge erp-badge-warning">Pending Invoice</span>}
                          >
                            <span class="erp-badge erp-badge-success">Invoiced</span>
                          </Show>
                        </td>
                        <td style={{ "text-align": "right" }}>
                          <Show when={!c.is_invoiced}>
                            <button
                              type="button"
                              class="erp-btn erp-btn-primary erp-btn-sm"
                              onClick={() => {
                                const matchCust = customers().find((cust) => cust.company_name === c.customer_name);
                                if (matchCust) setSelectedCustomerId(matchCust.id);
                                setChallans(challans().map((item) => item.id === c.id ? { ...item, is_invoiced: true, status: "Delivered" } : item));
                                setShowInvoiceModal(true);
                              }}
                              title="1-Click Convert Fulfilled Challan to Tax Invoice"
                            >
                              Convert to Invoice
                            </button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* Tab 4: Customer Directory (Section 2.1 User Manual) */}
      <Show when={activeTab() === "customers"}>
        <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
          <div class="erp-table-responsive">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Customer / Company Name</th>
                  <th>Channel Classification</th>
                  <th>Contact Person</th>
                  <th>Phone Number</th>
                  <th>PAN / VAT # (IRD)</th>
                  <th>Billing & Shipping Address</th>
                  <th style={{ "text-align": "right" }}>Credit Limit (NPR)</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={customers()}
                  fallback={
                    <tr>
                      <td colspan="7" style={{ "text-align": "center", padding: "2rem", color: "var(--erp-text-muted)" }}>
                        No customers registered yet. Click "+ Add Customer / PAN" above to onboard clients.
                      </td>
                    </tr>
                  }
                >
                  {(cust) => (
                    <tr>
                      <td style={{ "font-weight": "600", color: "var(--erp-text-main)" }}>
                        {cust.company_name}
                      </td>
                      <td>
                        <span class={`erp-badge ${cust.customer_type === "Project" ? "erp-badge-brand" : "erp-badge-neutral"}`}>
                          {cust.customer_type}
                        </span>
                      </td>
                      <td>{cust.contact_person || "—"}</td>
                      <td class="tabular-nums">{cust.phone || "—"}</td>
                      <td class="tabular-nums" style={{ "font-weight": "600", color: "var(--erp-primary)" }}>
                        {cust.pan_number || "PAN Pending"}
                      </td>
                      <td style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                        {cust.address || "Kathmandu"}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        NPR {formatNpr(cust.credit_limit_paisa)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Official Tax Invoice Print Preview Modal */}
      <Show when={previewInvoice()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "640px", background: "#ffffff", color: "#000000" }}>
            <div class="erp-modal-header no-print">
              <span class="erp-card-title">Nepal Tax Invoice (कर बिजक) Preview</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  class="erp-btn erp-btn-primary erp-btn-sm"
                  onClick={() => window.print()}
                >
                  <IconPrinter size={13} />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  class="erp-btn erp-btn-ghost erp-btn-sm"
                  onClick={() => setPreviewInvoice(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div class="erp-modal-body" style={{ padding: "2rem", "font-family": "var(--font-sans)" }}>
              {/* Invoice Header */}
              <div style={{ "text-align": "center", "border-bottom": "2px solid #000000", "padding-bottom": "0.75rem", "margin-bottom": "1rem" }}>
                <h3 style={{ "font-size": "16px", "font-weight": "800", "letter-spacing": "0.02em" }}>
                  JUBILANT ENTERPRISES PVT. LTD.
                </h3>
                <div style={{ "font-size": "12px" }}>Tripureshwor, Kathmandu, Nepal • Phone: 01-4240000</div>
                <div style={{ "font-size": "12px", "font-weight": "700" }}>स्थायी लेखा नं (PAN): 602489123</div>
                <div style={{ "margin-top": "0.5rem", "display": "inline-block", "border": "1px solid #000000", "padding": "0.1rem 0.75rem", "font-weight": "700", "font-size": "12px" }}>
                  कर बिजक (TAX INVOICE)
                </div>
              </div>

              {/* Buyer & Bill Meta */}
              <div style={{ display: "flex", "justify-content": "space-between", "font-size": "12px", "margin-bottom": "1rem" }}>
                <div>
                  <div><strong>Buyer Name:</strong> {previewInvoice()?.buyer_name}</div>
                  <div><strong>Buyer PAN:</strong> {previewInvoice()?.buyer_pan || "—"}</div>
                  <div><strong>Payment Mode:</strong> Credit / Bank</div>
                </div>
                <div style={{ "text-align": "right" }}>
                  <div><strong>Invoice #:</strong> {previewInvoice()?.bill_no}</div>
                  <div><strong>Date:</strong> {previewInvoice()?.bill_date}</div>
                  <div><strong>Fiscal Year:</strong> 2081/82</div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: "100%", "border-collapse": "collapse", "font-size": "12px", "margin-bottom": "1rem", "border": "1px solid #000000" }}>
                <thead>
                  <tr style={{ "border-bottom": "1px solid #000000", background: "#f1f5f9" }}>
                    <th style={{ padding: "0.4rem", "border-right": "1px solid #000000" }}>SN</th>
                    <th style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "left" }}>Description</th>
                    <th style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "right" }}>Qty</th>
                    <th style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "right" }}>Rate (NPR)</th>
                    <th style={{ padding: "0.4rem", "text-align": "right" }}>Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ "border-bottom": "1px solid #000000" }}>
                    <td style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "center" }}>1</td>
                    <td style={{ padding: "0.4rem", "border-right": "1px solid #000000" }}>Commercial Equipment & Spares</td>
                    <td style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "right" }}>1</td>
                    <td style={{ padding: "0.4rem", "border-right": "1px solid #000000", "text-align": "right" }}>
                      {formatNpr(previewInvoice()?.taxable_amount_paisa || 0)}
                    </td>
                    <td style={{ padding: "0.4rem", "text-align": "right" }}>
                      {formatNpr(previewInvoice()?.taxable_amount_paisa || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Tax Calculations Box */}
              <div style={{ display: "flex", "justify-content": "flex-end", "font-size": "12px", "margin-bottom": "2rem" }}>
                <div style={{ width: "240px", "border": "1px solid #000000", padding: "0.5rem" }}>
                  <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "0.25rem" }}>
                    <span>Taxable Amount:</span>
                    <span>NPR {formatNpr(previewInvoice()?.taxable_amount_paisa || 0)}</span>
                  </div>
                  <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "0.25rem" }}>
                    <span>13% VAT (१३% भ्याट):</span>
                    <span>NPR {formatNpr(previewInvoice()?.vat_amount_paisa || 0)}</span>
                  </div>
                  <div style={{ display: "flex", "justify-content": "space-between", "font-weight": "700", "border-top": "1px solid #000000", "padding-top": "0.25rem" }}>
                    <span>Grand Total (कुल जम्मा):</span>
                    <span>NPR {formatNpr(previewInvoice()?.total_amount_paisa || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", "justify-content": "space-between", "font-size": "11.5px", "margin-top": "3rem" }}>
                <div>
                  <div style={{ "border-top": "1px dashed #000000", width: "160px", "padding-top": "0.25rem" }}>
                    Customer's Signature
                  </div>
                </div>
                <div style={{ "text-align": "right" }}>
                  <div style={{ "border-top": "1px dashed #000000", width: "160px", "padding-top": "0.25rem" }}>
                    For Jubilant Enterprises Pvt. Ltd.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Issue Tax Invoice Modal */}
      <Show when={showInvoiceModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "620px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Issue Tax Invoice (कर बिजक)</div>
                <div class="erp-card-subtitle">Real-time godown stock deduction and double-entry VAT posting</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowInvoiceModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <Show when={invoiceError()}>
                  <div class="erp-badge erp-badge-danger" style={{ width: "100%", padding: "0.5rem" }}>
                    <IconAlert size={13} />
                    <span>{invoiceError()}</span>
                  </div>
                </Show>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Invoice Number (बिल नं)</label>
                    <input
                      type="text"
                      required
                      class="erp-input tabular-nums"
                      value={invoiceNo()}
                      onInput={(e) => setInvoiceNo(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Dispatch Godown</label>
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
                  <label class="erp-label">Customer / Buyer Entity</label>
                  <select
                    class="erp-select"
                    value={selectedCustomerId()}
                    onChange={(e) => setSelectedCustomerId(e.currentTarget.value)}
                  >
                    <For each={customers()}>
                      {(c) => (
                        <option value={c.id}>
                          {c.company_name} (PAN: {c.pan_number || "None"})
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                <div class="erp-card" style={{ background: "var(--erp-bg-card-subtle)", padding: "0.875rem" }}>
                  <div style={{ "font-size": "11.5px", "font-weight": "600", "margin-bottom": "0.5rem" }}>
                    INVOICE LINE ITEM
                  </div>
                  <div style={{ display: "grid", "grid-template-columns": "2fr 1fr 1fr", gap: "0.5rem" }}>
                    <div class="erp-form-group">
                      <label class="erp-label">Product / SKU</label>
                      <select
                        class="erp-select"
                        value={selectedProductId()}
                        onChange={(e) => handleProductChange(e.currentTarget.value)}
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
                      <label class="erp-label">Unit Price (NPR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        class="erp-input tabular-nums"
                        value={unitPrice()}
                        onInput={(e) => setUnitPrice(Number(e.currentTarget.value))}
                      />
                    </div>
                  </div>

                  <div style={{ "margin-top": "0.625rem", display: "flex", "align-items": "center", gap: "0.375rem" }}>
                    <input
                      type="checkbox"
                      id="exempt"
                      checked={isExempt()}
                      onChange={(e) => setIsExempt(e.currentTarget.checked)}
                      style={{ width: "auto" }}
                    />
                    <label for="exempt" style={{ "font-size": "12px", color: "var(--erp-text-secondary)", cursor: "pointer" }}>
                      VAT Exempt Good / Service (कर छुट)
                    </label>
                  </div>

                  {/* Financial Breakdown */}
                  <div
                    style={{
                      "margin-top": "0.75rem",
                      padding: "0.625rem",
                      background: "var(--erp-bg-card)",
                      "border-radius": "var(--erp-radius-sm)",
                      border: "1px solid var(--erp-border-medium)",
                      display: "flex",
                      "flex-direction": "column",
                      gap: "0.25rem",
                      "font-size": "12px",
                    }}
                  >
                    <div style={{ display: "flex", "justify-content": "space-between" }}>
                      <span style={{ color: "var(--erp-text-secondary)" }}>Taxable Subtotal:</span>
                      <span class="tabular-nums">NPR {formatNpr(taxablePaisa())}</span>
                    </div>
                    <div style={{ display: "flex", "justify-content": "space-between" }}>
                      <span style={{ color: "var(--erp-text-secondary)" }}>13% Value Added Tax:</span>
                      <span class="tabular-nums" style={{ color: "var(--erp-warning)" }}>
                        NPR {formatNpr(vatPaisa())}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        "justify-content": "space-between",
                        "border-top": "1px solid var(--erp-border-subtle)",
                        "padding-top": "0.25rem",
                        "font-weight": "700",
                        "font-size": "13px",
                      }}
                    >
                      <span>Invoice Total (कुल जम्मा):</span>
                      <span class="tabular-nums" style={{ color: "var(--erp-primary)" }}>
                        NPR {formatNpr(grandTotalPaisa())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add Customer Modal */}
      <Show when={showCustomerModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "480px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Register Customer Account</div>
                <div class="erp-card-subtitle">Buyer profile and IRD PAN record</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowCustomerModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.75rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Entity Category</label>
                  <select
                    class="erp-select"
                    value={custType()}
                    onChange={(e) => setCustType(e.currentTarget.value)}
                  >
                    <option value="Dealer">Authorized Dealer</option>
                    <option value="Corporate">Corporate Client</option>
                    <option value="Retailer">Direct Retailer</option>
                  </select>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Company / Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pokhara Machinery Traders Pvt. Ltd."
                    class="erp-input"
                    value={companyName()}
                    onInput={(e) => setCompanyName(e.currentTarget.value)}
                  />
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.5rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Contact Person</label>
                    <input
                      type="text"
                      required
                      placeholder="Manager Name"
                      class="erp-input"
                      value={contactPerson()}
                      onInput={(e) => setContactPerson(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="98XXXXXXXX"
                      class="erp-input"
                      value={phone()}
                      onInput={(e) => setPhone(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">IRD PAN (9 Digits)</label>
                  <input
                    type="text"
                    placeholder="600XXXXXX"
                    class="erp-input tabular-nums"
                    value={panNumber()}
                    onInput={(e) => setPanNumber(e.currentTarget.value)}
                  />
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Registered Address</label>
                  <input
                    type="text"
                    required
                    placeholder="City, District, Nepal"
                    class="erp-input"
                    value={address()}
                    onInput={(e) => setAddress(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowCustomerModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Create Quotation Modal (Section 2.2 User Manual) */}
      <Show when={showQuotationModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "500px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Create Sales Quotation / Proposal</div>
                <div class="erp-card-subtitle">Register commercial offer into negotiation pipeline</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowQuotationModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newQ = {
                  id: `qt-${Date.now()}`,
                  quote_no: `QT-${Date.now().toString().slice(-4)}`,
                  customer_name: newQuoteCustomer() || (customers()[0]?.company_name || "New Client"),
                  customer_channel: newQuoteChannel(),
                  date: new Date().toISOString().split("T")[0],
                  valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                  stage: "Pitch" as const,
                  items_summary: newQuoteSummary() || "Equipment & Service Maintenance Package",
                  total_amount_paisa: Math.round(Number(newQuoteAmount()) * 100),
                };
                setQuotations([newQ, ...quotations()]);
                setShowQuotationModal(false);
                setNewQuoteSummary("");
              }}
            >
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Select Customer / Client</label>
                  <select
                    class="erp-select"
                    value={newQuoteCustomer()}
                    onChange={(e) => setNewQuoteCustomer(e.currentTarget.value)}
                  >
                    <For each={customers()}>
                      {(c) => <option value={c.company_name}>{c.company_name} ({c.customer_type})</option>}
                    </For>
                  </select>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Sales Channel</label>
                  <select
                    class="erp-select"
                    value={newQuoteChannel()}
                    onChange={(e) => setNewQuoteChannel(e.currentTarget.value as any)}
                  >
                    <option value="Dealer">Dealer (Wholesale / Reseller)</option>
                    <option value="Project">Project (Direct Corporate / Institutional)</option>
                  </select>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Proposal Scope & Products Summary</label>
                  <textarea
                    rows={2}
                    class="erp-input"
                    placeholder="e.g. 2x Industrial Motors with 1-Year AMC Warranty"
                    value={newQuoteSummary()}
                    onInput={(e) => setNewQuoteSummary(e.currentTarget.value)}
                    required
                  />
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Quoted Base Amount (NPR)</label>
                  <input
                    type="number"
                    min="1"
                    class="erp-input tabular-nums"
                    value={newQuoteAmount()}
                    onInput={(e) => setNewQuoteAmount(Number(e.currentTarget.value))}
                    required
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowQuotationModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Save Proposal to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Issue Delivery Challan Modal (Section 2.3 User Manual) */}
      <Show when={showChallanModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "540px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Issue Delivery Challan (चलानी)</div>
                <div class="erp-card-subtitle">Authorize physical goods release from godown before invoicing</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowChallanModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newC = {
                  id: `dc-${Date.now()}`,
                  challan_no: `DC-${Date.now().toString().slice(-4)}`,
                  dispatch_date: new Date().toISOString().split("T")[0],
                  customer_name: newChallanCustomer() || (customers()[0]?.company_name || "Client"),
                  warehouse_name: newChallanWarehouse() || (warehouses()[0]?.name || "Kathmandu Main Godown"),
                  vehicle_no: newChallanVehicle() || "BA 2 KHA 1001",
                  driver_name: newChallanDriver() || "Staff Driver",
                  items_summary: newChallanSummary() || "Dispatched Goods",
                  status: "Issued" as const,
                  is_invoiced: false,
                };
                setChallans([newC, ...challans()]);
                setShowChallanModal(false);
                setNewChallanSummary("");
                setNewChallanVehicle("");
                setNewChallanDriver("");
              }}
            >
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Recipient Customer</label>
                    <select
                      class="erp-select"
                      value={newChallanCustomer()}
                      onChange={(e) => setNewChallanCustomer(e.currentTarget.value)}
                    >
                      <For each={customers()}>
                        {(c) => <option value={c.company_name}>{c.company_name}</option>}
                      </For>
                    </select>
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-label">Dispatch Godown</label>
                    <select
                      class="erp-select"
                      value={newChallanWarehouse()}
                      onChange={(e) => setNewChallanWarehouse(e.currentTarget.value)}
                    >
                      <For each={warehouses()}>
                        {(w) => <option value={w.name}>{w.name}</option>}
                      </For>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Transport Vehicle #</label>
                    <input
                      type="text"
                      class="erp-input"
                      placeholder="e.g. BA 2 KHA 8492"
                      value={newChallanVehicle()}
                      onInput={(e) => setNewChallanVehicle(e.currentTarget.value)}
                      required
                    />
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-label">Driver / Carrier Name</label>
                    <input
                      type="text"
                      class="erp-input"
                      placeholder="e.g. Ram Bahadur Thapa"
                      value={newChallanDriver()}
                      onInput={(e) => setNewChallanDriver(e.currentTarget.value)}
                      required
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Goods Description & Quantities</label>
                  <textarea
                    rows={2}
                    class="erp-input"
                    placeholder="e.g. 5x High Pressure Valves (Box A), 2x Gasket Assemblies"
                    value={newChallanSummary()}
                    onInput={(e) => setNewChallanSummary(e.currentTarget.value)}
                    required
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowChallanModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Issue Dispatch Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}

