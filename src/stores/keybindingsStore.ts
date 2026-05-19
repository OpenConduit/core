import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Binding = { key: string; mod?: boolean; shift?: boolean; alt?: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the effective keybinding for a command, accounting for user overrides.
 * Returns `null` if explicitly unbound or if neither an override nor a default exists.
 */
export function getEffectiveBinding(
  cmd: { id: string; keybinding?: Binding },
  overrides: Record<string, Binding | null>,
): Binding | null {
  if (cmd.id in overrides) return overrides[cmd.id];
  return cmd.keybinding ?? null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface KeybindingsState {
  /** User-defined overrides: id → Binding (or null to explicitly unbind). */
  overrides: Record<string, Binding | null>;
  /** Set or remove a keybinding override for a command. Pass null to unbind. */
  setOverride(id: string, binding: Binding | null): void;
  /** Remove the override for a command, restoring the default. */
  resetOverride(id: string): void;
  /** Remove all overrides. */
  resetAll(): void;
}

export const useKeybindingsStore = create<KeybindingsState>()(
  persist(
    (set) => ({
      overrides: {},

      setOverride: (id, binding) =>
        set((s) => ({ overrides: { ...s.overrides, [id]: binding } })),

      resetOverride: (id) =>
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _removed, ...rest } = s.overrides;
          return { overrides: rest };
        }),

      resetAll: () => set({ overrides: {} }),
    }),
    {
      name: 'oc-keybindings',
      partialize: (s) => ({ overrides: s.overrides }),
    },
  ),
);
