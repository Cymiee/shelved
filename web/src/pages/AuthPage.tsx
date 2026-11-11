import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useIsMobile } from "../hooks/useIsMobile";
import GameCover from "../components/GameCover";

const COVER_IMAGES = [
  { id: "co4jni", name: "Elden Ring" },
  { id: "coaes9", name: "Hollow Knight" },
  { id: "coaarl", name: "The Witcher 3" },
  { id: "co1q1f", name: "Red Dead Redemption 2" },
  { id: "co9j3v", name: "Disco Elysium" },
  { id: "co4rs3", name: "Hades" },
  { id: "cob9dh", name: "Celeste" },
  { id: "coa93h", name: "Stardew Valley" },
];

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const fromPath = searchParams.get("from");

  const [mode, setMode] = useState<"login" | "signup" | "reset">(initialMode);
  // Phase 1 signup is two steps: 1 = email, 2 = username + password.
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { login, register, requestPasswordReset, loading } = useAuthStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  function extractMessage(err: unknown): string {
    const raw =
      err instanceof Error ? err.message
      : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message)
      : "";
    if (!raw) return "Something went wrong. Please try again.";
    // Supabase's wording reads like a system error; say it the way a person would.
    if (/invalid login credentials/i.test(raw)) return "Wrong email or password.";
    if (/email not confirmed/i.test(raw)) return "Confirm your email first — check your inbox for the link.";
    return raw;
  }

  function switchMode(next: "login" | "signup" | "reset") {
    setMode(next);
    setError(null);
    setConfirmationSent(false);
    setResetSent(false);
    setSignupStep(1);
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(extractMessage(err));
    }
  }

  function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setSignupStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmationSent(false);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      if (mode === "login") {
        await login(email, password);
        navigate(fromPath ?? "/");
      } else {
        const { needsConfirmation } = await register(email, password, username);
        if (needsConfirmation) {
          setConfirmationSent(true);
        } else {
          navigate(fromPath ?? "/");
        }
      }
    } catch (err) {
      setError(extractMessage(err));
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

  const submitStyle: React.CSSProperties = {
    background: "var(--grad-brand)",
    color: "var(--on-accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "0.85rem",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    marginTop: "0.75rem",
    width: "100%",
    boxShadow: "var(--glow-soft)",
  };

  // Staggered load animation for the form fields. Index drives the delay.
  const riseStyle = (i: number): React.CSSProperties => ({ animationDelay: `${i * 60}ms` });

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        height: isMobile ? "auto" : "100vh",
        overflow: isMobile ? "visible" : "hidden",
      }}
    >
      {/* ── Left panel (brand) — hidden on mobile ── */}
      {!isMobile && (
      <div
        style={{
          flex: 1,
          // no fill: the pegboard wall shows through on this side
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Centre content — bottom padding keeps it clear of the cover shelf */}
        <div style={{ position: "relative", padding: "0 3.5rem 9rem" }}>
          <Link className="wordmark auth-rise" to="/" aria-label="Shelved, home" style={{ marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: "1.375rem" }}>Shelved</span>
          </Link>

          <h1
            className="auth-rise"
            style={{
              fontFamily: "var(--font-display)",
              fontStretch: "106%",
              fontSize: "clamp(2.25rem, 4vw, 3.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-5)",
              lineHeight: 0.98,
              maxWidth: "12ch",
              ...riseStyle(1),
            }}
          >
            Every game you&rsquo;ve played, on one shelf.
          </h1>

          <ul
            className="auth-rise"
            style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)", ...riseStyle(2) }}
          >
            {[
              "Log every game you play",
              "Show off your top 3",
              "See what your friends are playing",
            ].map((text) => (
              <li
                key={text}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-base)",
                  color: "var(--text-secondary)",
                  display: "flex",
                  gap: "var(--space-3)",
                  alignItems: "center",
                  lineHeight: 1.5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                  <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Shelf — covers displayed on a divider line, fading off-screen */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "2.75rem",
            left: 0,
            right: 0,
            // Fade both edges so the library reads as continuing off-screen
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
            maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "flex-end",
              padding: "0 3.5rem",
              paddingBottom: "0.6rem",
            }}
          >
            {COVER_IMAGES.map((cover) => (
              <div
                key={cover.id}
                className="auth-cover on-plank"
                style={{ width: 62, flexShrink: 0 }}
              >
                <GameCover name={cover.name} imageId={cover.id} size="cover_small" rounding="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── Right panel ── */}
      <div
        style={{
          flex: 1,
          background: "var(--bg-base)",
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "center",
          padding: isMobile ? "2.5rem 1.25rem" : "2rem",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Compact wordmark replaces the hidden brand panel on mobile */}
          {isMobile && (
            <Link className="wordmark" to="/" aria-label="Shelved, home" style={{ marginBottom: "var(--space-6)" }}>
              <span style={{ fontSize: "1.25rem" }}>Shelved</span>
            </Link>
          )}
          {/* "Sign in to continue" banner */}
          {fromPath && (
            <div
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-ring)",
                borderRadius: "var(--radius-sm)",
                padding: "0.4rem 0.8rem",
                fontSize: 13,
                color: "var(--accent)",
                marginBottom: "1.5rem",
                textAlign: "center",
              }}
            >
              Sign in to continue
            </div>
          )}

          {/* Auth card — subtly lighter than the page */}
          <div
            className="auth-rise"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              padding: isMobile ? "1.5rem 1.25rem" : "2rem",
            }}
          >
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem" }}>
            {(["login", "signup"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchMode(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: mode === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  color: mode === tab ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  fontWeight: mode === tab ? 600 : 400,
                  padding: "0 0 0.4rem",
                  transition: "color 0.15s, border-color 0.15s",
                  fontFamily: "var(--font-body)",
                }}
              >
                {tab === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* ── Sign in ── */}
          {mode === "login" && (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
            >
              <input
                className="auth-input auth-rise"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ ...fieldStyle, ...riseStyle(1) }}
              />
              <input
                className="auth-input auth-rise"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...fieldStyle, ...riseStyle(2) }}
              />

              {error && (
                <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>
              )}

              <button
                className="auth-submit auth-rise"
                type="submit"
                disabled={loading}
                style={{ ...submitStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Loading…" : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("reset")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-body)",
                  padding: 0,
                  alignSelf: "center",
                }}
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* ── Reset password: email only ── */}
          {mode === "reset" && (
            <form
              onSubmit={handleResetRequest}
              style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
            >
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 0.25rem", lineHeight: 1.5 }}>
                Enter your email and we&apos;ll send a link to set a new password.
              </p>
              <input
                className="auth-input auth-rise"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={{ ...fieldStyle, ...riseStyle(1) }}
              />

              {error && (
                <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>
              )}

              {resetSent ? (
                <p style={{ color: "var(--success)", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
                  If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
                </p>
              ) : (
                <button
                  className="auth-submit auth-rise"
                  type="submit"
                  disabled={loading}
                  style={{ ...submitStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              )}

              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-body)",
                  padding: 0,
                }}
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* ── Sign up · Step 1: email ── */}
          {mode === "signup" && signupStep === 1 && (
            <form
              onSubmit={handleEmailContinue}
              style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
            >
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 0.25rem" }}>
                Step 1 of 2: your email
              </p>
              <input
                className="auth-input auth-rise"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={{ ...fieldStyle, ...riseStyle(1) }}
              />

              {error && (
                <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>
              )}

              <button className="auth-submit auth-rise" type="submit" style={submitStyle}>
                Continue
              </button>

              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                By signing up you agree to our Terms of Service
              </p>
            </form>
          )}

          {/* ── Sign up · Step 2: username + password ── */}
          {mode === "signup" && signupStep === 2 && (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
            >
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 0.25rem" }}>
                Step 2 of 2: pick a username and password
              </p>
              <input
                className="auth-input auth-rise"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                style={{ ...fieldStyle, ...riseStyle(0) }}
              />
              <input
                className="auth-input auth-rise"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...fieldStyle, ...riseStyle(1) }}
              />
              <input
                className="auth-input auth-rise"
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ ...fieldStyle, ...riseStyle(2) }}
              />

              {error && (
                <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>
              )}

              {confirmationSent && (
                <p style={{ color: "var(--success)", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
                  Check your email to confirm your account, then sign in.
                </p>
              )}

              {!confirmationSent && (
                <button
                  className="auth-submit auth-rise"
                  type="submit"
                  disabled={loading}
                  style={{ ...submitStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Loading…" : "Create account"}
                </button>
              )}

              {!confirmationSent && (
                <button
                  type="button"
                  onClick={() => { setError(null); setSignupStep(1); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontFamily: "var(--font-body)",
                    padding: 0,
                  }}
                >
                  ← Back
                </button>
              )}
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
