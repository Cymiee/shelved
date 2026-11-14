import { useState } from "react";

interface EditProfileFormProps {
  initialBio: string;
  initialAvatarUrl: string;
  saving: boolean;
  onSave: (values: { bio: string; avatarUrl: string }) => void;
  onCancel: () => void;
}

/** Inline bio + avatar URL form. Owns the draft values; the page owns saving. */
export default function EditProfileForm({ initialBio, initialAvatarUrl, saving, onSave, onCancel }: EditProfileFormProps) {
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem",
        marginBottom: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div>
        <label className="label" htmlFor="profile-bio" style={{ display: "block", marginBottom: 4 }}>Bio</label>
        <textarea
          id="profile-bio"
          className="field"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          style={{ width: "100%", padding: "0.5rem 0.7rem", resize: "vertical" }}
        />
      </div>
      <div>
        <label className="label" htmlFor="profile-avatar-url" style={{ display: "block", marginBottom: 4 }}>Avatar URL</label>
        <input
          id="profile-avatar-url"
          className="field"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          style={{ width: "100%", padding: "0.5rem 0.7rem" }}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          className="btn-key btn-key--sm"
          onClick={() => onSave({ bio, avatarUrl })}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn-key btn-key--wall btn-key--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
