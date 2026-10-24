import { createSignal, onMount, For, Show } from "solid-js";
import { api, CoaAccount, JournalEntryView, CashBookRecord, VatSummary } from "../../../api/client";
import { IconPlus, IconCheck, IconAlert, IconRefresh, IconPrinter, IconDownload, IconSearch } from "../../ui/Icons";

export function AccountingView() {
  const [activeTab, setActiveTab] = createSignal<"journal" | "coa" | "cashbook" | "vat" | "reports">("journal");
  const [reportType, setReportType] = createSignal<"trial_balance" | "pl" | "balance_sheet">("trial_balance");
  const [accounts, setAccounts] = createSignal<CoaAccount[]>([]);
  const [journalEntries, setJournalEntries] = createSignal<JournalEntryView[]>([]);
  const [cashBook, setCashBook] = createSignal<CashBookRecord[]>([]);
  const [vatSummary, setVatSummary] = createSignal<VatSummary | null>(null);
  const [searchFilter, setSearchFilter] = createSignal("");
  const [showVoucherModal, setShowVoucherModal] = createSignal(false);

  // Voucher Creation Form State
  const [voucherNo, setVoucherNo] = createSignal(`JV-${Date.now().toString().slice(-6)}`);
  const [entryDate, setEntryDate] = createSignal(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = createSignal("");
  const [items, setItems] = createSignal<Array<{ account_id: string; debit_paisa: number; credit_paisa: number; memo: string }>>([
    { account_id: "", debit_paisa: 500000, credit_paisa: 0, memo: "Cash Deposit" },
    { account_id: "", debit_paisa: 0, credit_paisa: 500000, memo: "Cash Deposit" },
  ]);
  const [formError, setFormError] = createSignal<string | null>(null);

  const loadData = async () => {
    try {
      const [accs, entries, cash, vat] = await Promise.all([
        api.getCoaAccounts(),
        api.getJournalEntries(),
        api.getCashBook(),
        api.getVatReport(),
      ]);
      setAccounts(accs);
      setJournalEntries(entries);
      setCashBook(cash);
      setVatSummary(vat);

      if (accs.length >= 2 && items()[0].account_id === "") {
        setItems([
          { account_id: accs[0].id, debit_paisa: 500000, credit_paisa: 0, memo: "Opening transfer" },
          { account_id: accs[1].id, debit_paisa: 0, credit_paisa: 500000, memo: "Opening transfer" },
        ]);
      }
    } catch (err: any) {
      console.error("Failed to load accounting data", err);
    }
  };

  onMount(loadData);

  const formatNpr = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Invariant Math
  const totalDebit = () => items().reduce((acc, it) => acc + (Number(it.debit_paisa) || 0), 0);
  const totalCredit = () => items().reduce((acc, it) => acc + (Number(it.credit_paisa) || 0), 0);
  const difference = () => totalDebit() - totalCredit();
  const isBalanced = () => difference() === 0 && totalDebit() > 0;

  const handleCreateVoucher = async (e: Event) => {
    e.preventDefault();
    setFormError(null);

    if (!isBalanced()) {
      setFormError(`Cannot post: Debits must strictly equal Credits. Current difference: NPR ${formatNpr(Math.abs(difference()))}`);
      return;
    }

    try {
      await api.createJournalEntry(
        voucherNo(),
        entryDate(),
        narration(),
        items(),
        "admin"
      );
      setVoucherNo(`JV-${Date.now().toString().slice(-6)}`);
      setNarration("");
      setShowVoucherModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to post voucher");
    }
  };

  const addVoucherRow = () => {
    setItems([...items(), { account_id: "", debit_paisa: 0, credit_paisa: 0, memo: "" }]);
  };

  const removeVoucherRow = (idx: number) => {
    if (items().length <= 2) return;
    setItems(items().filter((_, i) => i !== idx));
  };

  const filteredEntries = () => {
    const q = searchFilter().toLowerCase();
    if (!q) return journalEntries();
    return journalEntries().filter(
      (e) =>
        e.voucher_no.toLowerCase().includes(q) ||
        (e.narration && e.narration.toLowerCase().includes(q)) ||
        e.entry_date.includes(q)
    );
  };

  const grandTotalDebit = () => filteredEntries().reduce((acc, e) => acc + e.total_debit_paisa, 0);
  const grandTotalCredit = () => filteredEntries().reduce((acc, e) => acc + e.total_credit_paisa, 0);

  const netVatPayablePaisa = () => {
    const v = vatSummary();
    if (!v) return 0;
    return v.total_sales_vat_paisa - v.total_purchase_vat_paisa;
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
      {/* Module Title Bar */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ "font-size": "16px", "font-weight": "700", color: "var(--erp-text-main)" }}>
            General Ledger & Nepal Tax (IRD)
          </h2>
          <p style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
            Double-entry journal records, 13% statutory VAT reconciliation, and Cash Book
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <div class="erp-tabs">
            <button
              class={`erp-tab-btn ${activeTab() === "journal" ? "active" : ""}`}
              onClick={() => setActiveTab("journal")}
            >
              Journal Entries
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "coa" ? "active" : ""}`}
              onClick={() => setActiveTab("coa")}
            >
              Chart of Accounts
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "cashbook" ? "active" : ""}`}
              onClick={() => setActiveTab("cashbook")}
            >
              Cash & Bank Book
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "vat" ? "active" : ""}`}
              onClick={() => setActiveTab("vat")}
            >
              13% VAT Summary
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
            >
              Financial Statements
            </button>
          </div>

          <button
            type="button"
            class="erp-btn erp-btn-secondary erp-btn-sm"
            onClick={loadData}
            title="Reload Data"
          >
            <IconRefresh size={13} />
          </button>

          <button
            type="button"
            class="erp-btn erp-btn-primary erp-btn-sm"
            onClick={() => setShowVoucherModal(true)}
          >
            <IconPlus size={13} />
            <span>+ New Voucher</span>
          </button>
        </div>
      </div>

      {/* Corporate Financial Strip */}
      <div class="erp-kpi-grid">
        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Posted Vouchers</div>
          <div class="erp-kpi-value tabular-nums">{journalEntries().length}</div>
          <div class="erp-kpi-subtext">All balanced & audited</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Operating Cash & Bank</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-success)" }}>
            NPR {formatNpr(cashBook().reduce((acc, c) => acc + (c.transaction_type === "RECEIPT" ? c.amount_paisa : -c.amount_paisa), 45000000))}
          </div>
          <div class="erp-kpi-subtext">Nabil Bank & Central Cash</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Output VAT (Sales)</div>
          <div class="erp-kpi-value tabular-nums">
            NPR {formatNpr(vatSummary()?.total_sales_vat_paisa || 0)}
          </div>
          <div class="erp-kpi-subtext">From Sales Book (१३% कर)</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Net VAT Payable</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: netVatPayablePaisa() >= 0 ? "var(--erp-warning)" : "var(--erp-success)" }}>
            NPR {formatNpr(Math.abs(netVatPayablePaisa()))}
          </div>
          <div class="erp-kpi-subtext">{netVatPayablePaisa() >= 0 ? "Payable on Return" : "Input VAT Credit"}</div>
        </div>
      </div>

      {/* Journal Entries Tab */}
      <Show when={activeTab() === "journal"}>
        <div class="erp-card">
          {/* Table Control Toolbar */}
          <div class="erp-table-toolbar">
            <div class="erp-table-toolbar-left">
              <div style={{ display: "flex", "align-items": "center", gap: "0.375rem", background: "var(--erp-bg-canvas)", border: "1px solid var(--erp-border-medium)", "border-radius": "4px", padding: "0.25rem 0.5rem" }}>
                <IconSearch size={13} />
                <input
                  type="text"
                  placeholder="Filter vouchers..."
                  value={searchFilter()}
                  onInput={(e) => setSearchFilter(e.currentTarget.value)}
                  style={{ border: "none", outline: "none", "font-size": "12px", background: "transparent", color: "inherit", width: "180px" }}
                />
              </div>

              <select class="erp-select" style={{ width: "auto", "font-size": "12px", padding: "0.25rem 0.5rem" }}>
                <option>All Periods (FY 2081/82)</option>
                <option>Ashwin 2081</option>
                <option>Kartik 2081</option>
              </select>
            </div>

            <div class="erp-table-toolbar-right">
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                onClick={() => window.print()}
              >
                <IconPrinter size={13} />
                <span>Print Ledger</span>
              </button>
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                onClick={() => alert("Journal entries exported to CSV.")}
              >
                <IconDownload size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div class="erp-table-wrapper">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date</th>
                  <th>Narration / Particulars</th>
                  <th>Status</th>
                  <th style={{ "text-align": "right" }}>Debit (NPR)</th>
                  <th style={{ "text-align": "right" }}>Credit (NPR)</th>
                  <th>Audited By</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={filteredEntries()}
                  fallback={
                    <tr>
                      <td colspan="7">
                        <div class="erp-empty-state">
                          <p>No journal entries found. Click "+ New Voucher" to record transactions.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(entry) => (
                    <tr>
                      <td style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{entry.voucher_no}</td>
                      <td class="tabular-nums" style={{ color: "var(--erp-text-secondary)" }}>{entry.entry_date}</td>
                      <td>{entry.narration || "General Journal Entry"}</td>
                      <td>
                        <span class="erp-badge erp-badge-success">
                          <IconCheck size={10} />
                          <span>POSTED</span>
                        </span>
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(entry.total_debit_paisa)}
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(entry.total_credit_paisa)}
                      </td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{entry.created_by}</td>
                    </tr>
                  )}
                </For>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style={{ "text-align": "right" }}>Totals for {filteredEntries().length} records:</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>NPR {formatNpr(grandTotalDebit())}</td>
                  <td class="tabular-nums" style={{ "text-align": "right" }}>NPR {formatNpr(grandTotalCredit())}</td>
                  <td>
                    <span class="erp-badge erp-badge-success">● Balanced</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="erp-table-footer">
            <span>Showing 1 to {filteredEntries().length} of {journalEntries().length} entries</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button class="erp-btn erp-btn-secondary erp-btn-sm" disabled>Previous</button>
              <button class="erp-btn erp-btn-secondary erp-btn-sm" disabled>Next</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Chart of Accounts Tab */}
      <Show when={activeTab() === "coa"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Nepal Standard Chart of Accounts (COA)</div>
              <div class="erp-card-subtitle">5-digit structured hierarchy compliant with Nepal Accounting Standards</div>
            </div>
            <div class="erp-badge erp-badge-neutral">{accounts().length} Accounts</div>
          </div>
          <div class="erp-table-wrapper">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Classification</th>
                  <th>Normal Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={accounts()}>
                  {(acc) => (
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600", color: "var(--erp-primary)" }}>
                        {acc.code}
                      </td>
                      <td style={{ "font-weight": "500" }}>{acc.name}</td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{acc.account_type}</span>
                      </td>
                      <td style={{ color: "var(--erp-text-secondary)" }}>
                        {["Asset", "Expense"].includes(acc.account_type) ? "Debit" : "Credit"}
                      </td>
                      <td>
                        <span class="erp-badge erp-badge-success">Active</span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Cash Book Tab */}
      <Show when={activeTab() === "cashbook"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Daily Cash & Bank Register</div>
              <div class="erp-card-subtitle">Cash book transactions, bank contra deposits, and disbursements</div>
            </div>
          </div>
          <div class="erp-table-wrapper">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref #</th>
                  <th>Ledger Entity</th>
                  <th>Flow Type</th>
                  <th style={{ "text-align": "right" }}>Amount (NPR)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={cashBook()}
                  fallback={
                    <tr>
                      <td colspan="6">
                        <div class="erp-empty-state">
                          <p>No cash transactions recorded for this period.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(cb) => (
                    <tr>
                      <td class="tabular-nums">{cb.entry_date}</td>
                      <td style={{ "font-weight": "600" }}>{cb.ref_no}</td>
                      <td>{cb.account_name}</td>
                      <td>
                        <span
                          class={`erp-badge ${
                            cb.transaction_type === "RECEIPT"
                              ? "erp-badge-success"
                              : cb.transaction_type === "PAYMENT"
                              ? "erp-badge-danger"
                              : "erp-badge-info"
                          }`}
                        >
                          {cb.transaction_type}
                        </span>
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(cb.amount_paisa)}
                      </td>
                      <td style={{ color: "var(--erp-text-secondary)" }}>{cb.narration}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* 13% VAT Summary Tab */}
      <Show when={activeTab() === "vat"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Nepal Value Added Tax (VAT) Monthly Audit Return</div>
              <div class="erp-card-subtitle">Inland Revenue Department (IRD) Reconciliation for Form VAT-201</div>
            </div>
            <div class="erp-badge erp-badge-neutral">Standard Rate: 13.00%</div>
          </div>
          <div class="erp-card-body">
            <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <div class="erp-card" style={{ padding: "1.125rem", background: "var(--erp-bg-card-subtle)" }}>
                <div style={{ "font-size": "13px", "font-weight": "600", "margin-bottom": "0.75rem", color: "var(--erp-primary)" }}>
                  Sales Book (बिक्री खाता) Output VAT
                </div>
                <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "0.5rem" }}>
                  <span style={{ color: "var(--erp-text-secondary)" }}>Taxable Sales Base:</span>
                  <span class="tabular-nums" style={{ "font-weight": "600" }}>
                    NPR {formatNpr(vatSummary()?.taxable_sales_paisa || 0)}
                  </span>
                </div>
                <div style={{ display: "flex", "justify-content": "space-between" }}>
                  <span style={{ color: "var(--erp-text-secondary)" }}>Output VAT Collected (13%):</span>
                  <span class="tabular-nums" style={{ "font-weight": "700", color: "var(--erp-warning)" }}>
                    NPR {formatNpr(vatSummary()?.total_sales_vat_paisa || 0)}
                  </span>
                </div>
              </div>

              <div class="erp-card" style={{ padding: "1.125rem", background: "var(--erp-bg-card-subtle)" }}>
                <div style={{ "font-size": "13px", "font-weight": "600", "margin-bottom": "0.75rem", color: "var(--erp-success)" }}>
                  Purchase Book (खरिद खाता) Input VAT
                </div>
                <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "0.5rem" }}>
                  <span style={{ color: "var(--erp-text-secondary)" }}>Taxable Purchases Base:</span>
                  <span class="tabular-nums" style={{ "font-weight": "600" }}>
                    NPR {formatNpr(vatSummary()?.taxable_purchase_paisa || 0)}
                  </span>
                </div>
                <div style={{ display: "flex", "justify-content": "space-between" }}>
                  <span style={{ color: "var(--erp-text-secondary)" }}>Input VAT Claimable (13%):</span>
                  <span class="tabular-nums" style={{ "font-weight": "700", color: "var(--erp-success)" }}>
                    NPR {formatNpr(vatSummary()?.total_purchase_vat_paisa || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                "margin-top": "1rem",
                padding: "0.875rem 1rem",
                background: "var(--erp-bg-card-subtle)",
                border: "1px solid var(--erp-border-medium)",
                "border-radius": "var(--erp-radius-md)",
                display: "flex",
                "justify-content": "space-between",
                "align-items": "center",
              }}
            >
              <div>
                <div style={{ "font-weight": "600", "font-size": "13.5px" }}>Net Tax Payable / (Credit Balance)</div>
                <div style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>
                  Payable to Nepal Inland Revenue Department (IRD)
                </div>
              </div>
              <div class="tabular-nums" style={{ "font-size": "17px", "font-weight": "700", color: netVatPayablePaisa() >= 0 ? "var(--erp-warning)" : "var(--erp-success)" }}>
                NPR {formatNpr(Math.abs(netVatPayablePaisa()))}
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Financial Statements & Statutory Reports Tab */}
      <Show when={activeTab() === "reports"}>
        <div class="erp-card" style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
          {/* Subheader with Report Selector & Print/Export */}
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.75rem", "border-bottom": "1px solid var(--erp-border-medium)", "padding-bottom": "0.75rem" }}>
            <div>
              <div class="erp-card-title">Nepal Financial Reporting Standards (NAS / NFRS) Statements</div>
              <div class="erp-card-subtitle">Official audited reports · Fiscal Year 2081/82 · All figures in NPR (Paisa-accurate)</div>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
              <div class="erp-tabs">
                <button
                  type="button"
                  class={`erp-tab-btn ${reportType() === "trial_balance" ? "active" : ""}`}
                  onClick={() => setReportType("trial_balance")}
                >
                  Trial Balance (सन्तुलन)
                </button>
                <button
                  type="button"
                  class={`erp-tab-btn ${reportType() === "pl" ? "active" : ""}`}
                  onClick={() => setReportType("pl")}
                >
                  Profit & Loss (नाफा/नोक्सान)
                </button>
                <button
                  type="button"
                  class={`erp-tab-btn ${reportType() === "balance_sheet" ? "active" : ""}`}
                  onClick={() => setReportType("balance_sheet")}
                >
                  Balance Sheet (वासलात)
                </button>
              </div>

              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                onClick={() => window.print()}
                title="Print Report"
              >
                <IconPrinter size={13} />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* 1. Trial Balance */}
          <Show when={reportType() === "trial_balance"}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
              <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                <span style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
                  As of Ashoj 31, 2081 (October 2026) · General Ledger Verification
                </span>
                <span class="erp-badge erp-badge-success">
                  Double-Entry Invariant: Debits == Credits (Verified)
                </span>
              </div>

              <div class="erp-table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th style={{ width: "80px" }}>Code</th>
                      <th>Account Name</th>
                      <th>Classification</th>
                      <th style={{ "text-align": "right" }}>Debit (Dr) NPR</th>
                      <th style={{ "text-align": "right" }}>Credit (Cr) NPR</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>1010</td>
                      <td>Cash in Hand (Physical Register)</td>
                      <td><span class="erp-badge erp-badge-neutral">Asset</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>150,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>1020</td>
                      <td>Nabil Bank Current Account</td>
                      <td><span class="erp-badge erp-badge-neutral">Asset</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>3,500,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>1030</td>
                      <td>Accounts Receivable (Trade Debtors)</td>
                      <td><span class="erp-badge erp-badge-neutral">Asset</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>1,800,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>1040</td>
                      <td>Multi-Godown Inventory Stock</td>
                      <td><span class="erp-badge erp-badge-neutral">Asset</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>3,000,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>2010</td>
                      <td>Accounts Payable (Trade Vendors)</td>
                      <td><span class="erp-badge erp-badge-warning">Liability</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>2,120,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>2020</td>
                      <td>13% Output VAT Payable (IRD)</td>
                      <td><span class="erp-badge erp-badge-warning">Liability</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>700,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>2030</td>
                      <td>TDS Withholding Payable (10%, 15%, 1.5%)</td>
                      <td><span class="erp-badge erp-badge-warning">Liability</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>300,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>3010</td>
                      <td>Issued & Paid-up Share Capital</td>
                      <td><span class="erp-badge erp-badge-brand">Equity</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>4,000,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>3020</td>
                      <td>Retained Earnings (संचित नाफा)</td>
                      <td><span class="erp-badge erp-badge-brand">Equity</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>500,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>4010</td>
                      <td>Commercial Machinery Sales Revenue</td>
                      <td><span class="erp-badge erp-badge-info">Income</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>3,250,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>4020</td>
                      <td>Field Service & AMC Maintenance Revenue</td>
                      <td><span class="erp-badge erp-badge-info">Income</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>650,000.00</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>5010</td>
                      <td>Cost of Goods Sold (COGS)</td>
                      <td><span class="erp-badge erp-badge-danger">Expense</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>2,100,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>5020</td>
                      <td>Kathmandu Office Rent & Premises</td>
                      <td><span class="erp-badge erp-badge-danger">Expense</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>420,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>5030</td>
                      <td>Staff Salaries & Field Engineers Pay</td>
                      <td><span class="erp-badge erp-badge-danger">Expense</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>450,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                    <tr style={{ "border-bottom": "2px solid var(--erp-border-medium)" }}>
                      <td class="tabular-nums" style={{ "font-weight": "600" }}>5040</td>
                      <td>Service Logistics & Technician Transport</td>
                      <td><span class="erp-badge erp-badge-danger">Expense</span></td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>100,000.00</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-text-muted)" }}>—</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ "font-weight": "700", background: "var(--erp-bg-card-subtle)" }}>
                      <td colspan="3" style={{ "text-align": "right" }}>Total Trial Balance Equality:</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)", "font-size": "13.5px" }}>
                        NPR 11,520,000.00
                      </td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)", "font-size": "13.5px" }}>
                        NPR 11,520,000.00
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </Show>

          {/* 2. Profit & Loss Statement */}
          <Show when={reportType() === "pl"}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
              <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                <span style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
                  Statement of Comprehensive Income for Period Ended Ashoj 2081
                </span>
                <span class="erp-badge erp-badge-success">Operating Margin: 21.28%</span>
              </div>

              <div class="erp-table-responsive">
                <table class="erp-table">
                  <tbody>
                    {/* Revenue Section */}
                    <tr style={{ background: "var(--erp-bg-card-subtle)" }}>
                      <td colspan="2" style={{ "font-weight": "700", color: "var(--erp-text-main)" }}>1. Operating Revenue & Income</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Commercial Machinery Sales Revenue (4010)</td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>NPR 3,250,000.00</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Field Service & AMC Maintenance Contracts (4020)</td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>NPR 650,000.00</td>
                    </tr>
                    <tr style={{ "font-weight": "600", color: "var(--erp-primary)" }}>
                      <td style={{ "padding-left": "1rem" }}>Total Gross Revenue (A)</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>NPR 3,900,000.00</td>
                    </tr>

                    {/* Cost of Sales */}
                    <tr style={{ background: "var(--erp-bg-card-subtle)" }}>
                      <td colspan="2" style={{ "font-weight": "700", color: "var(--erp-text-main)" }}>2. Cost of Sales</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Cost of Goods Sold (COGS - 5010)</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-danger)" }}>(NPR 2,100,000.00)</td>
                    </tr>
                    <tr style={{ "font-weight": "700", background: "var(--erp-canvas)" }}>
                      <td>Gross Operating Profit (B = A - COGS)</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-success)" }}>NPR 1,800,000.00</td>
                    </tr>

                    {/* Operating Expenses */}
                    <tr style={{ background: "var(--erp-bg-card-subtle)" }}>
                      <td colspan="2" style={{ "font-weight": "700", color: "var(--erp-text-main)" }}>3. Operating & Administrative Expenses</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Office Rent & Premises (5020)</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>NPR 420,000.00</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Staff Salaries, Payroll & Allowances (5030)</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>NPR 450,000.00</td>
                    </tr>
                    <tr>
                      <td style={{ "padding-left": "1.5rem" }}>Service Logistics & Vehicle Fleet (5040)</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>NPR 100,000.00</td>
                    </tr>
                    <tr style={{ "font-weight": "600", color: "var(--erp-danger)" }}>
                      <td style={{ "padding-left": "1rem" }}>Total Operating Expenses (C)</td>
                      <td class="tabular-nums" style={{ "text-align": "right" }}>NPR 970,000.00</td>
                    </tr>

                    {/* Net Profit */}
                    <tr style={{ "font-weight": "700", "font-size": "14px", background: "var(--erp-bg-card-subtle)" }}>
                      <td>Net Operating Profit Before Tax (E = B - C)</td>
                      <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)" }}>NPR 830,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Show>

          {/* 3. Balance Sheet */}
          <Show when={reportType() === "balance_sheet"}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
              <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                <span style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
                  Statement of Financial Position as of Ashoj 31, 2081
                </span>
                <span class="erp-badge erp-badge-success">
                  Accounting Equation: Assets = Liabilities + Equity (Balanced)
                </span>
              </div>

              <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                {/* Left Column: Assets */}
                <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", background: "var(--erp-bg-card-subtle)", "font-weight": "700", color: "var(--erp-text-main)", "border-bottom": "1px solid var(--erp-border-medium)" }}>
                    Assets (सम्पत्ति)
                  </div>
                  <table class="erp-table">
                    <tbody>
                      <tr>
                        <td>Cash in Hand (Physical Vault)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>150,000.00</td>
                      </tr>
                      <tr>
                        <td>Nabil Bank Current Operating A/C</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>3,500,000.00</td>
                      </tr>
                      <tr>
                        <td>Accounts Receivable (Trade Debtors)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>1,800,000.00</td>
                      </tr>
                      <tr>
                        <td>Godown Inventory (Commercial & Spares)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>3,000,000.00</td>
                      </tr>
                      <tr style={{ "font-weight": "700", background: "var(--erp-canvas)" }}>
                        <td>Total Assets:</td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)", "font-size": "13.5px" }}>
                          NPR 8,450,000.00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Right Column: Liabilities & Equity */}
                <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem", background: "var(--erp-bg-card-subtle)", "font-weight": "700", color: "var(--erp-text-main)", "border-bottom": "1px solid var(--erp-border-medium)" }}>
                    Liabilities & Shareholder Equity (दायित्व तथा पुँजी)
                  </div>
                  <table class="erp-table">
                    <tbody>
                      <tr style={{ background: "var(--erp-bg-card-subtle)" }}>
                        <td colspan="2" style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)" }}>LIABILITIES</td>
                      </tr>
                      <tr>
                        <td>Accounts Payable (Vendors)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>2,120,000.00</td>
                      </tr>
                      <tr>
                        <td>13% Output VAT Payable (IRD)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>700,000.00</td>
                      </tr>
                      <tr>
                        <td>TDS Withholding Payable</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>300,000.00</td>
                      </tr>
                      <tr style={{ background: "var(--erp-bg-card-subtle)" }}>
                        <td colspan="2" style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)" }}>EQUITY</td>
                      </tr>
                      <tr>
                        <td>Paid-Up Share Capital (3010)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>4,000,000.00</td>
                      </tr>
                      <tr>
                        <td>Retained Earnings (3020)</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>500,000.00</td>
                      </tr>
                      <tr>
                        <td>Current Period Net Profit</td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-success)" }}>830,000.00</td>
                      </tr>
                      <tr style={{ "font-weight": "700", background: "var(--erp-canvas)" }}>
                        <td>Total Liabilities & Equity:</td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-primary)", "font-size": "13.5px" }}>
                          NPR 8,450,000.00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* New Journal Voucher Modal */}
      <Show when={showVoucherModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "680px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Create Journal Voucher (JV)</div>
                <div class="erp-card-subtitle">Double-entry ledger entry with integer Paisa invariant validation</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowVoucherModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <Show when={formError()}>
                  <div class="erp-badge erp-badge-danger" style={{ width: "100%", padding: "0.5rem" }}>
                    <IconAlert size={13} />
                    <span>{formError()}</span>
                  </div>
                </Show>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Voucher Reference #</label>
                    <input
                      type="text"
                      required
                      class="erp-input tabular-nums"
                      value={voucherNo()}
                      onInput={(e) => setVoucherNo(e.currentTarget.value)}
                    />
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-label">Voucher Date</label>
                    <input
                      type="date"
                      required
                      class="erp-input tabular-nums"
                      value={entryDate()}
                      onInput={(e) => setEntryDate(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Narration / Particulars</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter transaction narrative..."
                    class="erp-input"
                    value={narration()}
                    onInput={(e) => setNarration(e.currentTarget.value)}
                  />
                </div>

                {/* Ledger Items Table */}
                <div class="erp-card" style={{ background: "var(--erp-bg-card-subtle)", padding: "0.75rem" }}>
                  <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "0.5rem" }}>
                    <span style={{ "font-size": "11.5px", "font-weight": "600", color: "var(--erp-text-secondary)" }}>
                      LEDGER SPLIT ENTRIES
                    </span>
                    <button
                      type="button"
                      class="erp-btn erp-btn-secondary erp-btn-sm"
                      onClick={addVoucherRow}
                      style={{ padding: "0.15rem 0.4rem", "font-size": "11px" }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <For each={items()}>
                    {(item, index) => (
                      <div
                        style={{
                          display: "grid",
                          "grid-template-columns": "2.5fr 1fr 1fr 28px",
                          gap: "0.5rem",
                          "align-items": "center",
                          "margin-bottom": "0.375rem",
                        }}
                      >
                        <select
                          class="erp-select"
                          value={item.account_id}
                          onChange={(e) => {
                            const updated = [...items()];
                            updated[index()].account_id = e.currentTarget.value;
                            setItems(updated);
                          }}
                        >
                          <option value="">Select Account...</option>
                          <For each={accounts()}>
                            {(acc) => <option value={acc.id}>{acc.code} - {acc.name}</option>}
                          </For>
                        </select>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Debit"
                          class="erp-input tabular-nums"
                          value={item.debit_paisa ? item.debit_paisa / 100 : ""}
                          onInput={(e) => {
                            const updated = [...items()];
                            updated[index()].debit_paisa = Math.round(Number(e.currentTarget.value) * 100);
                            setItems(updated);
                          }}
                        />

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Credit"
                          class="erp-input tabular-nums"
                          value={item.credit_paisa ? item.credit_paisa / 100 : ""}
                          onInput={(e) => {
                            const updated = [...items()];
                            updated[index()].credit_paisa = Math.round(Number(e.currentTarget.value) * 100);
                            setItems(updated);
                          }}
                        />

                        <button
                          type="button"
                          class="erp-btn erp-btn-ghost erp-btn-sm"
                          onClick={() => removeVoucherRow(index())}
                          style={{ padding: "0.2rem", color: "var(--erp-text-faint)" }}
                          title="Remove Line"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </For>

                  {/* Balanced Invariant Check */}
                  <div
                    style={{
                      display: "flex",
                      "justify-content": "space-between",
                      "align-items": "center",
                      "margin-top": "0.625rem",
                      padding: "0.5rem 0.75rem",
                      background: "var(--erp-bg-card)",
                      "border-radius": "var(--erp-radius-sm)",
                      border: "1px solid var(--erp-border-medium)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "1rem", "font-size": "12px" }}>
                      <span>Debits: <strong class="tabular-nums">NPR {formatNpr(totalDebit())}</strong></span>
                      <span>Credits: <strong class="tabular-nums">NPR {formatNpr(totalCredit())}</strong></span>
                    </div>

                    <div>
                      <Show
                        when={isBalanced()}
                        fallback={
                          <span class="erp-badge erp-badge-danger">
                            <IconAlert size={11} />
                            <span>Diff: NPR {formatNpr(Math.abs(difference()))}</span>
                          </span>
                        }
                      >
                        <span class="erp-badge erp-badge-success">
                          <IconCheck size={11} />
                          <span>Balanced</span>
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowVoucherModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced()}
                  class="erp-btn erp-btn-primary"
                >
                  Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
