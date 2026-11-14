import { color, space } from "../../theme";

/** One settings section: a titled card with a short line on what it is for. */
export function SettingsCard({ title, intro, children }: { title: string; intro?: string | undefined; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: color.bgCard,
        border: `1.5px solid ${color.border}`,
        borderRadius: "var(--radius-lg)",
        padding: space[5],
        display: "flex",
        flexDirection: "column",
        gap: space[5],
      }}
    >
      <header>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>{title}</h2>
        {intro && <p style={{ marginTop: space[1], color: color.textSecondary, fontSize: "var(--text-sm)", maxWidth: "56ch" }}>{intro}</p>}
      </header>
      {children}
    </section>
  );
}

/** A labelled field. `hint` sits under the control, e.g. a length limit. */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string | undefined; hint?: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor} style={{ display: "block", marginBottom: space[2] }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ marginTop: 6, fontSize: "var(--text-xs)", color: color.textMuted }}>{hint}</p>}
    </div>
  );
}

/** An inline error under a form. Successes go to a toast instead. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
      {message}
    </p>
  );
}

/** Turn a Supabase/Postgres error into something a person can act on. */
export function describeSaveError(error: unknown, fallback: string): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "23505") return "That username is taken. Try another.";
  if (code === "23514") return "One of those is too long. Shorten it and save again.";
  return error instanceof Error && error.message ? error.message : fallback;
}
