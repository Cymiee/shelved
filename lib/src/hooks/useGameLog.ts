import { useState, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/client.js";
import type { GameLogRow, GameStatus } from "../types/index.js";
import { upsertGameLog, getUserGameLogs } from "../supabase/games.js";

export function useGameLog(
  client: SupabaseClient<Database>,
  userId: string | null
) {
  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getUserGameLogs(client, userId);
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

  const logGame = useCallback(
    async (
      gameIgdbId: number,
      status: GameStatus,
      rating?: number | null,
      review?: string | null
    ) => {
      if (!userId) throw new Error("Not authenticated");
      const row = await upsertGameLog(client, userId, gameIgdbId, status, rating, review);
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.id === row.id);
        return idx >= 0
          ? prev.map((l) => (l.id === row.id ? row : l))
          : [row, ...prev];
      });
      return row;
    },
    [client, userId]
  );

  return { logs, loading, error, fetchLogs, logGame };
}
