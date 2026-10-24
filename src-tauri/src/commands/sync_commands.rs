use crate::error::AppResult;
use crate::sync::types::SyncStatus;
use crate::AppState;

#[tauri::command]
pub async fn get_sync_status(state: tauri::State<'_, AppState>) -> AppResult<SyncStatus> {
    state.sync.get_status()
}

#[tauri::command]
pub async fn trigger_manual_sync(state: tauri::State<'_, AppState>) -> AppResult<usize> {
    state.sync.run_replication_cycle().await
}

#[tauri::command]
pub async fn configure_sync_endpoint(
    device_name: Option<String>,
    lan_enabled: Option<bool>,
    internet_enabled: Option<bool>,
    relay_url: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    if let Some(name) = device_name {
        if !name.trim().is_empty() {
            if let Ok(mut dev) = state.sync.device_name.lock() {
                *dev = name.clone();
            }
        }
    }

    if let Ok(mut cfg) = state.sync.config.lock() {
        if let Some(lan) = lan_enabled {
            cfg.lan_sync_enabled = lan;
        }
        if let Some(inet) = internet_enabled {
            cfg.internet_sync_enabled = inet;
        }
        if let Some(url) = relay_url {
            cfg.relay_url = Some(url);
        }
    }

    Ok(true)
}
