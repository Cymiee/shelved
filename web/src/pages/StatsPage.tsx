import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { getUserGameLogs } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { getGames } from "../lib/igdb";
import { computeShelfStats } from "../lib/stats";
import type { RankedGame } from "../lib/stats";
import { formatPlaytime } from "../lib/format";
import StatsReceipt from "../components/StatsReceipt";
import GameCover from "../components/GameCover";
import RatingSticker from "../components/Sticker";
import { ShelfHeader } from "../components/Shelf";
import { PageSpinner } from "../components/Spinner";
import { useIsMobile } from "../hooks/useIsMobile";

/**
 * The signed-in user's shelf, added up. The receipt holds the totals; beside
 * it (below it on phones) the games behind the two numbers people care about
 * most stand on their own shelves: what you played longest and rated highest.
 */
export default function StatsPage() {
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const isMobile = useIsMobile();

  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [games, setGames] = useState<Map<number, IGDBGame>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userLogs = await getUserGameLogs(supabase, userId);
        const ids = [...new Set(userLogs.map((l) => l.game_igdb_id))];
        const gameList = ids.length > 0 ? await getGames(ids) : [];
        if (cancelled) return;
        setLogs(userLogs);
        setGames(new Map(gameList.map((g) => [g.id, g])));
      } catch {
        if (!cancelled) setError("Couldn't load your stats. Reload to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const stats = useMemo(() => computeShelfStats(logs, games), [logs, games]);

  if (loading) return <PageSpinner />;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStretch: "104%",
            fontSize: "clamp(2rem, 6vw, 3.25rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Stats
        </h1>
        <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Everything on your shelf, rung up.
        </p>
      </header>

      {stats.onShelf === 0 ? (
        <div
          style={{
            padding: "var(--space-5)",
            background: "var(--bg-card)",
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
            Nothing to ring up yet
          </h2>
          <p style={{ margin: "var(--space-2) 0 var(--space-4)", color: "var(--text-secondary)", maxWidth: "48ch" }}>
            Log a few games you&rsquo;ve played and your totals, ratings and top genres show up here.
          </p>
          <Link className="btn-key" to="/explore">Explore games</Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 380px) minmax(0, 1fr)",
            gap: isMobile ? "var(--space-7)" : "var(--space-8)",
            alignItems: "start",
          }}
        >
          <StatsReceipt username={profile?.username ?? "you"} stats={stats} />

          <div style={{ minWidth: 0 }}>
            <CoverShelf
              title="Most played"
              entries={stats.mostPlayed}
              empty="Add hours to a log, or link Steam in settings, and your most played games line up here."
              caption={(r) => formatPlaytime(r.log.playtime_min ?? 0)}
            />
            <CoverShelf
              title="Highest rated"
              entries={stats.topRated}
              empty="Rate a game out of ten and your favourites line up here."
              showRating
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface CoverShelfProps {
  title: string;
  entries: RankedGame[];
  /** Shown instead of the shelf when there is nothing to put on it. */
  empty: string;
  /** A line under each title, e.g. hours played. */
  caption?: (entry: RankedGame) => string;
  /** Stick each game's rating on its cover. */
  showRating?: boolean;
}

function CoverShelf({ title, entries, empty, caption, showRating = false }: CoverShelfProps) {
  const navigate = useNavigate();

  return (
    <section style={{ marginBottom: "var(--space-7)" }}>
      <ShelfHeader title={title} />
      {entries.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", maxWidth: "48ch" }}>{empty}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(30%, 112px), 1fr))",
            gap: "var(--space-5) var(--space-4)",
          }}
        >
          {entries.map(({ game, log }) => (
            <div key={game.id} className="game-card">
              <div className="on-plank">
                <GameCover
                  name={game.name}
                  imageId={game.cover?.image_id}
                  interactive
                  onClick={() => navigate(`/game/${game.id}`)}
                  {...(showRating && log.rating != null
                    ? {
                        badge: (
                          <RatingSticker rating={log.rating} size={30} tilt={9} style={{ position: "absolute", top: -8, right: -6 }} />
                        ),
                      }
                    : {})}
                />
              </div>
              <div
                className="game-card-title"
                style={{
                  paddingTop: "var(--space-2)",
                  fontFamily: "var(--font-display)",
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
              {caption && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {caption({ game, log })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
