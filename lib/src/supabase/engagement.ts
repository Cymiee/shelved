import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client.js";
import type { UserRow } from "../types/index.js";

/** Longest comment the database accepts (see the review_comments check constraint). */
export const REVIEW_COMMENT_MAX = 1000;

type Author = Pick<UserRow, "id" | "username" | "avatar_url">;

export interface ReviewEngagement {
  logId: string;
  likes: number;
  comments: number;
  /** Whether the signed-in caller has liked it. Always false when signed out. */
  likedByMe: boolean;
}

export interface ReviewComment {
  id: string;
  log_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type ReviewCommentWithUser = ReviewComment & { user: Author };

export interface ReviewNotification {
  kind: "like" | "comment";
  createdAt: string;
  actor: Author;
  logId: string;
  gameIgdbId: number;
  /** The comment's text; null for a like. */
  body: string | null;
  /** Arrived since the user last opened their notifications. */
  unseen: boolean;
}

/**
 * Like and comment counts for a batch of logs in one round trip, plus whether
 * the caller liked each. The server reads at most 200 ids per call.
 */
export async function getReviewEngagement(
  client: SupabaseClient<Database>,
  logIds: string[]
): Promise<ReviewEngagement[]> {
  if (logIds.length === 0) return [];
  const { data, error } = await client.rpc("review_engagement", { log_ids: logIds.slice(0, 200) });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    logId: row.log_id,
    likes: row.likes,
    comments: row.comments,
    likedByMe: row.liked_by_me,
  }));
}

/** Like a log. Liking something already liked is treated as success. */
export async function likeReview(
  client: SupabaseClient<Database>,
  logId: string,
  userId: string
): Promise<void> {
  const { error } = await client.from("review_likes").insert({ log_id: logId, user_id: userId });
  // 23505 = the like already exists (e.g. a double tap raced itself).
  if (error && error.code !== "23505") throw error;
}

export async function unlikeReview(
  client: SupabaseClient<Database>,
  logId: string,
  userId: string
): Promise<void> {
  const { error } = await client.from("review_likes").delete().eq("log_id", logId).eq("user_id", userId);
  if (error) throw error;
}

/** A log's comments, oldest first, each with its author. */
export async function getReviewComments(
  client: SupabaseClient<Database>,
  logId: string
): Promise<ReviewCommentWithUser[]> {
  const { data, error } = await client
    .from("review_comments")
    .select("id, log_id, user_id, body, created_at, user:users!review_comments_user_id_fkey(id, username, avatar_url)")
    .eq("log_id", logId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as ReviewCommentWithUser[];
}

/** Post a comment as `userId`. The body is trimmed; the database enforces the length. */
export async function addReviewComment(
  client: SupabaseClient<Database>,
  logId: string,
  userId: string,
  body: string
): Promise<ReviewComment> {
  const { data, error } = await client
    .from("review_comments")
    .insert({ log_id: logId, user_id: userId, body: body.trim() })
    .select("id, log_id, user_id, body, created_at")
    .single();
  if (error) throw error;
  return data;
}

/** Delete one of the caller's own comments. Resolves to false if nothing was deleted. */
export async function deleteReviewComment(
  client: SupabaseClient<Database>,
  commentId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("review_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Likes and comments other people left on the caller's logs, newest first. */
export async function getReviewNotifications(
  client: SupabaseClient<Database>,
  limit = 30
): Promise<ReviewNotification[]> {
  const { data, error } = await client.rpc("review_notifications", { max_rows: limit });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    kind: row.kind === "comment" ? "comment" : "like",
    createdAt: row.created_at,
    actor: { id: row.actor_id, username: row.actor_username, avatar_url: row.actor_avatar_url },
    logId: row.log_id,
    gameIgdbId: row.game_igdb_id,
    body: row.body,
    unseen: row.unseen,
  }));
}

/** How many likes and comments arrived since the caller last looked. */
export async function getUnseenReviewNotificationCount(client: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await client.rpc("unseen_review_notification_count");
  if (error) throw error;
  return data ?? 0;
}

/** Record that the caller has now seen their notifications (server clock). */
export async function markReviewNotificationsSeen(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.rpc("mark_review_notifications_seen");
  if (error) throw error;
}
