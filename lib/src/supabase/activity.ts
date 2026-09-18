import type { SupabaseClient } from './client.js';
import type { Database } from './client.js';
import type { ActivityRow, UserRow, GameStatus } from '../types/index.js';

export type ActivityWithUser = ActivityRow & {
  user: Pick<UserRow, 'id' | 'username' | 'avatar_url'>;
};

export type TrendingGameEntry = { gameIgdbId: number; count: number };

export type ReviewWithUser = {
  id: string;
  user_id: string;
  game_igdb_id: number;
  status: GameStatus;
  rating: number | null;
  review: string;
  created_at: string;
  updated_at: string;
  user: Pick<UserRow, 'id' | 'username' | 'avatar_url'>;
};

export async function getActivityWithUsers(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  limit = 20,
): Promise<ActivityWithUser[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('activity')
    .select('*, user:users!activity_user_id_fkey(id, username, avatar_url)')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityWithUser[];
}

export async function getFriendsActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
): Promise<ActivityWithUser[]> {
  const { data: friendships, error: fErr } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (fErr) throw fErr;

  const friendIds = (friendships ?? []).map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id,
  );
  return getActivityWithUsers(supabase, friendIds, limit);
}

export async function getUserActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
): Promise<ActivityWithUser[]> {
  return getActivityWithUsers(supabase, [userId], limit);
}

export async function getTrendingGameIds(
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<TrendingGameEntry[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_logs')
    .select('game_igdb_id')
    .gte('created_at', sevenDaysAgo)
    .limit(500);
  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.game_igdb_id, (counts.get(row.game_igdb_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([gameIgdbId, count]) => ({ gameIgdbId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getMostPlayedThisWeek(
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<TrendingGameEntry[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_logs')
    .select('game_igdb_id')
    .eq('status', 'playing')
    .gte('updated_at', sevenDaysAgo)
    .limit(500);
  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.game_igdb_id, (counts.get(row.game_igdb_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([gameIgdbId, count]) => ({ gameIgdbId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Newest written reviews across the whole community — the public "people are
 * here" surface. Ordered by updated_at so a review added to an old log surfaces.
 */
export async function getRecentReviews(
  supabase: SupabaseClient<Database>,
  limit = 6,
): Promise<ReviewWithUser[]> {
  const { data, error } = await supabase
    .from('game_logs')
    .select('id, user_id, game_igdb_id, status, rating, review, created_at, updated_at, user:users!game_logs_user_id_fkey(id, username, avatar_url)')
    .not('review', 'is', null)
    .neq('review', '')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReviewWithUser[];
}

/** Every written review for one game, newest first — the GamePage community block. */
export async function getGameReviews(
  supabase: SupabaseClient<Database>,
  gameIgdbId: number,
  limit = 20,
): Promise<ReviewWithUser[]> {
  const { data, error } = await supabase
    .from('game_logs')
    .select('id, user_id, game_igdb_id, status, rating, review, created_at, updated_at, user:users!game_logs_user_id_fkey(id, username, avatar_url)')
    .eq('game_igdb_id', gameIgdbId)
    .not('review', 'is', null)
    .neq('review', '')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReviewWithUser[];
}

export async function getUserStats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ logged: number; avgRating: number | null; reviews: number; friends: number }> {
  const [logsRes, friendsRes] = await Promise.all([
    supabase.from('game_logs').select('rating, review, status').eq('user_id', userId),
    supabase
      .from('friendships')
      .select('id')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted'),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (friendsRes.error) throw friendsRes.error;

  const logs = logsRes.data ?? [];
  const ratings = logs.map((l) => l.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const reviews = logs.filter((l) => l.review != null).length;

  return {
    logged: logs.filter((l) => l.status !== 'want_to_play').length,
    avgRating,
    reviews,
    friends: (friendsRes.data ?? []).length,
  };
}

// Re-exported for convenience — actual implementation in lists.ts
export { getPopularListsWithMeta as getPopularLists } from './lists.js';
