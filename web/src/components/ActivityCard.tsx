import { useState } from "react";
import type { ActivityRow, UserRow, IGDBGame, GameLogRow, GameStatus } from "@gameboxd/lib";
import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import GameCover from "./GameCover";
import StatusChip from "./StatusChip";
import { STATUS_META, color, font, space } from "../theme";
import { timeAgo } from "../lib/format";

interface Props {
  activity: ActivityRow;
  user: Pick<UserRow, "id" | "username" | "avatar_url">;
  game: Pick<IGDBGame, "id" | "name" | "cover">;
  /**
   * The user's current log for this game, when the caller has it. Rating and
   * review then reflect the latest edit rather than the moment the activity
   * was written. Falls back to the activity's own metadata.
   */
  log?: Pick<GameLogRow, "status" | "rating" | "review"> | undefined;
  /** Characters of review shown before the "Read more" fold. */
  excerptLength?: number;
}

/** What the person did, phrased the way a friend would say it. */
function verb(activity: ActivityRow, status: GameStatus | null): string {
  switch (activity.type) {
    case "reviewed": return "reviewed";
    case "rated":    return "rated";
    case "topped":   return "added to their favourites";
    default:
      switch (status) {
        case "completed":    return "finished";
        case "played":       return "played";
        case "dropped":      return "dropped";
        case "playing":      return "started playing";
        case "want_to_play": return "wants to play";
        default:             return "logged";
      }
  }
}

function isStatus(value: unknown): value is GameStatus {
  return typeof value === "string" && value in STATUS_META;
}

/**
 * One item in the activity feed, laid out as a social post: the person first,
 * then the game, then their words. Same bones as ReviewCard so the feed and
 * the review lists read as one system.
 */
export default function ActivityCard({ activity, user, game, log, excerptLength = 200 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = activity.metadata;

  const status: GameStatus | null = log?.status ?? (isStatus(meta.status) ? meta.status : null);
  const rating: number | null =
    log?.rating ?? (typeof meta.rating === "number" ? meta.rating : null);
  const review: string | null =
    activity.type === "topped" ? null : (log?.review ?? (typeof meta.review === "string" ? meta.review : null)) || null;

  const long = review != null && review.length > excerptLength;
  const body = review == null ? null : expanded || !long ? review : review.slice(0, excerptLength).trimEnd() + "…";

  return (
    <article
      className="hover-glow"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: space[3],
        padding: space[4],
        background: color.bgCard,
        border: `1px solid ${color.border}`,
        borderRadius: "var(--radius-lg)",
        minWidth: 0,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
        <Link to={`/profile/${user.id}`} style={{ display: "flex", flexShrink: 0 }} aria-label={user.username}>
          <Avatar username={user.username} avatarUrl={user.avatar_url} size={36} />
        </Link>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: color.textSecondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <Link to={`/profile/${user.id}`} style={{ color: color.text, fontWeight: 600 }}>
              {user.username}
            </Link>{" "}
            {verb(activity, status)}
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: color.textMuted }}>
            {timeAgo(activity.created_at)}
          </span>
        </div>
        {rating != null && (
          <span
            style={{
              fontFamily: font.display,
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: color.accent,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              lineHeight: 1,
            }}
            aria-label={`Rated ${rating} out of 10`}
          >
            {rating}
            <span style={{ fontSize: "var(--text-xs)", color: color.textMuted, fontFamily: font.body, fontWeight: 600 }}>/10</span>
          </span>
        )}
      </header>

      <Link
        to={`/game/${game.id}`}
        style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0, color: "inherit" }}
      >
        <div style={{ width: 48, flexShrink: 0 }}>
          <GameCover name={game.name} imageId={game.cover?.image_id} size="cover_small" rounding="sm" />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: font.display,
              fontWeight: 600,
              fontSize: "var(--text-base)",
              color: color.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {game.name}
          </span>
          {status && activity.type !== "topped" && (
            <span><StatusChip status={status} size="sm" /></span>
          )}
        </div>
      </Link>

      {body && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            lineHeight: 1.65,
            color: color.textSecondary,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {body}
          {long && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: color.accent,
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            </>
          )}
        </p>
      )}
    </article>
  );
}
