import { create } from 'zustand';

export type DebugLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';
export type LogCategory = 'provider' | 'mcp' | 'routing' | 'settings' | 'app';

export interface DebugEntry {
  id: string;
  ts: number;
  level: DebugLevel;
  message: string;
  data?: unknown;
  category?: LogCategory;
}

const MAX_ENTRIES = 500;

interface DebugConsoleState {
  entries: DebugEntry[];
  /** null = no filter (all categories pass); a Set = only those categories pass. Errors always pass. */
  enabledCategories: Set<LogCategory> | null;
  addEntry: (level: DebugLevel, message: string, data?: unknown, category?: LogCategory) => void;
  setEnabledCategories: (cats: Set<LogCategory> | null) => void;
  clear: () => void;
}

export const useDebugConsoleStore = create<DebugConsoleState>()((set, get) => ({
  entries: [],
  enabledCategories: null,

  addEntry: (level, message, data, category) => {
    const { enabledCategories } = get();
    // Always let errors through; uncategorised entries always pass.
    // Categorised entries are filtered when enabledCategories is a non-null Set.
    if (
      level !== 'error' &&
      category !== undefined &&
      enabledCategories !== null &&
      !enabledCategories.has(category)
    ) {
      return;
    }
    const entry: DebugEntry = { id: crypto.randomUUID(), ts: Date.now(), level, message, data, category };
    set((s) => ({
      entries: [...s.entries, entry].slice(-MAX_ENTRIES),
    }));
    // Fire-and-forget: persist to file via IPC (Electron only).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)?.api?.log?.write?.({ ts: entry.ts, level, message, data, category });
  },

  setEnabledCategories: (cats) => set({ enabledCategories: cats }),

  clear: () => set({ entries: [] }),
}));
