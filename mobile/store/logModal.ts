import { create } from 'zustand';
import type { IGDBGame } from '@gameboxd/lib';

interface LogModalStore {
  isOpen: boolean;
  preselectedGame: IGDBGame | null;
  open: (game?: IGDBGame) => void;
  close: () => void;
}

export const useLogModal = create<LogModalStore>((set) => ({
  isOpen: false,
  preselectedGame: null,
  open: (game) => set({ isOpen: true, preselectedGame: game ?? null }),
  close: () => set({ isOpen: false, preselectedGame: null }),
}));
