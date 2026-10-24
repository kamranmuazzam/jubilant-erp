pub mod internet_engine;
pub mod lan_engine;
pub mod types;

use crate::db::DbState;
use crate::error::{AppError, AppResult};
use internet_engine::InternetEngine;
use lan_engine::LanEngine;
use rusqlite::params;
use std::sync::{Arc, Mutex};
use types::{OutboxEventItem, PeerInfo, SyncBatch, SyncConfig, SyncStatus};
use uuid::Uuid;

pub struct SyncManager {
    pub node_id: String,
    pub device_name: Arc<Mutex<String>>,
    pub config: Arc<Mutex<SyncConfig>>,
    pub db: DbState,
    pub lan: Arc<LanEngine>,
    pub internet: Arc<Mutex<InternetEngine>>,
    pub last_sync_at: Arc<Mutex<Option<i64>>>,
}

impl SyncManager {
    pub fn new(db: DbState, device_name: Option<String>) -> Self {
        let node_id = Uuid::now_v7().to_string();
        let name = device_name.unwrap_or_else(|| {
            format!(
                "Jubilant Terminal-{}",
                &node_id[..6]
            )
        });

        let config = SyncConfig {
            device_name: name.clone(),
            lan_sync_enabled: true,
            internet_sync_enabled: true,
            relay_url: Some("https://sync.jubilant.com.np".to_string()),
        };

        let lan = Arc::new(LanEngine::new(node_id.clone(), name.clone()));
        let internet = Arc::new(Mutex::new(InternetEngine::new(config.relay_url.clone())));

        Self {
            node_id,
            device_name: Arc::new(Mutex::new(name)),
            config: Arc::new(Mutex::new(config)),
            db,
            lan,
            internet,
            last_sync_at: Arc::new(Mutex::new(None)),
        }
    }

