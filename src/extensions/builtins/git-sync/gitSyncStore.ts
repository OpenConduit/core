import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitSyncTargets {
  conversations: boolean;
  personas: boolean;
  prompts: boolean;
  settings: boolean;
}

export interface GitSyncConfig {
  enabled: boolean;
  repoPath: string;
  remoteUrl: string;
  autoSync: boolean;
  syncTargets: GitSyncTargets;
}

interface GitSyncState {
  config: GitSyncConfig;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  // Actions
  setConfig(partial: Partial<GitSyncConfig>): void;
  setSyncTargets(targets: Partial<GitSyncTargets>): void;
  setSyncing(v: boolean): void;
  setSyncResult(at: number | null, error: string | null): void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultConfig: GitSyncConfig = {
  enabled: false,
  repoPath: '',
  remoteUrl: '',
  autoSync: false,
  syncTargets: {
    conversations: true,
    personas: true,
    prompts: true,
    settings: false,
  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

type PersistedGitSync = Pick<GitSyncState, 'config' | 'lastSyncAt' | 'lastError'>;

function partializeGitSync(s: GitSyncState): PersistedGitSync {
  return { config: s.config, lastSyncAt: s.lastSyncAt, lastError: s.lastError };
}

export const useGitSyncStore = create<GitSyncState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      isSyncing: false,
      lastSyncAt: null as number | null,
      lastError: null as string | null,

      setConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),

      setSyncTargets: (targets) =>
        set((s) => ({
          config: {
            ...s.config,
            syncTargets: { ...s.config.syncTargets, ...targets },
          },
        })),

      setSyncing: (v) => set({ isSyncing: v }),

      setSyncResult: (at, error) =>
        set({ lastSyncAt: at, lastError: error, isSyncing: false }),
    }),
    {
      name: 'openconduit-git-sync',
      // Never persist isSyncing — always reset to false on load
      partialize: partializeGitSync,
    },
  ),
);
