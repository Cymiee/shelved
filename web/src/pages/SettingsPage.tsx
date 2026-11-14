import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToastStore } from "../store/toast";
import ProfileSettings from "../components/settings/ProfileSettings";
import TasteSettings from "../components/settings/TasteSettings";
import SteamSettings from "../components/settings/SteamSettings";
import AccountSettings from "../components/settings/AccountSettings";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "taste", label: "Taste" },
  { id: "steam", label: "Steam" },
  { id: "password", label: "Password" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

const isSection = (value: string | null): value is Section => SECTIONS.some((s) => s.id === value);

/** Messages for the `reason` the steam-auth function sends back on a failed link. */
const STEAM_ERRORS: Record<string, string> = {
  expired: "Linking took too long. Try again.",
  unverified: "Steam couldn't confirm the sign-in. Try again.",
  no_steamid: "Steam didn't send back an account. Try again.",
  already_linked: "That Steam account is linked to another Shelved account.",
  save_failed: "Couldn't save the link. Try again.",
  server: "Something went wrong on our side. Try again shortly.",
};

/**
 * Settings, one section at a time. Each section saves on its own and reports
 * success with a toast, so nothing on another tab is lost or saved by surprise.
 * The open section lives in the URL (?section=steam) so links can point at it.
 */
export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const showToast = useToastStore((s) => s.show);
  const [steamLinkError, setSteamLinkError] = useState<string | null>(null);

  const requested = params.get("section");
  const section: Section = params.get("steam") ? "steam" : isSection(requested) ? requested : "profile";

  // Steam sends the browser back here with ?steam=linked|error&reason=...
  useEffect(() => {
    const result = params.get("steam");
    if (!result) return;
    if (result === "linked") {
      showToast("Steam account linked. Sync to import your library.");
    } else {
      setSteamLinkError(STEAM_ERRORS[params.get("reason") ?? ""] ?? "Couldn't link Steam. Try again.");
    }
    // Clear the result so a refresh doesn't repeat it, and stay on the Steam section.
    setParams({ section: "steam" }, { replace: true });
  }, [params, setParams, showToast]);

  const changePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const open = (id: Section) => setParams(id === "profile" ? {} : { section: id }, { replace: true });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontStretch: "104%",
          fontSize: "clamp(2rem, 6vw, 3.25rem)",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: "var(--space-5)",
        }}
      >
        Settings
      </h1>

      <div className="segmented" role="tablist" aria-label="Settings sections" style={{ marginBottom: "var(--space-5)", maxWidth: "100%", overflowX: "auto" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            aria-pressed={section === s.id}
            onClick={() => open(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {section === "profile" && <ProfileSettings />}
        {section === "taste" && <TasteSettings />}
        {section === "steam" && <SteamSettings key={steamLinkError ?? "steam"} linkError={steamLinkError} />}
        {section === "password" && <AccountSettings onChangePassword={changePassword} />}
      </div>
    </div>
  );
}
