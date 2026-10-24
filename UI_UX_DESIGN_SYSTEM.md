# Jubilant ERP — Seamless UI/UX Architecture & Design System

## 1. Design Philosophy: Dual-Mode Ergonomics
Jubilant ERP operates across both **Desktop (macOS, Windows)** and **Mobile (Android)** devices. A single rigid layout fails on one or the other. Therefore, our UI/UX follows **Adaptive Dual-Mode Ergonomics**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Design Language & Tokens                        │
│         (Tailored HSL Color Palette, Inter/Outfit Typography,          │
│            Fluid Spacing, Dynamic Dark/Light Theme Engine)             │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
         ┌──────────▼──────────┐          ┌──────────▼──────────┐
         │ Desktop Experience  │          │  Mobile Experience  │
         │  (macOS / Windows)  │          │      (Android)      │
         └──────────┬──────────┘          └──────────┬──────────┘
                    │                                │
    ┌───────────────┴───────────────┐ ┌──────────────┴───────────────┐
    │ • High-density data tables    │ │ • Touch targets (>= 48px)    │
    │ • Command Palette (Cmd/Ctrl+K)│ │ • Bottom action navigation   │
    │ • Multi-pane split workflows  │ │ • Responsive Card Lists      │
    │ • Excel-like keyboard controls│ │ • Digital signature pad      │
    │ • Hover state tooltips        │ │ • Pull-to-refresh & gestures │
    └───────────────────────────────┘ └──────────────────────────────┘
