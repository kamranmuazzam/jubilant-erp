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
        props.onNavigate("service");
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
        class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={handleKeyDown}
      >
        <div
          class="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-card,#ffffff)] text-[var(--text-main,#2d2820)]"
          style={{ "font-family": "var(--font-sans, system-ui, sans-serif)" }}
        >
          {/* Search Input Bar */}
          <div class="px-4 py-3.5 border-b border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] flex items-center gap-3 bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
            <IconSearch size={18} class="text-[var(--color-primary,#8b6f4e)] shrink-0" />
            <input
              type="text"
              autofocus
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search views, tax invoices, vouchers, tickets... (Type to filter)"
              class="w-full bg-transparent text-sm text-[var(--text-main,#2d2820)] placeholder-[var(--text-muted,#7a7267)] focus:outline-none"
            />
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-black/5 dark:bg-white/10 text-[var(--text-muted,#7a7267)] border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a]">
              Esc
            </span>
          </div>

          {/* Results List */}
          <div class="p-2 max-h-[60vh] overflow-y-auto space-y-1">
            <Show
              when={filteredCommands().length > 0}
              fallback={
                <div class="p-8 text-center text-xs text-[var(--text-muted,#7a7267)]">
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
                      class={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                        isSelected()
                          ? "bg-[var(--color-primary,#8b6f4e)]/10 dark:bg-[var(--color-primary,#8b6f4e)]/20 text-[var(--text-main,#2d2820)]"
                          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-[var(--text-main,#2d2820)]"
                      }`}
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected()
                              ? "bg-[var(--color-primary,#8b6f4e)] text-white"
                              : "bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714] text-[var(--color-primary,#8b6f4e)] border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a]"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-semibold truncate flex items-center gap-2">
                            <span>{cmd.title}</span>
                            <span class="text-[10px] font-normal px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-[var(--text-muted,#7a7267)]">
                              {cmd.category}
                            </span>
                          </div>
                          <div class="text-[11px] text-[var(--text-muted,#7a7267)] truncate">
                            {cmd.subtitle}
                          </div>
                        </div>
                      </div>

                      <Show when={cmd.shortcut}>
                        <kbd class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/5 dark:bg-white/10 text-[var(--text-muted,#7a7267)] border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] shrink-0">
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
          <div class="px-4 py-2 border-t border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] flex items-center justify-between text-[11px] text-[var(--text-muted,#7a7267)] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
            <div class="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
            <div class="font-medium text-[var(--color-primary,#8b6f4e)]">
              Jubilant Enterprise
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
export default CommandPalette;
