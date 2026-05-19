import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstalledTheme, ThemeColors } from '../types';

// ─── Built-in themes ─────────────────────────────────────────────────────────

export const BUILT_IN_THEMES: InstalledTheme[] = [
  {
    id: 'builtin-dark',
    name: 'Default Dark',
    author: 'openconduit',
    verified: true,
    description: 'The default OpenConduit dark theme.',
    colors: {
      '--color-primary':    '#7c3aed',
      '--color-surface':    '#1e1e2e',
      '--color-background': '#13131f',
      '--color-muted':      '#2a2a3e',
      '--color-text':       '#e2e8f0',
      '--color-border':     '#2d2d45',
    },
  },
  {
    id: 'builtin-light',
    name: 'Default Light',
    author: 'openconduit',
    verified: true,
    description: 'Clean light theme for bright environments.',
    colors: {
      '--color-primary':    '#7c3aed',
      '--color-surface':    '#ffffff',
      '--color-background': '#f5f5f7',
      '--color-muted':      '#e5e5ea',
      '--color-text':       '#1c1c1e',
      '--color-border':     '#d1d1d6',
    },
  },
];

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

/** Find a theme by id across built-ins + installed. */
function findTheme(id: string, installed: InstalledTheme[]): InstalledTheme | undefined {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? installed.find((t) => t.id === id);
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ThemesState {
  /** User-installed themes (from marketplace). Built-ins are always available via BUILT_IN_THEMES. */
  installedThemes: InstalledTheme[];
  /** Id of the active theme, or null to use brand_tokens.css defaults. */
  activeThemeId: string | null;

  /** Install a theme from the marketplace. */
  installTheme: (theme: InstalledTheme) => void;
  /** Remove an installed theme. Clears it if it was active. */
  uninstallTheme: (id: string) => void;
  /** Apply a theme by id (built-in or installed). Pass null to reset to brand defaults. */
  setActiveTheme: (id: string | null) => void;
  /** Re-apply the persisted active theme on mount so CSS vars survive reload. */
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

        // Clear previous overrides
        if (activeThemeId) {
          const prev = findTheme(activeThemeId, installedThemes);
          if (prev) clearColors(prev.colors);
        }

        if (id) {
          const next = findTheme(id, installedThemes);
          if (next) applyColors(next.colors);
        }

        set({ activeThemeId: id });
      },

      restoreTheme: () => {
        const { installedThemes, activeThemeId } = get();
        if (!activeThemeId) return;
        const theme = findTheme(activeThemeId, installedThemes);
        if (theme) applyColors(theme.colors);
      },
    }),
    {
      name: 'oc-themes',
      partialize: (s) => ({
        installedThemes: s.installedThemes,
        activeThemeId: s.activeThemeId,
      }),
    },
  ),
);
