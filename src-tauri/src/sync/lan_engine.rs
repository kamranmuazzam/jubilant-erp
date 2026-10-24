use super::types::{OutboxEventItem, PeerInfo, SyncBatch};
use crate::error::AppResult;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream, UdpSocket};

pub const DEFAULT_UDP_PORT: u16 = 49152;
pub const DEFAULT_TCP_PORT: u16 = 49153;

pub struct LanEngine {
    pub node_id: String,
    pub device_name: String,
    pub peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    pub tcp_port: u16,
}

impl LanEngine {
    pub fn new(node_id: String, device_name: String) -> Self {
        Self {
            node_id,
            device_name,
            peers: Arc::new(Mutex::new(HashMap::new())),
            tcp_port: DEFAULT_TCP_PORT,
        }
    }

    /// Broadcast presence on local network via UDP
    pub async fn start_beacon_broadcaster(
        node_id: String,
        device_name: String,
        tcp_port: u16,
    ) {
        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[LAN Sync] Beacon socket bind failed: {}", e);
                return;
            }
        };

        let _ = socket.set_broadcast(true);
        let broadcast_addr = format!("255.255.255.255:{}", DEFAULT_UDP_PORT);

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        loop {
            interval.tick().await;

            let payload = serde_json::json!({
                "node_id": node_id,
                "device_name": device_name,
                "tcp_port": tcp_port,
                "schema_version": 1,
            });

            if let Ok(bytes) = serde_json::to_vec(&payload) {
                let _ = socket.send_to(&bytes, &broadcast_addr).await;
            }
        }
    }

    /// Listen for peer announcements on local network via UDP
    pub async fn start_beacon_listener(
        self_node_id: String,
        peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    ) {
        let socket = match UdpSocket::bind(format!("0.0.0.0:{}", DEFAULT_UDP_PORT)).await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[LAN Sync] Listener bind to port {} failed (another instance may own it): {}", DEFAULT_UDP_PORT, e);
                return;
            }
        };

        let mut buf = [0u8; 1024];
        loop {
            match socket.recv_from(&mut buf).await {
                Ok((len, src_addr)) => {
                    if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&buf[..len]) {
                        if let (Some(node_id), Some(device_name), Some(tcp_port)) = (
                            val.get("node_id").and_then(|v| v.as_str()),
                            val.get("device_name").and_then(|v| v.as_str()),
                            val.get("tcp_port").and_then(|v| v.as_u64()),
                        ) {
                            if node_id != self_node_id {
                                let peer_ip = src_addr.ip().to_string();
                                let peer_addr = format!("{}:{}", peer_ip, tcp_port);
                                let now = chrono::Utc::now().timestamp();

                                if let Ok(mut map) = peers.lock() {
                                    map.insert(
                                        node_id.to_string(),
                                        PeerInfo {
                                            node_id: node_id.to_string(),
                                            device_name: device_name.to_string(),
                                            address: peer_addr,
                                            is_lan: true,
                                            last_seen: now,
                                            schema_version: val.get("schema_version").and_then(|v| v.as_u64()).unwrap_or(1) as u32,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    /// Start lightweight local TCP exchange server for peer-to-peer sync
    pub async fn start_tcp_exchange_server(
        node_id: String,
        port: u16,
        inbound_handler: Arc<dyn Fn(SyncBatch) -> AppResult<usize> + Send + Sync>,
        outbound_fetcher: Arc<dyn Fn(i64, usize) -> AppResult<Vec<OutboxEventItem>> + Send + Sync>,
    ) {
        let listener = match TcpListener::bind(format!("0.0.0.0:{}", port)).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[LAN Sync] TCP server bind to port {} failed: {}", port, e);
                return;
            }
        };

        loop {
            match listener.accept().await {
                Ok((mut socket, _)) => {
                    let self_id = node_id.clone();
                    let in_handler = inbound_handler.clone();
                    let out_fetcher = outbound_fetcher.clone();

                    tauri::async_runtime::spawn(async move {
                        let mut length_buf = [0u8; 4];
                        if socket.read_exact(&mut length_buf).await.is_err() {
                            return;
                        }
                        let msg_len = u32::from_be_bytes(length_buf) as usize;
                        if msg_len > 10 * 1024 * 1024 {
                            // Reject packets exceeding 10MB as safety guard
                            return;
                        }

                        let mut body_buf = vec![0u8; msg_len];
                        if socket.read_exact(&mut body_buf).await.is_err() {
                            return;
                        }

                        if let Ok(request_val) = serde_json::from_slice::<serde_json::Value>(&body_buf) {
                            let action = request_val.get("action").and_then(|v| v.as_str()).unwrap_or("");
                            let mut response = serde_json::json!({ "status": "ERROR" });

                            match action {
                                "HANDSHAKE" => {
                                    response = serde_json::json!({
                                        "status": "OK",
                                        "node_id": self_id,
                                        "schema_version": 1,
                                    });
                                }
                                "PUSH_BATCH" => {
                                    if let Some(batch_val) = request_val.get("batch") {
                                        if let Ok(batch) = serde_json::from_value::<SyncBatch>(batch_val.clone()) {
                                            match in_handler(batch) {
                                                Ok(applied_count) => {
                                                    response = serde_json::json!({
                                                        "status": "OK",
                                                        "applied_count": applied_count,
                                                    });
                                                }
                                                Err(e) => {
                                                    response = serde_json::json!({
                                                        "status": "REJECTED",
                                                        "error": e.message,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                                "PULL_BATCH" => {
                                    let since = request_val.get("since").and_then(|v| v.as_i64()).unwrap_or(0);
                                    let limit = request_val.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize;
                                    match out_fetcher(since, limit.min(50)) {
                                        Ok(items) => {
                                            response = serde_json::json!({
                                                "status": "OK",
                                                "events": items,
                                            });
                                        }
                                        Err(e) => {
                                            response = serde_json::json!({
                                                "status": "ERROR",
                                                "error": e.message,
                                            });
                                        }
                                    }
                                }
                                _ => {}
                            }

                            if let Ok(res_bytes) = serde_json::to_vec(&response) {
                                let res_len = (res_bytes.len() as u32).to_be_bytes();
                                let _ = socket.write_all(&res_len).await;
                                let _ = socket.write_all(&res_bytes).await;
                            }
                        }
                    });
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                }
            }
        }
    }

    /// Push a bounded batch (max 50 items) to a remote LAN peer
    pub async fn push_batch_to_peer(
        peer_addr: &str,
        batch: SyncBatch,
    ) -> Result<usize, String> {
        let addr: SocketAddr = peer_addr.parse().map_err(|e| format!("Invalid peer address: {}", e))?;
        let mut stream = tokio::time::timeout(
            tokio::time::Duration::from_secs(3),
            TcpStream::connect(addr),
        )
        .await
        .map_err(|_| "Connection timed out".to_string())?
        .map_err(|e| format!("Failed to connect to peer: {}", e))?;

        let request = serde_json::json!({
            "action": "PUSH_BATCH",
            "batch": batch,
        });

        let req_bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        let req_len = (req_bytes.len() as u32).to_be_bytes();

        stream.write_all(&req_len).await.map_err(|e| e.to_string())?;
        stream.write_all(&req_bytes).await.map_err(|e| e.to_string())?;

        // Read response
        let mut len_buf = [0u8; 4];
        stream.read_exact(&mut len_buf).await.map_err(|e| e.to_string())?;
        let resp_len = u32::from_be_bytes(len_buf) as usize;

        let mut resp_buf = vec![0u8; resp_len];
        stream.read_exact(&mut resp_buf).await.map_err(|e| e.to_string())?;

        let resp_val: serde_json::Value = serde_json::from_slice(&resp_buf).map_err(|e| e.to_string())?;
        if resp_val.get("status").and_then(|v| v.as_str()) == Some("OK") {
            let applied = resp_val.get("applied_count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            Ok(applied)
        } else {
            let err = resp_val.get("error").and_then(|v| v.as_str()).unwrap_or("Peer rejected batch");
            Err(err.to_string())
        }
    }
}
