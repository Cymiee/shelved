import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import GameCover from "./GameCover";
import { useNextGamePick, NextGamePickPanel } from "./NextGamePick";
import { color, font, space } from "../theme";

export interface WishlistItem {
  log: GameLogRow;
  game: IGDBGame;
}

interface Props {
  items: WishlistItem[];
  /** Game ids with a request in flight; their buttons are disabled. */
  busy: ReadonlySet<number>;
  /** Move straight to "Playing" — the one-tap way off the wishlist. */
  onStart: (game: IGDBGame) => void;
  /** Open the full log form (already finished it, want to rate it). */
  onLog: (game: IGDBGame) => void;
  onRemove: (game: IGDBGame) => void;
}

const SORTS = ["added", "name", "release", "score"] as const;
type Sort = (typeof SORTS)[number];

const SORT_LABEL: Record<Sort, string> = {
  added: "Recently added",
  name: "A to Z",
  release: "Newest release",
  score: "Best reviewed",
};

const releaseFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Release date in ms, or null when IGDB doesn't know. */
const releaseMs = (game: IGDBGame) => (game.first_release_date ? game.first_release_date * 1000 : null);

/**
 * The wishlist: games still "in the shop", face-out on shelves. Each one can
 * leave in a single tap ("Start playing"), and the picker answers the question
 * a backlog always raises: which one next?
 *
 * Pure view; the page container owns the data.
 */
export default function WishlistView({ items, busy, onStart, onLog, onRemove }: Props) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("added");

  const sorted = useMemo(() => {
    const list = [...items];
    switch (sort) {
      case "name":
        return list.sort((a, b) => a.game.name.localeCompare(b.game.name));
      case "release":
        return list.sort((a, b) => (releaseMs(b.game) ?? 0) - (releaseMs(a.game) ?? 0));
      case "score":
        return list.sort((a, b) => (b.game.total_rating ?? b.game.rating ?? 0) - (a.game.total_rating ?? a.game.rating ?? 0));
      default:
        return list.sort((a, b) => b.log.created_at.localeCompare(a.log.created_at));
    }
  }, [items, sort]);

  // Only games that are out can be "played next".
  const playable = useMemo(() => {
    const now = Date.now();
    return items.map((i) => i.game).filter((g) => (releaseMs(g) ?? 0) <= now);
  }, [items]);
  const { pick, shuffling, pickNext, clear: clearPick } = useNextGamePick(playable);
  // The pick may have just been started or removed from under the panel.
  const livePick = pick && items.some((i) => i.game.id === pick.id) ? pick : null;

  const now = Date.now();

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: space[4],
          marginBottom: space[6],
        }}
      >
        <div>
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
            Wishlist
          </h1>
          {items.length > 0 && (
            <p style={{ marginTop: space[2], color: color.textSecondary }}>
              {items.length} {items.length === 1 ? "game" : "games"} you want to play
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: space[3] }}>
            {items.length > 1 && (
              <select
                className="field"
                aria-label="Sort wishlist by"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                style={{ padding: "0.55rem 0.7rem", cursor: "pointer" }}
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>{SORT_LABEL[s]}</option>
                ))}
              </select>
            )}
            {playable.length > 1 && !livePick && (
              <button type="button" className="btn-key" onClick={pickNext}>
                Pick my next game
              </button>
            )}
          </div>
        )}
      </header>

      {livePick && (
        <NextGamePickPanel
          pick={livePick}
          shuffling={shuffling}
          source="From your wishlist"
          canRepick={playable.length > 1}
          onRepick={pickNext}
          onDismiss={clearPick}
          primaryAction={
            <button type="button" className="btn-key" disabled={busy.has(livePick.id)} onClick={() => onStart(livePick)}>
              Start playing
            </button>
          }
        />
      )}

      {items.length === 0 ? (
        <div
          style={{
            padding: space[5],
            background: color.bgCard,
            border: `1.5px dashed ${color.borderStrong}`,
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontFamily: font.display, fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
            Nothing on your wishlist
          </h2>
          <p style={{ margin: `${space[2]} 0 ${space[4]}`, color: color.textSecondary, maxWidth: "48ch" }}>
            Spot a game you want to play and choose &ldquo;Add to wishlist&rdquo; on its page. It waits here until you start it.
          </p>
          <Link className="btn-key" to="/explore">Explore games</Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(45%, 150px), 1fr))",
            gap: `${space[6]} ${space[4]}`,
          }}
        >
          {sorted.map(({ log, game }) => {
            const release = releaseMs(game);
            const upcoming = release != null && release > now;
            const disabled = busy.has(game.id);

            return (
              <div key={log.id} className="game-card" style={{ display: "flex", flexDirection: "column" }}>
                <div className="on-plank">
                  <GameCover
                    name={game.name}
                    imageId={game.cover?.image_id}
                    interactive
                    onClick={() => navigate(`/game/${game.id}`)}
                    {...(upcoming
                      ? {
                          badge: (
                            <span
                              style={{
                                position: "absolute",
                                top: 8,
                                left: -6,
                                padding: "2px 8px",
                                background: "var(--sticker-pink)",
                                color: "#fff",
                                borderRadius: 4,
                                boxShadow: "0 2px 0 rgba(4, 7, 26, 0.45)",
                                fontFamily: font.display,
                                fontSize: "0.6875rem",
                                fontWeight: 800,
                                lineHeight: 1.5,
                                transform: "rotate(-4deg)",
                              }}
                            >
                              Not out yet
                            </span>
                          ),
                        }
                      : {})}
                  />
                </div>

                <div style={{ paddingTop: space[2], flex: 1, display: "flex", flexDirection: "column" }}>
                  <div
                    className="game-card-title"
                    style={{
                      fontFamily: font.display,
                      fontStretch: "78%",
                      fontWeight: 700,
                      fontSize: "var(--text-sm)",
                      lineHeight: 1.2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {game.name}
                  </div>
                  {release != null && (
                    <div style={{ fontSize: "var(--text-xs)", color: color.textMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {upcoming ? `Out ${releaseFormat.format(release)}` : new Date(release).getFullYear()}
                    </div>
                  )}

                  {/* Actions sit at the bottom so they line up across a row */}
                  <div style={{ marginTop: "auto", paddingTop: space[3] }}>
                    <button
                      type="button"
                      className="btn-key btn-key--sm btn-key--block"
                      disabled={disabled}
                      onClick={() => onStart(game)}
                    >
                      Start playing
                    </button>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: space[2], marginTop: 6 }}>
                      <button type="button" className="text-btn" disabled={disabled} onClick={() => onLog(game)}>
                        Already played
                      </button>
                      <button
                        type="button"
                        className="text-btn text-btn--danger"
                        disabled={disabled}
                        aria-label={`Remove ${game.name} from your wishlist`}
                        onClick={() => onRemove(game)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
