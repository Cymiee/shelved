import { useEffect, useState } from "react";
import type { IGDBGame, ActivityRow, UserRow, GameLogRow } from "@gameboxd/lib";
import { getFriendsActivityFeed, getUsersByIds, getLogsForPairs } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { getGames } from "../lib/igdb";

export interface FeedItem {
  activity: ActivityRow;
  user: Pick<UserRow, "id" | "username" | "avatar_url">;
  game: Pick<IGDBGame, "id" | "name" | "cover">;
  /** The friend's current log for this game, for up-to-date rating/review. */
  log: GameLogRow | undefined;
}

interface FriendsFeed {
  items: FeedItem[];
  loading: boolean;
  hasMore: boolean;
}

/**
 * Recent friend activity, newest first. Over-fetches by 2x so items whose game
 * or user fail to resolve don't leave the page under-filled. When `limit`
 * changes the previous items stay visible while the larger page loads.
 */
export function useFriendsFeed(userId: string | null, limit: number): FriendsFeed {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const feed = await getFriendsActivityFeed(supabase, userId, limit * 2);
        if (feed.length === 0) {
          if (!cancelled) { setItems([]); setHasMore(false); }
          return;
        }

        const uniqueGameIds = [...new Set(feed.map((a) => a.game_igdb_id))];
        const uniqueUserIds = [...new Set(feed.map((a) => a.user_id))];

        const [igdbGames, userRows, logRows] = await Promise.all([
          getGames(uniqueGameIds),
          getUsersByIds(supabase, uniqueUserIds),
          // Current ratings/reviews. Non-critical: without them cards fall back
          // to the activity's own metadata.
          getLogsForPairs(supabase, uniqueUserIds, uniqueGameIds).catch((): GameLogRow[] => []),
        ]);

        const gameMap = new Map(igdbGames.map((g) => [g.id, g]));
        const userMap = new Map(userRows.map((u) => [u.id, u]));
        const logMap = new Map(logRows.map((l) => [`${l.user_id}:${l.game_igdb_id}`, l]));

        const resolved: FeedItem[] = [];
        for (const activity of feed) {
          const user = userMap.get(activity.user_id);
          const game = gameMap.get(activity.game_igdb_id);
          if (user && game) {
            resolved.push({ activity, user, game, log: logMap.get(`${activity.user_id}:${activity.game_igdb_id}`) });
          }
        }

        if (cancelled) return;
        setHasMore(resolved.length > limit);
        setItems(resolved.slice(0, limit));
      } catch {
        // Keep whatever was already showing.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, limit]);

  if (!userId) return { items: [], loading: false, hasMore: false };
  return { items, loading, hasMore };
}
