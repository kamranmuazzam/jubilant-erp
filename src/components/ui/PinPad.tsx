import { createSignal, For } from "solid-js";

interface PinPadProps {
  onComplete: (pin: string) => void;
  isLoading?: boolean;
}

export function PinPad(props: PinPadProps) {
  const [pin, setPin] = createSignal("");

  const handleDigit = (digit: string) => {
    if (props.isLoading || pin().length >= 6) return;
    const nextPin = pin() + digit;
    setPin(nextPin);
    if (nextPin.length === 4) {
      props.onComplete(nextPin);
    }
  };

  const handleBackspace = () => {
    if (props.isLoading) return;
    setPin(pin().slice(0, -1));
  };

  const handleClear = () => {
    if (props.isLoading) return;
    setPin("");
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

  return (
    <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", gap: "1.25rem", width: "100%", "max-width": "300px" }}>
      {/* PIN Dots Display */}
      <div style={{ display: "flex", gap: "0.75rem", "margin-bottom": "0.5rem" }}>
        <For each={[0, 1, 2, 3]}>
          {(i) => (
            <div
              style={{
                width: "16px",
                height: "16px",
                "border-radius": "50%",
                border: "2px solid var(--erp-primary)",
                background: pin().length > i ? "var(--erp-primary)" : "transparent",
                transition: "all 0.15s ease",
              }}
            />
          )}
        </For>
      </div>

      {/* Keypad Grid */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "0.75rem", width: "100%" }}>
        <For each={digits}>
          {(key) => (
            <button
              type="button"
              disabled={props.isLoading}
              onClick={() => {
                if (key === "C") handleClear();
                else if (key === "⌫") handleBackspace();
                else handleDigit(key);
              }}
              style={{
                height: "56px",
                "font-size": "1.35rem",
                "font-weight": "600",
                "border-radius": "var(--erp-radius-md)",
                border: "1px solid var(--erp-border-subtle)",
                background: key === "C" || key === "⌫" ? "var(--erp-bg-card-subtle)" : "var(--erp-bg-card)",
                color: key === "C" ? "var(--erp-danger)" : "var(--erp-text-main)",
                cursor: props.isLoading ? "not-allowed" : "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                transition: "all 0.1s ease",
                "touch-action": "manipulation",
                "user-select": "none",
                "-webkit-user-select": "none",
              }}
            >
              {key}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
