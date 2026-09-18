import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

/**
 * Where the emailed reset link lands. Supabase signs the user in from the
 * link's token before this renders, so all that's left is the new password.
 * With no session (expired or reused link) it explains and points back.
 */
export default function ResetPasswordPage() {
  const { userId, updatePassword, loading } = useAuthStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: "var(--bg-inset)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "0.8rem 0.95rem",
    color: "var(--text-primary)",
    fontSize: "0.95rem",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 16px",
        background: "var(--bg-base)",
      }}
    >
      <div
        className="auth-rise"
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          padding: "2rem",
        }}
      >
        <div
          className="grad-text"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-5)",
            lineHeight: 1,
          }}
        >
          Shelved
        </div>

        {userId ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
              Choose a new password for your account.
            </p>
            <input
              className="auth-input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              style={fieldStyle}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={fieldStyle}
            />
            {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>}
            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
              style={{
                background: "var(--grad-brand)",
                color: "var(--on-accent)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "0.85rem",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontSize: "0.95rem",
                fontWeight: 600,
                fontFamily: "var(--font-body)",
                boxShadow: "var(--glow-soft)",
              }}
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              This reset link has expired or was already used. Request a new one from the sign-in page.
            </p>
            <Link to="/auth" style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
