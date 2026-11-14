import type { ReactNode } from "react";
import type { UserRow } from "@gameboxd/lib";
import Avatar from "../Avatar";
import CountUp from "../CountUp";
import { EditIcon } from "../icons";

export interface ProfileStats {
  logged: number;
  avgRating: string | null;
  reviews: number;
}

interface ProfileHeaderProps {
  profile: UserRow;
  stats: ProfileStats;
  isOwn: boolean;
  /** Whether a viewer is signed in; friend actions are hidden otherwise. */
  signedIn: boolean;
  editing: boolean;
  /** Rendered in place of the "Edit profile" button while editing. */
  editForm: ReactNode;
  isFriend: boolean;
  requestSent: boolean;
  friendActionLoading: boolean;
  onEditAvatar: () => void;
  onStartEdit: () => void;
  onAddFriend: () => void;
}

// Same box as `.btn-key--sm`, for status chips that aren't clickable.
const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.45rem 0.8rem",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-display)",
  fontWeight: 800,
  fontSize: "0.8125rem",
  lineHeight: 1.2,
} as const;

export default function ProfileHeader({
  profile, stats, isOwn, signedIn, editing, editForm, isFriend, requestSent,
  friendActionLoading, onEditAvatar, onStartEdit, onAddFriend,
}: ProfileHeaderProps) {
  return (
    <>
      <div className="reveal" style={{ marginBottom: "var(--space-5)" }}>
        <div className="reveal-pop" style={{ position: "relative", marginBottom: "var(--space-4)", width: 76 }}>
          <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={76} />
          {isOwn && (
            <button
              type="button"
              onClick={onEditAvatar}
              aria-label="Edit avatar"
              title="Edit avatar"
              className="press"
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "var(--on-accent)",
                border: "2px solid var(--bg-base)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <EditIcon size={14} />
            </button>
          )}
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStretch: "100%",
            fontWeight: 900,
            fontSize: "var(--text-2xl)",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "var(--space-2)",
            lineHeight: 1.1,
            overflowWrap: "anywhere",
          }}
        >
          {profile.username}
        </h1>

        {profile.bio && (
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginBottom: "var(--space-3)",
            }}
          >
            {profile.bio}
          </p>
        )}

        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <CountUp value={stats.logged} /> {stats.logged === 1 ? "game" : "games"}
          {stats.avgRating && `, ${stats.avgRating} average`}
          {stats.reviews > 0 && `, ${stats.reviews} ${stats.reviews === 1 ? "review" : "reviews"}`}
        </p>
      </div>

      {isOwn ? (
        editing ? (
          editForm
        ) : (
          <button
            type="button"
            className="btn-key btn-key--wall btn-key--sm"
            onClick={onStartEdit}
            style={{ marginBottom: "1.25rem" }}
          >
            Edit profile
          </button>
        )
      ) : signedIn ? (
        <div style={{ marginBottom: "1.25rem" }}>
          {isFriend ? (
            <span
              style={{
                ...chipStyle,
                background: "var(--accent-dim)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              Friends
            </span>
          ) : requestSent ? (
            <span
              style={{
                ...chipStyle,
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Request sent
            </span>
          ) : (
            <button
              type="button"
              className="btn-key btn-key--sm"
              onClick={onAddFriend}
              disabled={friendActionLoading}
            >
              Add friend
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}
