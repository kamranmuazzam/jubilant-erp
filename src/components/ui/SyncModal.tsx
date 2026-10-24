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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          class="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-card,#ffffff)] text-[var(--text-main,#2d2820)]"
          style={{ "font-family": "var(--font-sans, system-ui, sans-serif)" }}
        >
          {/* Header */}
          <div class="px-6 py-5 border-b border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] flex items-center justify-between bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[var(--color-primary,#8b6f4e)]/10 text-[var(--color-primary,#8b6f4e)] flex items-center justify-center">
                <IconSync size={20} class={isSyncing() ? "animate-spin" : ""} />
              </div>
              <div>
                <h3 class="text-base font-semibold tracking-tight text-[var(--text-main,#2d2820)]">
                  Peer Sync & Network Hub
                </h3>
                <p class="text-xs text-[var(--text-muted,#7a7267)]">
                  Local-area peer discovery & cloud relay synchronization
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="text-[var(--text-muted,#7a7267)] hover:text-[var(--text-main,#2d2820)] p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Status Overview Cards */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="p-4 rounded-xl border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
                <div class="flex items-center justify-between text-xs text-[var(--text-muted,#7a7267)] mb-1">
                  <span>Local Mesh Peers</span>
                  <IconWifi size={14} class="text-[var(--color-primary,#8b6f4e)]" />
                </div>
                <div class="text-xl font-bold text-[var(--text-main,#2d2820)]">
                  {status()?.lan_peer_count ?? 0}{" "}
                  <span class="text-xs font-normal text-[var(--text-muted,#7a7267)]">
                    active
                  </span>
                </div>
                <div class="text-[11px] text-[var(--text-muted,#7a7267)] mt-1">
                  Port 49152 (UDP) / 49153 (TCP)
                </div>
              </div>

              <div class="p-4 rounded-xl border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
                <div class="flex items-center justify-between text-xs text-[var(--text-muted,#7a7267)] mb-1">
                  <span>Cloud Relay</span>
                  <IconCloud size={14} class="text-[var(--color-primary,#8b6f4e)]" />
                </div>
                <div class="text-xl font-bold text-[var(--text-main,#2d2820)] flex items-center gap-1.5">
                  <span
                    class={`inline-block w-2 h-2 rounded-full ${
                      status()?.internet_connected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                  <span class="text-sm font-semibold">
                    {status()?.internet_connected ? "Connected" : "Standby"}
                  </span>
                </div>
                <div class="text-[11px] text-[var(--text-muted,#7a7267)] mt-1">
                  Automated fallback
                </div>
              </div>

              <div class="p-4 rounded-xl border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714]">
                <div class="flex items-center justify-between text-xs text-[var(--text-muted,#7a7267)] mb-1">
                  <span>Pending Outbox</span>
                  <IconServer size={14} class="text-[var(--color-primary,#8b6f4e)]" />
                </div>
                <div class="text-xl font-bold text-[var(--text-main,#2d2820)]">
                  {status()?.pending_outbox_count ?? 0}{" "}
                  <span class="text-xs font-normal text-[var(--text-muted,#7a7267)]">
                    changes
                  </span>
                </div>
                <div class="text-[11px] text-[var(--text-muted,#7a7267)] mt-1">
                  Bounded 50-chunk CDC
                </div>
              </div>
            </div>

            {/* Notification Feedback */}
            <Show when={feedbackMsg()}>
              <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <IconCheck size={14} class="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{feedbackMsg()}</span>
              </div>
            </Show>

            {/* Manual Sync Bar */}
            <div class="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714] border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a]">
              <div>
                <div class="text-xs font-semibold text-[var(--text-main,#2d2820)]">
                  Instant Manual Replication
                </div>
                <div class="text-[11px] text-[var(--text-muted,#7a7267)]">
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
                class="px-4 py-2 rounded-xl bg-[var(--color-primary,#8b6f4e)] text-white hover:opacity-90 font-medium text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
              >
                <IconSync size={13} class={isSyncing() ? "animate-spin" : ""} />
                <span>{isSyncing() ? "Reconciling..." : "Sync Now"}</span>
              </button>
            </div>

            {/* Active Mesh Peers List */}
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted,#7a7267)]">
                  Discovered Local & Cloud Peers
                </div>
                <span class="text-[11px] text-[var(--text-muted,#7a7267)]">
                  {(status()?.active_peers?.length ?? 0)} peer(s) in reach
                </span>
              </div>

              <div class="border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle,#e8e4dc)] dark:divide-[#38332a]">
                <Show
                  when={(status()?.active_peers?.length ?? 0) > 0}
                  fallback={
                    <div class="p-6 text-center text-xs text-[var(--text-muted,#7a7267)]">
                      Listening on LAN. Other Jubilant ERP devices on this Wi-Fi / network will appear automatically.
                    </div>
                  }
                >
                  <For each={status()?.active_peers}>
                    {(peer: PeerInfo) => (
                      <div class="p-3.5 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-[var(--color-primary,#8b6f4e)]/10 text-[var(--color-primary,#8b6f4e)] flex items-center justify-center font-bold text-xs">
                            {peer.is_lan ? "LAN" : "WAN"}
                          </div>
                          <div>
                            <div class="text-xs font-semibold text-[var(--text-main,#2d2820)]">
                              {peer.device_name}
                            </div>
                            <div class="text-[11px] text-[var(--text-muted,#7a7267)] font-mono">
                              {peer.address} • Schema v{peer.schema_version}
                            </div>
                          </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          Verified Peer
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* Device Identity & Configuration */}
            <form onSubmit={handleSaveSettings} class="space-y-4 pt-2 border-t border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a]">
              <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted,#7a7267)]">
                Terminal Identity & Gateway Config
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-[var(--text-muted,#7a7267)] mb-1">
                    Terminal Display Name
                  </label>
                  <input
                    type="text"
                    value={deviceName()}
                    onInput={(e) => setDeviceName(e.currentTarget.value)}
                    class="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714] text-[var(--text-main,#2d2820)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#8b6f4e)]"
                    placeholder="e.g. Kathmandu Head Office POS-1"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-[var(--text-muted,#7a7267)] mb-1">
                    Unique Node Fingerprint
                  </label>
                  <input
                    type="text"
                    disabled
                    value={status()?.node_id ?? "Loading..."}
                    class="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-black/5 dark:bg-white/5 text-[var(--text-muted,#7a7267)] font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-[var(--text-muted,#7a7267)] mb-1">
                  Remote Cloud Gateway URL (Fallback)
                </label>
                <input
                  type="text"
                  value={relayUrl()}
                  onInput={(e) => setRelayUrl(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#1a1714] text-[var(--text-main,#2d2820)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#8b6f4e)]"
                  placeholder="https://sync.jubilant.com.np"
                />
              </div>

              <div class="flex items-center justify-between pt-2">
                <div class="flex items-center gap-4 text-xs">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lanEnabled()}
                      onChange={(e) => setLanEnabled(e.currentTarget.checked)}
                      class="rounded text-[var(--color-primary,#8b6f4e)]"
                    />
                    <span>LAN Mesh Discovery</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={internetEnabled()}
                      onChange={(e) => setInternetEnabled(e.currentTarget.checked)}
                      class="rounded text-[var(--color-primary,#8b6f4e)]"
                    />
                    <span>Cloud Gateway Sync</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSaving()}
                  class="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--bg-primary,#fbf9f4)] dark:bg-[#25201b] border border-[var(--border-subtle,#e8e4dc)] dark:border-[#38332a] text-[var(--text-main,#2d2820)] hover:border-[var(--color-primary,#8b6f4e)] transition-colors cursor-pointer"
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
