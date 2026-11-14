import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./client.js";
import { getFriends, getFriendshipStatus, getFriendships, removeFriend } from "./friends";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const BAD = "x),requester_id.neq.0";

type Result = { data: unknown; error: null };

/**
 * Minimal chainable fake: every chain method returns the same builder, which
 * is also awaitable and resolves to `result`. The source builds the chain
 * (`.from().select()`) before evaluating the `.or()` argument, so the guard is
 * asserted by `or` never being reached, which means no query was ever sent. Only the calls made by the
 * friends functions under test are provided.
 */
function makeFake(result: Result) {
  const or = vi.fn();
  const builder: Record<string, unknown> = {};
  const chain = (): unknown => builder;
  builder["select"] = chain;
  builder["eq"] = chain;
  builder["order"] = chain;
  builder["delete"] = chain;
  builder["or"] = (filter: string) => {
    or(filter);
    return builder;
  };
  builder["maybeSingle"] = () => Promise.resolve(result);
  builder["then"] = (resolve: (value: Result) => unknown) => resolve(result);
  const from = vi.fn(() => builder);
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, from, or };
}

const empty: Result = { data: [], error: null };

describe("uuid guard via getFriendshipStatus", () => {
  it("rejects an injected id before any query is sent", async () => {
    const { client, or } = makeFake({ data: null, error: null });
    await expect(getFriendshipStatus(client, A, BAD)).rejects.toThrow("Invalid user id");
    expect(or).not.toHaveBeenCalled();
  });

  it("rejects an invalid requesting id too", async () => {
    const { client, or } = makeFake({ data: null, error: null });
    await expect(getFriendshipStatus(client, BAD, A)).rejects.toThrow("Invalid user id");
    expect(or).not.toHaveBeenCalled();
  });

  it("builds the expected filter for a valid pair", async () => {
    const { client, or } = makeFake({ data: null, error: null });
    const result = await getFriendshipStatus(client, A, B);
    expect(or).toHaveBeenCalledWith(
      `and(requester_id.eq.${A},addressee_id.eq.${B}),and(requester_id.eq.${B},addressee_id.eq.${A})`,
    );
    expect(result).toEqual({ status: "none", friendshipId: null });
  });

  it("accepts uppercase UUIDs", async () => {
    const { client, or } = makeFake({ data: null, error: null });
    await getFriendshipStatus(client, A.toUpperCase(), B);
    expect(or).toHaveBeenCalledTimes(1);
  });

  it("reports direction of a pending request", async () => {
    const sent = makeFake({ data: { id: "f1", requester_id: A, addressee_id: B, status: "pending" }, error: null });
    expect(await getFriendshipStatus(sent.client, A, B)).toEqual({ status: "pending_sent", friendshipId: "f1" });
    const received = makeFake({ data: { id: "f1", requester_id: B, addressee_id: A, status: "pending" }, error: null });
    expect(await getFriendshipStatus(received.client, A, B)).toEqual({ status: "pending_received", friendshipId: "f1" });
  });
});

describe("uuid guard in other functions", () => {
  const filter = `requester_id.eq.${A},addressee_id.eq.${A}`;

  it("getFriends validates and builds the filter", async () => {
    const { client, or } = makeFake(empty);
    await expect(getFriends(client, BAD)).rejects.toThrow("Invalid user id");
    expect(or).not.toHaveBeenCalled();
    await getFriends(client, A);
    expect(or).toHaveBeenCalledWith(filter);
  });

  it("getFriendships validates and builds the filter", async () => {
    const { client, or } = makeFake(empty);
    await expect(getFriendships(client, BAD)).rejects.toThrow("Invalid user id");
    expect(or).not.toHaveBeenCalled();
    await getFriendships(client, A);
    expect(or).toHaveBeenCalledWith(filter);
  });

  it("removeFriend validates and builds the filter", async () => {
    const { client, or } = makeFake({ data: null, error: null });
    await expect(removeFriend(client, "f1", BAD)).rejects.toThrow("Invalid user id");
    expect(or).not.toHaveBeenCalled();
    await removeFriend(client, "f1", A);
    expect(or).toHaveBeenCalledWith(filter);
  });
});
