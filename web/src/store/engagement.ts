import { useEffect } from "react";
import { create } from "zustand";
import { getReviewEngagement, likeReview, unlikeReview } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./auth";

export interface Engagement {
  likes: number;
  comments: number;
  likedByMe: boolean;
}

interface EngagementStore {
  /** Counts per log id. A log with no entry has not loaded (or could not). */
  byLog: Record<string, Engagement>;
  /** Ask for a log's counts. Requests made close together share one round trip. */
  request: (logId: string) => void;
  /**
   * Like or unlike as the signed-in user. The screen updates at once and is
   * put back if the server refuses, in which case this rejects.
   */
  toggleLike: (logId: string) => Promise<void>;
  /** Keep the comment count in step after posting (+1) or deleting (-1). */
  adjustComments: (logId: string, delta: number) => void;
  reset: () => void;
}

const BATCH_MS = 30;
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  timer = null;
  const ids = [...pending];
  pending.clear();
  if (ids.length === 0) return;
  try {
    const rows = await getReviewEngagement(supabase, ids);
    useEngagementStore.setState((state) => {
      const byLog = { ...state.byLog };
      for (const row of rows) byLog[row.logId] = { likes: row.likes, comments: row.comments, likedByMe: row.likedByMe };
      return { byLog };
    });
  } catch {
    // Counts are an extra on the card. If they can't load, the card simply
    // shows without them; nothing here is worth interrupting the page for.
  }
}

export const useEngagementStore = create<EngagementStore>((set, get) => ({
  byLog: {},

  request: (logId) => {
    if (get().byLog[logId] || pending.has(logId)) return;
    pending.add(logId);
    if (!timer) timer = setTimeout(() => { void flush(); }, BATCH_MS);
  },

  toggleLike: async (logId) => {
    const userId = useAuthStore.getState().userId;
    const before = get().byLog[logId];
    if (!userId || !before) throw new Error("Sign in to like this");

    const liked = !before.likedByMe;
    const patch = (value: Engagement) => set((state) => ({ byLog: { ...state.byLog, [logId]: value } }));
    patch({ ...before, likedByMe: liked, likes: Math.max(0, before.likes + (liked ? 1 : -1)) });
    try {
      if (liked) await likeReview(supabase, logId, userId);
      else await unlikeReview(supabase, logId, userId);
    } catch (error) {
      patch(before);
      throw error;
    }
  },

  adjustComments: (logId, delta) =>
    set((state) => {
      const current = state.byLog[logId];
      if (!current) return state;
      return { byLog: { ...state.byLog, [logId]: { ...current, comments: Math.max(0, current.comments + delta) } } };
    }),

  reset: () => {
    pending.clear();
    set({ byLog: {} });
  },
}));

// "Liked by me" belongs to whoever is signed in, so a sign-in or sign-out
// throws the cache away; mounted cards ask again (see useEngagement).
useAuthStore.subscribe((state, previous) => {
  if (state.userId !== previous.userId) useEngagementStore.getState().reset();
});

/**
 * Counts for one log, loaded on demand. Returns undefined until they arrive,
 * and stays undefined if they can't be loaded. Pass undefined when the card
 * has no log to attach likes to.
 */
export function useEngagement(logId: string | undefined): Engagement | undefined {
  const userId = useAuthStore((s) => s.userId);
  const engagement = useEngagementStore((s) => (logId ? s.byLog[logId] : undefined));
  const request = useEngagementStore((s) => s.request);

  useEffect(() => {
    if (logId) request(logId);
    // userId: after signing in or out the cache is cleared, so ask again.
  }, [logId, userId, request]);

  return engagement;
}
