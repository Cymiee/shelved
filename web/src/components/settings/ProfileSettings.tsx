import { useState } from "react";
import { updateProfile, isAllowedAvatarUrl, AVATAR_URL_ERROR } from "@gameboxd/lib";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import { useToastStore } from "../../store/toast";
import { isPresetAvatar } from "../Avatar";
import { SettingsCard, Field, FormError, describeSaveError } from "./SettingsParts";

// Match the database limits, so the form stops people before the server does.
const USERNAME_MAX = 64;
const BIO_MAX = 1000;
const AVATAR_URL_MAX = 2000;

export default function ProfileSettings() {
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const showToast = useToastStore((s) => s.show);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  // A preset avatar is chosen under Taste; keep it out of the URL box.
  const [avatarUrl, setAvatarUrl] = useState(isPresetAvatar(profile?.avatar_url) ? "" : (profile?.avatar_url ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const name = username.trim();
    const url = avatarUrl.trim();
    if (!name) {
      setError("Add a username so people can find you.");
      return;
    }
    if (url && !isAllowedAvatarUrl(url)) {
      setError(AVATAR_URL_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(supabase, userId, {
        username: name,
        bio: bio.trim() || null,
        // An empty URL box shouldn't wipe a preset chosen under Taste.
        avatar_url: url || (isPresetAvatar(profile?.avatar_url) ? (profile?.avatar_url ?? null) : null),
      });
      setProfile(updated);
      showToast("Profile saved");
    } catch (err) {
      setError(describeSaveError(err, "Couldn't save your profile. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Profile" intro="How you appear to other people on Shelved.">
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <Field label="Username" htmlFor="settings-username">
          <input
            id="settings-username"
            className="field"
            value={username}
            maxLength={USERNAME_MAX}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.75rem" }}
          />
        </Field>
        <Field label="Bio" htmlFor="settings-bio" hint={`${bio.length} of ${BIO_MAX} characters`}>
          <textarea
            id="settings-bio"
            className="field"
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="What do you play?"
            onChange={(e) => setBio(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.75rem", resize: "vertical", lineHeight: 1.55 }}
          />
        </Field>
        <Field
          label="Avatar image link"
          htmlFor="settings-avatar"
          hint="Optional. Imgur, GitHub, Discord, Steam, Gravatar, Google or X links only. Leave it empty to use the avatar you picked under Taste."
        >
          <input
            id="settings-avatar"
            className="field"
            value={avatarUrl}
            maxLength={AVATAR_URL_MAX}
            inputMode="url"
            placeholder="https://"
            onChange={(e) => setAvatarUrl(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.75rem" }}
          />
        </Field>

        <FormError message={error} />
        <div>
          <button type="submit" className="btn-key" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
