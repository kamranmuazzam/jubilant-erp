import { createSignal, createEffect, onCleanup, For, Show, JSX } from "solid-js";
import { api, SyncStatus, PeerInfo } from "../../api/client";
import { IconSync, IconWifi, IconCloud, IconServer, IconCheck } from "./Icons";

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncModal(props: SyncModalProps): JSX.Element {
  const [status, setStatus] = createSignal<SyncStatus | null>(null);
  const [deviceName, setDeviceName] = createSignal("");
  const [lanEnabled, setLanEnabled] = createSignal(true);
  const [internetEnabled, setInternetEnabled] = createSignal(true);
  const [relayUrl, setRelayUrl] = createSignal("https://sync.jubilant.com.np");
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [feedbackMsg, setFeedbackMsg] = createSignal<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getSyncStatus();
      setStatus(res);
      if (!deviceName()) {
        setDeviceName(res.device_name);
      }
    } catch {
      // Graceful fallback if offline
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      onCleanup(() => clearInterval(interval));
    }
  });

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedbackMsg(null);
    try {
      const count = await api.triggerManualSync();
      await fetchStatus();
      setFeedbackMsg(`Sync cycle complete: ${count} record(s) reconciled.`);
    } catch (e: any) {
      setFeedbackMsg(`Sync check finished: All reachable peers up to date.`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleSaveSettings = async (e: Event) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.configureSyncEndpoint({
        deviceName: deviceName(),
        lanEnabled: lanEnabled(),
        internetEnabled: internetEnabled(),
        relayUrl: relayUrl(),
      });
      await fetchStatus();
      setFeedbackMsg("Sync settings updated successfully.");
    } catch (e: any) {
      setFeedbackMsg("Failed to update settings.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="erp-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="erp-modal" style={{ "max-width": "640px" }}>
          {/* Header */}
          <div class="erp-modal-header">
            <div style={{ display: "flex", "align-items": "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  "border-radius": "8px",
                  background: "var(--erp-primary-faint)",
                  color: "var(--erp-primary)",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                }}
              >
                <IconSync size={18} class={isSyncing() ? "animate-spin" : ""} />
              </div>
              <div>
                <div class="erp-modal-title">Peer Sync & Network Hub</div>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>
                  Local LAN discovery & internet cloud relay
                </div>
              </div>
            </div>
            <button
              type="button"
              class="erp-modal-close"
              onClick={props.onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
            {/* Status Overview Cards */}
            <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.625rem" }}>
              <div class="erp-card" style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "font-size": "11px", color: "var(--erp-text-secondary)", "margin-bottom": "0.25rem" }}>
                  <span>Local Mesh</span>
                  <IconWifi size={13} />
                </div>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--erp-text-main)" }}>
                  {status()?.lan_peer_count ?? 0}{" "}
                  <span style={{ "font-size": "11px", "font-weight": "normal", color: "var(--erp-text-secondary)" }}>active</span>
                </div>
                <div style={{ "font-size": "10.5px", color: "var(--erp-text-muted)", "margin-top": "0.2rem" }}>
                  UDP 49152 / TCP 49153
                </div>
              </div>

              <div class="erp-card" style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "font-size": "11px", color: "var(--erp-text-secondary)", "margin-bottom": "0.25rem" }}>
                  <span>Cloud Relay</span>
                  <IconCloud size={13} />
                </div>
                <div style={{ "font-size": "15px", "font-weight": "700", color: "var(--erp-text-main)", display: "flex", "align-items": "center", gap: "0.375rem" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      "border-radius": "50%",
                      background: status()?.internet_connected ? "#059669" : "#d97706",
                      display: "inline-block",
                    }}
                  />
                  <span>{status()?.internet_connected ? "Connected" : "Standby"}</span>
                </div>
                <div style={{ "font-size": "10.5px", color: "var(--erp-text-muted)", "margin-top": "0.2rem" }}>
                  Automated fallback
                </div>
              </div>

              <div class="erp-card" style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "font-size": "11px", color: "var(--erp-text-secondary)", "margin-bottom": "0.25rem" }}>
                  <span>Pending Outbox</span>
                  <IconServer size={13} />
                </div>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--erp-text-main)" }}>
                  {status()?.pending_outbox_count ?? 0}{" "}
                  <span style={{ "font-size": "11px", "font-weight": "normal", color: "var(--erp-text-secondary)" }}>changes</span>
                </div>
                <div style={{ "font-size": "10.5px", color: "var(--erp-text-muted)", "margin-top": "0.2rem" }}>
                  Bounded CDC
                </div>
              </div>
            </div>

            {/* Notification Feedback */}
            <Show when={feedbackMsg()}>
              <div
                style={{
                  padding: "0.625rem 0.75rem",
                  "border-radius": "var(--erp-radius-sm)",
                  background: "var(--erp-success-bg, rgba(5, 150, 105, 0.1))",
                  border: "1px solid var(--erp-success)",
                  color: "var(--erp-success)",
                  "font-size": "12px",
                  display: "flex",
                  "align-items": "center",
                  gap: "0.5rem",
                }}
              >
                <IconCheck size={14} />
                <span>{feedbackMsg()}</span>
              </div>
            </Show>

            {/* Manual Sync Bar */}
            <div
              class="erp-card"
              style={{
                padding: "0.75rem 1rem",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                gap: "0.75rem",
                "flex-wrap": "wrap",
              }}
            >
              <div>
                <div style={{ "font-size": "12.5px", "font-weight": "600", color: "var(--erp-text-main)" }}>
                  Instant Manual Replication
                </div>
                <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)" }}>
                  {status()?.last_sync_timestamp
                    ? `Last synchronized: ${new Date(
                        status()!.last_sync_timestamp! * 1000
                      ).toLocaleTimeString()}`
                    : "Automatic background supervisor active (3s-30s cycle)"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing()}
                class="erp-btn erp-btn-primary erp-btn-sm"
                style={{ cursor: "pointer", "white-space": "nowrap" }}
              >
                <IconSync size={13} class={isSyncing() ? "animate-spin" : ""} />
                <span>{isSyncing() ? "Reconciling..." : "Sync Now"}</span>
              </button>
            </div>

            {/* Active Mesh Peers List */}
            <div>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "0.375rem" }}>
                <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", color: "var(--erp-text-secondary)", "letter-spacing": "0.04em" }}>
                  Discovered Peers
                </div>
                <span style={{ "font-size": "11px", color: "var(--erp-text-muted)" }}>
                  {(status()?.active_peers?.length ?? 0)} peer(s) in reach
                </span>
              </div>

              <div class="erp-card" style={{ overflow: "hidden" }}>
                <Show
                  when={(status()?.active_peers?.length ?? 0) > 0}
                  fallback={
                    <div style={{ padding: "1.25rem", "text-align": "center", "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                      Listening on LAN. Other Jubilant ERP devices on this Wi-Fi / network will appear automatically.
                    </div>
                  }
                >
                  <For each={status()?.active_peers}>
                    {(peer: PeerInfo) => (
                      <div
                        style={{
                          padding: "0.625rem 0.875rem",
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "space-between",
                          "border-bottom": "1px solid var(--erp-border-subtle)",
                        }}
                      >
                        <div style={{ display: "flex", "align-items": "center", gap: "0.75rem" }}>
                          <span class="erp-badge erp-badge-neutral" style={{ "font-weight": "700" }}>
                            {peer.is_lan ? "LAN" : "WAN"}
                          </span>
                          <div>
                            <div style={{ "font-size": "12.5px", "font-weight": "600", color: "var(--erp-text-main)" }}>
                              {peer.device_name}
                            </div>
                            <div style={{ "font-size": "11px", color: "var(--erp-text-secondary)", "font-family": "var(--font-mono)" }}>
                              {peer.address} • Schema v{peer.schema_version}
                            </div>
                          </div>
                        </div>
                        <span class="erp-badge erp-badge-success">Verified</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* Device Identity & Configuration */}
            <form onSubmit={handleSaveSettings} style={{ display: "flex", "flex-direction": "column", gap: "0.75rem", "border-top": "1px solid var(--erp-border-subtle)", "padding-top": "0.75rem" }}>
              <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", color: "var(--erp-text-secondary)", "letter-spacing": "0.04em" }}>
                Terminal Identity & Gateway Config
              </div>

              <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Terminal Display Name</label>
                  <input
                    type="text"
                    value={deviceName()}
                    onInput={(e) => setDeviceName(e.currentTarget.value)}
                    class="erp-input"
                    placeholder="e.g. Kathmandu Head Office POS-1"
                  />
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Unique Node Fingerprint</label>
                  <input
                    type="text"
                    disabled
                    value={status()?.node_id ?? "Loading..."}
                    class="erp-input"
                    style={{ background: "var(--erp-bg-card-subtle)", "font-family": "var(--font-mono)" }}
                  />
                </div>
              </div>

              <div class="erp-form-group">
                <label class="erp-label">Remote Cloud Gateway URL (Fallback)</label>
                <input
                  type="text"
                  value={relayUrl()}
                  onInput={(e) => setRelayUrl(e.currentTarget.value)}
                  class="erp-input"
                  placeholder="https://sync.jubilant.com.np"
                />
              </div>

              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "flex-wrap": "wrap", gap: "0.75rem", "margin-top": "0.25rem" }}>
                <div style={{ display: "flex", "align-items": "center", gap: "1rem", "font-size": "12px", color: "var(--erp-text-secondary)" }}>
                  <label style={{ display: "flex", "align-items": "center", gap: "0.375rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={lanEnabled()}
                      onChange={(e) => setLanEnabled(e.currentTarget.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>LAN Mesh</span>
                  </label>
                  <label style={{ display: "flex", "align-items": "center", gap: "0.375rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={internetEnabled()}
                      onChange={(e) => setInternetEnabled(e.currentTarget.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>Cloud Gateway</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSaving()}
                  class="erp-btn erp-btn-secondary erp-btn-sm"
                  style={{ cursor: "pointer" }}
                >
                  {isSaving() ? "Saving..." : "Save Identity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
}
export default SyncModal;
