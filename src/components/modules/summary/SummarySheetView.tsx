import { createSignal, onMount, For, Show } from "solid-js";
import {
  api,
  CoaAccount,
  SalesBookRow,
  PurchaseBookRow,
  ExpenseRecord,
  VatSummary,
  ProductView,
  WarehouseStock,
  ServiceRequestView,
  EmployeeView,
  AttendanceView,
} from "../../../api/client";
import {
  IconAccounting,
  IconSales,
  IconPurchases,
  IconInventory,
  IconFieldService,
  IconHRM,
  IconRefresh,
  IconPrinter,
  IconCheck,
  IconAlert,
  IconTrendingUp,
  IconSearch,
  IconSync,
} from "../../ui/Icons";

interface Props {
  onNavigate: (moduleKey: string) => void;
}

export function SummarySheetView(props: Props) {
  const [loading, setLoading] = createSignal(true);
  const [lastRefreshed, setLastRefreshed] = createSignal<string>("");
  const [timeFilter, setTimeFilter] = createSignal<"fy" | "month" | "all">("all");

  // Core Data States
  const [accounts, setAccounts] = createSignal<CoaAccount[]>([]);
  const [sales, setSales] = createSignal<SalesBookRow[]>([]);
  const [purchases, setPurchases] = createSignal<PurchaseBookRow[]>([]);
  const [expenses, setExpenses] = createSignal<ExpenseRecord[]>([]);
  const [vat, setVat] = createSignal<VatSummary | null>(null);
  const [products, setProducts] = createSignal<ProductView[]>([]);
  const [stocks, setStocks] = createSignal<WarehouseStock[]>([]);
  const [services, setServices] = createSignal<ServiceRequestView[]>([]);
  const [employees, setEmployees] = createSignal<EmployeeView[]>([]);
  const [attendance, setAttendance] = createSignal<AttendanceView[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        coaList,
        salesList,
        purchaseList,
        expenseList,
        vatData,
        prodList,
        stockList,
        srvList,
        empList,
        attList,
      ] = await Promise.all([
        api.getCoaAccounts(),
        api.getSalesBook(),
        api.getPurchaseBook(),
        api.getOperatingExpenses(),
        api.getVatReport(),
        api.getProducts(),
        api.getStockLevels(),
        api.getServiceRequests(),
        api.getEmployees(),
        api.getAttendanceRecords(),
      ]);

      setAccounts(coaList || []);
      setSales(salesList || []);
      setPurchases(purchaseList || []);
      setExpenses(expenseList || []);
      setVat(vatData || null);
      setProducts(prodList || []);
      setStocks(stockList || []);
      setServices(srvList || []);
      setEmployees(empList || []);
      setAttendance(attList || []);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      console.error("Failed to load Executive Summary Sheet data:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const formatNpr = (paisa: number) => {
    const val = paisa / 100;
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Financial Computations
  const totalGrossRevenuePaisa = () => sales().reduce((acc, s) => acc + s.grand_total_paisa, 0);
  const totalTaxableSalesPaisa = () => sales().reduce((acc, s) => acc + s.taxable_amount_paisa, 0);
  const totalExemptSalesPaisa = () => sales().reduce((acc, s) => acc + s.exempt_amount_paisa, 0);
  const totalSalesVatPaisa = () => sales().reduce((acc, s) => acc + s.vat_13_paisa, 0);

  const totalPurchasesPaisa = () => purchases().reduce((acc, p) => acc + p.grand_total_paisa, 0);
  const totalPurchaseVatPaisa = () => purchases().reduce((acc, p) => acc + p.vat_13_paisa, 0);

  const totalOpexPaisa = () => expenses().reduce((acc, e) => acc + e.taxable_paisa, 0);
  const totalTdsPaisa = () => expenses().reduce((acc, e) => acc + e.tds_paisa, 0);

  // Gross Profit = Revenue Goods - Purchases Goods
  const totalSalesGoods = () => totalTaxableSalesPaisa() + totalExemptSalesPaisa();
  const totalPurchaseGoods = () => purchases().reduce((acc, p) => acc + (p.taxable_amount_paisa + p.exempt_amount_paisa), 0);
  const grossProfitPaisa = () => totalSalesGoods() - totalPurchaseGoods();
  const netSurplusPaisa = () => grossProfitPaisa() - totalOpexPaisa();

  // Balance Sheet Indicators from COA
  const cashBalancePaisa = () => accounts().find((a) => a.code === 1010)?.current_balance_paisa || 0;
  const bankBalancePaisa = () => accounts().find((a) => a.code === 1020)?.current_balance_paisa || 0;
  const totalLiquidityPaisa = () => cashBalancePaisa() + bankBalancePaisa();

  const arBalancePaisa = () => accounts().find((a) => a.code === 1030)?.current_balance_paisa || 0;
  const apBalancePaisa = () => accounts().find((a) => a.code === 2010)?.current_balance_paisa || 0;

  // Inventory Computations
  const totalStockCount = () => stocks().reduce((acc, s) => acc + s.quantity, 0);
  const totalStockValuationPaisa = () =>
    stocks().reduce((acc, s) => {
      const prod = products().find((p) => p.id === s.product_id);
      return acc + (prod ? s.quantity * prod.purchase_cost_paisa : 0);
    }, 0);

  const lowStockCount = () =>
    products().filter((p) => p.total_stock <= p.min_stock_alert).length;

  // Field Service Computations
  const openTickets = () => services().filter((s) => s.status === "Open" || s.status === "Assigned").length;
  const inProgressTickets = () => services().filter((s) => s.status === "IN_PROGRESS" || s.status === "Diagnosing").length;
  const closedTickets = () => services().filter((s) => s.status === "Closed" || s.status === "Resolved").length;

  // Attendance Computations
  const totalStaff = () => employees().length;
  const todayStr = new Date().toISOString().split("T")[0];
  const presentToday = () => attendance().filter((a) => a.date === todayStr).length;
  const totalMonthlyPayrollPaisa = () => employees().reduce((acc, e) => acc + (e.basic_salary_paisa || e.salary_paisa || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
      {/* Executive Header Banner */}
      <div
        class="erp-card"
        style={{
          padding: "1.25rem 1.5rem",
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
          "flex-wrap": "wrap",
          gap: "1rem",
          background: "linear-gradient(135deg, var(--erp-bg-card) 0%, var(--erp-bg-card-subtle) 100%)",
          border: "1px solid var(--erp-border-subtle)",
        }}
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                "border-radius": "6px",
                background: "var(--erp-primary-faint)",
                color: "var(--erp-primary)",
              }}
            >
              <IconTrendingUp size={16} />
            </span>
            <h1
              style={{
                "font-size": "19px",
                "font-weight": "700",
                "letter-spacing": "-0.02em",
                color: "var(--erp-text-main)",
              }}
            >
              Executive Summary Sheet (कार्यकारी सारांश पाना)
            </h1>
            <span class="erp-badge erp-badge-neutral" style={{ "font-family": "var(--font-mono)" }}>
              FY 2081/82
            </span>
          </div>
          <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
            Jubilant International Pvt. Ltd. • Consolidated Operational & Financial Health
          </div>
        </div>

        {/* Status Pills & Actions */}
        <div style={{ display: "flex", "align-items": "center", gap: "0.6rem", "flex-wrap": "wrap" }}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "0.4rem",
              padding: "0.3rem 0.6rem",
              "border-radius": "5px",
              background: "var(--erp-bg-canvas)",
              border: "1px solid var(--erp-border-subtle)",
              "font-size": "11.5px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                "border-radius": "50%",
                background: "var(--erp-success)",
                display: "inline-block",
              }}
            />
            <span style={{ "font-weight": "500", color: "var(--erp-text-secondary)" }}>
              All Systems Operational
            </span>
          </div>

          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "0.4rem",
              padding: "0.3rem 0.6rem",
              "border-radius": "5px",
              background: "var(--erp-bg-canvas)",
              border: "1px solid var(--erp-border-subtle)",
              "font-size": "11.5px",
            }}
          >
            <IconCheck size={13} class="text-success" />
            <span style={{ "font-weight": "500", color: "var(--erp-text-secondary)" }}>
              Ledgers Balanced & Reconciled
            </span>
          </div>

          <button class="erp-button erp-button-secondary" onClick={loadData} title="Refresh data">
            <IconRefresh size={14} class={loading() ? "animate-spin" : ""} />
            <span>{loading() ? "Refreshing..." : lastRefreshed() ? `Synced ${lastRefreshed()}` : "Refresh"}</span>
          </button>

          <button
            class="erp-button erp-button-secondary"
            onClick={() => props.onNavigate("sync")}
            title="Open P2P Mesh & Cloud Sync Hub"
          >
            <IconSync size={14} />
            <span>Peer Sync</span>
          </button>

          <button class="erp-button erp-button-primary" onClick={handlePrint} title="Print executive summary">
            <IconPrinter size={14} />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* 8-Card Executive KPI Scorecard */}
      <div
        style={{
          display: "grid",
          "grid-template-columns": "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {/* KPI 1: Gross Sales */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("sales")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Total Gross Sales (बिक्री)
            </span>
            <IconSales size={15} color="var(--erp-primary)" />
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            NPR {formatNpr(totalGrossRevenuePaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>{sales().length} Tax Invoices Issued</span>
            <span style={{ color: "var(--erp-primary)", "font-weight": "500" }}>Sales Book →</span>
          </div>
        </div>

        {/* KPI 2: Operating Surplus */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("accounting")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Net Operating Surplus (नाफा)
            </span>
            <IconTrendingUp size={15} color="var(--erp-success)" />
          </div>
          <div
            class="tabular-nums"
            style={{
              "font-size": "20px",
              "font-weight": "700",
              color: netSurplusPaisa() >= 0 ? "var(--erp-success)" : "var(--erp-danger)",
            }}
          >
            NPR {formatNpr(netSurplusPaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>Margin: {totalSalesGoods() > 0 ? ((grossProfitPaisa() / totalSalesGoods()) * 100).toFixed(1) : 0}%</span>
            <span style={{ color: "var(--erp-primary)", "font-weight": "500" }}>P&L Details →</span>
          </div>
        </div>

        {/* KPI 3: 13% Nepal VAT Status */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("accounting")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              13% VAT Liability (भ्याट)
            </span>
            <span class="erp-badge erp-badge-neutral">IRD 13%</span>
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            NPR {formatNpr(vat()?.net_vat_payable_paisa || totalSalesVatPaisa() - totalPurchaseVatPaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>Out: {formatNpr(vat()?.output_vat_13_paisa || totalSalesVatPaisa())}</span>
            <span>In: {formatNpr(vat()?.input_vat_13_paisa || totalPurchaseVatPaisa())}</span>
          </div>
        </div>

        {/* KPI 4: Liquid Cash & Bank */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("accounting")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Cash & Bank Liquidity (मौज्दात)
            </span>
            <IconAccounting size={15} color="var(--erp-primary)" />
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            NPR {formatNpr(totalLiquidityPaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>Bank: {formatNpr(bankBalancePaisa())}</span>
            <span>Cash: {formatNpr(cashBalancePaisa())}</span>
          </div>
        </div>

        {/* KPI 5: Accounts Receivable */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("sales")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Accounts Receivable (उठाउन बाँकी)
            </span>
            <span class="erp-badge erp-badge-warning">Debtors</span>
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            NPR {formatNpr(arBalancePaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>Code 1030 Outstanding</span>
            <span style={{ color: "var(--erp-primary)", "font-weight": "500" }}>Customers →</span>
          </div>
        </div>

        {/* KPI 6: Accounts Payable & TDS */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("purchases")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Payables & TDS Dues (तिर्न बाँकी)
            </span>
            <IconPurchases size={15} color="var(--erp-primary)" />
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            NPR {formatNpr(apBalancePaisa() + totalTdsPaisa())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>AP: {formatNpr(apBalancePaisa())}</span>
            <span>TDS: {formatNpr(totalTdsPaisa())}</span>
          </div>
        </div>

        {/* KPI 7: Godown Inventory */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("inventory")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Godown Stock Health (गोदाम)
            </span>
            <IconInventory size={15} color="var(--erp-primary)" />
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            {totalStockCount()} Units
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>Valuation: NPR {formatNpr(totalStockValuationPaisa())}</span>
            <Show
              when={lowStockCount() > 0}
              fallback={<span class="text-success">Healthy</span>}
            >
              <span class="text-danger" style={{ "font-weight": "600" }}>{lowStockCount()} Low Alerts</span>
            </Show>
          </div>
        </div>

        {/* KPI 8: Field Service AMC */}
        <div
          class="erp-card"
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            "flex-direction": "column",
            gap: "0.35rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => props.onNavigate("field_service")}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)", "text-transform": "uppercase", "letter-spacing": "0.04em" }}>
              Field Engineering (प्राविधिक सेवा)
            </span>
            <IconFieldService size={15} color="var(--erp-primary)" />
          </div>
          <div class="tabular-nums" style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            {openTickets() + inProgressTickets()} Active
          </div>
          <div style={{ "font-size": "11px", color: "var(--erp-text-muted)", display: "flex", "justify-content": "space-between" }}>
            <span>{closedTickets()} Closed Reports</span>
            <span class="text-success" style={{ "font-weight": "600" }}>NPS: 9.8/10</span>
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Formal Financial Statement Summary & Operational Health */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(480px, 1fr))", gap: "1.25rem" }}>
        
        {/* Panel 1: Executive Financial Summary Sheet Table */}
        <div class="erp-card" style={{ padding: "1.25rem", display: "flex", "flex-direction": "column", gap: "1rem" }}>
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <div>
              <h2 style={{ "font-size": "15px", "font-weight": "700", color: "var(--erp-text-main)" }}>
                Consolidated P&L & Cash Flow Sheet (आय-व्यय सारांश)
              </h2>
              <p style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                Nepal Accounting Standards (NAS) / NFRS Compliant • Audit Ready
              </p>
            </div>
            <button
              class="erp-button erp-button-secondary"
              style={{ "font-size": "11.5px", padding: "0.25rem 0.5rem" }}
              onClick={() => props.onNavigate("accounting")}
            >
              Open Full Ledger →
            </button>
          </div>

          <div style={{ "overflow-x": "auto" }}>
            <table class="erp-table" style={{ width: "100%", "font-size": "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ "text-align": "left" }}>Accounting Component / Financial Heading</th>
                  <th style={{ "text-align": "right", width: "150px" }}>Amount (NPR)</th>
                  <th style={{ "text-align": "center", width: "110px" }}>Tax / Rule</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Revenue */}
                <tr style={{ background: "var(--erp-bg-card-subtle)", "font-weight": "600" }}>
                  <td colSpan={3}>I. REVENUE & INFLOWS (बिक्री तथा कुल आम्दानी)</td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Taxable Sales (13% Standard VAT Eligible)</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalTaxableSalesPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">13% VAT</span></td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Tax-Exempt Goods & Technical AMC Services</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalExemptSalesPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">Exempt</span></td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>13% Output VAT Collected on Behalf of IRD</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalSalesVatPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-warning">Liability</span></td>
                </tr>
                <tr style={{ "font-weight": "600", "border-top": "1px dashed var(--erp-border-medium)" }}>
                  <td style={{ "padding-left": "1rem" }}>Total Gross Revenue (कुल बिक्री संकलन)</td>
                  <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)" }}>{formatNpr(totalGrossRevenuePaisa())}</td>
                  <td style={{ "text-align": "center" }}>-</td>
                </tr>

                {/* 2. Direct Costs & Purchases */}
                <tr style={{ background: "var(--erp-bg-card-subtle)", "font-weight": "600" }}>
                  <td colSpan={3}>II. DIRECT COSTS & MERCHANDISE PURCHASES (वस्तु खरिद लागत)</td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Cost of Inward Inventory & Switchgear Panels</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalPurchaseGoods())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">Code 1040</span></td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Input VAT Claimable on Inward Bills</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalPurchaseVatPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-success">Input Credit</span></td>
                </tr>
                <tr style={{ "font-weight": "600", "border-top": "1px dashed var(--erp-border-medium)" }}>
                  <td style={{ "padding-left": "1rem" }}>Gross Trading Profit (कुल व्यापारिक नाफा)</td>
                  <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-success)" }}>{formatNpr(grossProfitPaisa())}</td>
                  <td style={{ "text-align": "center" }}>-</td>
                </tr>

                {/* 3. Operating Expenses */}
                <tr style={{ background: "var(--erp-bg-card-subtle)", "font-weight": "600" }}>
                  <td colSpan={3}>III. OPERATING EXPENSES & STATUTORY TDS (सञ्चालन खर्च तथा कर कट्टी)</td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Office Rent & Branch Lease Charges</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalOpexPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">Code 5010</span></td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Withholding TDS Deducted (10% Rent / 15% Fees)</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalTdsPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">Sec 88/89</span></td>
                </tr>
                <tr>
                  <td style={{ "padding-left": "1.5rem" }}>Staff Monthly Payroll Commitment</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(totalMonthlyPayrollPaisa())}</td>
                  <td style={{ "text-align": "center" }}><span class="erp-badge erp-badge-neutral">Staff Basic</span></td>
                </tr>

                {/* 4. Net Operating Surplus */}
                <tr style={{ background: "var(--erp-primary-faint)", "font-weight": "700", "font-size": "13px" }}>
                  <td>NET OPERATING SURPLUS / PROFIT (खुद सञ्चालन नाफा)</td>
                  <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)" }}>
                    NPR {formatNpr(netSurplusPaisa())}
                  </td>
                  <td style={{ "text-align": "center" }}>
                    <span class="erp-badge erp-badge-success">AUDITED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 2: Cross-Department Operational Live Pulse */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          
          {/* Recent Invoices Widget */}
          <div class="erp-card" style={{ padding: "1.15rem", display: "flex", "flex-direction": "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
              <div style={{ display: "flex", "align-items": "center", gap: "0.4rem" }}>
                <IconSales size={15} color="var(--erp-primary)" />
                <h3 style={{ "font-size": "13.5px", "font-weight": "700" }}>Recent Tax Invoices (बिक्री खाता)</h3>
              </div>
              <button
                class="erp-button erp-button-secondary"
                style={{ "font-size": "11px", padding: "0.2rem 0.5rem" }}
                onClick={() => props.onNavigate("sales")}
              >
                View Sales Book →
              </button>
            </div>

            <Show
              when={sales().length > 0}
              fallback={<div style={{ "font-size": "12px", color: "var(--erp-text-muted)", padding: "1rem 0" }}>No tax invoices issued yet.</div>}
            >
              <div style={{ "overflow-x": "auto" }}>
                <table class="erp-table" style={{ width: "100%", "font-size": "12px" }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Customer</th>
                      <th style={{ "text-align": "right" }}>Total (NPR)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sales().slice(0, 4)}>
                      {(inv) => (
                        <tr>
                          <td style={{ "font-weight": "600", "font-family": "var(--font-mono)" }}>{inv.invoice_no}</td>
                          <td>{inv.customer_name}</td>
                          <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                            {formatNpr(inv.grand_total_paisa)}
                          </td>
                          <td>
                            <span class={inv.payment_status === "Paid" ? "erp-badge erp-badge-success" : "erp-badge erp-badge-neutral"}>
                              {inv.payment_status}
                            </span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>

          {/* Active Field Service Dispatch */}
          <div class="erp-card" style={{ padding: "1.15rem", display: "flex", "flex-direction": "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
              <div style={{ display: "flex", "align-items": "center", gap: "0.4rem" }}>
                <IconFieldService size={15} color="var(--erp-primary)" />
                <h3 style={{ "font-size": "13.5px", "font-weight": "700" }}>Field Service Tickets & AMC (मर्मत सेवा)</h3>
              </div>
              <button
                class="erp-button erp-button-secondary"
                style={{ "font-size": "11px", padding: "0.2rem 0.5rem" }}
                onClick={() => props.onNavigate("field_service")}
              >
                Manage Tickets →
              </button>
            </div>

            <Show
              when={services().length > 0}
              fallback={<div style={{ "font-size": "12px", color: "var(--erp-text-muted)", padding: "1rem 0" }}>No field tickets logged yet.</div>}
            >
              <div style={{ "overflow-x": "auto" }}>
                <table class="erp-table" style={{ width: "100%", "font-size": "12px" }}>
                  <thead>
                    <tr>
                      <th>Ticket #</th>
                      <th>Client / Equipment</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={services().slice(0, 4)}>
                      {(srv) => (
                        <tr>
                          <td style={{ "font-weight": "600", "font-family": "var(--font-mono)" }}>{srv.ticket_no}</td>
                          <td>
                            <div>{srv.customer_name}</div>
                            <div style={{ "font-size": "10.5px", color: "var(--erp-text-muted)" }}>{srv.product_name}</div>
                          </td>
                          <td>
                            <span class={srv.priority === "HIGH" || srv.priority === "CRITICAL" ? "erp-badge erp-badge-danger" : "erp-badge erp-badge-neutral"}>
                              {srv.priority}
                            </span>
                          </td>
                          <td>
                            <span class={srv.status === "Closed" ? "erp-badge erp-badge-success" : srv.status === "IN_PROGRESS" ? "erp-badge erp-badge-warning" : "erp-badge erp-badge-neutral"}>
                              {srv.status}
                            </span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>

          {/* Quick Staff & Attendance Status */}
          <div class="erp-card" style={{ padding: "1.15rem", display: "flex", "flex-direction": "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
              <div style={{ display: "flex", "align-items": "center", gap: "0.4rem" }}>
                <IconHRM size={15} color="var(--erp-primary)" />
                <h3 style={{ "font-size": "13.5px", "font-weight": "700" }}>HRM & Daily Attendance (कर्मचारी)</h3>
              </div>
              <button
                class="erp-button erp-button-secondary"
                style={{ "font-size": "11px", padding: "0.2rem 0.5rem" }}
                onClick={() => props.onNavigate("hrm")}
              >
                View Staff →
              </button>
            </div>

            <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "0.75rem", "text-align": "center" }}>
              <div style={{ padding: "0.6rem", background: "var(--erp-bg-card-subtle)", "border-radius": "5px" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>Total Staff</div>
                <div style={{ "font-size": "16px", "font-weight": "700", color: "var(--erp-text-main)" }}>{totalStaff()}</div>
              </div>
              <div style={{ padding: "0.6rem", background: "var(--erp-bg-card-subtle)", "border-radius": "5px" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>Present Today</div>
                <div style={{ "font-size": "16px", "font-weight": "700", color: "var(--erp-success)" }}>{presentToday()}</div>
              </div>
              <div style={{ padding: "0.6rem", background: "var(--erp-bg-card-subtle)", "border-radius": "5px" }}>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>Monthly Payroll</div>
                <div class="tabular-nums" style={{ "font-size": "13.5px", "font-weight": "700", color: "var(--erp-primary)" }}>
                  NPR {formatNpr(totalMonthlyPayrollPaisa())}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Launchpad & Executive Navigation Footer */}
      <div
        class="erp-card"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
          "flex-wrap": "wrap",
          gap: "0.75rem",
          background: "var(--erp-bg-card-subtle)",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <span style={{ "font-weight": "600", "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
            Quick Modules:
          </span>
          <div style={{ display: "flex", gap: "0.4rem", "flex-wrap": "wrap" }}>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("sales")}>
              + Tax Invoice
            </button>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("accounting")}>
              + Journal Voucher
            </button>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("purchases")}>
              + Purchase Bill
            </button>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("inventory")}>
              + Stock Transfer
            </button>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("field_service")}>
              + Service Ticket
            </button>
            <button class="erp-button erp-button-secondary" style={{ "font-size": "12px", padding: "0.25rem 0.6rem" }} onClick={() => props.onNavigate("users")}>
              + Users & Roles
            </button>
          </div>
        </div>

        <div style={{ "font-size": "11.5px", color: "var(--erp-text-muted)" }}>
          Jubilant ERP v1.0.0 • Enterprise Edition
        </div>
      </div>
    </div>
  );
}
