import { createSignal, Show } from "solid-js";
import { api, UserProfile } from "../../../api/client";
import { PinPad } from "../../ui/PinPad";
import { IconShield, IconAlert, IconCheck, IconDatabase } from "../../ui/Icons";

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export function LoginView(props: LoginViewProps) {
  const [mode, setMode] = createSignal<"password" | "pin">("password");
  const [email, setEmail] = createSignal("admin@jubilant.com");
  const [password, setPassword] = createSignal("admin123");
  const [showPassword, setShowPassword] = createSignal(false);
  const [rememberMe, setRememberMe] = createSignal(true);
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const handlePasswordLogin = async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await api.loginWithPassword(email(), password());
      props.onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async (pin: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await api.loginWithPin(pin);
      props.onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid security PIN");
    } finally {
      setIsLoading(false);
    }
  };

  const setRole = (mail: string, pass: string) => {
    setEmail(mail);
    setPassword(pass);
    setMode("password");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        background: "var(--erp-bg-canvas)",
      }}
    >
      {/* Left Warm Editorial Brand Showcase */}
      <div
        style={{
          flex: "1",
          background: "var(--erp-bg-sidebar)",
          color: "var(--erp-text-main)",
          display: "flex",
          "flex-direction": "column",
          "justify-content": "space-between",
          padding: "3.5rem 3rem",
          "border-right": "1px solid var(--erp-border-subtle)",
        }}
      >
        <div>
          <div style={{ display: "flex", "align-items": "center", gap: "0.75rem", "margin-bottom": "3rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                "border-radius": "6px",
                background: "#d97706",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "font-weight": "800",
                "font-size": "18px",
                color: "#ffffff",
                "box-shadow": "0 2px 4px rgba(217, 119, 6, 0.2)",
              }}
            >
              J
            </div>
            <div>
              <div style={{ "font-weight": "700", "font-size": "17px", "letter-spacing": "-0.01em", color: "var(--erp-text-main)" }}>Jubilant ERP</div>
              <div style={{ "font-size": "11.5px", color: "var(--erp-text-secondary)" }}>Enterprise Accounting & Operations</div>
            </div>
          </div>

          <div style={{ "max-width": "460px" }}>
            <div
              style={{
                display: "inline-block",
                padding: "0.25rem 0.625rem",
                background: "var(--erp-primary-faint)",
                border: "1px solid var(--erp-primary-border)",
                "border-radius": "4px",
                "font-size": "11px",
                "font-weight": "700",
                color: "var(--erp-primary)",
                "margin-bottom": "1rem",
              }}
            >
              NEPAL TAX COMPLIANCE & IRD COMPATIBLE
            </div>
            <h2 style={{ "font-size": "26px", "font-weight": "700", "line-height": "1.3", "margin-bottom": "1rem", "letter-spacing": "-0.02em", color: "var(--erp-text-main)" }}>
              Unified financial ledgers, statutory VAT & multi-godown logistics.
            </h2>
            <p style={{ "font-size": "13.5px", color: "var(--erp-text-secondary)", "line-height": "1.6" }}>
              Secure offline-first architecture powered by embedded SQLite WAL mode. Perform double-entry bookkeeping, issue IRD Sales Books (अनुसूची १३), track technician AMC field operations, and manage payroll.
            </p>
          </div>
        </div>

        <div style={{ "border-top": "1px solid var(--erp-border-subtle)", "padding-top": "1.5rem" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "1.5rem", "font-size": "12px", color: "var(--erp-text-muted)" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "0.375rem" }}>
              <span style={{ width: "6px", height: "6px", "border-radius": "50%", background: "#059669" }}></span>
              <span style={{ "font-weight": "600", color: "var(--erp-text-secondary)" }}>Embedded SQLite</span>
            </div>
            <div>Nepal VAT 13%</div>
            <div>Fiscal Year 2081/82</div>
          </div>
        </div>
      </div>

      {/* Right Login Form Pane */}
      <div
        style={{
          width: "480px",
          display: "flex",
          "flex-direction": "column",
          "justify-content": "center",
          padding: "3.5rem",
          background: "var(--erp-bg-canvas)",
          "overflow-y": "auto",
        }}
      >
        <div style={{ "max-width": "360px", width: "100%", margin: "0 auto" }}>
          <div style={{ "margin-bottom": "2rem" }}>
            <h3 style={{ "font-size": "20px", "font-weight": "700", color: "var(--erp-text-main)", "letter-spacing": "-0.01em" }}>
              Sign in to Workstation
            </h3>
            <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)", "margin-top": "0.25rem" }}>
              Please enter your authorized credentials to continue.
            </p>
          </div>

          {/* Mode Switcher */}
          <div class="erp-tabs" style={{ "margin-bottom": "1.5rem" }}>
            <button
              type="button"
              class={`erp-tab-btn ${mode() === "password" ? "active" : ""}`}
              style={{ flex: 1, "text-align": "center" }}
              onClick={() => setMode("password")}
            >
              Email & Password
            </button>
            <button
              type="button"
              class={`erp-tab-btn ${mode() === "pin" ? "active" : ""}`}
              style={{ flex: 1, "text-align": "center" }}
              onClick={() => setMode("pin")}
            >
              Kiosk / Field PIN
            </button>
          </div>

          <Show when={errorMessage()}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "0.5rem",
                padding: "0.625rem 0.75rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                "border-radius": "5px",
                color: "#dc2626",
                "font-size": "12px",
                "margin-bottom": "1.25rem",
              }}
            >
              <IconAlert size={14} />
              <span>{errorMessage()}</span>
            </div>
          </Show>

          <Show
            when={mode() === "password"}
            fallback={
              <div style={{ "text-align": "center" }}>
                <p style={{ "font-size": "12px", color: "#64748b", "margin-bottom": "1rem" }}>
                  Enter your 4-digit PIN for rapid authentication:
                </p>
                <PinPad onComplete={handlePinLogin} length={4} />
              </div>
            }
          >
            <form onSubmit={handlePasswordLogin} style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
              <div class="erp-form-group">
                <label class="erp-label">Corporate Email</label>
                <input
                  type="email"
                  required
                  class="erp-input"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  placeholder="admin@jubilant.com"
                />
              </div>

              <div class="erp-form-group">
                <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                  <label class="erp-label">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    style={{ background: "none", border: "none", "font-size": "11px", color: "#2563eb", cursor: "pointer" }}
                  >
                    {showPassword() ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword() ? "text" : "password"}
                  required
                  class="erp-input"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                />
              </div>

              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "font-size": "12px" }}>
                <label style={{ display: "flex", "align-items": "center", gap: "0.375rem", color: "#475569", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe()}
                    onChange={(e) => setRememberMe(e.currentTarget.checked)}
                    style={{ width: "auto" }}
                  />
                  <span>Keep session active</span>
                </label>
                <span style={{ color: "#64748b", "font-size": "11.5px" }}>Local Security</span>
              </div>

              <button
                type="submit"
                disabled={isLoading()}
                class="erp-btn erp-btn-primary"
                style={{ width: "100%", padding: "0.5625rem", "margin-top": "0.5rem", "font-size": "13px" }}
              >
                {isLoading() ? "Verifying..." : "Sign In to ERP"}
              </button>
            </form>
          </Show>

          {/* Quick Department Role Selector */}
          <div style={{ "margin-top": "2rem", "border-top": "1px solid var(--erp-border-subtle)", "padding-top": "1.25rem" }}>
            <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--erp-text-muted)", "text-transform": "uppercase", "letter-spacing": "0.05em", "margin-bottom": "0.625rem" }}>
              Switch Test Role
            </div>
            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.375rem" }}>
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                style={{ "font-size": "11px", "justify-content": "flex-start" }}
                onClick={() => setRole("admin@jubilant.com", "admin123")}
              >
                System Admin
              </button>
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                style={{ "font-size": "11px", "justify-content": "flex-start" }}
                onClick={() => setRole("ramesh.acc@jubilant.com", "acc123")}
              >
                Accountant
              </button>
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                style={{ "font-size": "11px", "justify-content": "flex-start" }}
                onClick={() => setRole("bikash.tech@jubilant.com", "tech123")}
              >
                Field Technician
              </button>
              <button
                type="button"
                class="erp-btn erp-btn-secondary erp-btn-sm"
                style={{ "font-size": "11px", "justify-content": "flex-start" }}
                onClick={() => setRole("suresh.wh@jubilant.com", "wh123")}
              >
                Warehouse Head
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
