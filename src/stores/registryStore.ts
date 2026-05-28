import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RegistrySource } from '../types';

// ─── Registry endpoints ───────────────────────────────────────────────────────

/** Production registry (canonical). Falls back to backup if unreachable. */
const REGISTRY_PRIMARY = 'https://registry.openconduit.ai/v1';

/** Backup registry (Cloudflare Worker, always available). */
const REGISTRY_BACKUP = 'https://openconduit-registry.chumchal-account.workers.dev/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistryType = 'themes' | 'personas' | 'prompts' | 'profiles' | 'providers' | 'mcp' | 'extensions';

export interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  author: string;
  verified: boolean;
  version: string;
  description: string;
  content: Record<string, unknown>;
  /** Set for entries originating from a custom `RegistrySource`; absent for public registry entries. */
  sourceId?: string;
}

interface RegistryIndex {
  checksum: string;
  updatedAt: string;
  count: number;
  entries: RegistryEntry[];
}

interface RegistryState {
  /** Cached index responses keyed by type (built-in public registry only). */
  cache: Partial<Record<RegistryType, RegistryIndex>>;
  /** Last-received ETag per type for conditional GET requests (built-in only). */
  etags: Partial<Record<RegistryType, string>>;
  /** Per-type loading flags. */
  loading: Partial<Record<RegistryType, boolean>>;
  /** Per-type error messages. */
  errors: Partial<Record<RegistryType, string>>;
  /** Currently active custom registry sources (pushed in from settings). */
  sources: RegistrySource[];
  /** When true the built-in public registry is excluded from results. */
  disablePublicRegistry: boolean;
  /** Entries fetched from custom sources, keyed by sourceId then type. */
  customCache: Record<string, Partial<Record<RegistryType, RegistryEntry[]>>>;

  /** Push custom sources from AppSettings into the store. */
  setSources: (sources: RegistrySource[], disablePublicRegistry?: boolean) => void;
  /** Fetch a single type from all active sources, using ETag to avoid redundant downloads. */
  fetchType: (type: RegistryType) => Promise<void>;
  /** Fetch all types in parallel. */
  fetchAll: () => Promise<void>;
  /** Return merged entries for a type from all active sources. */
  getEntries: (type: RegistryType) => RegistryEntry[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Fetch a single URL, adding ETag + optional Bearer token headers. */
async function fetchFromUrl(
  url: string,
  etag: string | undefined,
  token?: string,
): Promise<{ index: RegistryIndex; etag: string } | 'not-modified' | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers, redirect: 'error', signal: controller.signal });
    clearTimeout(timer);

    if (res.status === 304) return 'not-modified';
    if (!res.ok) return null;

    const data = await res.json() as RegistryIndex & { error?: string };
    if (data.error || !Array.isArray(data.entries)) return null;

    return { index: data, etag: res.headers.get('ETag') ?? '' };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Fetch from the built-in public registry (primary → backup fallback). */
async function fetchIndex(
  type: RegistryType,
  etag: string | undefined,
): Promise<{ index: RegistryIndex; etag: string } | 'not-modified' | null> {
  const urls = [
    `${REGISTRY_PRIMARY}/${type}/index.json`,
    `${REGISTRY_BACKUP}/${type}/index.json`,
  ];
  for (const url of urls) {
    const result = await fetchFromUrl(url, etag);
    if (result !== null) return result;
  }
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRegistryStore = create<RegistryState>()(
  persist(
    (set, get) => ({
      cache: {},
      etags: {},
      loading: {},
      errors: {},
      sources: [] as RegistrySource[],
      disablePublicRegistry: false,
      customCache: {},

      setSources: (sources, disablePublicRegistry = false) => {
        set({ sources, disablePublicRegistry });
      },

      getEntries: (type) => {
        const { cache, disablePublicRegistry, customCache } = get();
        const builtin: RegistryEntry[] = disablePublicRegistry ? [] : (cache[type]?.entries ?? []);
        const custom: RegistryEntry[] = Object.values(customCache).flatMap(
          (typeMap) => typeMap[type] ?? [],
        );
        return [...builtin, ...custom];
      },

      fetchType: async (type) => {
        if (get().loading[type]) return;

        set((s) => ({ loading: { ...s.loading, [type]: true }, errors: { ...s.errors, [type]: undefined } }));

        // ── Built-in public registry ──────────────────────────────────────────
        if (!get().disablePublicRegistry) {
          const result = await fetchIndex(type, get().etags[type]);
          if (result === 'not-modified') {
            // cache is fresh — nothing to do
          } else if (result === null) {
            if (!get().cache[type]) {
              set((s) => ({ errors: { ...s.errors, [type]: 'Could not load registry.' } }));
            }
          } else {
            set((s) => ({
              cache: { ...s.cache, [type]: result.index },
              etags: { ...s.etags, [type]: result.etag },
            }));
          }
        }

        // ── Custom sources ────────────────────────────────────────────────────
        const enabledSources = get().sources.filter((s) => s.enabled);
        await Promise.allSettled(
          enabledSources.map(async (source) => {
            const url = `${source.url.replace(/\/$/, '')}/${type}/index.json`;
            const result = await fetchFromUrl(url, undefined, source.token);
            if (result && result !== 'not-modified') {
              set((s) => ({
                customCache: {
                  ...s.customCache,
                  [source.id]: {
                    ...(s.customCache[source.id] ?? {}),
                    [type]: result.index.entries.map((e) => ({ ...e, sourceId: source.id })),
                  },
                },
              }));
            }
          }),
        );

        set((s) => ({ loading: { ...s.loading, [type]: false } }));
      },

      fetchAll: async () => {
        const types: RegistryType[] = ['themes', 'personas', 'prompts', 'profiles', 'providers', 'mcp', 'extensions'];
        await Promise.all(types.map((t) => get().fetchType(t)));
      },
    }),
    {
      name: 'oc-registry',
      // Persist cache, etags, and customCache — sources/flags come from AppSettings at runtime
      partialize: (s) => ({ cache: s.cache, etags: s.etags, customCache: s.customCache }),
    },
  ),
);
