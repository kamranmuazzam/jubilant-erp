use jubilant_erp_lib::AppState;

#[tokio::test]
async fn test_state_creation() {
    let temp_dir = std::env::temp_dir().join(format!("test_erp_{}", uuid::Uuid::new_v4()));
    let db_state = jubilant_erp_lib::db::init_database(temp_dir).unwrap();
    let sync_manager = std::sync::Arc::new(jubilant_erp_lib::sync::SyncManager::new(db_state.clone(), None));
    let app_state = AppState { db: db_state, sync: sync_manager };
    
    // Check if we can call commands or use mock
    let app = tauri::test::mock_app();
    use tauri::Manager;
    app.manage(app_state);
    let state: tauri::State<AppState> = app.state::<AppState>();
    
    let roles = jubilant_erp_lib::commands::auth_commands::get_roles(state).await;
    assert!(roles.is_ok());
}
