import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  /** Optional follow-up link, e.g. to the game that was just logged. */
  link?: { to: string; label: string } | undefined;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, link?: Toast["link"]) => void;
  dismiss: (id: number) => void;
}

const VISIBLE_MS = 4500;
let nextId = 1;

/** Short confirmations for actions that otherwise leave no visible trace. */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, link) => {
    const id = nextId++;
    // Newest replaces older ones: two stacked confirmations are just noise.
    set({ toasts: [{ id, message, link }] });
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, VISIBLE_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
