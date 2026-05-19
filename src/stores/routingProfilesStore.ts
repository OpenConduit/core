import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutingTiers {
  fast?: string;
  balanced?: string;
  powerful?: string;
}

export interface InstalledRoutingProfile {
  id: string;
  name: string;
  description: string;
  author: string;
  verified: boolean;
  version: string;
  /** Model assignments per tier */
  tiers: RoutingTiers;
  /** Per-task-type overrides, e.g. { code: "balanced", research: "powerful" } */
  taskOverrides?: Record<string, string>;
  /** True when installed from registry.openconduit.ai, false for user-created */
  fromRegistry: boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface RoutingProfilesState {
  profiles: InstalledRoutingProfile[];
  /** The active routing profile ID, or null to use manual model selection */
  activeProfileId: string | null;
  addProfile: (p: Omit<InstalledRoutingProfile, 'id'>) => InstalledRoutingProfile;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  isInstalled: (registryId: string) => boolean;
}

export const useRoutingProfilesStore = create<RoutingProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [] as InstalledRoutingProfile[],
      activeProfileId: null as string | null,

      addProfile: (partial) => {
        const p: InstalledRoutingProfile = { id: uuidv4(), ...partial };
        set((s) => ({ profiles: [...s.profiles, p] }));
        return p;
      },

      removeProfile: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
        })),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      isInstalled: (registryId) =>
        get().profiles.some((p) => p.fromRegistry && p.name === registryId),
    }),
    { name: 'oc-routing-profiles', partialize: (s) => ({ profiles: s.profiles, activeProfileId: s.activeProfileId }) },
  ),
);
