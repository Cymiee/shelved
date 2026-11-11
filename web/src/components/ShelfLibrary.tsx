import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { ShelfHeader } from "./Shelf";
import GameCover from "./GameCover";
import SpineShelf from "./SpineShelf";
import RatingSticker from "./Sticker";
import { STATUS_META, STATUS_ORDER, space } from "../theme";
import { formatPlaytime } from "../lib/format";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  logs: GameLogRow[];
  /** IGDB data keyed by game id — callers already fetch this for their own use. */
  games: Map<number, IGDBGame>;
  emptyMessage?: string;
}

const VIEWS = ["spines", "covers"] as const;
type View = (typeof VIEWS)[number];

const SORTS = ["playtime", "rating", "recent", "name"] as const;
type Sort = (typeof SORTS)[number];

const SORT_LABEL: Record<Sort, string> = {
  playtime: "Most played",
  rating: "Highest rated",
  recent: "Recently updated",
  name: "A to Z",
};

/** A remembered view preference. Storage can be blocked or empty, so both directions fail soft. */
function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return allowed.includes(stored as T) ? (stored as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
}

/**
 * A user's library rendered as status shelves. Shared by the profile page and
 * the standalone /shelf route so both surfaces stay identical.
 *
 * Two ways to look at it: spines (the shelf as it would stand in a room) or
 * covers (face-out, with ratings and hours visible at a glance).
 */
export default function ShelfLibrary({ logs, games, emptyMessage = "No games logged yet." }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>(() => readPref("shelved:shelf-view", VIEWS, "spines"));
  const [sort, setSort] = useState<Sort>(() => readPref("shelved:shelf-sort", SORTS, "playtime"));

  if (logs.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{emptyMessage}</p>;
  }

  const compare = (a: GameLogRow, b: GameLogRow): number => {
    switch (sort) {
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "recent":
        return b.updated_at.localeCompare(a.updated_at);
      case "name":
        return (games.get(a.game_igdb_id)?.name ?? "").localeCompare(games.get(b.game_igdb_id)?.name ?? "");
      default:
        return (b.playtime_min ?? 0) - (a.playtime_min ?? 0);
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: space[3],
          marginBottom: space[6],
        }}
      >
        <div className="segmented" role="group" aria-label="Shelf view">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => { setView(v); writePref("shelved:shelf-view", v); }}
            >
              {v === "spines" ? "Spines" : "Covers"}
            </button>
          ))}
        </div>

        <select
          className="field"
          aria-label="Sort each shelf by"
          value={sort}
          onChange={(e) => {
            const next = e.target.value as Sort;
            setSort(next);
            writePref("shelved:shelf-sort", next);
          }}
          style={{ padding: "0.5rem 0.7rem", cursor: "pointer" }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>{SORT_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {STATUS_ORDER.map((status) => {
        // Logs whose game data didn't resolve can't be drawn, so they don't count.
        const shelfLogs = logs
          .filter((l) => l.status === status && games.has(l.game_igdb_id))
          .sort(compare);
        if (shelfLogs.length === 0) return null;
        const meta = STATUS_META[status];

        return (
          <section key={status} style={{ marginBottom: space[7] }}>
            <ShelfHeader title={meta.label} count={shelfLogs.length} accent={meta.color} />

            {view === "spines" ? (
              <SpineShelf
                height={isMobile ? 168 : 196}
                items={shelfLogs.map((log) => {
                  const game = games.get(log.game_igdb_id);
                  return {
                    id: log.game_igdb_id,
                    name: game?.name ?? "",
                    imageId: game?.cover?.image_id,
                    rating: log.rating,
                    playtimeMin: log.playtime_min,
                  };
                })}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(45%, 116px), 1fr))",
                  gap: `${space[5]} ${space[4]}`,
                }}
              >
                {shelfLogs.map((log) => {
                  const game = games.get(log.game_igdb_id);
                  if (!game) return null;
                  return (
                    <div key={log.id} className="on-plank">
                      <GameCover
                        name={game.name}
                        imageId={game.cover?.image_id}
                        rounding="md"
                        interactive
                        onClick={() => navigate(`/game/${log.game_igdb_id}`)}
                        {...(log.rating != null
                          ? {
                              badge: (
                                <RatingSticker
                                  rating={log.rating}
                                  size={30}
                                  tilt={9}
                                  style={{ position: "absolute", top: -8, right: -6 }}
                                />
                              ),
                            }
                          : {})}
                      >
                        {log.playtime_min != null && log.playtime_min > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 6,
                              left: 6,
                              background: "rgba(4, 7, 26, 0.82)",
                              color: "#fff",
                              borderRadius: 4,
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "1px 7px",
                              lineHeight: 1.5,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatPlaytime(log.playtime_min)}
                          </span>
                        )}
                      </GameCover>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
