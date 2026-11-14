import { create } from "zustand";
import { getPendingRequests, getUnseenReviewNotificationCount, markReviewNotificationsSeen } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";

interface NotificationsStore {
  /** Number of incoming friend requests awaiting the user's response. */
  pendingRequests: number;
  /** Likes and comments on the user's logs that arrived since they last looked. */
  unseenReviews: number;
  /** Re-read both counts for a user. Safe to call often; failures are silent. */
  refresh: (userId: string) => Promise<void>;
  /** Set directly when the caller already knows the count (e.g. FriendsPage). */
  setPending: (count: number) => void;
  /** The user has opened their notifications: clear the count here and on the server. */
  markReviewsSeen: () => Promise<void>;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  pendingRequests: 0,
  unseenReviews: 0,
  refresh: async (userId) => {
    // Independent of each other: one failing must not blank the other.
    const [pending, unseen] = await Promise.allSettled([
      getPendingRequests(supabase, userId),
      getUnseenReviewNotificationCount(supabase),
    ]);
    // Non-critical — on failure leave the last known count in place.
    if (pending.status === "fulfilled") set({ pendingRequests: pending.value.length });
    if (unseen.status === "fulfilled") set({ unseenReviews: unseen.value });
  },
  setPending: (count) => set({ pendingRequests: count }),
  markReviewsSeen: async () => {
    set({ unseenReviews: 0 });
    try {
      await markReviewNotificationsSeen(supabase);
    } catch {
      // The badge is already cleared on this device; if the server didn't
      // record it, the next refresh shows the same items as new again.
    }
  },
  clear: () => set({ pendingRequests: 0, unseenReviews: 0 }),
}));
