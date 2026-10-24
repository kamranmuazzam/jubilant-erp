use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub node_id: String,
    pub device_name: String,
    pub address: String,
    pub is_lan: bool,
    pub last_seen: i64,
    pub schema_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEventItem {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub op: String, // INSERT, UPDATE, DELETE
    pub payload_json: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncBatch {
    pub source_node_id: String,
    pub schema_version: u32,
    pub events: Vec<OutboxEventItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub node_id: String,
    pub device_name: String,
    pub is_listening: bool,
    pub lan_peer_count: usize,
    pub internet_connected: bool,
    pub pending_outbox_count: i64,
    pub last_sync_timestamp: Option<i64>,
    pub active_peers: Vec<PeerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub device_name: String,
    pub lan_sync_enabled: bool,
    pub internet_sync_enabled: bool,
    pub relay_url: Option<String>,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            device_name: "Jubilant Terminal".to_string(),
            lan_sync_enabled: true,
            internet_sync_enabled: true,
            relay_url: Some("https://sync.jubilant.com.np".to_string()),
        }
    }
}
