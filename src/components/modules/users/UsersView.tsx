import { createSignal, onMount, For, Show } from "solid-js";
import { api, UserProfile, Role } from "../../../api/client";
import {
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconKey,
  IconEdit,
  IconCheck,
  IconAlert,
  IconClose,
} from "../../ui/Icons";

export function UsersView() {
  const [activeTab, setActiveTab] = createSignal<"users" | "roles">("users");
  const [users, setUsers] = createSignal<UserProfile[]>([]);
  const [roles, setRoles] = createSignal<Role[]>([]);
  const [searchFilter, setSearchFilter] = createSignal("");
  const [roleFilter, setRoleFilter] = createSignal("ALL");
  const [statusFilter, setStatusFilter] = createSignal("ALL");
  const [isLoading, setIsLoading] = createSignal(false);
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showResetModal, setShowResetModal] = createSignal(false);

  // Selected User for Edit / Reset
  const [selectedUser, setSelectedUser] = createSignal<UserProfile | null>(null);

  // Create User Form
  const [newName, setNewName] = createSignal("");
  const [newEmail, setNewEmail] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [newPin, setNewPin] = createSignal("");
  const [newRoleId, setNewRoleId] = createSignal("");
  const [newDepartment, setNewDepartment] = createSignal("Administration");
  const [createError, setCreateError] = createSignal<string | null>(null);

  // Edit User Form
  const [editName, setEditName] = createSignal("");
  const [editEmail, setEditEmail] = createSignal("");
  const [editRoleId, setEditRoleId] = createSignal("");
  const [editDepartment, setEditDepartment] = createSignal("");
  const [editIsActive, setEditIsActive] = createSignal(true);
  const [editError, setEditError] = createSignal<string | null>(null);

  // Reset Password Form
  const [resetPassword, setResetPassword] = createSignal("");
  const [resetPin, setResetPin] = createSignal("");
  const [resetError, setResetError] = createSignal<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, rList] = await Promise.all([api.getUsers(), api.getRoles()]);
      setUsers(uList);
      setRoles(rList);
      if (rList.length > 0 && !newRoleId()) {
        setNewRoleId(rList[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load user management data", err);
      showToast("Error loading users: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  onMount(loadData);

  // Open Edit Modal
  const openEditModal = (u: UserProfile) => {
    setSelectedUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRoleId(u.role_id);
    setEditDepartment(u.department);
    setEditIsActive(u.is_active);
    setEditError(null);
    setShowEditModal(true);
  };

  // Open Reset Password Modal
  const openResetModal = (u: UserProfile) => {
    setSelectedUser(u);
    setResetPassword("");
    setResetPin("");
    setResetError(null);
    setShowResetModal(true);
  };

  // Handle Create User
  const handleCreateUser = async (e: Event) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName() || !newEmail() || !newPassword() || !newRoleId()) {
      setCreateError("Please fill all required fields.");
      return;
    }
    try {
      await api.createUser({
        name: newName(),
        email: newEmail(),
        password: newPassword(),
        pin: newPin() || undefined,
        roleId: newRoleId(),
        department: newDepartment(),
      });
      showToast(`User ${newName()} created successfully.`);
      setShowCreateModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewPin("");
      loadData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user");
    }
  };

  // Handle Edit User
  const handleEditUser = async (e: Event) => {
    e.preventDefault();
    setEditError(null);
    const u = selectedUser();
    if (!u) return;

    try {
      await api.updateUser({
        id: u.id,
        name: editName(),
        email: editEmail(),
        roleId: editRoleId(),
        department: editDepartment(),
        isActive: editIsActive(),
      });
      showToast(`User ${editName()} updated.`);
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      setEditError(err.message || "Failed to update user");
    }
  };

  // Handle Reset Password / PIN
  const handleResetPassword = async (e: Event) => {
    e.preventDefault();
    setResetError(null);
    const u = selectedUser();
    if (!u) return;
    if (!resetPassword() && !resetPin()) {
      setResetError("Please provide at least a new password or a new 4-digit PIN.");
      return;
    }
    try {
      await api.resetUserPassword({
        id: u.id,
        newPassword: resetPassword() || undefined,
        newPin: resetPin() || undefined,
      });
      showToast(`Credentials updated for ${u.name}.`);
      setShowResetModal(false);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset credentials");
    }
  };

  // Handle Quick Toggle Status
  const handleToggleStatus = async (u: UserProfile) => {
    const nextStatus = !u.is_active;
    try {
      await api.toggleUserStatus(u.id, nextStatus);
      showToast(`User ${u.name} is now ${nextStatus ? "Active" : "Suspended"}.`);
      loadData();
    } catch (err: any) {
      showToast("Failed to toggle status: " + (err.message || String(err)));
    }
  };

  // Filtered Users
  const filteredUsers = () => {
    return users().filter((u) => {
      const q = searchFilter().toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);
      const matchesRole = roleFilter() === "ALL" || u.role_name === roleFilter();
      const matchesStatus =
        statusFilter() === "ALL" ||
        (statusFilter() === "ACTIVE" && u.is_active) ||
        (statusFilter() === "INACTIVE" && !u.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  };

  // User Manual Standard Role Specifications
  const standardRoles = [
    {
      role: "Company (Admin)",
      dept: "Executive / Admin",
      responsibilities: "Full system configuration, fiscal year management, master reports, global overrides, audit logs.",
      modules: "All Modules, Settings, Security & User Management",
      badgeClass: "erp-badge-brand",
    },
    {
      role: "Accountant / Finance",
      dept: "Accounts & Finance",
      responsibilities: "Tax Invoicing, Bills, Payments, 13% VAT returns, TDS withholding, Bank Reconciliation, Cash Book, Financial Statements.",
      modules: "Accounting System, Double Entry, Banking, Purchases, Reports",
      badgeClass: "erp-badge-primary",
    },
    {
      role: "Operation",
      dept: "Commercial & CRM",
      responsibilities: "Lead follow-up, Quotations, Client management, Delivery Challans, Daily Activity Reports.",
      modules: "Sales Portal, CRM, Challan, Quotations, Performance (Self)",
      badgeClass: "erp-badge-info",
    },
    {
      role: "Warehouse / Godown Officer",
      dept: "Supply & Inventory",
      responsibilities: "Stock receipt from bills, dispatching against Delivery Challans, warehouse transfers, physical stock audits.",
      modules: "Products System, Challan, Warehouse, Damage Reports",
      badgeClass: "erp-badge-warning",
    },
    {
      role: "HR Manager",
      dept: "Human Resources",
      responsibilities: "Employee profiles, biometric attendance import, leave approvals, salary structure, monthly payroll processing.",
      modules: "HRM System, Recruitment, Payroll, Attendance",
      badgeClass: "erp-badge-neutral",
    },
    {
      role: "Technician / Service Engineer",
      dept: "Field Service",
      responsibilities: "Customer complaint diagnosis, site visits, maintenance checklists, spare parts requests, repair sign-off.",
      modules: "Technician System, Spare Parts, Work Orders, Digital Sign-Off",
      badgeClass: "erp-badge-success",
    },
    {
      role: "General Employee",
      dept: "All Departments",
      responsibilities: "Daily attendance punch, leave application, view personal payslip, submit work tasks, view personal scorecard.",
      modules: "My Performance, HRM Self-Service",
      badgeClass: "erp-badge-neutral",
    },
    {
      role: "Client / Dealer",
      dept: "External Portal",
      responsibilities: "View approved quotations, invoices, service ticket statuses, and account statements.",
      modules: "Client Portal, Ticket Status, Statements",
      badgeClass: "erp-badge-neutral",
    },
  ];

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
      {/* Toast Notification */}
      <Show when={toastMessage()}>
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            background: "var(--erp-surface)",
            color: "var(--erp-text-main)",
            border: "1px solid var(--erp-primary)",
            padding: "0.75rem 1.25rem",
            "border-radius": "6px",
            "box-shadow": "0 4px 12px rgba(0,0,0,0.15)",
            "z-index": 9999,
            display: "flex",
            "align-items": "center",
            gap: "0.5rem",
            "font-size": "13px",
          }}
        >
          <IconCheck size={16} />
          <span>{toastMessage()}</span>
        </div>
      </Show>

      {/* Header & Action Bar */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "flex-start", "flex-wrap": "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ "font-size": "1.35rem", "font-weight": "700", color: "var(--erp-text-main)", margin: "0 0 0.25rem 0" }}>
            User Management & RBAC Security
          </h2>
          <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)", margin: 0 }}>
            Configure employee accounts, role-based module access, credential security, and field service authentication PINs.
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <button
            type="button"
            class="erp-btn erp-btn-secondary"
            onClick={loadData}
            title="Refresh Users"
          >
            <IconRefresh size={14} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            class="erp-btn erp-btn-primary"
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
          >
            <IconPlus size={14} />
            <span>Onboard New User</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div class="erp-tabs">
        <button
          type="button"
          class={`erp-tab ${activeTab() === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <IconShield size={14} />
          <span>Active Users ({users().length})</span>
        </button>
        <button
          type="button"
          class={`erp-tab ${activeTab() === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          <IconKey size={14} />
          <span>Roles & Security Matrix ({roles().length})</span>
        </button>
      </div>

      {/* Tab 1: User Directory */}
      <Show when={activeTab() === "users"}>
        {/* Filter Bar */}
        <div
          class="erp-card"
          style={{
            padding: "0.75rem 1rem",
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            "flex-wrap": "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "0.75rem", flex: 1, "min-width": "260px" }}>
            <div class="erp-search-box" style={{ width: "100%", "max-width": "320px" }}>
              <IconSearch size={14} />
              <input
                type="text"
                placeholder="Search user by name, email, department..."
                value={searchFilter()}
                onInput={(e) => setSearchFilter(e.currentTarget.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "inherit",
                  "font-size": "inherit",
                  width: "100%",
                }}
              />
            </div>

            <select
              class="erp-input"
              value={roleFilter()}
              onChange={(e) => setRoleFilter(e.currentTarget.value)}
              style={{ width: "auto", "font-size": "12px", padding: "0.35rem 0.65rem" }}
            >
              <option value="ALL">All Roles</option>
              <For each={roles()}>{(r) => <option value={r.name}>{r.name}</option>}</For>
            </select>

            <select
              class="erp-input"
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
              style={{ width: "auto", "font-size": "12px", padding: "0.35rem 0.65rem" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Suspended Only</option>
            </select>
          </div>

          <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)" }}>
            Showing <strong>{filteredUsers().length}</strong> of <strong>{users().length}</strong> accounts
          </div>
        </div>

        {/* Users Table */}
        <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
          <div class="erp-table-responsive">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Department</th>
                  <th>System Role</th>
                  <th>Status</th>
                  <th>Last Authentication</th>
                  <th style={{ "text-align": "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={filteredUsers()}
                  fallback={
                    <tr>
                      <td colspan="6" style={{ "text-align": "center", padding: "2.5rem", color: "var(--erp-text-muted)" }}>
                        No user accounts found matching your query.
                      </td>
                    </tr>
                  }
                >
                  {(u) => {
                    const roleBadgeClass = () => {
                      if (u.role_name.includes("Admin")) return "erp-badge-brand";
                      if (u.role_name.includes("Accountant") || u.role_name.includes("Finance")) return "erp-badge-primary";
                      if (u.role_name.includes("Technician")) return "erp-badge-success";
                      if (u.role_name.includes("Warehouse")) return "erp-badge-warning";
                      if (u.role_name.includes("Operation")) return "erp-badge-info";
                      return "erp-badge-neutral";
                    };

                    const formatLastLogin = (ts?: number) => {
                      if (!ts) return "Never logged in";
                      const d = new Date(ts);
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                    };

                    return (
                      <tr>
                        <td>
                          <div style={{ display: "flex", "align-items": "center", gap: "0.6rem" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                "border-radius": "50%",
                                background: "var(--erp-border-medium)",
                                color: "var(--erp-text-main)",
                                display: "flex",
                                "align-items": "center",
                                "justify-content": "center",
                                "font-weight": "700",
                                "font-size": "12px",
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ "font-weight": "600", color: "var(--erp-text-main)", "font-size": "13px" }}>
                                {u.name}
                              </div>
                              <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ "font-size": "12.5px", color: "var(--erp-text-main)" }}>
                            {u.department}
                          </span>
                        </td>
                        <td>
                          <span class={`erp-badge ${roleBadgeClass()}`}>
                            {u.role_name}
                          </span>
                        </td>
                        <td>
                          <Show
                            when={u.is_active}
                            fallback={<span class="erp-badge erp-badge-danger">Suspended</span>}
                          >
                            <span class="erp-badge erp-badge-success">Active</span>
                          </Show>
                        </td>
                        <td>
                          <span style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>
                            {formatLastLogin(u.last_login_at)}
                          </span>
                        </td>
                        <td style={{ "text-align": "right" }}>
                          <div style={{ display: "inline-flex", "align-items": "center", gap: "0.4rem" }}>
                            <button
                              type="button"
                              class="erp-btn erp-btn-ghost erp-btn-sm"
                              title="Edit User Profile & Role"
                              onClick={() => openEditModal(u)}
                            >
                              <IconEdit size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              class="erp-btn erp-btn-ghost erp-btn-sm"
                              title="Reset Password or PIN"
                              onClick={() => openResetModal(u)}
                            >
                              <IconKey size={13} />
                              <span>Reset</span>
                            </button>
                            <button
                              type="button"
                              class={`erp-btn erp-btn-sm ${u.is_active ? "erp-btn-secondary" : "erp-btn-primary"}`}
                              title={u.is_active ? "Suspend User Account" : "Activate User Account"}
                              onClick={() => handleToggleStatus(u)}
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
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
      </Show>

      {/* Tab 2: Roles & Permissions Matrix */}
      <Show when={activeTab() === "roles"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
          <div class="erp-card" style={{ padding: "1.25rem" }}>
            <h3 style={{ "font-size": "1.05rem", "font-weight": "700", color: "var(--erp-text-main)", margin: "0 0 0.5rem 0" }}>
              Spatie Role-Based Access Control (RBAC) Architecture
            </h3>
            <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)", margin: 0, "line-height": 1.5 }}>
              Jubilant ERP strictly enforces multi-tier privilege separation according to Section 1 of the User Manual.
              Every operation across financial ledgers, godown dispatches, service diagnostics, and employee payroll is isolated to certified departmental roles.
            </p>
          </div>

          <div class="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Designated Role</th>
                    <th>Department</th>
                    <th>Primary Operational Responsibilities</th>
                    <th>Accessible ERP Modules</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={standardRoles}>
                    {(r) => (
                      <tr>
                        <td>
                          <span class={`erp-badge ${r.badgeClass}`} style={{ "font-weight": "600" }}>
                            {r.role}
                          </span>
                        </td>
                        <td>
                          <span style={{ "font-weight": "500", "font-size": "12.5px" }}>{r.dept}</span>
                        </td>
                        <td>
                          <p style={{ margin: 0, "font-size": "12px", color: "var(--erp-text-main)", "line-height": 1.45 }}>
                            {r.responsibilities}
                          </p>
                        </td>
                        <td>
                          <span style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)", "font-family": "monospace" }}>
                            {r.modules}
                          </span>
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

      {/* ================= MODAL: CREATE USER ================= */}
      <Show when={showCreateModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal-content" style={{ "max-width": "500px" }}>
            <div class="erp-modal-header">
              <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
                <IconShield size={18} />
                <h3 style={{ margin: 0, "font-size": "1.1rem", "font-weight": "700", color: "var(--erp-text-main)" }}>
                  Onboard New User Account
                </h3>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowCreateModal(false)}
              >
                <IconClose size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <Show when={createError()}>
                  <div
                    style={{
                      background: "rgba(220, 38, 38, 0.1)",
                      border: "1px solid var(--erp-danger)",
                      color: "var(--erp-danger)",
                      padding: "0.5rem 0.75rem",
                      "border-radius": "4px",
                      "font-size": "12px",
                      display: "flex",
                      "align-items": "center",
                      gap: "0.5rem",
                    }}
                  >
                    <IconAlert size={14} />
                    <span>{createError()}</span>
                  </div>
                </Show>

                <div>
                  <label class="erp-label">Full Name *</label>
                  <input
                    type="text"
                    class="erp-input"
                    placeholder="e.g. Suresh Shrestha"
                    value={newName()}
                    onInput={(e) => setNewName(e.currentTarget.value)}
                    required
                  />
                </div>

                <div>
                  <label class="erp-label">Email Address (Login Username) *</label>
                  <input
                    type="email"
                    class="erp-input"
                    placeholder="e.g. suresh@jubilant.com"
                    value={newEmail()}
                    onInput={(e) => setNewEmail(e.currentTarget.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label class="erp-label">System Role *</label>
                    <select
                      class="erp-input"
                      value={newRoleId()}
                      onChange={(e) => {
                        setNewRoleId(e.currentTarget.value);
                        const match = roles().find((r) => r.id === e.currentTarget.value);
                        if (match) setNewDepartment(match.department);
                      }}
                      required
                    >
                      <For each={roles()}>
                        {(r) => <option value={r.id}>{r.name}</option>}
                      </For>
                    </select>
                  </div>
                  <div>
                    <label class="erp-label">Department</label>
                    <input
                      type="text"
                      class="erp-input"
                      value={newDepartment()}
                      onInput={(e) => setNewDepartment(e.currentTarget.value)}
                      placeholder="e.g. Accounts & Finance"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1.3fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label class="erp-label">Initial Password *</label>
                    <input
                      type="password"
                      class="erp-input"
                      placeholder="Minimum 6 characters"
                      value={newPassword()}
                      onInput={(e) => setNewPassword(e.currentTarget.value)}
                      required
                    />
                  </div>
                  <div>
                    <label class="erp-label">Field 4-Digit PIN (Optional)</label>
                    <input
                      type="text"
                      class="erp-input"
                      placeholder="e.g. 5678"
                      maxLength={4}
                      value={newPin()}
                      onInput={(e) => setNewPin(e.currentTarget.value)}
                    />
                    <span style={{ "font-size": "10.5px", color: "var(--erp-text-secondary)" }}>
                      Used for technician mobile check-in
                    </span>
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ================= MODAL: EDIT USER ================= */}
      <Show when={showEditModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal-content" style={{ "max-width": "480px" }}>
            <div class="erp-modal-header">
              <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
                <IconEdit size={16} />
                <h3 style={{ margin: 0, "font-size": "1.1rem", "font-weight": "700", color: "var(--erp-text-main)" }}>
                  Edit User: {selectedUser()?.name}
                </h3>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowEditModal(false)}
              >
                <IconClose size={15} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <Show when={editError()}>
                  <div
                    style={{
                      background: "rgba(220, 38, 38, 0.1)",
                      border: "1px solid var(--erp-danger)",
                      color: "var(--erp-danger)",
                      padding: "0.5rem 0.75rem",
                      "border-radius": "4px",
                      "font-size": "12px",
                      display: "flex",
                      "align-items": "center",
                      gap: "0.5rem",
                    }}
                  >
                    <IconAlert size={14} />
                    <span>{editError()}</span>
                  </div>
                </Show>

                <div>
                  <label class="erp-label">Full Name</label>
                  <input
                    type="text"
                    class="erp-input"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    required
                  />
                </div>

                <div>
                  <label class="erp-label">Email Address</label>
                  <input
                    type="email"
                    class="erp-input"
                    value={editEmail()}
                    onInput={(e) => setEditEmail(e.currentTarget.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label class="erp-label">Assigned Role</label>
                    <select
                      class="erp-input"
                      value={editRoleId()}
                      onChange={(e) => setEditRoleId(e.currentTarget.value)}
                    >
                      <For each={roles()}>
                        {(r) => <option value={r.id}>{r.name}</option>}
                      </For>
                    </select>
                  </div>
                  <div>
                    <label class="erp-label">Department</label>
                    <input
                      type="text"
                      class="erp-input"
                      value={editDepartment()}
                      onInput={(e) => setEditDepartment(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", "align-items": "center", gap: "0.6rem", "margin-top": "0.25rem" }}>
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editIsActive()}
                    onChange={(e) => setEditIsActive(e.currentTarget.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label for="edit_is_active" style={{ "font-size": "13px", "font-weight": "500", cursor: "pointer" }}>
                    Account Status: {editIsActive() ? "Active & Authorized" : "Suspended"}
                  </label>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ================= MODAL: RESET PASSWORD / PIN ================= */}
      <Show when={showResetModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal-content" style={{ "max-width": "450px" }}>
            <div class="erp-modal-header">
              <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
                <IconKey size={16} />
                <h3 style={{ margin: 0, "font-size": "1.1rem", "font-weight": "700", color: "var(--erp-text-main)" }}>
                  Reset Credentials: {selectedUser()?.name}
                </h3>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowResetModal(false)}
              >
                <IconClose size={15} />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.85rem" }}>
                <p style={{ "font-size": "12px", color: "var(--erp-text-secondary)", margin: 0 }}>
                  Enter a new login password or 4-digit mobile check-in PIN. Leave blank if unchanged.
                </p>

                <Show when={resetError()}>
                  <div
                    style={{
                      background: "rgba(220, 38, 38, 0.1)",
                      border: "1px solid var(--erp-danger)",
                      color: "var(--erp-danger)",
                      padding: "0.5rem 0.75rem",
                      "border-radius": "4px",
                      "font-size": "12px",
                      display: "flex",
                      "align-items": "center",
                      gap: "0.5rem",
                    }}
                  >
                    <IconAlert size={14} />
                    <span>{resetError()}</span>
                  </div>
                </Show>

                <div>
                  <label class="erp-label">New Password</label>
                  <input
                    type="password"
                    class="erp-input"
                    placeholder="Enter new strong password"
                    value={resetPassword()}
                    onInput={(e) => setResetPassword(e.currentTarget.value)}
                  />
                </div>

                <div>
                  <label class="erp-label">New 4-Digit Field PIN</label>
                  <input
                    type="text"
                    class="erp-input"
                    placeholder="e.g. 4321"
                    maxLength={4}
                    value={resetPin()}
                    onInput={(e) => setResetPin(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
