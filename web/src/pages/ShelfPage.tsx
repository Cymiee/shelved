import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { getUserGameLogs } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { getGames } from "../lib/igdb";
import ShelfLibrary from "../components/ShelfLibrary";
import GameCover from "../components/GameCover";
import { CloseIcon } from "../components/icons";
import { PageSpinner } from "../components/Spinner";
import { formatPlaytime } from "../lib/format";
import { useIsMobile } from "../hooks/useIsMobile";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How many covers flick past before the picker settles, and how fast. */
const SHUFFLE_TICKS = 9;
const SHUFFLE_MS = 85;

/**
 * The signed-in user's working library, at a top-level route. Renders the same
 * ShelfLibrary the profile page uses, plus the things only the owner needs:
 * totals, and a picker for "what do I play next?".
 */
export default function ShelfPage() {
  const { userId } = useAuthStore();
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [games, setGames] = useState<Map<number, IGDBGame>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pick, setPick] = useState<IGDBGame | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const shuffleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const userLogs = await getUserGameLogs(supabase, userId!);
        if (cancelled) return;
        setLogs(userLogs);

        if (userLogs.length > 0) {
          const ids = [...new Set(userLogs.map((l) => l.game_igdb_id))];
          const gameList = await getGames(ids);
          if (cancelled) return;
          const map = new Map<number, IGDBGame>();
          for (const g of gameList) map.set(g.id, g);
          setGames(map);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your shelf. Reload to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => () => {
    if (shuffleTimer.current) clearInterval(shuffleTimer.current);
  }, []);

  // What "next" can be drawn from: the wishlist if there is one, otherwise
  // whatever is already in progress.
  const backlog = useMemo(() => {
    const gamesFor = (status: GameLogRow["status"]) =>
      logs.flatMap((l) => {
        const game = l.status === status ? games.get(l.game_igdb_id) : undefined;
        return game ? [game] : [];
      });
    const wishlist = gamesFor("want_to_play");
    return wishlist.length > 0
      ? { source: "From your wishlist", pool: wishlist }
      : { source: "You're already playing this", pool: gamesFor("playing") };
  }, [logs, games]);

  const pickNext = () => {
    const { pool } = backlog;
    if (pool.length === 0) return;
    const draw = () => pool[Math.floor(Math.random() * pool.length)] ?? null;

    if (shuffleTimer.current) clearInterval(shuffleTimer.current);
    if (reducedMotion || pool.length < 3) {
      setPick(draw());
      return;
    }
    // Flick through a few covers before settling, like riffling along the shelf.
    setShuffling(true);
    let ticks = 0;
    shuffleTimer.current = setInterval(() => {
      ticks++;
      setPick(draw());
      if (ticks >= SHUFFLE_TICKS && shuffleTimer.current) {
        clearInterval(shuffleTimer.current);
        shuffleTimer.current = null;
        setShuffling(false);
      }
    }, SHUFFLE_MS);
  };

  if (loading) return <PageSpinner />;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}>{error}</div>;

  const onShelf = logs.filter((l) => l.status !== "want_to_play");
  const minutes = logs.reduce((sum, l) => sum + (l.playtime_min ?? 0), 0);
  const rated = logs.filter((l) => l.rating != null);
  const average = rated.length > 0 ? rated.reduce((sum, l) => sum + (l.rating ?? 0), 0) / rated.length : null;

  const summary = [
    `${onShelf.length} ${onShelf.length === 1 ? "game" : "games"}`,
    ...(minutes > 0 ? [`${formatPlaytime(minutes)} played`] : []),
    ...(average != null ? [`rated ${average.toFixed(1)} on average`] : []),
  ].join(", ");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStretch: "104%",
              fontSize: "clamp(2rem, 6vw, 3.25rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "var(--text-primary)",
            }}
          >
            My shelf
          </h1>
          {logs.length > 0 && (
            <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {summary}
            </p>
          )}
        </div>

        {backlog.pool.length > 0 && !pick && (
          <button type="button" className="btn-key" onClick={pickNext}>
            Pick my next game
          </button>
        )}
      </header>

      {/* The picker's answer */}
      {pick && (
        <section
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            marginBottom: "var(--space-7)",
            padding: "var(--space-4)",
            background: "var(--bg-card)",
            border: "1.5px solid var(--accent)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          <div style={{ width: isMobile ? 84 : 104, flexShrink: 0 }}>
            <GameCover name={pick.name} imageId={pick.cover?.image_id} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="label">{shuffling ? "Looking along the shelf…" : "Play this next"}</p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "2px 0 4px",
                overflowWrap: "anywhere",
              }}
            >
              {pick.name}
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{backlog.source}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <Link
                className="btn-key"
                to={`/game/${pick.id}`}
                {...(shuffling ? { "aria-disabled": true, style: { pointerEvents: "none", opacity: 0.6 } } : {})}
              >
                Open game
              </Link>
              {backlog.pool.length > 1 && (
                <button type="button" className="btn-key btn-key--wall" onClick={pickNext} disabled={shuffling}>
                  Pick another
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss pick"
            onClick={() => setPick(null)}
            style={{ alignSelf: "flex-start" }}
          >
            <CloseIcon size={16} />
          </button>
        </section>
      )}

      {logs.length === 0 ? (
        <div
          style={{
            padding: "var(--space-5)",
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-card)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
            Nothing on your shelf yet
          </h2>
          <p style={{ margin: "var(--space-2) 0 var(--space-4)", color: "var(--text-secondary)", maxWidth: "48ch" }}>
            Find a game you've played and log it. It shows up here as a case on the shelf.
          </p>
          <Link className="btn-key" to="/explore">Explore games</Link>
        </div>
      ) : (
        <ShelfLibrary logs={logs} games={games} />
      )}
    </div>
  );
}
