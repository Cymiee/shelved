import { useEffect, useState } from "react";
import type { IGDBGame, ReviewWithUser } from "@gameboxd/lib";
import { getRecentReviews } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { getGames } from "../lib/igdb";
import ReviewCard from "./ReviewCard";
import { ShelfHeader } from "./Shelf";
import { space } from "../theme";

interface Props {
  limit?: number;
}

interface Item {
  review: ReviewWithUser;
  game: Pick<IGDBGame, "id" | "name" | "cover">;
}

/**
 * Newest reviews across the whole community, shown to everyone — the one
 * Home section that proves other people are here. Renders nothing while
 * loading or when empty so it never leaves a hole on the page.
 */
export default function CommunityReviews({ limit = 6 }: Props) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Over-fetch a little so a review whose game fails to resolve doesn't
      // leave the grid short.
      const reviews = await getRecentReviews(supabase, limit * 2);
      if (reviews.length === 0) return;
      const games = await getGames([...new Set(reviews.map((r) => r.game_igdb_id))]);
      if (cancelled) return;
      const gameMap = new Map(games.map((g) => [g.id, g]));
      const next: Item[] = [];
      for (const review of reviews) {
        const game = gameMap.get(review.game_igdb_id);
        if (game) next.push({ review, game });
        if (next.length === limit) break;
      }
      setItems(next);
    }
    load().catch(() => {});
    return () => { cancelled = true; };
  }, [limit]);

  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: space[7] }}>
      <ShelfHeader title="Fresh reviews" count={items.length} />
      <div
        className="paper-wall"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
          gap: `${space[6]} ${space[5]}`,
          alignItems: "start",
          // room for the tape and the corner sticker that overhang each card
          paddingTop: space[3],
        }}
      >
        {items.map(({ review, game }) => (
          <ReviewCard key={review.id} review={review} game={game} />
        ))}
      </div>
    </section>
  );
}
