import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Registry endpoints ───────────────────────────────────────────────────────

/** Production registry (canonical). Falls back to backup if unreachable. */
const REGISTRY_PRIMARY = 'https://registry.openconduit.ai/v1';

/** Backup registry (Cloudflare Worker, always available). */
const REGISTRY_BACKUP = 'https://openconduit-registry.chumchal-account.workers.dev/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistryType = 'themes' | 'personas' | 'prompts' | 'profiles' | 'providers' | 'mcp';

export interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  author: string;
  verified: boolean;
  version: string;
  description: string;
  content: Record<string, unknown>;
}

interface RegistryIndex {
  checksum: string;
  updatedAt: string;
  count: number;
  entries: RegistryEntry[];
}

interface RegistryState {
  /** Cached index responses keyed by type. */
  cache: Partial<Record<RegistryType, RegistryIndex>>;
  /** Last-received ETag per type for conditional GET requests. */
  etags: Partial<Record<RegistryType, string>>;
  /** Per-type loading flags. */
  loading: Partial<Record<RegistryType, boolean>>;
  /** Per-type error messages. */
  errors: Partial<Record<RegistryType, string>>;

  /** Fetch a single type, using ETag to avoid redundant downloads. */
  fetchType: (type: RegistryType) => Promise<void>;
  /** Fetch all six types in parallel. */
  fetchAll: () => Promise<void>;
  /** Return cached entries for a type, or empty array if not yet fetched. */
  getEntries: (type: RegistryType) => RegistryEntry[];
}

// ─── Fetch helper (primary → backup fallback) ─────────────────────────────────

async function fetchIndex(
  type: RegistryType,
  etag: string | undefined,
): Promise<{ index: RegistryIndex; etag: string } | 'not-modified' | null> {
  const urls = [
    `${REGISTRY_PRIMARY}/${type}/index.json`,   // try canonical first
    `${REGISTRY_BACKUP}/${type}/index.json`,    // fallback
  ];

  for (const url of urls) {
    try {
      const headers: Record<string, string> = {};
      if (etag) headers['If-None-Match'] = etag;

      const res = await fetch(url, { headers });

      if (res.status === 304) return 'not-modified';

      if (!res.ok) continue; // try next URL

      const data = await res.json() as RegistryIndex & { error?: string };

      // Worker returns { error } when type not yet populated
      if (data.error || !Array.isArray(data.entries)) continue;

      const newEtag = res.headers.get('ETag') ?? '';
      return { index: data, etag: newEtag };
    } catch {
      // network error — try next URL
    }
  }

  return null; // both URLs failed / returned no data
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRegistryStore = create<RegistryState>()(
  persist(
    (set, get) => ({
      cache: {},
      etags: {},
      loading: {},
      errors: {},

      getEntries: (type) => get().cache[type]?.entries ?? [],

      fetchType: async (type) => {
        if (get().loading[type]) return;

        set((s) => ({ loading: { ...s.loading, [type]: true }, errors: { ...s.errors, [type]: undefined } }));

        const result = await fetchIndex(type, get().etags[type]);

        if (result === 'not-modified') {
          set((s) => ({ loading: { ...s.loading, [type]: false } }));
          return;
        }

        if (result === null) {
          set((s) => ({
            loading: { ...s.loading, [type]: false },
            errors: { ...s.errors, [type]: 'Could not load registry.' },
          }));
          return;
        }

        set((s) => ({
          loading: { ...s.loading, [type]: false },
          cache: { ...s.cache, [type]: result.index },
          etags: { ...s.etags, [type]: result.etag },
        }));
      },

      fetchAll: async () => {
        const types: RegistryType[] = ['themes', 'personas', 'prompts', 'profiles', 'providers', 'mcp'];
        await Promise.all(types.map((t) => get().fetchType(t)));
      },
    }),
    {
      name: 'oc-registry',
      // Only persist cache + etags — loading/error are transient
      partialize: (s) => ({ cache: s.cache, etags: s.etags }),
    },
  ),
);
