import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client.js";
import type { UserRow } from "../types/index.js";

export async function signUp(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
  username: string
): Promise<{ userId: string; needsConfirmation: boolean }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Signup succeeded but no user returned");

  // With email confirmation on, Supabase answers a signup for an address that
  // already has an account with a fake success (no session, no email) so the
  // endpoint can't be used to probe for accounts. The tell is an empty
  // identities list. Surface that instead of a "check your email" that never
  // arrives.
  if (!data.session && (data.user.identities?.length ?? 0) === 0) {
    throw new Error("An account with this email already exists. Sign in instead, or reset your password.");
  }

  // Only insert the users row if we have a live session (email confirmation disabled).
  // When confirmation is required, session is null — we create the row on first sign-in instead.
  if (data.session) {
    const { error: profileError } = await client.from("users").insert({
      id: data.user.id,
      username,
      bio: null,
      avatar_url: null,
    });
    if (profileError) throw profileError;
  }

  return { userId: data.user.id, needsConfirmation: !data.session };
}

export async function signIn(
  client: SupabaseClient<Database>,
  email: string,
  password: string
): Promise<{ userId: string }> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Sign-in succeeded but no user returned");

  // Ensure the users row exists — it may be missing if the user signed up with
  // email confirmation enabled and this is their first sign-in after confirming.
  const { data: existingUser } = await client
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existingUser) {
    const username = (data.user.user_metadata?.username as string | undefined) ?? email.split("@")[0] ?? "user";
    const { error: profileError } = await client.from("users").insert({
      id: data.user.id,
      username,
      bio: null,
      avatar_url: null,
    });
    if (profileError) throw profileError;
  }

  return { userId: data.user.id };
}

/**
 * Email a password-reset link. `redirectTo` must be on the project's allowed
 * redirect list; the link signs the user in and lands them there so they can
 * set a new password with `updatePassword`.
 */
export async function requestPasswordReset(
  client: SupabaseClient<Database>,
  email: string,
  redirectTo: string
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Set a new password for the signed-in user (e.g. after a reset link). */
export async function updatePassword(
  client: SupabaseClient<Database>,
  password: string
): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(
  client: SupabaseClient<Database>
): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function ensureProfile(
  client: SupabaseClient<Database>,
  userId: string,
  fallbackUsername: string
): Promise<UserRow> {
  const { data: existing } = await client
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await client
    .from("users")
    .insert({ id: userId, username: fallbackUsername, bio: null, avatar_url: null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProfile(
  client: SupabaseClient<Database>,
  userId: string
): Promise<UserRow> {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUsersByIds(
  client: SupabaseClient<Database>,
  userIds: string[]
): Promise<UserRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await client
    .from("users")
    .select("*")
    .in("id", userIds);
  if (error) throw error;
  return data;
}

export async function getUserByUsername(
  client: SupabaseClient<Database>,
  username: string
): Promise<UserRow | null> {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: SupabaseClient<Database>,
  userId: string,
  updates: Partial<Pick<UserRow, "username" | "bio" | "avatar_url">>
): Promise<UserRow> {
  const { data, error } = await client
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Unlink a user's Steam account (clears steam_id + sync time). */
export async function unlinkSteam(
  client: SupabaseClient<Database>,
  userId: string
): Promise<UserRow> {
  const { data, error } = await client
    .from("users")
    .update({ steam_id: null, steam_synced_at: null })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
