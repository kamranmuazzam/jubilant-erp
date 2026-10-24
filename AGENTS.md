# AGENTS.md - Jubilant ERP Workspace Guidelines

## Project Overview
Jubilant ERP is a cross-platform (macOS, Windows, Android), serverless / local-first enterprise application built with:
- **Frontend**: SolidJS + TypeScript + Vite
- **Backend**: Rust + Tauri v2
- **Database**: Embedded SQLite (using `rusqlite` with `bundled` feature)
- **Auto-Updates**: Dual-engine strategy (Tauri Plugin Updater for Desktop; Custom in-app APK streaming + JNI package installer for Android)

---

## Architectural Principles & Strict Guidelines

### 1. Database & Serverless Architecture
- **Embedded SQLite**: All data resides in local SQLite database (`app.db`) resolved via Tauri's `app.path().app_data_dir()`.
- **Zero Foreign Runtime Dependencies**: Use `rusqlite` with `features = ["bundled"]` so SQLite C code is compiled directly into the binary. This prevents build failures across macOS, Windows, and Android NDK.
- **Enterprise SQLite PRAGMAs**: Enable `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, `PRAGMA foreign_keys = ON;`, `PRAGMA busy_timeout = 5000;`, and `PRAGMA cache_size = -64000;` on connection initialization to maximize throughput and prevent lock contention.
- **Thread Safety**: Wrap database connections in `Arc<Mutex<rusqlite::Connection>>` or connection pooling managed via Tauri state (`tauri::State<AppState>`).
- **Migrations**: Database tables and initial seeds must be idempotent (`CREATE TABLE IF NOT EXISTS`).

### 2. Double-Entry Accounting & Nepal Tax Integrity
- **Integer Paisa Invariance**: All monetary values are strictly stored as `INTEGER` representing Paisa (1 NPR = 100 Paisa). `REAL` or floating-point values are strictly forbidden in accounting tables to prevent rounding inaccuracies.
- **Double-Entry Invariance**: In every journal transaction, `SUM(Debits) == SUM(Credits)`. Never allow unbalanced entries.
- **Chart of Accounts (COA)**:
  - `1000`: Assets (Cash, Bank, AR, Inventory)
  - `2000`: Liabilities (AP, VAT Payable, TDS Payable, Short-term Loans)
  - `3000`: Equity (Share Capital, Retained Earnings)
  - `4000`: Income (Sales Revenue, Service Revenue)
  - `5000`: Expenses (COGS, Rent, Salaries, Utilities)
- **Nepal Tax Compliance (IRD)**:
  - Standard VAT is strictly **13%**.
  - TDS withholding rates: **10%** (Office Rent), **15%** (Consultant Fees), **1.5%** (Contract Works / PAN goods).
  - Sales Book (बिक्री खाता) & Purchase Book (खरिद खाता) must capture: Invoice/Bill No, Date, Buyer/Seller Name, PAN, Taxable Amount, Exempt Amount, and 13% VAT.
- **Cash Book Rule**: Cash transfers (Contra) between Bank and Cash must never impact Revenue or Expense accounts.

### 3. Cross-Platform Compilation & Auto-Update
- **Desktop vs Mobile Isolation**:
  - `tauri-plugin-updater` must only be loaded on desktop targets (`macOS`, `windows`, `linux`). It must NEVER be compiled into Android builds.
  - In `Cargo.toml`: Scoped under `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
  - In `src-tauri/capabilities/desktop.json`: Set `"platforms": ["macOS", "windows", "linux"]`.
  - In `src-tauri/src/lib.rs`: Wrap plugin initialization in `#[cfg(desktop)]`.
- **Android Updater**:
  - Implement custom Rust commands `download_android_apk` and `install_android_apk`.
  - Use JNI with Android `ndk-context` to trigger `android.content.Intent.ACTION_VIEW` with MIME type `application/vnd.android.package-archive` and `FLAG_GRANT_READ_URI_PERMISSION`.

### 4. SolidJS Frontend Conventions
- Use fine-grained SolidJS reactivity: `createSignal`, `createStore`, `createMemo`, `createEffect`.
- Never mutate state directly; use setter functions or `produce` with stores.
- Clean Tauri IPC: Abstract all `invoke()` calls into typed functions in `src/db/` or `src/api/`.

### 5. Crash-Proof & Sync Resilience Invariants
- **Zero-Panic Rule**: Never call `.unwrap()` or `.expect()` in Rust Tauri commands or background tasks. All commands must return `Result<T, AppError>` with structured error codes.
- **Async Runtime Isolation**: Synchronous SQLite operations must run inside `tauri::async_runtime::spawn_blocking` to prevent blocking the async Tokio thread pool.
- **Sync Worker Concurrency Shield**: Background serverless sync tasks must use a dedicated connection or run with `BEGIN IMMEDIATE` + exponential backoff, isolated from UI read queries, to eliminate `SQLITE_BUSY` crashes.
- **Login Lifecycle State Machine**: UI must transition through explicit states (`Uninitialized -> Migrated -> ReadyForAuth -> Authenticated`). Login must never hang or produce a blank screen; if session bootstrapping encounters an issue, fallback to safe minimal permissions with a diagnostic toast.
- **Frontend Error Boundaries**: Every major module and top-level router must be wrapped in SolidJS `<ErrorBoundary>` with user-friendly recovery buttons ("Reload Module" / "Diagnostic Reset") to eliminate white-screen-of-death crashes.
