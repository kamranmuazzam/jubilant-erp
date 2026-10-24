# Jubilant ERP System & Coding Rules

## 1. Serverless SQLite Guidelines
- Never require an external database server or remote API for core business operations.
- Always use `rusqlite` with `features = ["bundled"]` in `src-tauri/Cargo.toml`.
- All database queries must be transactional when multiple tables are affected (e.g., creating an invoice must insert into `invoices`, insert into `invoice_items`, reduce `inventory_stock`, and insert into `journal_entries` + `journal_items` inside a single SQLite transaction).
- Tables and indexes must be created using idempotent migrations (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

## 2. Cross-Platform Tauri Rules
- Never import `tauri-plugin-updater` unconditionally in Rust or in universal capabilities.
- Always wrap desktop updater initialization in `#[cfg(desktop)]`.
- On Android, use the custom `download_android_apk` and `install_android_apk` Rust commands.
- Ensure all file paths use forward slashes or `PathBuf` joins for platform neutrality.

## 3. Financial Invariants
- Total Debits must strictly equal Total Credits in every journal entry (`SUM(debit) == SUM(credit)`).
- Tax calculations must follow Inland Revenue Department (IRD) Nepal specifications: 13% standard VAT rate.
- TDS rates must conform to: 10% (Rent), 15% (Consultancy), 1.5% (Contract works).
- Sales Book (बिक्री खाता) and Purchase Book (खरिद खाता) must match IRD reporting structures.

## 4. Crash-Proof Rust Commands & Sync Safety
- **Strictly No Panics**: `unwrap()` and `expect()` are forbidden in Tauri commands and sync actors. All fallible operations must be mapped to structured `AppError` types.
- **Dedicated Sync Connection**: Serverless background sync loops must not share connection locks with UI query threads. All batch sync writes must execute in bounded transactions with `PRAGMA busy_timeout = 5000;`.
- **Bounded Sync Chunks**: Serverless sync payloads must be processed in streaming batches ($\le 50$ records per chunk) to avoid Out-Of-Memory (OOM) aborts on mobile devices.
- **Supervisor Pattern**: Background sync tasks must be supervised. If a network socket or peer disconnects, the sync worker must gracefully backoff without crashing the Tauri process.

## 5. Login Bootstrapping & Fail-Safe UI
- **Health Check First**: The app must verify database integrity before displaying the login form.
- **Safe Fallback Permissions**: If a user's permissions or session profile cannot be parsed, the app must fall back to a safe default viewer role rather than hanging on a white screen.
- **IPC Watchdog**: All frontend `invoke()` calls must have a 10s timeout watchdog to cancel stalled spinners.
- **SolidJS Error Boundaries**: Every top-level module must be enclosed in `<ErrorBoundary>` to catch component-level exceptions gracefully.
