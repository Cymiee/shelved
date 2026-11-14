import { Link } from "react-router-dom";
import type { IGDBGame, ReviewNotification } from "@gameboxd/lib";
import Avatar from "./Avatar";
import GameCover from "./GameCover";
import { timeAgo } from "../lib/format";
import { color, font, space } from "../theme";

export interface NotificationItem {
  notification: ReviewNotification;
  game: Pick<IGDBGame, "id" | "name" | "cover"> | undefined;
}

interface Props {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Incoming friend requests, surfaced here because there is no other inbox. */
  pendingRequests: number;
  items: NotificationItem[];
}

const wallCard: React.CSSProperties = {
  background: color.bgCard,
  borderRadius: "var(--radius-lg)",
};

/**
 * The Notifications page, as a pure view. Friend requests come first because
 * they are waiting on an answer; likes and comments follow, newest first.
 */
export default function NotificationsView({ loading, error, onRetry, pendingRequests, items }: Props) {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header style={{ marginBottom: space[6] }}>
        <h1
          style={{
            fontFamily: font.display,
            fontStretch: "104%",
            fontSize: "clamp(2rem, 6vw, 3.25rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Notifications
        </h1>
      </header>

      <div style={{ maxWidth: 640 }}>
        {pendingRequests > 0 && (
          <div
            style={{
              ...wallCard,
              border: `1.5px solid ${color.borderStrong}`,
              padding: space[4],
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: space[3],
              marginBottom: space[6],
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {pendingRequests === 1 ? "1 friend request waiting" : `${pendingRequests} friend requests waiting`}
            </span>
            <Link className="btn-key btn-key--sm" to="/friends">
              Review requests
            </Link>
          </div>
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading notifications" style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{
                  ...wallCard,
                  border: `1.5px solid ${color.border}`,
                  height: 64,
                  animation: "skeletonPulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
        ) : error ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: space[3] }}>
            <p style={{ color: color.textSecondary }}>Couldn&rsquo;t load your notifications.</p>
            <button type="button" className="btn-key btn-key--wall btn-key--sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              ...wallCard,
              border: `1.5px dashed ${color.borderStrong}`,
              padding: space[5],
            }}
          >
            <h2 style={{ fontFamily: font.display, fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
              Nothing new
            </h2>
            <p style={{ margin: `${space[2]} 0 0`, color: color.textSecondary, maxWidth: "50ch" }}>
              When someone likes or comments on one of your logs, it shows up here.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: space[2] }}>
            {items.map((item) => (
              <NotificationRow key={`${item.notification.kind}-${item.notification.logId}-${item.notification.actor.id}-${item.notification.createdAt}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const { notification: n, game } = item;
  const profileTo = `/profile/${n.actor.id}`;

  return (
    <li
      style={{
        ...wallCard,
        border: `1.5px solid ${n.unseen ? "var(--sticker-pink)" : color.border}`,
        padding: "0.7rem 0.85rem",
        display: "flex",
        gap: space[3],
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <Link to={profileTo} style={{ display: "flex", flexShrink: 0 }} aria-label={n.actor.username}>
        <Avatar username={n.actor.username} avatarUrl={n.actor.avatar_url} size={38} variant="solid" />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ lineHeight: 1.35, overflowWrap: "anywhere" }}>
          {n.unseen && <span className="visually-hidden">New: </span>}
          <Link to={profileTo} style={{ fontWeight: 700, color: color.text }}>{n.actor.username}</Link>
          {n.kind === "like" ? " liked your log of " : " commented on your log of "}
          {game ? (
            <Link to={`/game/${game.id}`} style={{ fontWeight: 700, color: color.text }}>{game.name}</Link>
          ) : (
            "one of your logs"
          )}
        </p>

        {n.kind === "comment" && n.body && (
          <p
            style={{
              marginTop: 2,
              color: color.textSecondary,
              fontSize: "var(--text-sm)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {n.body}
          </p>
        )}

        <p style={{ marginTop: 4, display: "flex", alignItems: "center", gap: space[2], color: color.textMuted, fontSize: "var(--text-xs)" }}>
          <span>{timeAgo(n.createdAt)}</span>
          {n.unseen && (
            <span
              aria-hidden
              style={{
                padding: "1px 7px",
                borderRadius: 4,
                background: "var(--sticker-pink)",
                color: "var(--ink)",
                fontSize: "0.6875rem",
                fontWeight: 800,
              }}
            >
              New
            </span>
          )}
        </p>
      </div>

      {game && (
        <Link to={`/game/${game.id}`} style={{ width: 40, flexShrink: 0 }} aria-label={game.name}>
          <GameCover
            name={game.name}
            imageId={game.cover?.image_id}
            size="cover_small"
            rounding="sm"
          />
        </Link>
      )}
    </li>
  );
}
