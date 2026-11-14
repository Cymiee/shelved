import { useState } from "react";
import { useToastStore } from "../../store/toast";
import { SettingsCard, Field, FormError } from "./SettingsParts";

// Same minimum as sign-up and password reset. To raise it, change it in
// Supabase (Authentication settings) so every path enforces it, then here.
const PASSWORD_MIN = 6;

interface Props {
  /** Sets the new password. The page owns the auth call: per CLAUDE.md only it may use supabase.auth. */
  onChangePassword: (password: string) => Promise<void>;
}

export default function AccountSettings({ onChangePassword }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onChangePassword(password);
      setPassword("");
      setConfirm("");
      showToast("Password changed");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't change your password. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Password" intro="Choose a new password for signing in.">
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <Field label="New password" htmlFor="settings-password" hint={`At least ${PASSWORD_MIN} characters.`}>
          <input
            id="settings-password"
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.75rem" }}
          />
        </Field>
        <Field label="Type it again" htmlFor="settings-password-confirm">
          <input
            id="settings-password-confirm"
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.75rem" }}
          />
        </Field>

        <FormError message={error} />
        <div>
          <button type="submit" className="btn-key" disabled={saving || !password}>
            {saving ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
