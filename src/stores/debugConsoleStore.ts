import { create } from 'zustand';

export type DebugLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface DebugEntry {
  id: string;
  ts: number;
  level: DebugLevel;
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 500;

interface DebugConsoleState {
  entries: DebugEntry[];
  addEntry: (level: DebugLevel, message: string, data?: unknown) => void;
  clear: () => void;
}

export const useDebugConsoleStore = create<DebugConsoleState>()((set) => ({
  entries: [],

  addEntry: (level, message, data) =>
    set((s) => ({
      entries: [
        ...s.entries,
        { id: crypto.randomUUID(), ts: Date.now(), level, message, data },
      ].slice(-MAX_ENTRIES),
    })),

  clear: () => set({ entries: [] }),
}));
