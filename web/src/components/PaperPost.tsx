import { useState } from "react";
import { Link } from "react-router-dom";
import type { GameStatus, IGDBGame, UserRow } from "@gameboxd/lib";
import Avatar from "./Avatar";
import GameCover from "./GameCover";
import StatusChip from "./StatusChip";
import RatingSticker from "./Sticker";
import { color, font, space } from "../theme";

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
}

/**
 * Something a person wrote or did, as a paper card taped to the shop wall —
 * the way staff picks get pinned beside a shelf. Paper is reserved for people:
 * catalogue content stays on the navy wall, so the two never get confused.
 *
 * The one layout behind both ReviewCard and ActivityCard.
 */
export default function PaperPost({ user, verb, time, rating, game, status, body, excerptLength = 220 }: Props) {
  const [expanded, setExpanded] = useState(false);

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
    </article>
  );
}
