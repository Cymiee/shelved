import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { getGames } from "../lib/igdb";
import SpineShelf from "./SpineShelf";
import { ShelfHeader } from "./Shelf";
import { useIsMobile } from "../hooks/useIsMobile";
import { space } from "../theme";

interface Props {
  /** The signed-in user's shelf logs (wishlist excluded by the caller). */
  logs: GameLogRow[];
}

/** How many of the most recently touched games to stand on the strip. */
const STRIP_SIZE = 40;

/**
 * The top of Home for someone signed in: their own shelf, most recent first,
 * as one row of spines. A way back into what they were playing, and a link to
 * the full shelf.
 */
export default function YourShelfStrip({ logs }: Props) {
  const isMobile = useIsMobile();
  const [games, setGames] = useState<Map<number, IGDBGame>>(new Map());

  const recent = useMemo(
    () => [...logs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, STRIP_SIZE),
    [logs],
  );
  const idsKey = recent.map((l) => l.game_igdb_id).join(",");

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getGames(idsKey.split(",").map(Number));
        if (!cancelled) setGames(new Map(list.map((g) => [g.id, g])));
      } catch {
        // The strip is a shortcut, not the library itself: without game data
        // it simply stays empty and the rest of Home carries on.
      }
    })();
    return () => { cancelled = true; };
  }, [idsKey]);

  const height = isMobile ? 168 : 208;
  const items = recent.flatMap((log) => {
    const game = games.get(log.game_igdb_id);
    return game
      ? [{ id: game.id, name: game.name, imageId: game.cover?.image_id, rating: log.rating, playtimeMin: log.playtime_min }]
      : [];
  });

  return (
    <section style={{ marginBottom: space[7] }}>
      <ShelfHeader
        title="Your shelf"
        count={logs.length}
        action={<Link to="/shelf" className="nav-link">Open shelf</Link>}
      />
      {/* Height reserved up front so the page doesn't jump when covers load */}
      <div style={{ minHeight: height + 11 }}>
        <SpineShelf singleRow height={height} items={items} />
      </div>
    </section>
  );
}
