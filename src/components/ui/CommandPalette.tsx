import { createSignal, createEffect, onCleanup, For, Show, JSX } from "solid-js";
import {
  IconSearch,
  IconDashboard,
  IconSales,
  IconPurchases,
  IconAccounting,
  IconFieldService,
  IconHRM,
  IconInventory,
  IconTrendingUp,
  IconShield,
  IconSync,
  IconPlus,
} from "./Icons";

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Navigation" | "Quick Action" | "System";
  icon: (props: any) => JSX.Element;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
  onOpenSync: () => void;
  onToggleTheme: () => void;
  onLockSession: () => void;
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const allCommands = (): CommandItem[] => [
    // Navigation
    {
      id: "nav-summary",
      title: "Executive Summary Sheet",
      subtitle: "Enterprise overview, sales trends, cash balance & service KPIs",
      category: "Navigation",
      icon: IconDashboard,
      shortcut: "⌘1",
      action: () => {
        props.onNavigate("summary");
        props.onClose();
      },
    },
    {
      id: "nav-sales",
      title: "Sales & Commercial Pipeline",
      subtitle: "Quotations, Delivery Challans, 13% VAT Tax Invoices & Customer Ledgers",
      category: "Navigation",
      icon: IconSales,
      shortcut: "⌘2",
      action: () => {
        props.onNavigate("sales");
        props.onClose();
      },
    },
    {
      id: "nav-purchases",
      title: "Purchases & Vendor Bills",
      subtitle: "Vendor accounts, inward bills, TDS withholdings & Operating Expenses",
      category: "Navigation",
      icon: IconPurchases,
      shortcut: "⌘3",
      action: () => {
        props.onNavigate("purchases");
        props.onClose();
      },
    },
    {
      id: "nav-accounting",
      title: "Double-Entry Accounting & Nepal Tax",
      subtitle: "General Ledger, Cash Book, Sales/Purchase Book (बिक्री/खरिद खाता), VAT Returns",
      category: "Navigation",
      icon: IconAccounting,
      shortcut: "⌘4",
      action: () => {
        props.onNavigate("accounting");
        props.onClose();
      },
    },
    {
      id: "nav-service",
      title: "Technician & Field Service",
      subtitle: "14-step service lifecycle, diagnostics, spare parts, customer sign-off",
      category: "Navigation",
      icon: IconFieldService,
      shortcut: "⌘5",
      action: () => {
        props.onNavigate("field_service");
        props.onClose();
      },
    },
    {
      id: "nav-inventory",
      title: "Godown Warehousing & POS",
      subtitle: "Multi-godown stock, SKU master, warehouse transfers & low stock alerts",
      category: "Navigation",
      icon: IconInventory,
      shortcut: "⌘6",
      action: () => {
        props.onNavigate("inventory");
        props.onClose();
      },
    },
    {
      id: "nav-hrm",
      title: "HRM & Attendance",
      subtitle: "Biometric attendance, leaves, employee profiles & payroll calculation",
      category: "Navigation",
      icon: IconHRM,
      shortcut: "⌘7",
      action: () => {
        props.onNavigate("hrm");
        props.onClose();
      },
    },
    {
      id: "nav-performance",
      title: "Performance Center",
      subtitle: "Daily task activity logs, negotiation pipeline, NPS customer scorecards",
      category: "Navigation",
      icon: IconTrendingUp,
      action: () => {
        props.onNavigate("performance");
        props.onClose();
      },
    },
    {
      id: "nav-users",
      title: "User Management & RBAC",
      subtitle: "Team members, 8 department roles, Argon2 passwords & Quick PIN resets",
      category: "Navigation",
      icon: IconShield,
      action: () => {
        props.onNavigate("users");
        props.onClose();
      },
    },

    // Quick Actions
    {
      id: "action-sync",
      title: "Peer Sync & Network Discovery",
      subtitle: "Discover local Wi-Fi terminals, inspect CDC outbox & trigger replication",
      category: "Quick Action",
      icon: IconSync,
      shortcut: "⌘S",
      action: () => {
        props.onClose();
        props.onOpenSync();
      },
    },
    {
      id: "action-new-invoice",
      title: "Create 13% VAT Tax Invoice",
      subtitle: "Open sales commercial pipeline to generate a compliant tax bill",
      category: "Quick Action",
      icon: IconPlus,
      action: () => {
        props.onNavigate("sales");
        props.onClose();
      },
    },
    {
      id: "action-new-ticket",
      title: "Raise Field Service Request",
      subtitle: "Intake customer breakdown complaint and dispatch technician",
      category: "Quick Action",
      icon: IconPlus,
      action: () => {
        props.onNavigate("service");
        props.onClose();
      },
    },

    // System
    {
      id: "sys-theme",
      title: "Toggle Visual Theme",
      subtitle: "Switch between Warm Editorial Light and Deep Charcoal Dark mode",
      category: "System",
      icon: IconDashboard,
      shortcut: "⌘T",
      action: () => {
        props.onToggleTheme();
        props.onClose();
      },
    },
    {
      id: "sys-lock",
      title: "Lock Session / Sign Out",
      subtitle: "Secure current terminal; return to quick PIN / password login",
      category: "System",
      icon: IconShield,
      shortcut: "⌘L",
      action: () => {
        props.onLockSession();
        props.onClose();
      },
    },
  ];

  const filteredCommands = () => {
    const q = query().toLowerCase().trim();
    if (!q) return allCommands();
    return allCommands().filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  };

  createEffect(() => {
    // Reset selected index when query changes
    query();
    setSelectedIndex(0);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const list = filteredCommands();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, list.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const list = filteredCommands();
      setSelectedIndex((prev) => (prev - 1 + list.length) % Math.max(1, list.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const list = filteredCommands();
      if (list[selectedIndex()]) {
        list[selectedIndex()].action();
      }
    }
  };

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  createEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (props.isOpen) {
          props.onClose();
        } else {
          // Open
          setQuery("");
          setSelectedIndex(0);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleGlobalKeyDown));
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="erp-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={handleKeyDown}
      >
        <div class="erp-modal" style={{ "max-width": "580px" }}>
          {/* Search Input Bar */}
          <div
            style={{
              padding: "0.75rem 1rem",
              "border-bottom": "1px solid var(--erp-border-subtle)",
              display: "flex",
              "align-items": "center",
              gap: "0.75rem",
              background: "var(--erp-bg-card-subtle)",
            }}
          >
            <IconSearch size={16} class="text-secondary" />
            <input
              type="text"
              autofocus
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search views, tax invoices, vouchers, tickets..."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                "font-size": "14px",
                color: "var(--erp-text-main)",
              }}
            />
            <span class="erp-badge erp-badge-neutral" style={{ "font-family": "var(--font-mono)" }}>
              Esc
            </span>
          </div>

          {/* Results List */}
          <div style={{ padding: "0.5rem", "max-height": "60vh", "overflow-y": "auto", display: "flex", "flex-direction": "column", gap: "0.25rem" }}>
            <Show
              when={filteredCommands().length > 0}
              fallback={
                <div style={{ padding: "2rem", "text-align": "center", "font-size": "12px", color: "var(--erp-text-muted)" }}>
                  No commands or views match "{query()}".
                </div>
              }
            >
              <For each={filteredCommands()}>
                {(cmd, idx) => {
                  const isSelected = () => idx() === selectedIndex();
                  const Icon = cmd.icon;
                  return (
                    <button
                      type="button"
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx())}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.75rem",
                        "border-radius": "var(--erp-radius-sm)",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        "text-align": "left",
                        cursor: "pointer",
                        border: "none",
                        background: isSelected() ? "var(--erp-primary-faint)" : "transparent",
                        color: "var(--erp-text-main)",
                        transition: "all 0.1s ease",
                      }}
                    >
                      <div style={{ display: "flex", "align-items": "center", gap: "0.75rem", "min-width": 0 }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            "border-radius": "6px",
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "center",
                            "flex-shrink": 0,
                            background: isSelected() ? "#d97706" : "var(--erp-bg-card-subtle)",
                            color: isSelected() ? "#ffffff" : "var(--erp-primary)",
                            border: isSelected() ? "none" : "1px solid var(--erp-border-subtle)",
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <div style={{ "min-width": 0 }}>
                          <div style={{ "font-size": "12.5px", "font-weight": "600", display: "flex", "align-items": "center", gap: "0.5rem" }}>
                            <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{cmd.title}</span>
                            <span class="erp-badge erp-badge-neutral" style={{ "font-size": "9.5px", padding: "0.1rem 0.35rem" }}>
                              {cmd.category}
                            </span>
                          </div>
                          <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                            {cmd.subtitle}
                          </div>
                        </div>
                      </div>

                      <Show when={cmd.shortcut}>
                        <kbd class="erp-badge erp-badge-neutral" style={{ "font-family": "var(--font-mono)", "margin-left": "0.5rem", "flex-shrink": 0 }}>
                          {cmd.shortcut}
                        </kbd>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Footer Guide */}
          <div
            style={{
              padding: "0.5rem 1rem",
              "border-top": "1px solid var(--erp-border-subtle)",
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "font-size": "11px",
              color: "var(--erp-text-muted)",
              background: "var(--erp-bg-card-subtle)",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "0.75rem" }}>
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
            <div style={{ "font-weight": "600", color: "var(--erp-primary)" }}>
              Jubilant Enterprise
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
export default CommandPalette;
