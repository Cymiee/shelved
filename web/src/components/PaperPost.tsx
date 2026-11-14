import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GameStatus, IGDBGame, UserRow } from "@gameboxd/lib";
import Avatar from "./Avatar";
import GameCover from "./GameCover";
import StatusChip from "./StatusChip";
import RatingSticker from "./Sticker";
import ReviewThread from "./ReviewThread";
import { useAuthStore } from "../store/auth";
import { useEngagement, useEngagementStore } from "../store/engagement";
import { useToastStore } from "../store/toast";
import { color, font, space } from "../theme";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.7 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.3 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.5-5A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

interface Props {
  user: Pick<UserRow, "id" | "username" | "avatar_url">;
  /** What they did, after their name: "reviewed", "started playing". Omit for a plain byline. */
  verb?: string | undefined;
  /** Already-formatted relative time. */
  time: string;
  rating?: number | null | undefined;
  /** The game this is about. Omit when the card sits on that game's own page. */
  game?: Pick<IGDBGame, "id" | "name" | "cover"> | undefined;
  status?: GameStatus | null | undefined;
  /** Their words. */
  body?: string | null | undefined;
  /** Characters of body shown before the "Read more" fold. */
  excerptLength?: number;
  /** The game_logs row this card is about. Without it the card has no likes or comments. */
  logId?: string | undefined;
  /** Who wrote it; people can't like their own log. */
  ownerId?: string | undefined;
}

/**
 * Something a person wrote or did, as a paper card taped to the shop wall —
 * the way staff picks get pinned beside a shelf. Paper is reserved for people:
 * catalogue content stays on the navy wall, so the two never get confused.
 *
 * The one layout behind both ReviewCard and ActivityCard.
 */
export default function PaperPost({ user, verb, time, rating, game, status, body, excerptLength = 220, logId, ownerId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const engagement = useEngagement(logId);
  const userId = useAuthStore((s) => s.userId);
  const toggleLike = useEngagementStore((s) => s.toggleLike);
  const showToast = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const location = useLocation();
  const own = userId != null && ownerId === userId;

  async function onLike() {
    if (!logId) return;
    if (!userId) {
      navigate(`/auth?from=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    try {
      await toggleLike(logId);
    } catch {
      showToast("Couldn't save your like. Try again.");
    }
  }

  const long = body != null && body.length > excerptLength;
  const shown = body == null ? null : expanded || !long ? body : body.slice(0, excerptLength).trimEnd() + "…";

  return (
    <article
      className="paper"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: space[3],
        padding: `${space[5]} ${space[4]} ${space[4]}`,
        minWidth: 0,
      }}
    >
      {rating != null && (
        <RatingSticker rating={rating} size={42} tilt={9} style={{ position: "absolute", top: -12, right: -8 }} />
      )}

      {/* Who — the face comes first, like any social post */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: space[3],
          minWidth: 0,
          // keep the byline clear of the sticker in the corner
          paddingRight: rating != null ? 34 : 0,
        }}
      >
        <Link to={`/profile/${user.id}`} style={{ display: "flex", flexShrink: 0 }} aria-label={user.username}>
          <Avatar username={user.username} avatarUrl={user.avatar_url} size={36} variant="solid" />
        </Link>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: color.inkSoft,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <Link to={`/profile/${user.id}`} style={{ fontWeight: 700 }}>
              {user.username}
            </Link>
            {verb ? ` ${verb}` : null}
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: color.inkSoft }}>{time}</span>
        </div>
      </header>

      {/* What */}
      {game ? (
        <Link
          to={`/game/${game.id}`}
          style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0, textDecoration: "none" }}
        >
          <div style={{ width: 46, flexShrink: 0 }}>
            <GameCover name={game.name} imageId={game.cover?.image_id} size="cover_small" rounding="sm" />
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
            <span
              style={{
                fontFamily: font.display,
                fontStretch: "80%",
                fontWeight: 800,
                fontSize: "var(--text-lg)",
                lineHeight: 1.1,
                maxWidth: "100%",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {game.name}
            </span>
            {status && <StatusChip status={status} size="sm" />}
          </div>
        </Link>
      ) : (
        status && (
          <span>
            <StatusChip status={status} size="sm" />
          </span>
        )
      )}

      {/* Their words */}
      {shown && (
        <p
          style={{
            margin: 0,
            paddingTop: space[3],
            borderTop: `1px dashed ${color.inkFaint}`,
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {shown}
          {long && (
            <>
              {" "}
              <button type="button" className="paper-link" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Read more"}
              </button>
            </>
          )}
        </p>
      )}

      {/* Likes and comments; absent until counts load so the card never jumps */}
      {logId && engagement && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: space[2] }}>
            <button
              type="button"
              className="paper-action"
              aria-pressed={engagement.likedByMe}
              aria-label={`${engagement.likedByMe ? "Unlike" : "Like"}, ${engagement.likes} ${engagement.likes === 1 ? "like" : "likes"}`}
              disabled={own}
              {...(own ? { title: "You can't like your own log" } : {})}
              onClick={() => void onLike()}
            >
              <HeartIcon filled={engagement.likedByMe} />
              {engagement.likes > 0 && <span>{engagement.likes}</span>}
            </button>
            <button
              type="button"
              className="paper-action"
              aria-expanded={threadOpen}
              aria-label={`Comments, ${engagement.comments}`}
              onClick={() => setThreadOpen((v) => !v)}
            >
              <CommentIcon />
              {engagement.comments > 0 && <span>{engagement.comments}</span>}
            </button>
          </div>
          {threadOpen && <ReviewThread logId={logId} />}
        </>
      )}
    </article>
  );
}
