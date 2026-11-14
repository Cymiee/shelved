import { useState } from "react";
import { unlinkSteam, importSteamLogs } from "@gameboxd/lib";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import { useGamesStore } from "../../store/games";
import { useToastStore } from "../../store/toast";
import { startSteamLink, syncSteam } from "../../lib/steam";
import { SettingsCard, FormError } from "./SettingsParts";

interface Props {
  /** Result of a link round trip, read from the URL by the page. */
  linkError: string | null;
}

const syncedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function SteamSettings({ linkError }: Props) {
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const fetchLogs = useGamesStore((s) => s.fetchLogs);
  const showToast = useToastStore((s) => s.show);

  const [busy, setBusy] = useState<"link" | "sync" | "unlink" | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [error, setError] = useState<string | null>(linkError);

  const handleLink = async () => {
    setError(null);
    setBusy("link");
    try {
      await startSteamLink(); // leaves the page for Steam
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start Steam sign-in. Try again.");
      setBusy(null);
    }
  };

  // One tap: refresh the Steam library, add played games to the shelf, and
  // reload the in-app logs so they appear without a refresh.
  const handleSync = async () => {
    setError(null);
    setBusy("sync");
    try {
      const { owned } = await syncSteam();
      const { imported, updated } = await importSteamLogs(supabase);
      await fetchLogs();
      if (profile) setProfile({ ...profile, steam_synced_at: new Date().toISOString() });
      const hours = updated ? `, and updated hours on ${updated}` : "";
      showToast(`Synced ${owned} games. Added ${imported} to your shelf${hours}.`, { to: "/shelf", label: "View" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Steam sync failed. Try again shortly.");
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async () => {
    if (!userId) return;
    setError(null);
    setBusy("unlink");
    try {
      setProfile(await unlinkSteam(supabase, userId));
      setConfirmUnlink(false);
      showToast("Steam account unlinked");
    } catch {
      setError("Couldn't unlink Steam. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsCard
      title="Steam"
      intro="Import your Steam library and hours played. Your Steam profile's game details need to be public."
    >
      {profile?.steam_id ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ fontSize: "var(--text-sm)" }}>
            <span style={{ color: "var(--status-completed)", fontWeight: 700 }}>Linked</span>
            <span style={{ color: "var(--text-secondary)" }}> to Steam account {profile.steam_id}</span>
          </p>
          {profile.steam_synced_at && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Last synced {syncedAt.format(new Date(profile.steam_synced_at))}
            </p>
          )}
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "56ch" }}>
            Syncing adds games you've played to your shelf as &ldquo;Played&rdquo;. Games you already logged keep their status and rating.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
            <button type="button" className="btn-key" disabled={busy !== null} onClick={() => { void handleSync(); }}>
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </button>
            {!confirmUnlink && (
              <button type="button" className="btn-key btn-key--wall" disabled={busy !== null} onClick={() => setConfirmUnlink(true)}>
                Unlink
              </button>
            )}
          </div>

          {confirmUnlink && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                padding: "var(--space-3) var(--space-4)",
                border: "1.5px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span>Unlink Steam? Games already on your shelf stay there.</span>
              <span style={{ display: "flex", gap: "var(--space-2)" }}>
                <button type="button" className="btn-key btn-key--wall btn-key--sm" onClick={() => setConfirmUnlink(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn-key btn-key--wall btn-key--sm"
                  disabled={busy !== null}
                  onClick={() => { void handleUnlink(); }}
                  style={{ color: "var(--danger)" }}
                >
                  {busy === "unlink" ? "Unlinking…" : "Unlink"}
                </button>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button type="button" className="btn-key" disabled={busy !== null} onClick={() => { void handleLink(); }}>
            {busy === "link" ? "Opening Steam…" : "Link Steam account"}
          </button>
        </div>
      )}

      <FormError message={error} />
    </SettingsCard>
  );
}
