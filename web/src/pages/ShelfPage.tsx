import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { getUserGameLogs } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { getGames } from "../lib/igdb";
import ShelfLibrary from "../components/ShelfLibrary";
import { useNextGamePick, NextGamePickPanel } from "../components/NextGamePick";
import { PageSpinner } from "../components/Spinner";
import { formatPlaytime } from "../lib/format";

/**
 * The signed-in user's working library, at a top-level route. Renders the same
 * ShelfLibrary the profile page uses, plus the things only the owner needs:
 * totals, and a picker for "what do I play next?".
 */
export default function ShelfPage() {
  const { userId } = useAuthStore();
  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [games, setGames] = useState<Map<number, IGDBGame>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const { pick, shuffling, pickNext, clear: clearPick } = useNextGamePick(backlog.pool);

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

        {logs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <Link className="btn-key btn-key--wall" to="/stats">See your stats</Link>
            {backlog.pool.length > 0 && !pick && (
              <button type="button" className="btn-key" onClick={pickNext}>
                Pick my next game
              </button>
            )}
          </div>
        )}
      </header>

      {pick && (
        <NextGamePickPanel
          pick={pick}
          shuffling={shuffling}
          source={backlog.source}
          canRepick={backlog.pool.length > 1}
          onRepick={pickNext}
          onDismiss={clearPick}
        />
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
