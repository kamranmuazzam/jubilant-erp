# Jubilant ERP — Cross-Platform Implementation Plan

## 1. Executive Summary & Domain Overview
**Jubilant ERP** is an enterprise management system designed for **Jubilant International**, built for offline-first/serverless desktop (macOS, Windows) and mobile (Android) operations using **Tauri v2**, **Rust**, **SolidJS**, and an **embedded SQLite** database.

Based on the [Jubilant_ERP_User_Manual.docx](file:///Users/kamran/id/Jubilant_ERP_User_Manual.docx), the system consists of seven operational modules:
1. **Module 1: Sales, Customers & Commercial Pipeline**: Lead tracking, quotations, delivery challans, 13% VAT tax invoicing, customer payments, credit notes, and sales returns.
2. **Module 2: Purchases, Vendors & Expense Management**: Vendor onboarding, purchase bills (inward godown stock), operating expenses, debit notes, and payment settlements.
3. **Module 3: Double-Entry Accounting & Nepal Tax Compliance**: Chart of Accounts (COA: 1000–5000), cash book, contra bank transfers, journal vouchers, 13% VAT, TDS withholding (10%, 15%, 1.5%), IRD-compliant Sales Book (बिक्री खाता) & Purchase Book (खरिद खाता), monthly VAT returns, and financial reports (Balance Sheet, P&L, Trial Balance).
4. **Module 4: Technician & Field Service Operations**: 14-step service lifecycle, complaint intake (SR tickets), technician dispatching, site checklists, spare parts requisition & stock deduction, testing, PDF service report sign-off, and warranty tracking.
5. **Module 5: HRM & Payroll**: Employee master records, daily attendance (biometric CSV / manual / bulk), leave management, salary structure, monthly payslip generation, and sales commission payouts.
6. **Module 6: Performance Center & Daily Activities**: Task activity logging, negotiation pipeline, NPS customer feedback, designation-weighted scorecard (0–100 score), and sales incentive calculation.
7. **Module 7: Products, Warehousing (Godown) & POS**: SKU master, multi-godown stock tracking, godown-to-godown transfer vouchers, low-stock alerts, and inventory audits.

---

## 2. Technical Stack & Serverless Architecture

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | SolidJS + TypeScript + Vite | Reactive UI with high performance and zero Virtual DOM overhead. |
| **Styling & UI/UX** | Vanilla CSS + Design Tokens | Custom design system detailed in [UI_UX_DESIGN_SYSTEM.md](file:///Users/kamran/id/UI_UX_DESIGN_SYSTEM.md); adaptive dual-mode (Desktop high-density + Android touch-first). |
| **Backend Core** | Rust (Tauri v2) | High-performance system integration, business logic, and security. |
| **Database** | Embedded SQLite (`rusqlite` bundled) | Serverless local storage in `app_data_dir()`, zero network dependency, compiled directly with binary. |
| **Desktop Auto-Update** | `tauri-plugin-updater` | Minisign cryptographic verification with GitHub Releases endpoints for macOS and Windows. |
| **Android Auto-Update** | Custom In-App APK Engine | Rust streaming downloader + JNI Android `Intent.ACTION_VIEW` package installer with `REQUEST_INSTALL_PACKAGES`. |
| **CI/CD Platform** | GitHub Actions | Automated release matrix building macOS (`.dmg`), Windows (`.exe`), and Android (`.apk`). |

---

### High-Performance SQLite Configuration
The SQLite database will be initialized at `app.path().app_data_dir()/jubilant_erp.db` with the following enterprise PRAGMAs:
```sql
PRAGMA journal_mode = WAL;         -- Write-Ahead Logging for high concurrent read/write throughput
PRAGMA synchronous = NORMAL;       -- Balances ACID safety with maximum disk I/O performance
PRAGMA foreign_keys = ON;          -- Strict relational integrity enforcement
PRAGMA busy_timeout = 5000;        -- Prevent database lock contention across threads
PRAGMA cache_size = -64000;        -- 64MB memory cache for instant queries
PRAGMA temp_store = MEMORY;        -- In-memory temporary tables and indexes
```

> **Financial Precision Invariant**: All monetary values are strictly stored as **`INTEGER` (in Paisa, where 1 NPR = 100 Paisa)**. Floating-point `REAL` types are strictly prohibited in financial tables to eliminate IEEE-754 rounding drift.

### Core Schema Modules

#### A. Users, Authentication & Role-Based Access Control (RBAC)
The manual mandates strict department-level isolation. Each user only accesses menus and operations relevant to their role.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Authentication & RBAC Engine                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
┌───────▼──────────────────────────┐    ┌───────────────────────▼────────┐
│ Dual-Mode Login                  │    │ 8 Enterprise Roles (RBAC)      │
│ • Email + Master Password        │    │ 1. Company (Admin)             │
│ • Quick 4-6 Digit PIN            │    │ 2. Accountant / Finance        │
│   (for field technicians & godown│    │ 3. Operation (Sales/Challans)  │
│    one-handed mobile access)     │    │ 4. Warehouse / Godown Officer  │
│ • Argon2id Secure Password Hash  │    │ 5. HR Manager                  │
│ • In-Memory Session + Auto-Lock  │    │ 6. Technician / Service Eng.   │
│ • Audit Log Recording            │    │ 7. General Employee            │
└──────────────────────────────────┘    │ 8. Client / Dealer (External)  │
                                        └────────────────────────────────┘
```

**Schema Definition**:
- `roles` (`id`, `name` UNIQUE, `department`, `description`, `permissions_json`)
  - *Seed Roles*: `Admin`, `Accountant`, `Operation`, `Warehouse_Officer`, `HR_Manager`, `Technician`, `Employee`, `Client`.
- `users` (`id`, `employee_id` FK NULL, `name`, `email` UNIQUE, `password_hash`, `pin_hash`, `role_id` FK, `department`, `is_active`, `last_login_at`, `created_at`)
- `user_sessions` (`id`, `user_id` FK, `session_token` UNIQUE, `device_name`, `expires_at`, `is_revoked`)
- `audit_logs` (`id`, `user_id` FK, `action` [CREATE, UPDATE, DELETE, POST_VOUCHER, APPROVE], `entity_type`, `entity_id`, `ip_or_device`, `changes_json`, `created_at`)

**Role Permission Scopes**:
1. **Company (Admin)**: Full system configuration, fiscal year management, master reports, global overrides, audit trail inspection.
2. **Accountant / Finance**: Sales invoicing, purchase bills, bank transfers, 13% VAT returns, TDS withholding, cash book, ledger postings.
3. **Operation**: Leads, quotations, dealer accounts, delivery challans, daily activity logging.
4. **Warehouse / Godown Officer**: Goods inward receipt, delivery challan dispatch, multi-godown stock transfers, damage reports.
5. **HR Manager**: Employee onboarding, biometric attendance import, leave approvals, salary setup, payroll processing.
6. **Technician / Service Engineer**: Service ticket diagnosis, site visit checklists, spare part requisitions, repair sign-off with customer digital signature.
7. **General Employee**: Daily attendance check-in, leave requests, personal payslips, daily work task submissions.
8. **Client / Dealer (External)**: View approved quotes, delivery tracking, payment invoice history, open service complaints.

#### B. Accounting & Nepal Tax (All amounts in Integer Paisa)
- `coa_accounts` (`id`, `code` INT UNIQUE, `name`, `type` [Asset, Liability, Equity, Income, Expense], `parent_id`, `opening_balance_paisa` INT)
- `fiscal_years` (`id`, `name` e.g., '2081/2082', `start_date`, `end_date`, `is_locked`)
- `journal_entries` (`id`, `voucher_no` UNIQUE, `entry_date`, `narration`, `fiscal_year_id`, `created_by`, `created_at`)
- `journal_items` (`id`, `journal_id` FK, `account_id` FK, `debit_paisa` INT, `credit_paisa` INT, `memo`)
- `tax_rates` (`id`, `name`, `rate_basis_points` INT) — e.g., 1300 for 13% VAT, 1000 for 10% TDS, 1500 for 15% TDS, 150 for 1.5% TDS
- `bank_accounts` (`id`, `bank_name`, `account_no`, `branch`, `current_balance_paisa` INT)
- `cash_book_entries` (`id`, `date`, `opening_balance_paisa` INT, `cash_in_paisa` INT, `cash_out_paisa` INT, `closing_balance_paisa` INT, `verified_by`)

#### C. Products & Inventory (Multi-Godown)
- `warehouses` (`id`, `name`, `location`, `is_primary`)
- `products` (`id`, `sku` UNIQUE, `barcode`, `name`, `category`, `unit`, `purchase_cost_paisa` INT, `selling_price_paisa` INT, `is_vat_exempt`, `min_stock_alert`)
- `inventory_stock` (`id`, `product_id` FK, `warehouse_id` FK, `quantity_on_hand`)
- `stock_transfers` (`id`, `transfer_no` UNIQUE, `from_warehouse_id` FK, `to_warehouse_id` FK, `status`, `transfer_date`, `approved_by`)
- `stock_transfer_items` (`id`, `transfer_id` FK, `product_id` FK, `quantity`)

#### D. Sales & Commercial Pipeline
- `customers` (`id`, `type` [Dealer, Project, Retail], `company_name`, `contact_person`, `phone`, `pan_number`, `credit_limit_paisa` INT, `address`)
- `quotations` (`id`, `quotation_no` UNIQUE, `customer_id` FK, `date`, `subtotal_paisa` INT, `discount_paisa` INT, `vat_paisa` INT, `grand_total_paisa` INT, `status` [Draft, Sent, Won, Lost])
- `quotation_items` (`id`, `quotation_id` FK, `product_id` FK, `quantity`, `unit_price_paisa` INT, `discount_pct`, `vat_paisa` INT, `line_total_paisa` INT)
- `delivery_challans` (`id`, `challan_no` UNIQUE, `customer_id` FK, `warehouse_id` FK, `dispatch_date`, `status` [Pending, Delivered])
- `invoices` (`id`, `invoice_no` UNIQUE, `customer_id` FK, `invoice_date`, `taxable_amount_paisa` INT, `exempt_amount_paisa` INT, `vat_13_paisa` INT, `grand_total_paisa` INT, `payment_status`, `ird_sync_status`)
- `invoice_items` (`id`, `invoice_id` FK, `product_id` FK, `quantity`, `unit_price_paisa` INT, `is_exempt`, `vat_paisa` INT, `line_total_paisa` INT)
- `customer_payments` (`id`, `payment_no` UNIQUE, `invoice_id` FK, `customer_id` FK, `amount_paisa` INT, `payment_mode` [Cash, Bank, Cheque], `bank_account_id` FK, `payment_date`)

#### E. Purchases & Vendors
- `vendors` (`id`, `name`, `pan_number`, `phone`, `address`, `contact_person`)
- `purchase_bills` (`id`, `bill_no` UNIQUE, `vendor_id` FK, `bill_date`, `warehouse_id` FK, `taxable_amount_paisa` INT, `exempt_amount_paisa` INT, `vat_13_paisa` INT, `grand_total_paisa` INT, `payment_status`)
- `purchase_bill_items` (`id`, `bill_id` FK, `product_id` FK, `quantity`, `unit_cost_paisa` INT, `is_exempt`, `vat_paisa` INT, `line_total_paisa` INT)
- `operating_expenses` (`id`, `expense_no` UNIQUE, `expense_account_id` FK, `vendor_pan`, `taxable_paisa` INT, `vat_paisa` INT, `tds_rate_bps` INT, `tds_paisa` INT, `net_payable_paisa` INT, `payment_mode`, `date`)

#### F. Technician & Field Service
- `service_requests` (`id`, `ticket_no` UNIQUE, `customer_id` FK, `product_serial`, `priority`, `issue_description`, `status` [Open, Assigned, On-Site, In-Progress, QC, Closed], `created_at`)
- `work_orders` (`id`, `ticket_id` FK, `technician_id` FK, `scheduled_date`, `status`, `checklist_json`, `notes`)
- `spare_part_requests` (`id`, `work_order_id` FK, `product_id` FK, `quantity`, `warehouse_id` FK, `status` [Pending, Approved, Rejected], `approved_by`)
- `service_reports` (`id`, `ticket_id` FK, `diagnosis`, `work_performed`, `customer_signature_blob`, `customer_feedback`, `nps_rating`, `completed_at`)

#### G. HRM, Attendance & Performance
- `employees` (`id`, `employee_code` UNIQUE, `name`, `citizenship_no`, `department`, `designation`, `basic_salary`, `bank_account_no`, `joining_date`)
- `attendance_records` (`id`, `employee_id` FK, `date`, `in_time`, `out_time`, `hours_worked`, `is_late`, `overtime_hours`, `source` [Biometric, Manual])
- `leaves` (`id`, `employee_id` FK, `leave_type`, `start_date`, `end_date`, `status` [Pending, Approved, Rejected])
- `work_tasks` (`id`, `employee_id` FK, `title`, `due_date`, `priority`, `status` [Pending, Completed, Postponed], `postpone_reason`)
- `employee_scorecards` (`id`, `employee_id` FK, `month`, `year`, `attendance_score`, `task_score`, `sales_score`, `nps_score`, `total_score`, `grade`, `incentive_amount`)

---

## 4. Auto-Update Architecture (The Dual-Engine Approach)

```
┌────────────────────────────────────────────────────────┐
│                   GitHub Releases                      │
│   (latest.json, .dmg, .msi, and signed .apk assets)    │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       [Desktop Updater]          [Android Updater]
                │                        │
     ┌──────────▼──────────┐   ┌─────────▼─────────┐
     │ tauri-plugin-updater│   │ Custom Rust Stream│
     │  (macOS & Windows)  │   │  Downloader Event │
     └──────────┬──────────┘   └─────────┬─────────┘
                │                        │
     ┌──────────▼──────────┐   ┌─────────▼─────────┐
     │ Minisign Signature  │   │ JNI Package       │
     │ Verification & Swap │   │ Installer (Intent)│
     └─────────────────────┘   └───────────────────┘
```

### Desktop Implementation
1. Add `tauri-plugin-updater` exclusively to desktop target dependencies in `Cargo.toml`.
2. Define `desktop.json` capability with `"platforms": ["macOS", "windows"]` and `"permissions": ["updater:default"]`.
3. In `lib.rs`:
   ```rust
   #[cfg(desktop)]
   {
       builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
   }
   ```
4. Generate keypair using `tauri signer generate` and embed public key in `tauri.conf.json`.

### Android Implementation
1. Provide `download_android_apk` Rust command that streams the release `.apk` directly to the secure app cache directory (`appCacheDir()`) while emitting progress events (`tauri://download-progress`) to SolidJS.
2. Provide `check_install_permission` Rust command using JNI to query `PackageManager.canRequestPackageInstalls()`. If false, trigger `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` so Android guides the user directly to grant permission instead of silently dropping the install.
3. Provide `install_android_apk` Rust command using JNI (`ndk-context`) and Android's native `androidx.core.content.FileProvider`:
   - Wraps the cache file path into a secure `content://` URI via `FileProvider.getUriForFile()`.
   - Creates an `Intent(Intent.ACTION_VIEW)` with MIME type `application/vnd.android.package-archive`.
   - Attaches `Intent.FLAG_ACTIVITY_NEW_TASK` and `Intent.FLAG_GRANT_READ_URI_PERMISSION`.
   - This eliminates `FileUriExposedException` and guarantees flawless installation on modern Android versions (Android 10 through 15+).
4. Configure `AndroidManifest.xml` and `res/xml/file_paths.xml`:
   ```xml
   <!-- AndroidManifest.xml -->
   <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

   <application ...>
       <provider
           android:name="androidx.core.content.FileProvider"
           android:authorities="${applicationId}.fileprovider"
           android:exported="false"
           android:grantUriPermissions="true">
           <meta-data
               android:name="android.support.FILE_PROVIDER_PATHS"
               android:resource="@xml/file_paths" />
       </provider>
   </application>
   ```
   ```xml
   <!-- res/xml/file_paths.xml -->
   <?xml version="1.0" encoding="utf-8"?>
   <paths xmlns:android="http://schemas.android.com/apk/res/android">
       <cache-path name="cached_apk" path="." />
   </paths>
   ```

---

## 5. Phased Implementation Roadmap & Verification Status

### Phase 1: Local macOS Project Scaffold & Design System Setup — [COMPLETED]
- [x] Initialize Vite + SolidJS + TypeScript in the repository.
- [x] Initialize Tauri v2 configured for macOS.
- [x] Setup core capability files (`capabilities/default.json` and `capabilities/desktop.json`).
- [x] Build core Design System ([UI_UX_DESIGN_SYSTEM.md](file:///Users/kamran/id/UI_UX_DESIGN_SYSTEM.md)): Warm editorial color tokens (cream `--erp-bg-canvas: #fcfbf9`, warm white `--erp-bg-card: #ffffff`, rich charcoal `--erp-text-main: #1c1917`, amber accents), Inter/JetBrains Mono typography, CSS variables, dark/light theme engine, and responsive app shell (collapsible desktop sidebar + Android bottom navigation).
- [x] Verify clean local build on macOS (`npm run tauri dev` and `npm run tauri build`).

### Phase 2: Embedded Database, RBAC & Authentication Engine — [COMPLETED]
- [x] Add `rusqlite` (with `bundled` feature), `serde`, `serde_json`, `tokio`, `argon2` to `Cargo.toml`.
- [x] Implement `src-tauri/src/db/` with embedded SQLite initialization and idempotent schema migration scripts.
- [x] Seed default 8 system roles (`Admin`, `Accountant`, `Operation`, `Warehouse_Officer`, `HR_Manager`, `Technician`, `Employee`, `Client`) and default superadmin account (`admin@jubilant.com.np`).
- [x] Implement Rust authentication commands: `login_with_password`, `login_with_pin`, `lock_session`, `get_current_user_permissions`.
- [x] Implement thread-safe connection state (`Arc<Mutex<Connection>>`), audit logging service (`audit_logs`), and zero-panic error handling (`AppResult<T>`).

### Phase 3: Core Module Implementation & Enterprise UX — [COMPLETED]
- [x] **Executive Summary Sheet (कार्यकारी सारांश पाना)**: Consolidated operational and financial health briefing with real-time sales trends, bank balances, tax liabilities, attendance KPIs, and print-ready report layout (`SummarySheetView.tsx`).
- [x] **Authentication & RBAC UI**: Dual-mode login screen with instant toggle between Argon2 password and Quick PIN Pad; dynamic sidebar filtering based on logged-in user's role permissions; Admin User Management panel (`UsersView.tsx`) to create users, assign roles, and reset PINs.
- [x] **Double-Entry Engine**: Auto-post balanced debit/credit journals with integer Paisa invariance (`Debits - Credits == 0.00`). Tested with 0 NPR variance.
- [x] **Nepal Tax Engine**: Compute 13% VAT, TDS deductions (10% Rent, 15% Consultant, 1.5% Pan Goods), generate IRD Sales Book (बिक्री खाता) and Purchase Book (खरिद खाता) statutory views.
- [x] **Field Service**: Implement 14-step service lifecycle with digital vector canvas signature capture, checklist switches, godown spare part deduction, and warranty tracking (`FieldServiceView.tsx`, `SignaturePad.tsx`).
- [x] **Inventory & Godown**: Real-time stock counts across multi-godown storage with transfer vouchers and low-stock alert thresholds (`InventoryView.tsx`).
- [x] **HRM & Attendance**: Daily attendance scoring, biometric/manual check-in, leave approvals, salary structure, and automated commission calculations (`HrmView.tsx`).
- [x] **Global Command Palette (`Cmd+K` / `Ctrl+K`)**: Fast keyboard-driven fuzzy search across all 7 operational modules, tax invoices, vouchers, service tickets, and system preferences (`CommandPalette.tsx`).
- [x] **Zero Jargon Invariant**: Replaced all raw technical terminology (`SQLite WAL`, `Integer Paisa`, `P2P Mesh Discovery UDP 49152`) with clean, elegant enterprise language (`System Online`, `All Systems Operational`, `Ledgers Balanced & Reconciled`, `Enterprise Edition`).

### Phase 4: Peer-to-Peer & Cloud Sync Engine — [COMPLETED]
- [x] Implement UDP broadcast beacon on port 49152 for instantaneous zero-config LAN peer discovery (`lan_engine.rs`).
- [x] Implement local TCP peer batch exchange server on port 49153 with peer handshake and schema version verification (`lan_engine.rs`).
- [x] Implement remote cloud sync gateway client for cross-branch synchronization over the internet (`internet_engine.rs`).
- [x] Bounded 50-chunk CDC replication from `outbox_events` table to eliminate memory spikes and mobile OOM crashes.
- [x] Background supervisor actor running on `tauri::async_runtime::spawn` with jittered exponential backoff (1s, 2s, 5s, max 30s) and automatic offline recovery (`sync/mod.rs`).
- [x] Interactive UI Sync Modal (`SyncModal.tsx`) with real-time peer discovery list, terminal renaming, outbox inspection, and manual sync triggering.

### Phase 5: Auto-Update Engine Integration — [COMPLETED]
- [x] Configure `tauri.conf.json` with updater endpoints and Minisign public key.
- [x] Implement desktop updater check in SolidJS with auto-update banner notification (`UpdateBanner.tsx`).
- [x] Implement Android APK downloader stream + JNI package installer commands (`download_android_apk`, `install_android_apk`, `check_install_permission`) in Rust using Android `FileProvider` and `Intent.ACTION_VIEW`.
- [x] Reactive download progress bar with seamless user prompt.

### Phase 6: CI/CD Pipeline (GitHub Actions) — [COMPLETED]
- [x] Automated release workflow `.github/workflows/release.yml` with multi-target matrix:
  - `macos-latest` (Desktop build & DMG)
  - `windows-latest` (Desktop build & MSI/EXE)
  - `ubuntu-latest` (Android build via NDK r26b + Java 17 + APK Signing)
- [x] Swatinem/rust-cache@v2 build caching for fast ~4-minute warm compilation runs.

---

## 6. Verification and Acceptance Criteria Matrix

| Criterion | Specification | Verified Result | Status |
| :--- | :--- | :--- | :--- |
| **Local Compilation** | Clean build with zero missing dependencies | `npm run build` completed in 1.09s; `cargo test` clean build | **PASSED** |
| **Serverless Independence** | 100% offline operation via embedded SQLite | Creates `jubilant_erp.db` in `app_data_dir()`, seeds default roles/admin, zero remote server required | **PASSED** |
| **Double-Entry Invariance** | `SUM(Debit) == SUM(Credit)` strictly enforced | Tested in `commands_test::test_accounting_and_nepal_double_entry_invariance` with 0 NPR variance | **PASSED** |
| **Integer Paisa Math** | All currency stored as 64-bit integer paisa | 1 NPR = 100 Paisa; zero floating point precision drift in journal & invoice tables | **PASSED** |
| **Nepal Tax Compliance** | 13% VAT, TDS withholdings, IRD Sales & Purchase Books | Verified in `commands_test::test_sales_and_nepal_vat_tax_invoice` & `test_operating_expenses_and_tds_compliance` | **PASSED** |
| **14-Step Field Service** | Ticket intake to digital signature sign-off | Verified in `commands_test::test_field_service_14_step_lifecycle` | **PASSED** |
| **HRM & Attendance** | Biometric check-in, late calculations, salary | Verified in `commands_test::test_hrm_and_attendance_flow` | **PASSED** |
| **P2P & Cloud Sync** | LAN beacon discovery + 50-chunk CDC replication | Verified in `sync_test::test_sync_status_and_defaults`, `test_configure_sync_endpoint`, `test_outbox_drain_and_50_chunk_limit` | **PASSED** |
| **Zero-Panic Rule** | No `.unwrap()` or `.expect()` in production commands | All commands return `AppResult<T>` with structured error codes | **PASSED** |
| **Crash Protection** | Async runtime isolation & error boundaries | All modules wrapped in `<ModuleErrorBoundary>` with 10s IPC timeout watchdog | **PASSED** |

---

## 7. System-Wide Optimization Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Jubilant ERP Optimization Matrix                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
┌────▼─────────────────┐  ┌─────────▼────────────┐  ┌──────────────▼─────┐
│ Database & Storage   │  │ Binary & Compiler    │  │ Frontend & Memory  │
│ • WAL Mode + NORMAL  │  │ • LTO = true         │  │ • Table Windowing  │
│ • 64MB Cache         │  │ • Codegen Units = 1  │  │ • Route Splitting  │
│ • Integer Paisa Math │  │ • Panic = abort      │  │ • Direct Signals   │
│ • Covering Indexes   │  │ • Strip = true       │  │ • Vector Signatures│
└──────────────────────┘  └──────────────────────┘  └────────────────────┘
```

### A. Database & Query Engine
1. **Write-Ahead Logging (WAL)**: Allows concurrent reads while a write transaction is in progress, preventing UI freezes during large report generations.
2. **Integer Arithmetic**: Eliminates software float emulation and rounding guards; arithmetic operations on 64-bit integers execute in a single CPU cycle.
3. **Covering Indexes**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_journal_items_account_date 
   ON journal_items(account_id, debit_paisa, credit_paisa);

   CREATE INDEX IF NOT EXISTS idx_invoices_date_customer 
   ON invoices(invoice_date, customer_id, grand_total_paisa);

   CREATE INDEX IF NOT EXISTS idx_inventory_product_wh 
   ON inventory_stock(product_id, warehouse_id);
   ```

### B. Rust Binary & Compiler Optimization
Configure `src-tauri/Cargo.toml` for minimal binary footprint and maximum execution speed:
```toml
[profile.release]
opt-level = 3              # Maximum performance
lto = true                 # Link-Time Optimization across all crates
codegen-units = 1          # Maximizes compiler optimizations
panic = "abort"            # Removes stack unwinding metadata
strip = true               # Strips debug symbols and symbols table
```
*Expected Result*: Binary size reduced by ~60% (desktop installer ~12MB, Android APK ~15MB).

### C. Frontend Runtime & Memory Optimization
1. **DOM Virtualization**: For general ledgers, sales registers, and transaction logs exceeding 500 rows, use windowed list rendering so only visible rows (~20) exist in the DOM.
2. **Route-Level Code Splitting**: Use SolidJS `lazy(() => import('./modules/...'))` to load accounting, field service, or HRM modules on demand. Initial bundle payload drops under 180KB.
3. **Payload Compression**: Customer signatures stored as normalized vector coordinates (SVG/JSON paths, ~2KB) rather than base64 raster PNGs (~150KB).

### D. CI/CD Pipeline Build Caching
In `.github/workflows/release.yml`, implement `Swatinem/rust-cache@v2` and `actions/cache` for `node_modules`.
*Impact*: Reduces multi-platform GitHub Actions build duration from ~22 minutes down to ~4 minutes on warm runs.

---

## 8. Resilience, Crash Prevention & Sync Safety Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Zero-Crash Resilience Architecture                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
┌────▼─────────────────┐  ┌─────────▼────────────┐  ┌──────────────▼─────┐
│ Panic Shield & IPC   │  │ Serverless Sync Guard│  │ Fail-Safe Boot & UI│
│ • Zero unwrap/expect │  │ • Dedicated Sync Conn│  │ • DB Health Check  │
│ • Structured AppError│  │ • 50-Record Chunks   │  │ • Diagnostic Mode  │
│ • Tokio SpawnBlocking│  │ • LWW + Tombstones   │  │ • Permission Fallbk│
│ • IPC Watchdog (10s) │  │ • Supervisor Backoff │  │ • Error Boundaries │
└──────────────────────┘  └──────────────────────┘  └────────────────────┘
```

### A. Preventing App Crashes & Freezes (Rust Core)
1. **Zero-Panic Mandate**:
   - Calling `.unwrap()` or `.expect()` inside Tauri command handlers or Tokio threads is strictly prohibited. If Rust panics under `panic = "abort"`, the entire application terminates immediately.
   - All fallible operations return a strongly-typed `AppResult<T>`:
     ```rust
     #[derive(Debug, serde::Serialize)]
     pub struct AppError {
         pub code: String,       // e.g. "DB_BUSY", "AUTH_INVALID", "MIGRATION_ERROR"
         pub message: String,
         pub is_fatal: bool,
     }
     pub type AppResult<T> = Result<T, AppError>;
     ```
2. **Async Runtime Thread Starvation Prevention**:
   - Synchronous SQLite disk operations must never be awaited directly on Tokio worker threads. All `rusqlite` calls run inside `tauri::async_runtime::spawn_blocking` to prevent starving IPC message channels.

### B. Preventing Serverless Sync Crashes (Outbox CDC & Connection Layout)
Based on production local-first architectures (PowerSync, Syncular), raw SQLite file syncing causes instant corruption due to file-locking. Instead, we use an **Optimistic Outbox Pattern with Change Data Capture (CDC)**:
1. **The Outbox Table**:
   - Whenever a business record is inserted, updated, or deleted offline, a trigger or transaction atomically records an entry in `outbox_events`:
     `outbox_events (id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, op TEXT, payload_json TEXT, created_at INT, status TEXT, retry_count INT)`
   - The background sync actor simply drains the outbox queue in batches without touching live UI tables during network operations.
2. **Time-Ordered UUIDv7 for SQLite B-Tree Performance**:
   - Instead of random UUIDv4 (which causes severe page fragmentation and degraded disk I/O in SQLite), all entities use **UUIDv7** (`uuid::Uuid::now_v7()`).
   - Because UUIDv7 is 100% time-ordered by timestamp prefix, new records append sequentially to the B-Tree, reducing write latency by up to 40% on mobile flash storage.
3. **Multi-Owner Connection Separation (Reader vs Sync Writer)**:
   - UI reads use a dedicated read-only connection snapshot (`PRAGMA query_only = ON;`).
   - Mutations and sync background writes flow through a serialized channel with `PRAGMA busy_timeout = 5000;`.
   - Because SQLite WAL mode supports unlimited concurrent readers alongside a single active writer, the UI **never** experiences stutter, thread contention, or `SQLITE_BUSY` errors.
4. **Bounded Chunking (Prevent Mobile OOM)**:
   - Sync payloads are strictly limited to **50 records per chunk**. Mobile devices never attempt to deserialize 50MB blobs in memory.
5. **Supervisor Pattern with Exponential Backoff**:
   - The background sync engine runs as a supervised actor. If network drops, sockets close, or peer handshakes fail, the worker catches the error, transitions to `Status::Offline`, and retries with jittered exponential backoff (1s, 2s, 5s, max 30s) without affecting the UI.
6. **Conflict Resolution & Schema Handshake**:
   - Records use Last-Write-Wins (LWW) with high-precision timestamping and soft-delete tombstones (`deleted_at`).
   - Before syncing records, peers exchange their schema version (`PRAGMA user_version`). If a peer has a newer schema version, sync is suspended and the user is prompted to update the app, preventing deserialization panics.

### C. "Logged In But App Not Working" Prevention
This issue occurs when authentication completes before database hydration, when role permissions fail to parse, or when database queries deadlock.
1. **Deterministic Lifecycle State Machine**:
   - The SolidJS frontend strictly enforces boot states:
     `Uninitialized ──► DB Health Check ──► Schema Migrated ──► ReadyForAuth ──► Authenticated ──► DashboardReady`
   - The login form is disabled until migrations pass health checks.
2. **Safe Fallback Permissions**:
   - If a user's `permissions_json` in SQLite is missing, corrupted, or unparseable, the app falls back to a safe default `Employee` permission profile with an alert toast, rather than crashing or rendering a blank screen.
3. **Diagnostic & Self-Healing Mode**:
   - If SQLite connection fails on launch (e.g. lockfile stuck or disk permission error), the app does not crash. It displays a **Diagnostic & Recovery Screen** allowing the user to:
     - Run SQLite Integrity Check (`PRAGMA integrity_check`)
     - Backup corrupted `.db` to a timestamped file
     - Rebuild fresh local database
4. **Frontend Error Boundaries & IPC Watchdogs**:
   - All SolidJS modules (`accounting`, `sales`, `field_service`) are wrapped in `<ErrorBoundary>`. If an uncaught rendering error occurs in one module, only that view shows a recovery prompt ("Module Error — Reload"), while the sidebar, topbar, and remaining modules stay completely functional.
   - All `invoke()` calls include a **10-second client-side timeout watchdog**. If backend IPC stalls, the loading spinner cancels and displays an explicit retry button.
