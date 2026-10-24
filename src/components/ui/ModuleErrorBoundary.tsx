import { ErrorBoundary, JSX } from "solid-js";

interface ModuleErrorBoundaryProps {
  moduleName: string;
  children: JSX.Element;
}

export function ModuleErrorBoundary(props: ModuleErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div
          style={{
            padding: "2rem",
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            height: "100%",
            gap: "1rem",
            "text-align": "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              "border-radius": "50%",
              background: "var(--danger-faint)",
              color: "var(--danger)",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "font-size": "1.75rem",
              "font-weight": "bold",
            }}
          >
            !
          </div>
          <h2 style={{ "font-size": "1.25rem", "font-weight": "700" }}>
            {props.moduleName} Encountered an Error
          </h2>
          <p style={{ color: "var(--text-muted)", "max-width": "500px", "font-size": "0.875rem" }}>
            {String(err)}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="button" onClick={() => reset()} class="btn btn-primary">
              Reload {props.moduleName}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              class="btn btn-secondary"
            >
              Diagnostic Reset
            </button>
          </div>
        </div>
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
}
