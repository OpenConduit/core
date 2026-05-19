import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstalledTheme, ThemeColors } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write a color map onto <html> as CSS custom properties. */
function applyColors(colors: ThemeColors): void {
  const root = document.documentElement;
  Object.entries(colors).forEach(([k, v]) => root.style.setProperty(k, v));
}

/** Remove all overrides — falls back to the defaults in brand_tokens.css. */
function clearColors(colors: ThemeColors): void {
  const root = document.documentElement;
  Object.keys(colors).forEach((k) => root.style.removeProperty(k));
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ThemesState {
  /** All user-installed themes (from marketplace). */
  installedThemes: InstalledTheme[];
  /** Id of the active custom theme, or null to use brand defaults. */
  activeThemeId: string | null;

  /** Install a theme from the marketplace. */
  installTheme: (theme: InstalledTheme) => void;
  /** Remove an installed theme. Clears it if it was active. */
  uninstallTheme: (id: string) => void;
  /** Apply a theme by id (must be installed). */
  setActiveTheme: (id: string | null) => void;
  /**
   * Re-apply the persisted active theme to the DOM.
   * Call once on app mount so CSS vars survive page reload.
   */
  restoreTheme: () => void;
}

export const useThemesStore = create<ThemesState>()(
  persist(
    (set, get) => ({
      installedThemes: [] as InstalledTheme[],
      activeThemeId: null as string | null,

      installTheme: (theme) =>
        set((s) => ({
          installedThemes: [
            ...s.installedThemes.filter((t) => t.id !== theme.id),
            theme,
          ],
        })),

      uninstallTheme: (id) => {
        const { installedThemes, activeThemeId } = get();
        const theme = installedThemes.find((t) => t.id === id);
        if (theme && activeThemeId === id) clearColors(theme.colors);
        set((s) => ({
          installedThemes: s.installedThemes.filter((t) => t.id !== id),
          activeThemeId: s.activeThemeId === id ? null : s.activeThemeId,
        }));
      },

      setActiveTheme: (id) => {
        const { installedThemes, activeThemeId } = get();

        // Clear previous theme overrides
        if (activeThemeId) {
          const prev = installedThemes.find((t) => t.id === activeThemeId);
          if (prev) clearColors(prev.colors);
        }

        if (id) {
          const next = installedThemes.find((t) => t.id === id);
          if (next) applyColors(next.colors);
        }

        set({ activeThemeId: id });
      },

      restoreTheme: () => {
        const { installedThemes, activeThemeId } = get();
        if (!activeThemeId) return;
        const theme = installedThemes.find((t) => t.id === activeThemeId);
        if (theme) applyColors(theme.colors);
      },
    }),
    {
      name: 'oc-themes',
      // Only persist the data, not the actions
      partialize: (s) => ({
        installedThemes: s.installedThemes,
        activeThemeId: s.activeThemeId,
      }),
    },
  ),
);
