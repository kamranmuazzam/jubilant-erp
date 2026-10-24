use jubilant_erp_lib::commands::sync_commands;
use jubilant_erp_lib::db::init_database;
use jubilant_erp_lib::AppState;
use tauri::Manager;
use uuid::Uuid;

fn setup_test_app() -> tauri::App<tauri::test::MockRuntime> {
    let temp_dir = std::env::temp_dir().join(format!("test_sync_{}", Uuid::now_v7()));
    let db_state = init_database(temp_dir).expect("Failed to initialize database");
    let sync_manager = std::sync::Arc::new(jubilant_erp_lib::sync::SyncManager::new(
        db_state.clone(),
        Some("Test-Terminal-Alpha".to_string()),
    ));
    let app_state = AppState {
        db: db_state,
        sync: sync_manager,
    };

    let app = tauri::test::mock_app();
    app.manage(app_state);
    app
}

#[tokio::test]
async fn test_sync_status_and_defaults() {
    let app = setup_test_app();
    let state = app.state::<AppState>();

    let status = sync_commands::get_sync_status(state).await.expect("Failed to get sync status");
    assert_eq!(status.device_name, "Test-Terminal-Alpha");
    assert_eq!(status.pending_outbox_count, 0);
    assert_eq!(status.lan_peer_count, 0);
}

#[tokio::test]
async fn test_configure_sync_endpoint() {
    let app = setup_test_app();
    let state = app.state::<AppState>();

    let result = sync_commands::configure_sync_endpoint(
        Some("Branch-Kathmandu-01".to_string()),
        Some(true),
        Some(true),
        Some("https://relay.jubilant.internal".to_string()),
        state.clone(),
    )
    .await;
    assert!(result.is_ok());

    let status = sync_commands::get_sync_status(state).await.expect("Failed to get status");
    assert_eq!(status.device_name, "Branch-Kathmandu-01");
}

#[tokio::test]
async fn test_outbox_drain_and_50_chunk_limit() {
    let app = setup_test_app();
    let state = app.state::<AppState>();

    // Insert 65 mock events into outbox_events to test 50-chunking invariant
    {
        let conn = state.db.conn.lock().unwrap();
        for i in 1..=65 {
            let event_id = format!("evt-{}", Uuid::now_v7());
            let created_at = 1700000000 + i;
            conn.execute(
                "INSERT INTO outbox_events (id, entity_type, entity_id, op, payload_json, created_at, status, retry_count)
                 VALUES (?1, 'product', ?2, 'CREATE', '{\"name\":\"Widget\"}', ?3, 'PENDING', 0)",
                rusqlite::params![event_id, format!("prod-{}", i), created_at],
            )
            .expect("Failed to insert outbox event");
        }
    }

    // Check status reports 65 pending
    let status_before = sync_commands::get_sync_status(state.clone()).await.unwrap();
    assert_eq!(status_before.pending_outbox_count, 65);

    // Verify fetch_outbox_chunk limits to 50
    let chunk = state.sync.fetch_outbox_chunk(0, 100).expect("Fetch chunk failed");
    assert_eq!(chunk.len(), 50, "Sync chunk MUST be bounded to maximum 50 records to prevent mobile OOM");

    // Trigger manual sync (local returns 0 because no peers are reachable in unit test env, but does not panic)
    let sync_res = sync_commands::trigger_manual_sync(state.clone()).await;
    assert!(sync_res.is_ok(), "Manual sync should gracefully handle offline state");
}
