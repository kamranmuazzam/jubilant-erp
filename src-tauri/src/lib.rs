pub mod commands;
pub mod db;
pub mod error;
pub mod sync;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub db: db::DbState,
    pub sync: Arc<sync::SyncManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .or_else(|_| app.path().app_local_data_dir())
                .unwrap_or_else(|_| PathBuf::from("."));

            let db_state = db::init_database(app_dir).expect("Failed to initialize SQLite database");
            let sync_manager = Arc::new(sync::SyncManager::new(db_state.clone(), None));
            sync_manager.clone().start_background_workers();

            app.manage(AppState {
                db: db_state,
                sync: sync_manager,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Peer-to-Peer & Serverless Sync
            commands::sync_commands::get_sync_status,
            commands::sync_commands::trigger_manual_sync,
            commands::sync_commands::configure_sync_endpoint,
            // Auth & User Management
            commands::auth_commands::login_with_password,
            commands::auth_commands::login_with_pin,
            commands::auth_commands::get_roles,
            commands::auth_commands::get_users,
            commands::auth_commands::create_user,
            commands::auth_commands::update_user,
            commands::auth_commands::reset_user_password,
            commands::auth_commands::toggle_user_status,
            // Accounting & Nepal Tax
            commands::accounting_commands::get_coa_accounts,
            commands::accounting_commands::create_journal_entry,
            commands::accounting_commands::get_journal_entries,
            commands::accounting_commands::get_cash_book,
            commands::accounting_commands::add_cash_book_entry,
            commands::accounting_commands::get_vat_report,
            // Sales & Customers
            commands::sales_commands::get_customers,
            commands::sales_commands::create_customer,
            commands::sales_commands::get_sales_book,
            commands::sales_commands::create_tax_invoice,
            // Purchases & Operating Expenses
            commands::purchase_commands::get_vendors,
            commands::purchase_commands::create_vendor,
            commands::purchase_commands::get_purchase_book,
            commands::purchase_commands::create_purchase_bill,
            commands::purchase_commands::get_operating_expenses,
            commands::purchase_commands::create_operating_expense,
            // Inventory & Godown
            commands::inventory_commands::get_products,
            commands::inventory_commands::create_product,
            commands::inventory_commands::get_warehouses,
            commands::inventory_commands::create_warehouse,
            commands::inventory_commands::get_stock_levels,
            commands::inventory_commands::create_stock_transfer,
            // Field Service (14-Step Lifecycle)
            commands::field_service_commands::get_service_requests,
            commands::field_service_commands::create_service_request,
            commands::field_service_commands::update_service_status,
            commands::field_service_commands::submit_spare_part_request,
            commands::field_service_commands::approve_spare_part_request,
            commands::field_service_commands::submit_service_report,
            // HRM & Attendance
            commands::hrm_commands::get_employees,
            commands::hrm_commands::create_employee,
            commands::hrm_commands::mark_attendance,
            commands::hrm_commands::get_attendance_records,
            // Cross-Platform Auto-Update
            commands::update_commands::download_android_apk,
            commands::update_commands::check_install_permission,
            commands::update_commands::install_android_apk
        ]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
