import { useState } from "react";
import { updateProfile, upsertProfileTags, MIN_GENRES } from "@gameboxd/lib";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import { useToastStore } from "../../store/toast";
import { presetAvatarUrl } from "../Avatar";
import AvatarSelect from "../onboarding/AvatarSelect";
import GenreSelect from "../onboarding/GenreSelect";
import ArchetypeSelect from "../onboarding/ArchetypeSelect";
import { SettingsCard, Field, FormError, describeSaveError } from "./SettingsParts";

export default function TasteSettings() {
  const userId = useAuthStore((s) => s.userId);
  const profileTags = useAuthStore((s) => s.profileTags);
  const setProfileTags = useAuthStore((s) => s.setProfileTags);
  const setProfile = useAuthStore((s) => s.setProfile);
  const showToast = useToastStore((s) => s.show);

  const [avatarId, setAvatarId] = useState<string | null>(profileTags?.avatar_id ?? null);
  const [genres, setGenres] = useState<string[]>(profileTags?.genres ?? []);
  const [archetypes, setArchetypes] = useState<string[]>(profileTags?.archetypes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (genres.length > 0 && genres.length < MIN_GENRES) {
      setError(`Pick at least ${MIN_GENRES} ${MIN_GENRES === 1 ? "genre" : "genres"}, or clear them all.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertProfileTags(supabase, userId, { avatar_id: avatarId, genres, archetypes });
      setProfileTags(saved);
      // Mirror the chosen preset into avatar_url so it shows everywhere.
      if (avatarId) {
        setProfile(await updateProfile(supabase, userId, { avatar_url: presetAvatarUrl(avatarId) }));
      }
      showToast("Taste saved");
    } catch (err) {
      setError(describeSaveError(err, "Couldn't save your taste. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Taste" intro="Your avatar and what you like to play. Recommendations on Home use your genres.">
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Field label="Avatar">
          <AvatarSelect value={avatarId} onChange={setAvatarId} />
        </Field>
        <Field label="Favourite genres">
          <GenreSelect value={genres} onChange={setGenres} />
        </Field>
        <Field label="What kind of player are you?">
          <ArchetypeSelect value={archetypes} onChange={setArchetypes} />
        </Field>

        <FormError message={error} />
        <div>
          <button type="submit" className="btn-key" disabled={saving}>
            {saving ? "Saving…" : "Save taste"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
