import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client.js";
import type { FriendshipRow, ActivityRow, UserRow } from "../types/index.js";
import { collapseActivity } from "./activity.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `.or()` takes a raw filter string, so any id placed in one must be a real
 * UUID. A value from a URL (e.g. /profile/<anything>) could otherwise add its
 * own filter clauses.
 */
function uuid(value: string): string {
  if (!UUID.test(value)) throw new Error("Invalid user id");
  return value;
}

export async function sendFriendRequest(
  client: SupabaseClient<Database>,
  requesterId: string,
  addresseeId: string
): Promise<FriendshipRow> {
  const { data, error } = await client
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptFriendRequest(
  client: SupabaseClient<Database>,
  friendshipId: string,
  addresseeId: string
): Promise<FriendshipRow> {
  const { data, error } = await client
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("addressee_id", addresseeId) // ensure only addressee can accept
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFriends(
  client: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${uuid(userId)},addressee_id.eq.${uuid(userId)}`);
  if (error) throw error;

  return data.map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );
}

/**
 * Every friendship row the user is part of, in any state: accepted friends,
 * requests they received and requests they sent. One query for the whole
 * Friends page; callers split it by status and direction.
 */
export async function getFriendships(
  client: SupabaseClient<Database>,
  userId: string
): Promise<FriendshipRow[]> {
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${uuid(userId)},addressee_id.eq.${uuid(userId)}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPendingRequests(
  client: SupabaseClient<Database>,
  userId: string
): Promise<FriendshipRow[]> {
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return data;
}

export async function getPopularAmongFriends(
  client: SupabaseClient<Database>,
  userId: string,
  limit = 8
): Promise<{ gameIgdbId: number; count: number }[]> {
  const friendIds = await getFriends(client, userId);
  if (friendIds.length === 0) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await client
    .from("game_logs")
    .select("game_igdb_id")
    .in("user_id", friendIds)
    .gte("updated_at", thirtyDaysAgo);

  if (error) throw error;

  const freq = new Map<number, number>();
  for (const row of data) {
    freq.set(row.game_igdb_id, (freq.get(row.game_igdb_id) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([gameIgdbId, count]) => ({ gameIgdbId, count }));
}

export type FriendRating = {
  user: Pick<UserRow, "id" | "username" | "avatar_url">;
  rating: number;
};

export async function getFriendRatingsForGame(
  client: SupabaseClient<Database>,
  userId: string,
  gameIgdbId: number
): Promise<FriendRating[]> {
  const friendIds = await getFriends(client, userId);
  if (friendIds.length === 0) return [];

  const { data, error } = await client
    .from("game_logs")
    .select("rating, user:users!game_logs_user_id_fkey(id, username, avatar_url)")
    .in("user_id", friendIds)
    .eq("game_igdb_id", gameIgdbId)
    .not("rating", "is", null);
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    rating: number | null;
    user: Pick<UserRow, "id" | "username" | "avatar_url"> | null;
  }[];

  return rows
    .filter((r) => r.rating != null && r.user != null)
    .map((r) => ({ user: r.user as Pick<UserRow, "id" | "username" | "avatar_url">, rating: r.rating as number }));
}

export interface FriendStatusResult {
  status: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId: string | null;
}

export async function getFriendshipStatus(
  client: SupabaseClient<Database>,
  userId: string,
  otherUserId: string,
): Promise<FriendStatusResult> {
  const { data, error } = await client
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${uuid(userId)},addressee_id.eq.${uuid(otherUserId)}),` +
      `and(requester_id.eq.${uuid(otherUserId)},addressee_id.eq.${uuid(userId)})`,
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'none', friendshipId: null };
  if (data.status === 'accepted') return { status: 'accepted', friendshipId: data.id };
  if (data.requester_id === userId) return { status: 'pending_sent', friendshipId: data.id };
  return { status: 'pending_received', friendshipId: data.id };
}

export async function declineFriendRequest(
  client: SupabaseClient<Database>,
  friendshipId: string,
  addresseeId: string,
): Promise<void> {
  const { error } = await client
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .eq('addressee_id', addresseeId);
  if (error) throw error;
}

export async function removeFriend(
  client: SupabaseClient<Database>,
  friendshipId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .or(`requester_id.eq.${uuid(userId)},addressee_id.eq.${uuid(userId)}`);
  if (error) throw error;
}

export async function getFriendsActivityFeed(
  client: SupabaseClient<Database>,
  userId: string,
  limit = 50
): Promise<ActivityRow[]> {
  const friendIds = await getFriends(client, userId);
  if (friendIds.length === 0) return [];

  // Over-fetch so that collapsing repeat edits of one log still fills the limit.
  const { data, error } = await client
    .from("activity")
    .select("*")
    .in("user_id", friendIds)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  if (error) throw error;
  return collapseActivity(data).slice(0, limit);
}
