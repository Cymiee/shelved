import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReviewWithUser, IGDBGame } from "@gameboxd/lib";
import Avatar from "./Avatar";
import GameCover from "./GameCover";
import StatusChip from "./StatusChip";
import { timeAgo } from "../lib/format";
import { color, font, space } from "../theme";

interface Props {
  review: ReviewWithUser;
  /** The game being reviewed. Omit when the card sits on that game's own page. */
  game?: Pick<IGDBGame, "id" | "name" | "cover"> | undefined;
  /** Characters shown before the "Read more" fold. */
  excerptLength?: number;
}

/**
 * A review as a social post: who wrote it leads, then what they played, then
 * their words. Used on Home (community feed) and GamePage (per-game reviews).
 */
export default function ReviewCard({ review, game, excerptLength = 220 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { user } = review;
  const long = review.review.length > excerptLength;
  const body = expanded || !long ? review.review : review.review.slice(0, excerptLength).trimEnd() + "…";

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
      {/* Author row — the face comes first, like any social post */}
      <header style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
        <Link to={`/profile/${user.id}`} style={{ display: "flex", flexShrink: 0 }} aria-label={user.username}>
          <Avatar username={user.username} avatarUrl={user.avatar_url} size={36} />
        </Link>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
          <Link
            to={`/profile/${user.id}`}
            style={{
              color: color.text,
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.username}
          </Link>
          <span style={{ fontSize: "var(--text-xs)", color: color.textMuted }}>
            {timeAgo(review.updated_at)}
          </span>
        </div>
        {review.rating != null && (
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
            aria-label={`Rated ${review.rating} out of 10`}
          >
            {review.rating}
            <span style={{ fontSize: "var(--text-xs)", color: color.textMuted, fontFamily: font.body, fontWeight: 600 }}>/10</span>
          </span>
        )}
      </header>

      {/* Game row — only when the card isn't already on that game's page */}
      {game && (
        <Link
          to={`/game/${game.id}`}
          style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0, color: "inherit" }}
        >
          <div style={{ width: 40, flexShrink: 0 }}>
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
            <span><StatusChip status={review.status} size="sm" /></span>
          </div>
        </Link>
      )}
      {!game && (
        <span><StatusChip status={review.status} size="sm" /></span>
      )}

      {/* The words */}
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
    </article>
  );
}
