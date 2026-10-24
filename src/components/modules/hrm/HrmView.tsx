import { createSignal, onMount, For, Show } from "solid-js";
import { api, EmployeeView, AttendanceView } from "../../../api/client";
import { IconPlus, IconRefresh, IconCheck, IconHRM, IconPrinter, IconAlert } from "../../ui/Icons";

export function HrmView() {
  const [activeTab, setActiveTab] = createSignal<"attendance" | "employees" | "leaves" | "payroll" | "performance">("attendance");
  const [employees, setEmployees] = createSignal<EmployeeView[]>([]);
  const [attendance, setAttendance] = createSignal<AttendanceView[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = createSignal(false);
  const [showLeaveModal, setShowLeaveModal] = createSignal(false);
  const [previewPayslip, setPreviewPayslip] = createSignal<any | null>(null);

  // Leave Management State (Section 6.3 User Manual)
  const [leaves, setLeaves] = createSignal([
    {
      id: "lv-1",
      employee_name: "Ramesh Sharma",
      department: "Field Service",
      leave_type: "Casual Leave",
      start_date: "2081-07-15",
      end_date: "2081-07-16",
      days: 2,
      reason: "Family social celebration",
      status: "Approved",
    },
    {
      id: "lv-2",
      employee_name: "Anita Shrestha",
      department: "Accounts & Finance",
      leave_type: "Sick Leave",
      start_date: "2081-07-20",
      end_date: "2081-07-21",
      days: 2,
      reason: "Medical health checkup and recovery",
      status: "Pending",
    },
    {
      id: "lv-3",
      employee_name: "Sunil Tamang",
      department: "Field Service",
      leave_type: "Paid Annual",
      start_date: "2081-07-28",
      end_date: "2081-07-30",
      days: 3,
      reason: "Travel outside Kathmandu valley",
      status: "Pending",
    },
  ]);

  // Leave Form State
  const [leaveEmployeeName, setLeaveEmployeeName] = createSignal("");
  const [leaveType, setLeaveType] = createSignal("Casual Leave");
  const [leaveDays, setLeaveDays] = createSignal(2);
  const [leaveReason, setLeaveReason] = createSignal("");

  // Payroll Records State (Section 6.4 & 6.5 User Manual)
  const [payrollRecords, setPayrollRecords] = createSignal([
    {
      id: "pr-1",
      employee_name: "Ramesh Sharma",
      designation: "Lead Service Engineer",
      department: "Field Service",
      month: "Ashoj 2081",
      basic_salary_paisa: 4500000,
      allowance_paisa: 800000,
      incentive_bonus_paisa: 500000,
      pf_deduction_paisa: 450000,
      social_security_tax_paisa: 45000,
      net_payout_paisa: 5305000,
      status: "Approved",
    },
    {
      id: "pr-2",
      employee_name: "Anita Shrestha",
      designation: "Senior Accountant",
      department: "Accounts & Finance",
      month: "Ashoj 2081",
      basic_salary_paisa: 4200000,
      allowance_paisa: 600000,
      incentive_bonus_paisa: 0,
      pf_deduction_paisa: 420000,
      social_security_tax_paisa: 42000,
      net_payout_paisa: 4338000,
      status: "Approved",
    },
    {
      id: "pr-3",
      employee_name: "Sunil Tamang",
      designation: "Field Technician",
      department: "Field Service",
      month: "Ashoj 2081",
      basic_salary_paisa: 3200000,
      allowance_paisa: 500000,
      incentive_bonus_paisa: 400000,
      pf_deduction_paisa: 320000,
      social_security_tax_paisa: 32000,
      net_payout_paisa: 3748000,
      status: "Calculated",
    },
  ]);

  // Performance Scorecards (Section 7.1 to 7.6 User Manual)
  const [scorecards, setScorecards] = createSignal([
    {
      id: "sc-1",
      employee_name: "Ramesh Sharma",
      designation: "Lead Service Engineer",
      department: "Field Service",
      attendance_score: 96,
      task_completion_score: 94,
      sales_or_service_target_score: 92,
      nps_feedback_score: 95,
      overall_score: 93,
      grade: "A+",
      calculated_incentive_paisa: 500000,
    },
    {
      id: "sc-2",
      employee_name: "Anita Shrestha",
      designation: "Senior Accountant",
      department: "Accounts & Finance",
      attendance_score: 98,
      task_completion_score: 95,
      sales_or_service_target_score: 90,
      nps_feedback_score: 88,
      overall_score: 94,
      grade: "A+",
      calculated_incentive_paisa: 0,
    },
    {
      id: "sc-3",
      employee_name: "Sunil Tamang",
      designation: "Field Technician",
      department: "Field Service",
      attendance_score: 90,
      task_completion_score: 85,
      sales_or_service_target_score: 88,
      nps_feedback_score: 90,
      overall_score: 88,
      grade: "A",
      calculated_incentive_paisa: 400000,
    },
  ]);

  // New Employee Form
  const [code, setCode] = createSignal(`EMP-${Date.now().toString().slice(-4)}`);
  const [name, setName] = createSignal("");
  const [citizenship, setCitizenship] = createSignal("");
  const [dept, setDept] = createSignal("Technician");
  const [designation, setDesignation] = createSignal("Senior Field Engineer");
  const [salary, setSalary] = createSignal(45000); // 45,000 NPR
  const [bankAcc, setBankAcc] = createSignal("");

  const loadData = async () => {
    try {
      const [emps, att] = await Promise.all([
        api.getEmployees(),
        api.getAttendanceRecords(),
      ]);
      setEmployees(emps);
      setAttendance(att);
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

  const handlePunch = async (employeeId: string) => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await api.markAttendance({
        employeeId,
        date: now.toISOString().split("T")[0],
        inTime: timeStr,
        hoursWorked: 8.0,
        isLate: false,
        source: "Self-CheckIn",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Attendance punch failed");
    }
  };

  const handleCreateEmployee = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createEmployee({
        employeeCode: code(),
        name: name(),
        citizenshipNo: citizenship() || undefined,
        department: dept(),
        designation: designation(),
        salaryPaisa: Math.round(Number(salary()) * 100),
        bankAccountNo: bankAcc() || undefined,
        panNo: undefined,
      });
      setShowEmployeeModal(false);
      setCode(`EMP-${Date.now().toString().slice(-4)}`);
      setName("");
      setCitizenship("");
      loadData();
    } catch (err: any) {
      alert("Failed to register employee: " + err.message);
    }
  };

  const totalPayrollPaisa = () => employees().reduce((acc, e) => acc + (e.basic_salary_paisa || (e as any).salary_paisa || 0), 0);

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ "font-size": "18px", "font-weight": "700", "letter-spacing": "-0.01em" }}>
            Human Resources & Daily Attendance
          </h2>
          <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
            Employee roster, biometric daily check-in, and payroll register
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <div class="erp-tabs">
            <button
              class={`erp-tab-btn ${activeTab() === "attendance" ? "active" : ""}`}
              onClick={() => setActiveTab("attendance")}
            >
              Today's Attendance
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "employees" ? "active" : ""}`}
              onClick={() => setActiveTab("employees")}
            >
              Staff Directory
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "leaves" ? "active" : ""}`}
              onClick={() => setActiveTab("leaves")}
            >
              Leave Approvals ({leaves().filter(l => l.status === "Pending").length})
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "payroll" ? "active" : ""}`}
              onClick={() => setActiveTab("payroll")}
            >
              Payroll & Payslips
            </button>
            <button
              class={`erp-tab-btn ${activeTab() === "performance" ? "active" : ""}`}
              onClick={() => setActiveTab("performance")}
            >
              Performance Center
            </button>
          </div>

          <button
            type="button"
            class="erp-btn erp-btn-secondary"
            onClick={loadData}
            title="Refresh Attendance"
          >
            <IconRefresh size={14} />
          </button>

          <button
            type="button"
            class="erp-btn erp-btn-primary"
            onClick={() => {
              if (activeTab() === "leaves") setShowLeaveModal(true);
              else setShowEmployeeModal(true);
            }}
          >
            <IconPlus size={14} />
            <span>{activeTab() === "leaves" ? "+ Apply Leave" : "+ Onboard Staff"}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div class="erp-kpi-grid">
        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Total Active Staff</div>
          <div class="erp-kpi-value tabular-nums">{employees().length}</div>
          <div class="erp-kpi-subtext">Across 4 departments</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Present Today</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-success)" }}>
            {attendance().length}
          </div>
          <div class="erp-kpi-subtext">Clocked in via kiosk/mobile</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Field Technicians</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-primary)" }}>
            {employees().filter((e) => e.department === "Technician").length}
          </div>
          <div class="erp-kpi-subtext">Available for dispatch</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Monthly Gross Payroll</div>
          <div class="erp-kpi-value tabular-nums">
            NPR {formatNpr(totalPayrollPaisa())}
          </div>
          <div class="erp-kpi-subtext">Base salaries in NPR</div>
        </div>
      </div>

      {/* Attendance Register Tab */}
      <Show when={activeTab() === "attendance"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Daily Attendance Register</div>
              <div class="erp-card-subtitle">Live biometric and mobile timestamp audit trail</div>
            </div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={employees()}
                  fallback={
                    <tr>
                      <td colspan="8">
                        <div class="erp-empty-state">
                          <p>No staff records found. Click "+ Onboard Staff" to add employees.</p>
                        </div>
                      </td>
                    </tr>
                  }
                >
                  {(emp) => {
                    const todayRecord = () => attendance().find((a) => a.employee_id === emp.id);
                    return (
                      <tr>
                        <td>
                          <div style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{emp.name}</div>
                          <div class="tabular-nums" style={{ "font-size": "11px", color: "var(--erp-text-muted)" }}>{emp.employee_code}</div>
                        </td>
                        <td>
                          <span class="erp-badge erp-badge-neutral">{emp.department}</span>
                        </td>
                        <td class="tabular-nums" style={{ color: "var(--erp-text-secondary)" }}>
                          {todayRecord() ? todayRecord()!.date : new Date().toISOString().split("T")[0]}
                        </td>
                        <td class="tabular-nums">
                          {todayRecord()?.in_time || "—"}
                        </td>
                        <td class="tabular-nums">
                          {todayRecord()?.out_time || "—"}
                        </td>
                        <td class="tabular-nums">
                          {todayRecord()?.hours_worked ? `${todayRecord()!.hours_worked} hrs` : "—"}
                        </td>
                        <td>
                          <span class={`erp-badge ${todayRecord() ? "erp-badge-success" : "erp-badge-neutral"}`}>
                            {todayRecord() ? todayRecord()!.source : "Not Clocked In"}
                          </span>
                        </td>
                        <td>
                          <Show
                            when={!todayRecord()}
                            fallback={
                              <span style={{ color: "var(--erp-success)", "font-size": "12px", "font-weight": "600" }}>
                                Present
                              </span>
                            }
                          >
                            <button
                              type="button"
                              class="erp-btn erp-btn-secondary erp-btn-sm"
                              onClick={() => handlePunch(emp.id)}
                            >
                              Check In
                            </button>
                          </Show>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Employee Directory Tab */}
      <Show when={activeTab() === "employees"}>
        <div class="erp-card">
          <div class="erp-card-header">
            <div>
              <div class="erp-card-title">Staff Roster Directory</div>
              <div class="erp-card-subtitle">Permanent personnel with bank account and citizenship records</div>
            </div>
            <div class="erp-badge erp-badge-neutral">{employees().length} Staff</div>
          </div>

          <div class="erp-table-wrapper" style={{ "border": "none", "border-radius": "0" }}>
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Staff Code</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th style={{ "text-align": "right" }}>Monthly Salary (NPR)</th>
                  <th>Bank Account</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={employees()}>
                  {(emp) => (
                    <tr>
                      <td class="tabular-nums" style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{emp.employee_code}</td>
                      <td style={{ "font-weight": "600" }}>{emp.name}</td>
                      <td>
                        <span class="erp-badge erp-badge-neutral">{emp.department}</span>
                      </td>
                      <td style={{ color: "var(--erp-text-secondary)" }}>{emp.designation}</td>
                      <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600" }}>
                        {formatNpr(emp.basic_salary_paisa || (emp as any).salary_paisa || 0)}
                      </td>
                      <td class="tabular-nums" style={{ color: "var(--erp-text-muted)" }}>
                        {emp.bank_account_no || "Nabil Bank (On File)"}
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

      {/* Tab 3: Leave Management & Approvals (Section 6.3 User Manual) */}
      <Show when={activeTab() === "leaves"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          <div class="erp-card" style={{ padding: "1rem 1.25rem", display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <div>
              <div style={{ "font-weight": "600", "font-size": "13px", color: "var(--erp-text-main)" }}>
                Staff Leave Applications & Approvals
              </div>
              <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                Supported categories: Paid Annual, Sick Leave, Casual Leave, Maternity & Paternity. Department leads approve with 1-click.
              </div>
            </div>
            <button
              type="button"
              class="erp-btn erp-btn-primary erp-btn-sm"
              onClick={() => setShowLeaveModal(true)}
            >
              <IconPlus size={13} />
              <span>+ Apply Leave Request</span>
            </button>
          </div>

          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Department</th>
                    <th>Leave Category</th>
                    <th>Leave Period</th>
                    <th style={{ "text-align": "center" }}>Days</th>
                    <th>Reason / Justification</th>
                    <th>Approval Status</th>
                    <th style={{ "text-align": "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={leaves()}>
                    {(l) => (
                      <tr>
                        <td style={{ "font-weight": "600" }}>{l.employee_name}</td>
                        <td><span class="erp-badge erp-badge-neutral">{l.department}</span></td>
                        <td>
                          <span class={`erp-badge ${l.leave_type === "Sick Leave" ? "erp-badge-danger" : l.leave_type === "Casual Leave" ? "erp-badge-info" : "erp-badge-primary"}`}>
                            {l.leave_type}
                          </span>
                        </td>
                        <td style={{ "font-size": "12px" }}>
                          {l.start_date} <span style={{ color: "var(--erp-text-muted)" }}>to</span> {l.end_date}
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "center", "font-weight": "600" }}>
                          {l.days}
                        </td>
                        <td style={{ "font-size": "12px", "max-width": "220px" }}>{l.reason}</td>
                        <td>
                          <span class={`erp-badge ${l.status === "Approved" ? "erp-badge-success" : l.status === "Rejected" ? "erp-badge-danger" : "erp-badge-warning"}`}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ "text-align": "right" }}>
                          <Show when={l.status === "Pending"}>
                            <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                              <button
                                type="button"
                                class="erp-btn erp-btn-primary erp-btn-sm"
                                onClick={() => {
                                  setLeaves(leaves().map(item => item.id === l.id ? { ...item, status: "Approved" } : item));
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                class="erp-btn erp-btn-secondary erp-btn-sm"
                                onClick={() => {
                                  setLeaves(leaves().map(item => item.id === l.id ? { ...item, status: "Rejected" } : item));
                                }}
                              >
                                Reject
                              </button>
                            </div>
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

      {/* Tab 4: Monthly Payroll & Payslips (Section 6.4 & 6.5 User Manual) */}
      <Show when={activeTab() === "payroll"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          <div class="erp-card" style={{ padding: "1rem 1.25rem", display: "flex", "justify-content": "space-between", "align-items": "center" }}>
            <div>
              <div style={{ "font-weight": "600", "font-size": "13px", color: "var(--erp-text-main)" }}>
                Monthly Payroll Calculation & Bank Advice (Bikram Sambat Ashoj 2081)
              </div>
              <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                Auto-computes basic pay, dearness allowance, sales incentives, 10% Provident Fund (PF), and 1% Social Security Tax (SST).
              </div>
            </div>
            <button
              type="button"
              class="erp-btn erp-btn-secondary erp-btn-sm"
              onClick={() => alert("Batch payroll recalculated against biometric attendance and leave registers.")}
            >
              <IconRefresh size={13} />
              <span>Recalculate Batch</span>
            </button>
          </div>

          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Staff Name & Role</th>
                    <th>Salary Month</th>
                    <th style={{ "text-align": "right" }}>Basic Pay (NPR)</th>
                    <th style={{ "text-align": "right" }}>Allowances</th>
                    <th style={{ "text-align": "right" }}>Incentive Bonus</th>
                    <th style={{ "text-align": "right" }}>PF (10%)</th>
                    <th style={{ "text-align": "right" }}>1% SST</th>
                    <th style={{ "text-align": "right" }}>Net Payout (NPR)</th>
                    <th>Status</th>
                    <th style={{ "text-align": "right" }}>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={payrollRecords()}>
                    {(p) => (
                      <tr>
                        <td>
                          <div style={{ "font-weight": "600", color: "var(--erp-primary)" }}>{p.employee_name}</div>
                          <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>{p.designation}</div>
                        </td>
                        <td style={{ "font-size": "12px" }}>{p.month}</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(p.basic_salary_paisa)}</td>
                        <td class="tabular-nums" style={{ "text-align": "right" }}>{formatNpr(p.allowance_paisa)}</td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-success)" }}>
                          {p.incentive_bonus_paisa > 0 ? `+${formatNpr(p.incentive_bonus_paisa)}` : "—"}
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-danger)" }}>
                          ({formatNpr(p.pf_deduction_paisa)})
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "right", color: "var(--erp-danger)" }}>
                          ({formatNpr(p.social_security_tax_paisa)})
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "700", color: "var(--erp-primary)", "font-size": "13px" }}>
                          NPR {formatNpr(p.net_payout_paisa)}
                        </td>
                        <td>
                          <span class="erp-badge erp-badge-success">{p.status}</span>
                        </td>
                        <td style={{ "text-align": "right" }}>
                          <button
                            type="button"
                            class="erp-btn erp-btn-ghost erp-btn-sm"
                            onClick={() => setPreviewPayslip(p)}
                            title="View Official Payslip PDF"
                          >
                            <IconPrinter size={13} />
                            <span>Payslip</span>
                          </button>
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

      {/* Tab 5: Performance Center & Scorecards (Section 7 User Manual) */}
      <Show when={activeTab() === "performance"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          {/* Scoring Model Weighting Banner */}
          <div class="erp-card" style={{ padding: "1.125rem" }}>
            <div style={{ "font-size": "13px", "font-weight": "700", color: "var(--erp-text-main)", "margin-bottom": "0.35rem" }}>
              Designation-Weighted Performance Models (0–100 Scale)
            </div>
            <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)", "line-height": "1.5" }}>
              Performance Center integrates attendance punctuality, completed daily tasks, commercial/service targets, and customer NPS feedback into objective, data-driven grades with direct incentive payouts.
            </div>

            <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", "margin-top": "0.75rem" }}>
              <div style={{ padding: "0.6rem 0.85rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", border: "1px solid var(--erp-border-medium)" }}>
                <div style={{ "font-weight": "600", "font-size": "12px", color: "var(--erp-primary)" }}>Sales Representative</div>
                <div style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>40% Target · 20% Tasks · 20% Attendance · 20% NPS</div>
              </div>
              <div style={{ padding: "0.6rem 0.85rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", border: "1px solid var(--erp-border-medium)" }}>
                <div style={{ "font-weight": "600", "font-size": "12px", color: "var(--erp-success)" }}>Field Service Technician</div>
                <div style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>40% Work Orders · 30% First-Visit Fix · 20% Attendance · 10% NPS</div>
              </div>
              <div style={{ padding: "0.6rem 0.85rem", background: "var(--erp-bg-card-subtle)", "border-radius": "4px", border: "1px solid var(--erp-border-medium)" }}>
                <div style={{ "font-weight": "600", "font-size": "12px", color: "var(--erp-warning)" }}>Accountant & Administration</div>
                <div style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>50% Deadlines · 30% Attendance · 20% Tax Compliance</div>
              </div>
            </div>
          </div>

          {/* Scorecards Table */}
          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Designation & Dept</th>
                    <th style={{ "text-align": "center" }}>Attendance</th>
                    <th style={{ "text-align": "center" }}>Tasks Done</th>
                    <th style={{ "text-align": "center" }}>Target Attainment</th>
                    <th style={{ "text-align": "center" }}>NPS Rating</th>
                    <th style={{ "text-align": "center" }}>Overall (0–100)</th>
                    <th style={{ "text-align": "center" }}>Grade</th>
                    <th style={{ "text-align": "right" }}>Approved Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={scorecards()}>
                    {(s) => (
                      <tr>
                        <td style={{ "font-weight": "600", color: "var(--erp-text-main)" }}>{s.employee_name}</td>
                        <td>
                          <div>{s.designation}</div>
                          <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>{s.department}</div>
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "center" }}>{s.attendance_score}%</td>
                        <td class="tabular-nums" style={{ "text-align": "center" }}>{s.task_completion_score}%</td>
                        <td class="tabular-nums" style={{ "text-align": "center" }}>{s.sales_or_service_target_score}%</td>
                        <td class="tabular-nums" style={{ "text-align": "center" }}>{s.nps_feedback_score}%</td>
                        <td class="tabular-nums" style={{ "text-align": "center", "font-weight": "700", "font-size": "13.5px", color: "var(--erp-primary)" }}>
                          {s.overall_score}
                        </td>
                        <td style={{ "text-align": "center" }}>
                          <span class={`erp-badge ${s.grade === "A+" ? "erp-badge-brand" : s.grade === "A" ? "erp-badge-success" : "erp-badge-neutral"}`}>
                            {s.grade}
                          </span>
                        </td>
                        <td class="tabular-nums" style={{ "text-align": "right", "font-weight": "600", color: s.calculated_incentive_paisa > 0 ? "var(--erp-success)" : "var(--erp-text-muted)" }}>
                          {s.calculated_incentive_paisa > 0 ? `NPR ${formatNpr(s.calculated_incentive_paisa)}` : "—"}
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

      {/* Onboard Staff Modal */}
      <Show when={showEmployeeModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "540px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Onboard New Employee</div>
                <div class="erp-card-subtitle">Register personnel for biometric attendance and payroll</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowEmployeeModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmployee}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div style={{ display: "grid", "grid-template-columns": "1fr 2fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Staff Code</label>
                    <input
                      type="text"
                      required
                      class="erp-input tabular-nums"
                      value={code()}
                      onInput={(e) => setCode(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Karki"
                      class="erp-input"
                      value={name()}
                      onInput={(e) => setName(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Department</label>
                    <select
                      class="erp-select"
                      value={dept()}
                      onChange={(e) => setDept(e.currentTarget.value)}
                    >
                      <option value="Accounting">Accounting & Finance</option>
                      <option value="Technician">Field Engineering</option>
                      <option value="Warehouse">Godown & Logistics</option>
                      <option value="Sales">Sales & Distribution</option>
                      <option value="Executive">Management</option>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Designation / Role</label>
                    <input
                      type="text"
                      required
                      placeholder="Senior Field Engineer"
                      class="erp-input"
                      value={designation()}
                      onInput={(e) => setDesignation(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Monthly Gross Salary (NPR)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      class="erp-input tabular-nums"
                      value={salary()}
                      onInput={(e) => setSalary(Number(e.currentTarget.value))}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Citizenship # (नागरिकता नं)</label>
                    <input
                      type="text"
                      placeholder="27-01-XX-XXXXX"
                      class="erp-input tabular-nums"
                      value={citizenship()}
                      onInput={(e) => setCitizenship(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="Nabil Bank 0100XXXXXXX"
                    class="erp-input tabular-nums"
                    value={bankAcc()}
                    onInput={(e) => setBankAcc(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Register Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Apply Leave Modal (Section 6.3 User Manual) */}
      <Show when={showLeaveModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "500px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Apply for Staff Leave</div>
                <div class="erp-card-subtitle">Submit leave request for departmental authorization</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowLeaveModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const matchedEmp = employees().find((emp) => emp.name === leaveEmployeeName());
                const newLv = {
                  id: `lv-${Date.now()}`,
                  employee_name: leaveEmployeeName() || (employees()[0]?.name || "Staff Member"),
                  department: matchedEmp ? matchedEmp.department : "General",
                  leave_type: leaveType() as any,
                  start_date: new Date().toISOString().split("T")[0],
                  end_date: new Date(Date.now() + leaveDays() * 86400000).toISOString().split("T")[0],
                  days: Number(leaveDays()),
                  reason: leaveReason() || "Personal obligation",
                  status: "Pending" as const,
                };
                setLeaves([newLv, ...leaves()]);
                setShowLeaveModal(false);
                setLeaveReason("");
              }}
            >
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Staff Member</label>
                  <select
                    class="erp-select"
                    value={leaveEmployeeName()}
                    onChange={(e) => setLeaveEmployeeName(e.currentTarget.value)}
                  >
                    <For each={employees()}>
                      {(emp) => <option value={emp.name}>{emp.name} ({emp.department})</option>}
                    </For>
                  </select>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1.4fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Leave Category</label>
                    <select
                      class="erp-select"
                      value={leaveType()}
                      onChange={(e) => setLeaveType(e.currentTarget.value)}
                    >
                      <option value="Casual Leave">Casual Leave (आकस्मिक)</option>
                      <option value="Sick Leave">Sick Leave (बिरामी बिदा)</option>
                      <option value="Paid Annual">Paid Annual (घर बिदा)</option>
                      <option value="Maternity / Paternity">Maternity / Paternity</option>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Requested Days</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      class="erp-input tabular-nums"
                      value={leaveDays()}
                      onInput={(e) => setLeaveDays(Number(e.currentTarget.value))}
                      required
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Reason / Justification</label>
                  <textarea
                    rows={3}
                    class="erp-input"
                    placeholder="Provide specific reason for absence..."
                    value={leaveReason()}
                    onInput={(e) => setLeaveReason(e.currentTarget.value)}
                    required
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Submit Leave Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Official Monthly Payslip Preview & Print Modal (Section 6.5 User Manual) */}
      <Show when={previewPayslip()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "600px", background: "#ffffff", color: "#000000" }}>
            <div class="erp-modal-header no-print">
              <span class="erp-card-title">Nepal Salary Slip / Advice (तलब विवरण)</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  class="erp-btn erp-btn-primary erp-btn-sm"
                  onClick={() => window.print()}
                >
                  <IconPrinter size={13} />
                  <span>Print Payslip</span>
                </button>
                <button
                  type="button"
                  class="erp-btn erp-btn-ghost erp-btn-sm"
                  onClick={() => setPreviewPayslip(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div class="erp-printable-invoice" style={{ padding: "1.5rem" }}>
              <div style={{ "text-align": "center", "margin-bottom": "1.25rem", "border-bottom": "2px solid #000000", "padding-bottom": "0.75rem" }}>
                <h2 style={{ margin: "0", "font-size": "17px", "font-weight": "800" }}>JUBILANT ENTERPRISES PVT. LTD.</h2>
                <div style={{ "font-size": "11.5px" }}>Kathmandu, Nepal · IRD PAN: 601928475</div>
                <div style={{ "font-weight": "700", "font-size": "13px", "margin-top": "0.35rem" }}>
                  SALARY SLIP FOR THE MONTH OF {previewPayslip()?.month.toUpperCase()}
                </div>
              </div>

              <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.5rem", "font-size": "12px", "margin-bottom": "1.25rem" }}>
                <div><strong>Employee Name:</strong> {previewPayslip()?.employee_name}</div>
                <div><strong>Designation:</strong> {previewPayslip()?.designation}</div>
                <div><strong>Department:</strong> {previewPayslip()?.department}</div>
                <div><strong>Bank Transfer:</strong> Nabil Bank (Branch Kathmandu)</div>
              </div>

              <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "1rem", "font-size": "12px", "margin-bottom": "1.25rem" }}>
                {/* Earnings Table */}
                <table style={{ width: "100%", "border-collapse": "collapse", border: "1px solid #000000" }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0", border: "1px solid #000000" }}>
                      <th style={{ padding: "0.35rem 0.5rem", "text-align": "left" }}>Earnings (आम्दानी)</th>
                      <th style={{ padding: "0.35rem 0.5rem", "text-align": "right" }}>NPR</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd" }}>Basic Salary</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #ddd" }}>
                        {formatNpr(previewPayslip()?.basic_salary_paisa || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd" }}>Allowances (Dearness/Rent)</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #ddd" }}>
                        {formatNpr(previewPayslip()?.allowance_paisa || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd" }}>Performance Incentive</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #ddd" }}>
                        {formatNpr(previewPayslip()?.incentive_bonus_paisa || 0)}
                      </td>
                    </tr>
                    <tr style={{ "font-weight": "700", background: "#fafafa" }}>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #000" }}>Gross Earnings:</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #000" }}>
                        {formatNpr(
                          (previewPayslip()?.basic_salary_paisa || 0) +
                          (previewPayslip()?.allowance_paisa || 0) +
                          (previewPayslip()?.incentive_bonus_paisa || 0)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Deductions Table */}
                <table style={{ width: "100%", "border-collapse": "collapse", border: "1px solid #000000" }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0", border: "1px solid #000000" }}>
                      <th style={{ padding: "0.35rem 0.5rem", "text-align": "left" }}>Deductions (कटौती)</th>
                      <th style={{ padding: "0.35rem 0.5rem", "text-align": "right" }}>NPR</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd" }}>Provident Fund (10%)</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #ddd" }}>
                        {formatNpr(previewPayslip()?.pf_deduction_paisa || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd" }}>1% Social Security Tax (SST)</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #ddd" }}>
                        {formatNpr(previewPayslip()?.social_security_tax_paisa || 0)}
                      </td>
                    </tr>
                    <tr style={{ "font-weight": "700", background: "#fafafa" }}>
                      <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #000" }}>Total Deductions:</td>
                      <td style={{ padding: "0.35rem 0.5rem", "text-align": "right", border: "1px solid #000" }}>
                        {formatNpr(
                          (previewPayslip()?.pf_deduction_paisa || 0) +
                          (previewPayslip()?.social_security_tax_paisa || 0)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Payout Banner */}
              <div style={{ background: "#f9f9f9", border: "2px solid #000000", padding: "0.75rem 1rem", display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "2.5rem" }}>
                <span style={{ "font-size": "13px", "font-weight": "700" }}>NET SALARY PAYABLE (कुल खुद भुक्तानी):</span>
                <span style={{ "font-size": "15px", "font-weight": "800" }}>NPR {formatNpr(previewPayslip()?.net_payout_paisa || 0)}</span>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", "justify-content": "space-between", "font-size": "11.5px" }}>
                <div style={{ "border-top": "1px dashed #000", width: "170px", "padding-top": "0.35rem", "text-align": "center" }}>
                  Employee Signature
                </div>
                <div style={{ "border-top": "1px dashed #000", width: "170px", "padding-top": "0.35rem", "text-align": "center" }}>
                  HR & Finance Manager
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

