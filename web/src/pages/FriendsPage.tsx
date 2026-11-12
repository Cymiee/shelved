import { useCallback, useEffect, useMemo, useState } from "react";
import type { FriendshipRow, UserProfileTagsRow } from "@gameboxd/lib";
import {
  getFriendships,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getUsersByIds,
  getProfileTagsByIds,
  searchUsers,
} from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { useNotificationsStore } from "../store/notifications";
import { useToastStore } from "../store/toast";
import FriendsView from "../components/FriendsView";
import type { Person, Relation } from "../components/FriendsView";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Data and actions for the Friends page; FriendsView draws it.
 *
 * Every action updates the screen first and talks to the server second, then
 * puts things back if the server says no. Waiting on a round trip before
 * anything moves is what made this page feel unresponsive.
 */
export default function FriendsPage() {
  const userId = useAuthStore((s) => s.userId);
  const myTags = useAuthStore((s) => s.profileTags);
  const setPending = useNotificationsStore((s) => s.setPending);
  const showToast = useToastStore((s) => s.show);

  const [rows, setRows] = useState<FriendshipRow[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [tags, setTags] = useState<Map<string, UserProfileTagsRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Person[] | null>(null);

  const otherId = useCallback(
    (row: FriendshipRow) => (row.requester_id === userId ? row.addressee_id : row.requester_id),
    [userId],
  );

  // ── Load ──
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const friendships = await getFriendships(supabase, userId);
        const ids = [...new Set(friendships.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))];
        const friendIds = friendships
          .filter((r) => r.status === "accepted")
          .map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));

        const [users, tagRows] = await Promise.all([
          getUsersByIds(supabase, ids),
          // Taste tags are decoration on the cards; the page works without them.
          friendIds.length > 0
            ? getProfileTagsByIds(supabase, friendIds).catch((): UserProfileTagsRow[] => [])
            : Promise.resolve<UserProfileTagsRow[]>([]),
        ]);
        if (cancelled) return;
        setRows(friendships);
        setPeople(new Map(users.map((u) => [u.id, u])));
        setTags(new Map(tagRows.map((t) => [t.user_id, t])));
      } catch {
        if (!cancelled) showToast("Couldn't load your friends. Reload to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, showToast]);

  // ── Derived lists ──
  const { friends, incoming, sent } = useMemo(() => {
    const person = (row: FriendshipRow) => people.get(otherId(row));
    const present = <T,>(value: T | undefined): value is T => value !== undefined;
    return {
      friends: rows
        .filter((r) => r.status === "accepted")
        .map(person)
        .filter(present)
        .sort((a, b) => a.username.localeCompare(b.username))
        .map((user) => ({ user, tags: tags.get(user.id) })),
      incoming: rows.filter((r) => r.status === "pending" && r.addressee_id === userId).map(person).filter(present),
      sent: rows.filter((r) => r.status === "pending" && r.requester_id === userId).map(person).filter(present),
    };
  }, [rows, people, tags, userId, otherId]);

  // Keep the nav badge in step with what's on screen.
  useEffect(() => {
    if (!loading) setPending(incoming.length);
  }, [loading, incoming.length, setPending]);

  const rowFor = (otherUserId: string) => rows.find((r) => otherId(r) === otherUserId);

  const relationOf = (otherUserId: string): Relation => {
    const row = rowFor(otherUserId);
    if (!row) return "none";
    if (row.status === "accepted") return "friends";
    return row.requester_id === userId ? "sent" : "incoming";
  };

  const nameOf = (otherUserId: string) => people.get(otherUserId)?.username ?? "them";

  /** Mark someone busy for the length of a request. */
  const withBusy = async (otherUserId: string, work: () => Promise<void>) => {
    setBusy((prev) => new Set(prev).add(otherUserId));
    try {
      await work();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(otherUserId);
        return next;
      });
    }
  };

  // ── Search ──
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchUsers(supabase, term);
        if (!cancelled) setResults(found.filter((p) => p.id !== userId));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, userId]);

  // ── Actions ──
  const handleAdd = (person: Person) => {
    if (!userId) return;
    void withBusy(person.id, async () => {
      try {
        const row = await sendFriendRequest(supabase, userId, person.id);
        setPeople((prev) => new Map(prev).set(person.id, person));
        setRows((prev) => [row, ...prev]);
        showToast(`Request sent to ${person.username}`);
      } catch {
        showToast(`Couldn't send a request to ${person.username}. Try again.`);
      }
    });
  };

  const handleAccept = (otherUserId: string) => {
    const row = rowFor(otherUserId);
    if (!userId || !row) return;
    void withBusy(otherUserId, async () => {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "accepted" } : r)));
      try {
        await acceptFriendRequest(supabase, row.id, userId);
        showToast(`You and ${nameOf(otherUserId)} are now friends`, { to: `/profile/${otherUserId}`, label: "View" });
        // Their taste tags weren't loaded while they were only a request.
        const [theirTags] = await getProfileTagsByIds(supabase, [otherUserId]).catch((): UserProfileTagsRow[] => []);
        if (theirTags) setTags((prev) => new Map(prev).set(otherUserId, theirTags));
      } catch {
        setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        showToast(`Couldn't accept ${nameOf(otherUserId)}'s request. Try again.`);
      }
    });
  };

  /** Decline, cancel and unfriend are all "delete this row"; only the wording differs. */
  const dropRow = (otherUserId: string, remove: (row: FriendshipRow) => Promise<void>, done: string, failed: string) => {
    const row = rowFor(otherUserId);
    if (!userId || !row) return;
    void withBusy(otherUserId, async () => {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      try {
        await remove(row);
        showToast(done);
      } catch {
        setRows((prev) => [row, ...prev]);
        showToast(failed);
      }
    });
  };

  const handleDecline = (otherUserId: string) =>
    dropRow(
      otherUserId,
      (row) => declineFriendRequest(supabase, row.id, userId!),
      `Declined ${nameOf(otherUserId)}'s request`,
      "Couldn't decline that request. Try again.",
    );

  const handleCancelRequest = (otherUserId: string) =>
    dropRow(
      otherUserId,
      (row) => removeFriend(supabase, row.id, userId!),
      `Cancelled your request to ${nameOf(otherUserId)}`,
      "Couldn't cancel that request. Try again.",
    );

  const handleRemove = (otherUserId: string) =>
    dropRow(
      otherUserId,
      (row) => removeFriend(supabase, row.id, userId!),
      `Removed ${nameOf(otherUserId)} from your friends`,
      `Couldn't remove ${nameOf(otherUserId)}. Try again.`,
    );

  const handleCopyProfileLink = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${userId}`);
      showToast("Profile link copied");
    } catch {
      showToast("Couldn't copy the link. Copy it from your profile page's address bar.");
    }
  };

  return (
    <FriendsView
      loading={loading}
      friends={friends}
      incoming={incoming}
      sent={sent}
      myTags={myTags}
      query={query}
      onQueryChange={setQuery}
      searching={searching}
      results={results}
      relationOf={relationOf}
      busy={busy}
      onAdd={handleAdd}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onCancelRequest={handleCancelRequest}
      onRemove={handleRemove}
      onCopyProfileLink={() => { void handleCopyProfileLink(); }}
    />
  );
}
