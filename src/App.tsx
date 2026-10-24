import { createSignal, onMount, Show, Switch, Match, For } from "solid-js";
import { UserProfile } from "./api/client";
import { LoginView } from "./components/modules/auth/LoginView";
import { AccountingView } from "./components/modules/accounting/AccountingView";
import { SalesView } from "./components/modules/sales/SalesView";
import { PurchasesView } from "./components/modules/purchases/PurchasesView";
import { InventoryView } from "./components/modules/inventory/InventoryView";
import { FieldServiceView } from "./components/modules/field_service/FieldServiceView";
import { HrmView } from "./components/modules/hrm/HrmView";
import { UsersView } from "./components/modules/users/UsersView";
import { SummarySheetView } from "./components/modules/summary/SummarySheetView";
import { ModuleErrorBoundary } from "./components/ui/ModuleErrorBoundary";
import { UpdateBanner } from "./components/ui/UpdateBanner";
import {
  IconDashboard,
  IconAccounting,
  IconSales,
  IconPurchases,
  IconInventory,
  IconFieldService,
  IconHRM,
  IconShield,
  IconLogOut,
  IconSearch,
  IconDatabase,
  IconSun,
  IconMoon,
  IconSync,
} from "./components/ui/Icons";
import { SyncModal } from "./components/ui/SyncModal";
import { CommandPalette } from "./components/ui/CommandPalette";
import { api } from "./api/client";

