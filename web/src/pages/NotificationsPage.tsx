import { useCallback, useEffect, useState } from "react";
import { getReviewNotifications } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { getGames } from "../lib/igdb";
import { useAuthStore } from "../store/auth";
import { useNotificationsStore } from "../store/notifications";
import NotificationsView from "../components/NotificationsView";
import type { NotificationItem } from "../components/NotificationsView";

/** Loads likes and comments on the user's logs; NotificationsView draws them. */
export default function NotificationsPage() {
  const userId = useAuthStore((s) => s.userId);
  const pendingRequests = useNotificationsStore((s) => s.pendingRequests);
  const refresh = useNotificationsStore((s) => s.refresh);
  const markReviewsSeen = useNotificationsStore((s) => s.markReviewsSeen);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Keep the friend-request count current.
  useEffect(() => {
    if (userId) void refresh(userId);
  }, [userId, refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const notifications = await getReviewNotifications(supabase, 50);
        const ids = [...new Set(notifications.map((n) => n.gameIgdbId))];
        // Game names and covers are decoration; without them the rows still read.
        const games = await getGames(ids).catch(() => []);
        if (cancelled) return;
        const byId = new Map(games.map((g) => [g.id, g]));
        setItems(notifications.map((notification) => ({ notification, game: byId.get(notification.gameIgdbId) })));
        setLoading(false);
        // Only after the list is in hand: the "New" labels come from that data,
        // so they stay for this visit while the navbar badge clears.
        void markReviewsSeen();
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, markReviewsSeen]);

  return (
    <NotificationsView
      loading={loading}
      error={error}
      onRetry={retry}
      pendingRequests={pendingRequests}
      items={items}
    />
  );
}
