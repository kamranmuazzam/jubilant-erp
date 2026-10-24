import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface ProgressPayload {
  downloaded: number;
  total: number;
  percentage: number;
  status: string;
}

export function UpdateBanner() {
  const [downloadProgress, setDownloadProgress] = createSignal<number | null>(null);
  const [statusMessage, setStatusMessage] = createSignal<string>("");
  let unlisten: UnlistenFn | undefined;

  onMount(async () => {
    try {
      unlisten = await listen<ProgressPayload>("tauri://download-progress", (event) => {
        setDownloadProgress(event.payload.percentage);
        if (event.payload.status === "finished") {
          setStatusMessage("Download complete. Ready to install.");
        } else {
          setStatusMessage(`Downloading update: ${event.payload.percentage}%`);
        }
      });
    } catch {
      // Ignored on platforms without tauri event bridge
    }
  });

  onCleanup(() => {
    if (unlisten) unlisten();
  });

  return (
    <Show when={downloadProgress() !== null}>
      <div
        class="glass-panel"
        style={{
          position: "fixed",
          bottom: "1rem",
          right: "1rem",
          padding: "0.75rem 1.25rem",
          "border-radius": "var(--radius-md)",
          "box-shadow": "var(--shadow-md)",
          "z-index": "1000",
          display: "flex",
          "flex-direction": "column",
          gap: "0.5rem",
          "min-width": "260px",
        }}
      >
        <div style={{ display: "flex", "justify-content": "space-between", "font-size": "0.8125rem", "font-weight": "600" }}>
          <span>{statusMessage()}</span>
          <span>{downloadProgress()}%</span>
        </div>
        <div
          style={{
            height: "6px",
            width: "100%",
            background: "var(--bg-surface-elevated)",
            "border-radius": "var(--radius-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${downloadProgress()}%`,
              background: "var(--primary)",
              transition: "width 0.2s ease",
            }}
          />
        </div>
      </div>
    </Show>
  );
}