export default function App() {
  const [currentUser, setCurrentUser] = createSignal<UserProfile | null>(null);
  const [activeModule, setActiveModule] = createSignal<string>("summary");
  const [theme, setTheme] = createSignal<"light" | "dark">("light");
  const [isSyncModalOpen, setIsSyncModalOpen] = createSignal(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = createSignal(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [peerCount, setPeerCount] = createSignal(0);

  const checkSyncStatus = async () => {
    try {
      const res = await api.getSyncStatus();
      setPeerCount(res.lan_peer_count + (res.internet_connected ? 1 : 0));
    } catch {
      // Offline fallback
    }
  };

  onMount(() => {
    // Check initial sync status & poll
    checkSyncStatus();
    const syncInterval = setInterval(checkSyncStatus, 10000);

    // Global Cmd+K / Ctrl+K listener
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);

    // Restore Theme
    const savedTheme = localStorage.getItem("jubilant_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    // Restore Session
    const saved = localStorage.getItem("jubilant_user_session");
    if (saved) {
      try {
        const user: UserProfile = JSON.parse(saved);
        setCurrentUser(user);
        if (user.role_name === "Technician") setActiveModule("field_service");
        else if (user.role_name === "Warehouse_Officer") setActiveModule("inventory");
        else if (user.role_name === "Operation") setActiveModule("sales");
        else if (user.role_name === "HR_Manager") setActiveModule("hrm");
      } catch {
        localStorage.removeItem("jubilant_user_session");
      }
    }

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("keydown", handleGlobalKey);
    };
  });

  const toggleTheme = () => {
    const nextTheme = theme() === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("jubilant_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem("jubilant_user_session", JSON.stringify(user));
    if (user.role_name === "Technician") setActiveModule("field_service");
    else if (user.role_name === "Warehouse_Officer") setActiveModule("inventory");
    else if (user.role_name === "Operation") setActiveModule("sales");
    else if (user.role_name === "HR_Manager") setActiveModule("hrm");
    else setActiveModule("summary");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("jubilant_user_session");
  };

  // RBAC Permission Check
  const hasAccess = (moduleKey: string) => {
    if (moduleKey === "summary" || moduleKey === "sync") return true;
    const user = currentUser();
    if (!user) return false;
    if (user.permissions.includes("*")) return true;
    switch (moduleKey) {
      case "accounting":
        return user.permissions.some((p) => p.startsWith("accounting"));
      case "sales":
        return user.permissions.some((p) => p.startsWith("sales"));
      case "purchases":
        return user.permissions.some((p) => p.startsWith("purchases") || p.startsWith("accounting"));
      case "inventory":
        return user.permissions.some((p) => p.startsWith("inventory") || p.startsWith("sales"));
      case "field_service":
        return user.permissions.some((p) => p.startsWith("service") || p.startsWith("technician"));
      case "hrm":
        return user.permissions.some((p) => p.startsWith("hrm") || p.startsWith("employees"));
      case "users":
        return user.role_name === "Company" || user.permissions.includes("*") || user.permissions.some((p) => p.startsWith("users") || p.startsWith("admin"));
      default:
        return true;
    }
  };

  const navSections = [
    {
      heading: "Executive Briefing",
      items: [
        { key: "summary", label: "Executive Summary Sheet", icon: IconDashboard },
      ],
    },
    {
      heading: "Financial Accounting",
      items: [
        { key: "accounting", label: "General Ledger & VAT", icon: IconAccounting },
        { key: "sales", label: "Sales & Sales Book", icon: IconSales },
        { key: "purchases", label: "Purchases & TDS Book", icon: IconPurchases },
      ],
    },
    {
      heading: "Supply & Service",
      items: [
        { key: "inventory", label: "Multi-Godown Stock", icon: IconInventory },
        { key: "field_service", label: "Field Service & AMC", icon: IconFieldService },
      ],
    },
    {
      heading: "Administration",
      items: [
        { key: "hrm", label: "Staff & Attendance", icon: IconHRM },
        { key: "users", label: "User Management & RBAC", icon: IconShield },
        { key: "sync", label: "Peer Sync & Network Hub", icon: IconSync },
      ],
    },
  ];

  const currentModuleTitle = () => {
    for (const section of navSections) {
      const match = section.items.find((item) => item.key === activeModule());
      if (match) return match.label;
    }
    return "Workspace";
  };

  return (
    <Show when={currentUser()} fallback={<LoginView onLoginSuccess={handleLogin} />}>
      <div class="erp-app-shell">
        {/* Mobile Backdrop Overlay */}
        <Show when={isMobileMenuOpen()}>
          <div
            class="erp-mobile-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </Show>

        {/* Executive Sidebar Navigation */}
        <aside class={`erp-sidebar ${isMobileMenuOpen() ? "mobile-open" : ""}`}>
          {/* Brand Logo & Name */}
          <div class="erp-sidebar-brand">
            <div class="erp-brand-badge">J</div>
            <div style={{ "min-width": 0, flex: "1" }}>
              <div style={{ "font-weight": "700", "font-size": "13.5px", "color": "var(--erp-text-main)" }}>Jubilant ERP</div>
              <div style={{ "font-size": "11px", "color": "var(--erp-text-secondary)" }}>Kathmandu Branch</div>
            </div>
            {/* Close Button on Mobile Drawer */}
            <button
              type="button"
              class="erp-mobile-close-btn"
              onClick={() => setIsMobileMenuOpen(false)}
              title="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Mobile Drawer Status Strip (Shows fiscal year & online state on phone) */}
          <div class="erp-drawer-status-strip">
            <span class="erp-badge erp-badge-neutral" style={{ "font-size": "10.5px" }}>FY 2081/82</span>
            <span class="erp-badge erp-badge-success" style={{ "font-size": "10.5px", display: "inline-flex", "align-items": "center", gap: "0.3rem" }}>
              <span style={{ width: "5px", height: "5px", "border-radius": "50%", background: "var(--erp-success)", display: "inline-block" }} />
              <span>Online</span>
            </span>
          </div>

          {/* Nav Categories */}
          <nav style={{ flex: "1", "overflow-y": "auto", padding: "0.5rem 0" }}>
            <For each={navSections}>
              {(section) => {
                const accessibleItems = section.items.filter((item) => hasAccess(item.key));
                return (
                  <Show when={accessibleItems.length > 0}>
                    <div class="erp-sidebar-group">
                      <div class="erp-sidebar-heading">{section.heading}</div>
                      <For each={accessibleItems}>
                        {(item) => {
                          const IconComp = item.icon;
                          const isActive = () => activeModule() === item.key;
                          return (
                            <button
                              type="button"
                              class={`erp-nav-item ${isActive() ? "active" : ""}`}
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                if (item.key === "sync") {
                                  setIsSyncModalOpen(true);
                                } else {
                                  setActiveModule(item.key);
                                }
                              }}
                            >
                              <IconComp size={15} />
                              <span>{item.label}</span>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                );
              }}
            </For>
          </nav>

          {/* User Session Footer */}
          <div class="erp-sidebar-footer">
            <div style={{ "min-width": 0, "max-width": "160px" }}>
              <div style={{ "font-weight": "600", "font-size": "12px", "color": "var(--erp-text-main)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {currentUser()?.name}
              </div>
              <div style={{ "font-size": "10.5px", color: "var(--erp-text-secondary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {currentUser()?.role_name}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              class="erp-btn erp-btn-ghost erp-btn-sm"
              title="Sign Out"
              style={{ color: "var(--erp-text-secondary)", padding: "0.25rem" }}
            >
              <IconLogOut size={15} />
            </button>
          </div>
        </aside>

        {/* Main Content View */}
        <div class="erp-main-area">
          {/* Topbar with Breadcrumbs, Search, Theme Toggle and DB Status */}
          <header class="erp-topbar">
            <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
              {/* Mobile Hamburger Menu Toggle Button */}
              <button
                type="button"
                class="erp-mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
                title="Toggle Menu"
                aria-label="Toggle navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              <div class="erp-breadcrumb">
                <span class="erp-breadcrumb-prefix" style={{ "font-size": "12px", color: "var(--erp-text-muted)" }}>Jubilant</span>
                <span class="erp-breadcrumb-sep" style={{ color: "var(--erp-border-medium)" }}>/</span>
                <span class="erp-breadcrumb-current">{currentModuleTitle()}</span>
              </div>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "0.75rem" }}>
              {/* Quick Search Trigger / Command Palette */}
              <button
                type="button"
                onClick={() => setIsCmdPaletteOpen(true)}
                class="erp-search-box"
                style={{ cursor: "pointer", "text-align": "left" }}
                title="Search views and actions (⌘K / Ctrl+K)"
              >
                <IconSearch size={13} />
                <span
                  class="erp-search-placeholder"
                  style={{
                    color: "var(--erp-text-secondary)",
                    "font-size": "inherit",
                    flex: "1",
                    "white-space": "nowrap",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                  }}
                >
                  Search views, invoices, vouchers...
                </span>
                <span class="erp-search-shortcut">⌘K</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm erp-header-theme-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme() === "light" ? "Dark" : "Light"} Mode`}
                style={{ padding: "0.3rem 0.5rem" }}
              >
                {theme() === "light" ? <IconMoon size={13} /> : <IconSun size={13} />}
                <span class="erp-header-theme-label" style={{ "font-size": "11.5px" }}>{theme() === "light" ? "Dark" : "Light"}</span>
              </button>

              {/* Fiscal Year Pill */}
              <div class="erp-badge erp-badge-neutral erp-header-fy-badge">
                <span>FY 2081/82</span>
              </div>

              {/* Peer Sync Hub Trigger Button */}
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                class="erp-btn erp-btn-secondary erp-btn-sm erp-header-sync-btn"
                title="Open Peer Sync & Local Mesh Network Hub"
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.6rem",
                  cursor: "pointer",
                }}
              >
                <IconSync size={13} class={peerCount() > 0 ? "text-success" : ""} />
                <span class="erp-header-sync-label" style={{ "font-size": "11.5px" }}>
                  {peerCount() > 0 ? `${peerCount()} Peer${peerCount() > 1 ? "s" : ""} Active` : "Mesh Sync"}
                </span>
              </button>

              {/* System Status Indicator */}
              <div class="erp-badge erp-badge-success erp-header-status-badge" title="Secure Local Storage Active">
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    "border-radius": "50%",
                    background: "var(--erp-success)",
                    display: "inline-block",
                  }}
                />
                <span>System Online</span>
              </div>
            </div>
          </header>

          {/* Auto-update banner notification if available */}
          <UpdateBanner />

          {/* Scrollable Module Body with Error Boundary */}
          <main class="erp-content-container">
            <Switch>
              <Match when={activeModule() === "summary"}>
                <ModuleErrorBoundary moduleName="Executive Summary Sheet">
                  <SummarySheetView onNavigate={(mod) => setActiveModule(mod)} />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "accounting"}>
                <ModuleErrorBoundary moduleName="Accounting & Tax">
                  <AccountingView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "sales"}>
                <ModuleErrorBoundary moduleName="Sales & IRD Sales Book">
                  <SalesView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "purchases"}>
                <ModuleErrorBoundary moduleName="Purchases & TDS">
                  <PurchasesView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "inventory"}>
                <ModuleErrorBoundary moduleName="Multi-Godown Inventory">
                  <InventoryView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "field_service"}>
                <ModuleErrorBoundary moduleName="Field Service & AMC">
                  <FieldServiceView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "hrm"}>
                <ModuleErrorBoundary moduleName="HRM & Attendance">
                  <HrmView />
                </ModuleErrorBoundary>
              </Match>
              <Match when={activeModule() === "users"}>
                <ModuleErrorBoundary moduleName="User Management & RBAC">
                  <UsersView />
                </ModuleErrorBoundary>
              </Match>
            </Switch>
          </main>

          {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
          <nav class="erp-bottom-nav">
            <button
              type="button"
              class={`erp-bottom-nav-item ${activeModule() === "summary" ? "active" : ""}`}
              onClick={() => { setActiveModule("summary"); setIsMobileMenuOpen(false); }}
            >
              <IconDashboard size={18} />
              <span>Summary</span>
            </button>

            <button
              type="button"
              class={`erp-bottom-nav-item ${activeModule() === "sales" ? "active" : ""}`}
              onClick={() => { setActiveModule("sales"); setIsMobileMenuOpen(false); }}
            >
              <IconSales size={18} />
              <span>Sales</span>
            </button>

            <button
              type="button"
              class={`erp-bottom-nav-item ${activeModule() === "field_service" ? "active" : ""}`}
              onClick={() => { setActiveModule("field_service"); setIsMobileMenuOpen(false); }}
            >
              <IconFieldService size={18} />
              <span>Service</span>
            </button>

            <button
              type="button"
              class={`erp-bottom-nav-item ${activeModule() === "inventory" ? "active" : ""}`}
              onClick={() => { setActiveModule("inventory"); setIsMobileMenuOpen(false); }}
            >
              <IconInventory size={18} />
              <span>Stock</span>
            </button>

            <button
              type="button"
              class={`erp-bottom-nav-item ${isMobileMenuOpen() ? "active" : ""}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="19" cy="12" r="1.5"></circle>
                <circle cx="5" cy="12" r="1.5"></circle>
              </svg>
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Peer Sync & Mesh Network Modal */}
      <SyncModal
        isOpen={isSyncModalOpen()}
        onClose={() => setIsSyncModalOpen(false)}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCmdPaletteOpen()}
        onClose={() => setIsCmdPaletteOpen(false)}
        onNavigate={(mod) => {
          if (mod === "sync") {
            setIsSyncModalOpen(true);
          } else {
            setActiveModule(mod);
          }
        }}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onToggleTheme={toggleTheme}
        onLockSession={handleLogout}
      />
    </Show>
  );
}