```

---

## 2. Visual Identity & Design Tokens

### A. Color Palette (HSL Tailored)
- **Primary / Brand Accent**: `hsl(226, 70%, 55%)` (Sapphire Indigo) — Authoritative, precise, modern.
- **Surface & Backgrounds (Dark Mode)**:
  - Deep Background: `hsl(224, 71%, 4%)`
  - Card / Panel Surface: `hsl(223, 47%, 11%)`
  - Elevated / Popover Surface: `hsl(224, 38%, 16%)`
  - Subtle Border: `hsl(220, 20%, 20%)`
- **Surface & Backgrounds (Light Mode)**:
  - Crisp Canvas: `hsl(210, 20%, 98%)`
  - Card Surface: `hsl(0, 0%, 100%)`
  - Subtle Border: `hsl(214, 32%, 91%)`
- **Functional Semantics**:
  - **Success / In-Balance / Paid**: `hsl(152, 69%, 40%)` (Emerald)
  - **Warning / Pending Approval**: `hsl(38, 92%, 50%)` (Warm Amber)
  - **Danger / Overdue / Unbalanced**: `hsl(354, 70%, 54%)` (Crimson Rose)
  - **Info / In-Progress**: `hsl(199, 89%, 48%)` (Cyan Azure)

### B. Typography
- **Primary UI Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
- **Numerical / Financial Font**: `JetBrains Mono` or `Fira Code` with tabular numerals (`font-variant-numeric: tabular-nums;`). This prevents column jitter in financial ledgers, debit/credit rows, and stock counts.
- **Hierarchy**:
  - Page Headings: `font-size: 1.5rem (24px)`, `font-weight: 700`, `letter-spacing: -0.02em`
  - Section Headings: `font-size: 1.125rem (18px)`, `font-weight: 600`
  - Body Text: `font-size: 0.875rem (14px)`, `line-height: 1.5`
  - Meta / Captions: `font-size: 0.75rem (12px)`, `font-weight: 500`, muted foreground

---

## 3. Platform-Specific Ergonomics

### A. Desktop Workspace (macOS & Windows)
1. **Collapsible High-Speed Sidebar**:
   - Compact icon-rail mode (64px) for maximum screen real estate vs expanded text mode (240px).
   - Instant keyboard toggle (`Cmd/Ctrl + B`).
2. **Command Palette (`Cmd/Ctrl + K`)**:
   - Universal spotlight search to jump straight to: "New Sales Invoice", "Cash Book", "Technician Ticket #SR0045", or "Sales Book (बिक्री खाता)".
3. **Data Density & Tables**:
   - Sticky headers and frozen key columns (Invoice No, Customer Name).
   - High-density rows with inline badges for status (e.g., `Draft`, `Posted`, `Paid`, `Overdue`).
   - Bulk selection bar that slides in smoothly from the bottom upon row selection.
4. **Live Invariance Feedback in Double-Entry Forms**:
   - When entering journals, an inline ticker updates in real time:
     `Debits: NPR 50,000.00 | Credits: NPR 50,000.00 | Difference: NPR 0.00 (Balanced ✓)`
   - The "Post Voucher" button is locked with explanatory tooltip until `Difference == 0`.

### B. Mobile Experience (Android Field Technicians & Sales Officers)
1. **Bottom Navigation**:
   - Essential thumb-zone navigation: `Dashboard`, `My Tickets / Work Orders`, `Customers`, `Inventory`, `More`.
2. **Card-Based List Transformations**:
   - Wide data tables automatically transform into touch-friendly cards on screens `< 768px`.
   - Clear swipe actions (e.g., swipe right to approve parts, swipe left to view details).
3. **Touch-First Field Service Tools**:
   - **Digital Signature Canvas**: Ultra-smooth HTML5 Canvas component with palm-rejection simulation and clear/save actions for customer sign-offs.
   - **Checklist Engine**: Giant toggle switches and check-boxes (min 48px touch zone) for on-site equipment inspection.
   - **Camera / Attachment Input**: Direct photo upload for equipment damage reports and receipts.
4. **Offline Resilience Indicators**:
   - Minimalist persistent top banner showing `Offline Mode — Changes Saved Locally` with a pulse animation.
   - Zero blocking loaders; optimistic local SQLite updates ensure instant response.

---

## 4. Micro-Interactions & Seamless Polish

| Element | Interaction Spec |
| :--- | :--- |
| **Page Transitions** | Subtle fade-slide (`transform: translateY(4px)`, `opacity: 0 -> 1` over 150ms). |
| **Button States** | Active scale depression (`transform: scale(0.98)` on click/tap), ripple on Android. |
| **Toast Notifications** | Slide in from bottom-right (Desktop) or top-center (Mobile) with auto-dismiss and undo action. |
| **Skeleton Loaders** | Shimmer gradients matching the theme instead of jarring spinner wheels. |
| **Update Progress** | Non-modal bottom pill showing animated progress bar during background APK or binary download. |

---

## 5. UI Component Hierarchy (SolidJS)

├── components/
│   ├── ui/                          # Atom & Molecule Design Tokens
│   │   ├── Button.tsx               # Primary, Secondary, Ghost, Danger
│   │   ├── Input.tsx                # Floating label, currency prefix, validation state
│   │   ├── Table.tsx                # Responsive sortable table / mobile card switcher
│   │   ├── VirtualizedTable.tsx     # Windowed table for 10,000+ ledger/invoice rows
│   │   ├── Badge.tsx                # Semantic status badges
│   │   ├── Modal.tsx                # Accessible backdrop dialog with focus trap
│   │   ├── SignaturePad.tsx         # Vector SVG/JSON coordinate customer sign-off
│   │   ├── CommandPalette.tsx       # Cmd+K Quick Search
│   │   ├── ModuleErrorBoundary.tsx  # Fallback card preventing white screens
│   │   └── Toast.tsx                # Micro-notifications
│   ├── layout/
│   │   ├── AppLayout.tsx            # Main shell with responsive sidebar & bottom bar
│   │   ├── Sidebar.tsx              # Desktop collapsible sidebar
│   │   ├── Topbar.tsx               # Breadcrumbs, Command Palette trigger, sync status
│   │   └── MobileNav.tsx            # Android bottom navigation
│   ├── modules/
│   │   ├── auth/                    # LoginView (Password & PinPad), UserManagement, Recovery
│   │   │   ├── LoginView.tsx        # Glassmorphic login card with password/PIN toggle
│   │   │   ├── PinPad.tsx           # Touch-optimized keypad for 4-6 digit quick PIN
│   │   │   ├── UserManagement.tsx   # Admin user directory, roles, and access control
│   │   │   └── DiagnosticRecoveryView.tsx # Self-healing DB integrity check & repair
│   │   ├── accounting/              # Ledger views, Cash Book, VAT/TDS widgets
│   │   ├── sales/                   # Invoicing, Quotations, Challan trackers
│   │   ├── field_service/           # 14-step ticket flow, inspection checklists
│   │   └── inventory/               # Godown stock bars, transfer vouchers
│   └── updater/
│       ├── DesktopUpdatePrompt.tsx  # Native modal for macOS/Windows
│       └── MobileUpdateBanner.tsx   # Progress bar streamer for Android APK
```

---

## 6. Accessibility & Performance Benchmarks
- **Color Contrast**: WCAG 2.1 AA compliant across both light and dark themes.
- **Touch Targets**: Minimum `48px x 48px` on all mobile clickable targets.
- **Render Latency**: Sub-16ms (60fps) table scrolling via `VirtualizedTable` even with 50,000+ ledger lines.
- **Vector Signatures**: Stored as normalized coordinate vectors (~2KB per signature) rather than bloated base64 raster PNGs (~150KB), saving 98% disk storage and sync bandwidth.
- **Memory Footprint**: Low memory footprint using SolidJS direct DOM reactivity (zero Virtual DOM overhead).
- **Bundle Footprint**: Route-level dynamic code splitting (`lazy()`) ensuring initial page bundle remains < 180KB.