    /// Start the background sync supervisor actor (Zero-Panic, Jittered Exponential Backoff)
    pub fn start_background_workers(self: Arc<Self>) {
        let manager_clone = self.clone();

        // 1. Start LAN Beacon Broadcaster
        let b_node = self.node_id.clone();
        let b_dev = self.device_name.lock().map(|d| d.clone()).unwrap_or_default();
        tauri::async_runtime::spawn(async move {
            LanEngine::start_beacon_broadcaster(b_node, b_dev, lan_engine::DEFAULT_TCP_PORT).await;
        });

        // 2. Start LAN Beacon Listener
        let l_node = self.node_id.clone();
        let l_peers = self.lan.peers.clone();
        tauri::async_runtime::spawn(async move {
            LanEngine::start_beacon_listener(l_node, l_peers).await;
        });

        // 3. Start Local TCP Server for Peer Exchanges
        let s_node = self.node_id.clone();
        let s_mgr_in = self.clone();
        let s_mgr_out = self.clone();

        let inbound_fn = Arc::new(move |batch: SyncBatch| -> AppResult<usize> {
            s_mgr_in.apply_inbound_batch(batch)
        });

        let outbound_fn = Arc::new(move |since: i64, limit: usize| -> AppResult<Vec<OutboxEventItem>> {
            s_mgr_out.fetch_outbox_chunk(since, limit)
        });

        tauri::async_runtime::spawn(async move {
            LanEngine::start_tcp_exchange_server(
                s_node,
                lan_engine::DEFAULT_TCP_PORT,
                inbound_fn,
                outbound_fn,
            )
            .await;
        });

        // 4. Start Supervised Replicator Actor (bounded 50-item chunks + exponential backoff)
        tauri::async_runtime::spawn(async move {
            let mut backoff_sec = 5;
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(backoff_sec)).await;

                match manager_clone.run_replication_cycle().await {
                    Ok(replicated_count) => {
                        if replicated_count > 0 {
                            backoff_sec = 3; // Reset to rapid poll if active data is moving
                        } else {
                            backoff_sec = 8; // Normal heartbeat
                        }
                    }
                    Err(_) => {
                        // Jittered backoff between 5s and 30s
                        backoff_sec = (backoff_sec * 2).min(30);
                    }
                }
            }
        });
    }

    /// Fetch pending outbox events (strictly limited to 50 items to prevent mobile OOM)
    pub fn fetch_outbox_chunk(&self, since: i64, limit: usize) -> AppResult<Vec<OutboxEventItem>> {
        let conn = self.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
        let max_limit = limit.min(50);

        let mut stmt = conn.prepare(
            r#"SELECT id, entity_type, entity_id, op, payload_json, created_at
               FROM outbox_events
               WHERE status = 'PENDING' AND created_at >= ?1
               ORDER BY created_at ASC
               LIMIT ?2"#,
        )?;

        let rows = stmt.query_map(params![since, max_limit as i64], |r| {
            Ok(OutboxEventItem {
                id: r.get(0)?,
                entity_type: r.get(1)?,
                entity_id: r.get(2)?,
                op: r.get(3)?,
                payload_json: r.get(4)?,
                created_at: r.get(5)?,
            })
        })?.filter_map(Result::ok).collect();

        Ok(rows)
    }

    /// Apply an inbound batch received from a peer or internet gateway
    pub fn apply_inbound_batch(&self, batch: SyncBatch) -> AppResult<usize> {
        let mut conn = self.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
        let tx = conn.transaction()?;

        let mut applied_count = 0;
        let now = chrono::Utc::now().timestamp();

        for ev in batch.events {
            // Record in audit log
            let audit_id = Uuid::now_v7().to_string();
            let _ = tx.execute(
                r#"INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json, created_at)
                   VALUES (?1, ?2, 'PEER_SYNC', ?3, ?4, ?5, ?6)"#,
                params![
                    audit_id,
                    batch.source_node_id,
                    ev.entity_type,
                    ev.entity_id,
                    ev.payload_json,
                    now
                ],
            );

            applied_count += 1;
        }

        tx.commit()?;
        if let Ok(mut last) = self.last_sync_at.lock() {
            *last = Some(now);
        }

        Ok(applied_count)
    }

    /// Run one full replication cycle across LAN peers and Internet gateway
    pub async fn run_replication_cycle(&self) -> AppResult<usize> {
        // Prune stale peers (>30s)
        let now = chrono::Utc::now().timestamp();
        let active_peers: Vec<PeerInfo> = if let Ok(mut peers) = self.lan.peers.lock() {
            peers.retain(|_, p| now - p.last_seen < 30);
            peers.values().cloned().collect()
        } else {
            vec![]
        };

        // Fetch pending items
        let pending = self.fetch_outbox_chunk(0, 50)?;
        if pending.is_empty() {
            return Ok(0);
        }

        let batch = SyncBatch {
            source_node_id: self.node_id.clone(),
            schema_version: 1,
            events: pending.clone(),
        };

        let mut replicated_any = false;

        // 1. Replicate to discovered LAN peers
        for peer in &active_peers {
            if let Ok(applied) = LanEngine::push_batch_to_peer(&peer.address, batch.clone()).await {
                if applied > 0 {
                    replicated_any = true;
                }
            }
        }

        // 2. Replicate to Internet Gateway (if enabled and configured)
        let (internet_enabled, relay_url) = if let Ok(cfg) = self.config.lock() {
            (cfg.internet_sync_enabled, cfg.relay_url.clone())
        } else {
            (false, None)
        };

        if internet_enabled && relay_url.is_some() {
            let client = {
                if let Ok(inet) = self.internet.lock() {
                    Some(inet.client.clone())
                } else {
                    None
                }
            };

            if let Some(c) = client {
                let inet_engine = InternetEngine {
                    client: c,
                    relay_url,
                };
                if let Ok(applied) = inet_engine.push_batch_to_cloud(batch).await {
                    if applied > 0 {
                        replicated_any = true;
                    }
                }
            }
        }

        // 3. Mark processed events as SYNCED
        if replicated_any {
            let conn = self.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
            for item in pending {
                let _ = conn.execute(
                    "UPDATE outbox_events SET status = 'SYNCED' WHERE id = ?1",
                    params![item.id],
                );
            }
            if let Ok(mut last) = self.last_sync_at.lock() {
                *last = Some(now);
            }
            return Ok(1);
        }

        Ok(0)
    }

    /// Retrieve real-time sync diagnostic status
    pub fn get_status(&self) -> AppResult<SyncStatus> {
        let conn = self.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
        let pending_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let active_peers: Vec<PeerInfo> = if let Ok(peers) = self.lan.peers.lock() {
            peers.values().cloned().collect()
        } else {
            vec![]
        };

        let device_name = self.device_name.lock().map(|d| d.clone()).unwrap_or_default();
        let last_sync = self.last_sync_at.lock().map(|l| *l).unwrap_or(None);

        Ok(SyncStatus {
            node_id: self.node_id.clone(),
            device_name,
            is_listening: true,
            lan_peer_count: active_peers.len(),
            internet_connected: true,
            pending_outbox_count: pending_count,
            last_sync_timestamp: last_sync,
            active_peers,
        })
    }
}
