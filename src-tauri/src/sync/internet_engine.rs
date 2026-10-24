use super::types::{OutboxEventItem, SyncBatch};

pub struct InternetEngine {
    pub client: reqwest::Client,
    pub relay_url: Option<String>,
}

impl InternetEngine {
    pub fn new(relay_url: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .unwrap_or_default();

        Self { client, relay_url }
    }

    /// Check if remote cloud sync gateway is reachable
    pub async fn check_cloud_health(&self) -> bool {
        let base_url = match &self.relay_url {
            Some(u) if !u.trim().is_empty() => u,
            _ => return false,
        };

        let health_url = format!("{}/health", base_url.trim_end_matches('/'));
        match self.client.get(&health_url).send().await {
            Ok(res) => res.status().is_success(),
            Err(_) => false,
        }
    }

    /// Push pending delta batch to Internet sync relay gateway
    pub async fn push_batch_to_cloud(&self, batch: SyncBatch) -> Result<usize, String> {
        let base_url = match &self.relay_url {
            Some(u) if !u.trim().is_empty() => u,
            _ => return Err("No remote sync gateway configured".to_string()),
        };

        let push_url = format!("{}/api/v1/sync/push", base_url.trim_end_matches('/'));
        let res = self
            .client
            .post(&push_url)
            .json(&batch)
            .send()
            .await
            .map_err(|e| format!("Remote gateway error: {}", e))?;

        if res.status().is_success() {
            let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            let applied = val.get("applied_count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            Ok(applied)
        } else {
            Err(format!("Remote gateway returned status: {}", res.status()))
        }
    }

    /// Pull new delta events from Internet sync relay gateway
    pub async fn pull_batch_from_cloud(&self, since: i64, limit: usize) -> Result<Vec<OutboxEventItem>, String> {
        let base_url = match &self.relay_url {
            Some(u) if !u.trim().is_empty() => u,
            _ => return Err("No remote sync gateway configured".to_string()),
        };

        let pull_url = format!(
            "{}/api/v1/sync/pull?since={}&limit={}",
            base_url.trim_end_matches('/'),
            since,
            limit.min(50)
        );

        let res = self
            .client
            .get(&pull_url)
            .send()
            .await
            .map_err(|e| format!("Remote gateway pull error: {}", e))?;

        if res.status().is_success() {
            let events: Vec<OutboxEventItem> = res.json().await.map_err(|e| e.to_string())?;
            Ok(events)
        } else {
            Err(format!("Remote gateway returned status: {}", res.status()))
        }
    }
}
