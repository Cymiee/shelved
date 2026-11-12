import { useEffect, useState } from "react";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { getUserGameLogs, deleteGameLog } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { useGamesStore } from "../store/games";
import { useToastStore } from "../store/toast";
import { getGames } from "../lib/igdb";
import { PageSpinner } from "../components/Spinner";
import LogGameModal from "../components/LogGameModal";
import WishlistView from "../components/WishlistView";
import type { WishlistItem } from "../components/WishlistView";

/**
 * Data and actions for the wishlist; WishlistView draws it.
 *
 * Starting or removing a game takes it off the screen immediately and puts it
 * back if the server refuses, so the page never waits on a round trip.
 */
export default function WantToPlayPage() {
  const userId = useAuthStore((s) => s.userId);
  const logGame = useGamesStore((s) => s.logGame);
  const showToast = useToastStore((s) => s.show);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [logging, setLogging] = useState<IGDBGame | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const allLogs = await getUserGameLogs(supabase, userId);
        const wishLogs = allLogs.filter((l) => l.status === "want_to_play");
        const games = wishLogs.length > 0 ? await getGames(wishLogs.map((l) => l.game_igdb_id)) : [];
        if (cancelled) return;
        const byId = new Map(games.map((g) => [g.id, g]));
        setItems(
          wishLogs.flatMap((log: GameLogRow) => {
            const game = byId.get(log.game_igdb_id);
            return game ? [{ log, game }] : [];
          }),
        );
      } catch {
        if (!cancelled) setError("Couldn't load your wishlist. Reload to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  /** Take a game off the list now; put it back where it was if `work` fails. */
  const leaveList = async (game: IGDBGame, work: () => Promise<void>, done: () => void, failed: string) => {
    const index = items.findIndex((i) => i.game.id === game.id);
    const item = items[index];
    if (!item) return;

    setBusy((prev) => new Set(prev).add(game.id));
    setItems((prev) => prev.filter((i) => i.game.id !== game.id));
    try {
      await work();
      done();
    } catch {
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
      showToast(failed);
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(game.id);
        return next;
      });
    }
  };

  const handleStart = (game: IGDBGame) => {
    void leaveList(
      game,
      async () => {
        await logGame(game.id, "playing", undefined, undefined, (game.genres ?? []).map((g) => g.id));
      },
      () => showToast(`Started ${game.name}`, { to: `/game/${game.id}`, label: "View" }),
      `Couldn't start ${game.name}. Try again.`,
    );
  };

  const handleRemove = (game: IGDBGame) => {
    if (!userId) return;
    void leaveList(
      game,
      () => deleteGameLog(supabase, userId, game.id),
      () => showToast(`Removed ${game.name} from your wishlist`),
      `Couldn't remove ${game.name}. Try again.`,
    );
  };

  if (loading) return <PageSpinner />;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}>{error}</div>;

  return (
    <>
      <WishlistView items={items} busy={busy} onStart={handleStart} onLog={setLogging} onRemove={handleRemove} />

      {logging && (
        <LogGameModal
          game={logging}
          onClose={() => setLogging(null)}
          onSave={async (status, rating, review, playtimeMin) => {
            await logGame(
              logging.id,
              status,
              rating ?? undefined,
              review ?? undefined,
              (logging.genres ?? []).map((g) => g.id),
              playtimeMin,
            );
            // Anything but "Wishlist" means it has left this page.
            if (status !== "want_to_play") {
              setItems((prev) => prev.filter((i) => i.game.id !== logging.id));
            }
            showToast(`Logged ${logging.name}`, { to: `/game/${logging.id}`, label: "View" });
          }}
        />
      )}
    </>
  );
}
