import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { uuidv4 } from './MarketplacePanel';
import { MCP_REGISTRY } from '../data/mcpRegistry';
import { PROVIDER_REGISTRY } from '../data/providerRegistry';
import type { ProviderConfig, McpServerConfig, McpTransport } from '../types';
import type { InstalledTheme, ThemeColors } from '../types';
import { useThemesStore } from '../stores/themesStore';
import { usePersonasStore } from '../stores/personasStore';
import { usePromptTemplatesStore } from '../stores/promptTemplatesStore';
import type { PromptVariable } from '../stores/promptTemplatesStore';
import { useRoutingProfilesStore } from '../stores/routingProfilesStore';
import { useRegistryStore } from '../stores/registryStore';
import type { RegistryType, RegistryEntry } from '../stores/registryStore';

/** Returns true if `registryVer` is strictly greater than `installedVer` (semver). */
function isNewer(registryVer: string | undefined, installedVer: string | undefined): boolean {
  if (!registryVer || !installedVer) return false;
  const parse = (v: string) => v.split('.').map(Number);
  const [rA = 0, rB = 0, rC = 0] = parse(registryVer);
  const [iA = 0, iB = 0, iC = 0] = parse(installedVer);
  if (rA !== iA) return rA > iA;
  if (rB !== iB) return rB > iB;
  return rC > iC;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const _svgFiles = import.meta.glob(
  '../assets/marketplace/*.svg',
  { query: '?url', eager: true, import: 'default' },
) as Record<string, string>;

const ICON_FILE_MAP: Record<string, string> = {
  'azure-openai': 'azure',
  'azure-anthropic': 'azure',
};

function getIconUrl(id: string): string | undefined {
  const fileId = ICON_FILE_MAP[id] ?? id;
  return _svgFiles[`../assets/marketplace/${fileId}.svg`];
}

function EntryIcon({ id, name, emoji }: { id: string; name: string; emoji?: string }) {
  const url = getIconUrl(id);
  if (url) {
    return (
      <div className="w-7 h-7 flex-shrink-0 bg-white dark:bg-white rounded-lg p-0.5 border border-slate-200 dark:border-transparent flex items-center justify-center">
        <img src={url} alt={name} className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-xl leading-none">
      {emoji ?? '🔌'}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  const colours: Record<string, string> = {
    'Free tier':     'bg-green-100  text-green-700  border-green-300  dark:bg-green-900/40  dark:text-green-400  dark:border-green-700',
    'Free':          'bg-green-100  text-green-700  border-green-300  dark:bg-green-900/40  dark:text-green-400  dark:border-green-700',
    'API Key':       'bg-amber-100  text-amber-700  border-amber-300  dark:bg-amber-900/40  dark:text-amber-400  dark:border-amber-700',
    'Local':         'bg-sky-100    text-sky-700    border-sky-300    dark:bg-sky-900/40    dark:text-sky-400    dark:border-sky-700',
    'Local install': 'bg-sky-100    text-sky-700    border-sky-300    dark:bg-sky-900/40    dark:text-sky-400    dark:border-sky-700',
    'Enterprise':    'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-700',
    'Self-hosted':   'bg-slate-200  text-slate-600  border-slate-300  dark:bg-slate-700     dark:text-slate-300  dark:border-slate-600',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colours[label] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
      {label}
    </span>
  );
}

// ─── Type pill ────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'provider' | 'mcp' | 'theme' | 'persona' | 'prompt' | 'profile';

const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'provider', label: 'Providers' },
  { id: 'mcp',      label: 'MCP' },
  { id: 'theme',    label: 'Themes' },
  { id: 'persona',  label: 'Personas' },
  { id: 'prompt',   label: 'Prompts' },
  { id: 'profile',  label: 'Profiles' },
];

/** Registry type → TypeFilter mapping */
const REGISTRY_TYPE_MAP: Record<RegistryType, TypeFilter> = {
  themes:    'theme',
  personas:  'persona',
  prompts:   'prompt',
  profiles:  'profile',
  providers: 'provider',
  mcp:       'mcp',
};

// ─── Unified entry ────────────────────────────────────────────────────────────

type UnifiedEntry =
  | { kind: 'provider'; id: string; name: string; description: string; badge: string; installed: boolean; emoji?: string }
  | { kind: 'mcp';      id: string; name: string; description: string; badge?: string; installed: boolean; emoji: string; notes?: string }
  | { kind: 'theme';    id: string; name: string; description: string; author: string; verified: boolean; installed: boolean; hasUpdate: boolean; entry: RegistryEntry }
  | { kind: 'persona';  id: string; name: string; description: string; author: string; verified: boolean; installed: boolean; hasUpdate: boolean; entry: RegistryEntry }
  | { kind: 'prompt';   id: string; name: string; description: string; author: string; verified: boolean; installed: boolean; hasUpdate: boolean; entry: RegistryEntry }
  | { kind: 'profile';  id: string; name: string; description: string; author: string; verified: boolean; installed: boolean; hasUpdate: boolean; entry: RegistryEntry };

// ─── Kind colour map ──────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  provider: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  mcp:      'bg-teal-100   text-teal-700   dark:bg-teal-900/60   dark:text-teal-300',
  theme:    'bg-pink-100   text-pink-700   dark:bg-pink-900/60   dark:text-pink-300',
  persona:  'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
  prompt:   'bg-amber-100  text-amber-700  dark:bg-amber-900/60  dark:text-amber-300',
  profile:  'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/60   dark:text-cyan-300',
};

const KIND_LABELS: Record<string, string> = {
  provider: 'Provider', mcp: 'MCP', theme: 'Theme',
  persona: 'Persona', prompt: 'Prompt', profile: 'Profile',
};

// ─── Verified checkmark ───────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function MarketplaceRow({
  entry,
  onAdd,
  onRemove,
  onUpdate,
}: {
  entry: UnifiedEntry;
  onAdd: () => void;
  onRemove: () => void;
  onUpdate: () => void;
}) {
  const isRegistryKind = entry.kind === 'theme' || entry.kind === 'persona' || entry.kind === 'prompt' || entry.kind === 'profile';
  const canRemove = isRegistryKind && entry.kind !== 'persona'; // personas use their own delete flow
  const hasUpdate = isRegistryKind && (entry as { hasUpdate: boolean }).hasUpdate;

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-700/40 transition-colors">
      {'emoji' in entry ? (
        <EntryIcon id={entry.id} name={entry.name} emoji={entry.emoji} />
      ) : (
        <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-slate-700 flex items-center justify-center text-base leading-none">
          {entry.kind === 'theme' ? '🎨' : entry.kind === 'persona' ? '🤖' : entry.kind === 'prompt' ? '📝' : '⚙️'}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-xs font-medium text-slate-200 truncate">{entry.name}</span>
          <span className={`text-[9px] font-semibold px-1 py-px rounded uppercase tracking-wide ${KIND_COLORS[entry.kind]}`}>
            {KIND_LABELS[entry.kind]}
          </span>
          {'verified' in entry && entry.verified && <VerifiedBadge />}
          {'badge' in entry && entry.badge && <Badge label={entry.badge as string} />}
          {entry.installed && (
            <span className="text-[9px] font-semibold px-1 py-px rounded uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              Installed
            </span>
          )}
          {hasUpdate && (
            <span className="text-[9px] font-semibold px-1 py-px rounded uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              Update available
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">
          {entry.description}
        </p>
        {entry.kind === 'mcp' && entry.notes && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400/70 mt-0.5 leading-tight line-clamp-1">
            ℹ️ {entry.notes}
          </p>
        )}
        {'author' in entry && (
          <p className="text-[10px] text-slate-600 mt-0.5">by {entry.author}</p>
        )}
      </div>

      <div className="flex flex-col gap-1 flex-shrink-0">
        {hasUpdate ? (
          <>
            <button
              onClick={onUpdate}
              className="text-[11px] px-2 py-1 rounded-lg font-medium transition-colors bg-amber-600 text-white hover:bg-amber-500"
            >
              Update
            </button>
            {canRemove && (
              <button
                onClick={onRemove}
                className="text-[11px] px-2 py-1 rounded-lg font-medium transition-colors bg-slate-700 text-slate-400 hover:bg-red-900/40 hover:text-red-400"
              >
                Remove
              </button>
            )}
          </>
        ) : entry.installed && canRemove ? (
          <button
            onClick={onRemove}
            className="text-[11px] px-2 py-1 rounded-lg font-medium transition-colors bg-slate-700 text-slate-400 hover:bg-red-900/40 hover:text-red-400"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={onAdd}
            disabled={entry.installed && !canRemove}
            className={`text-[11px] px-2 py-1 rounded-lg font-medium transition-colors ${
              entry.installed
                ? 'bg-slate-700 text-slate-500 cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {entry.installed ? 'Added' : '+ Add'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketplaceSidebarPanel() {
  const [query, setQuery]   = useState('');
  const [typePill, setTypePill] = useState<TypeFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, saveSettings } = useSettingsStore();

  // Registry stores
  const { fetchType, getEntries, loading: regLoading, errors: regErrors } = useRegistryStore();
  const { installTheme, uninstallTheme, installedThemes, setActiveTheme } = useThemesStore();
  const { addPersona, deletePersona, personas: installedPersonas } = usePersonasStore();
  const { addTemplate, removeTemplate, templates: installedTemplates } = usePromptTemplatesStore();
  const { addProfile, removeProfile, profiles: installedProfiles } = useRoutingProfilesStore();

  // Fetch registry data for the active tab on demand
  useEffect(() => {
    const typeMap: Partial<Record<TypeFilter, RegistryType>> = {
      theme:   'themes',
      persona: 'personas',
      prompt:  'prompts',
      profile: 'profiles',
    };
    if (typePill === 'all') {
      // Fetch all registry types in parallel on first open
      (['themes', 'personas', 'prompts', 'profiles'] as RegistryType[]).forEach((t) => fetchType(t));
    } else {
      const rt = typeMap[typePill];
      if (rt) fetchType(rt);
    }
  }, [typePill, fetchType]);

  // Parse @mcp / @provider / @theme / etc. prefix from raw query
  const PREFIX_MAP: Record<string, TypeFilter> = {
    mcp: 'mcp', provider: 'provider', theme: 'theme',
    persona: 'persona', prompt: 'prompt', profile: 'profile',
  };
  const atMatch = query.match(/^@(\w+)\s*/i);
  const prefixType: TypeFilter = atMatch
    ? (PREFIX_MAP[atMatch[1].toLowerCase()] ?? 'all')
    : 'all';
  const effectiveType: TypeFilter = atMatch ? prefixType : typePill;
  const cleanQuery = query.replace(/^@\w+\s*/, '').toLowerCase().trim();

  // Sync pill when @ prefix is typed
  const handleQueryChange = (val: string) => {
    setQuery(val);
    const m = val.match(/^@(\w+)\s*/i);
    if (m && PREFIX_MAP[m[1].toLowerCase()]) {
      setTypePill(PREFIX_MAP[m[1].toLowerCase()]);
    }
  };

  const handlePillClick = (id: TypeFilter) => {
    setTypePill(id);
    setQuery((q) => q.replace(/^@\w+\s*/, ''));
    inputRef.current?.focus();
  };

  const installedThemeIds = useMemo(() => new Set(installedThemes.map((t) => t.id)), [installedThemes]);
  const installedPersonaNames = useMemo(() => new Set(installedPersonas.map((p) => p.name)), [installedPersonas]);
  const installedTemplateNames = useMemo(() => new Set(installedTemplates.map((t) => t.name)), [installedTemplates]);
  const installedProfileNames = useMemo(() => new Set(installedProfiles.map((p) => p.name)), [installedProfiles]);

  const entries: UnifiedEntry[] = useMemo(() => {
    if (!settings) return [];
    const addedProviderNames = new Set(settings.providers.map((p) => p.name));
    const installedMcpIds    = new Set((settings.mcpServers ?? []).map((s) => s.name));

    const providers: UnifiedEntry[] = PROVIDER_REGISTRY.map((e) => ({
      kind: 'provider',
      id: e.id,
      name: e.name,
      description: e.description,
      badge: e.badge,
      installed: addedProviderNames.has(e.name),
      emoji: e.icon,
    }));

    const mcpServers: UnifiedEntry[] = MCP_REGISTRY.map((e) => ({
      kind: 'mcp',
      id: e.id,
      name: e.name,
      description: e.description,
      badge: e.badge,
      installed: installedMcpIds.has(e.name),
      emoji: e.icon,
      notes: e.notes,
    }));

    const themes: UnifiedEntry[] = getEntries('themes').map((e) => ({
      kind: 'theme',
      id: e.id,
      name: e.name,
      description: e.description,
      author: e.author,
      verified: e.verified,
      installed: installedThemeIds.has(e.id),
      hasUpdate: isNewer(e.version, installedThemes.find((t) => t.id === e.id)?.version),
      entry: e,
    }));

    const personaEntries: UnifiedEntry[] = getEntries('personas').map((e) => ({
      kind: 'persona',
      id: e.id,
      name: e.name,
      description: e.description,
      author: e.author,
      verified: e.verified,
      installed: installedPersonaNames.has((e.content as { name?: string }).name ?? e.name),
      hasUpdate: isNewer(e.version, installedPersonas.find((p) => p.name === ((e.content as { name?: string }).name ?? e.name))?.version),
      entry: e,
    }));

    const promptEntries: UnifiedEntry[] = getEntries('prompts').map((e) => ({
      kind: 'prompt',
      id: e.id,
      name: e.name,
      description: e.description,
      author: e.author,
      verified: e.verified,
      installed: installedTemplateNames.has(e.name),
      hasUpdate: isNewer(e.version, installedTemplates.find((t) => t.name === e.name)?.version),
      entry: e,
    }));

    const profileEntries: UnifiedEntry[] = getEntries('profiles').map((e) => ({
      kind: 'profile',
      id: e.id,
      name: e.name,
      description: e.description,
      author: e.author,
      verified: e.verified,
      installed: installedProfileNames.has(e.name),
      hasUpdate: isNewer(e.version, installedProfiles.find((p) => p.name === e.name)?.version),
      entry: e,
    }));

    let pool: UnifiedEntry[] =
      effectiveType === 'provider' ? providers
      : effectiveType === 'mcp'    ? mcpServers
      : effectiveType === 'theme'  ? themes
      : effectiveType === 'persona'? personaEntries
      : effectiveType === 'prompt' ? promptEntries
      : effectiveType === 'profile'? profileEntries
      : [...providers, ...mcpServers, ...themes, ...personaEntries, ...promptEntries, ...profileEntries];

    if (cleanQuery) {
      pool = pool.filter(
        (e) =>
          e.name.toLowerCase().includes(cleanQuery) ||
          e.description.toLowerCase().includes(cleanQuery),
      );
    }

    return pool;
  }, [settings, effectiveType, cleanQuery, getEntries, installedThemeIds, installedPersonaNames, installedTemplateNames, installedProfileNames, installedThemes, installedPersonas, installedTemplates, installedProfiles]);

  const handleAdd = (entry: UnifiedEntry) => {
    if (!settings) return;

    if (entry.kind === 'provider') {
      const reg = PROVIDER_REGISTRY.find((e) => e.id === entry.id);
      if (!reg) return;
      const partial: Omit<ProviderConfig, 'id'> = {
        name: reg.name,
        type: reg.type,
        baseUrl: reg.baseUrl,
        defaultModel: reg.defaultModel,
      };
      saveSettings({ providers: [...settings.providers, { id: uuidv4(), ...partial }] });

    } else if (entry.kind === 'mcp') {
      const reg = MCP_REGISTRY.find((e) => e.id === entry.id);
      if (!reg) return;
      const partial: Omit<McpServerConfig, 'id'> = {
        name: reg.name,
        transport: reg.transport as McpTransport,
        url: reg.url,
        command: reg.command,
        args: reg.args ? [...reg.args] : undefined,
        env: reg.env
          ? { ...reg.env }
          : reg.requiresApiKey && reg.apiKeyEnvVar
            ? { [reg.apiKeyEnvVar]: '' }
            : undefined,
        enabled: true,
      };
      saveSettings({ mcpServers: [...(settings.mcpServers ?? []), { id: uuidv4(), ...partial }] });

    } else if (entry.kind === 'theme') {
      const c = entry.entry.content as { colors?: Record<string, string>; colorScheme?: string };
      if (!c.colors) return;
      const colorScheme = c.colorScheme === 'light' ? 'light' : 'dark';
      const theme: InstalledTheme = {
        id: entry.id,
        name: entry.name,
        author: entry.author,
        verified: entry.verified,
        description: entry.description,
        version: entry.entry.version,
        colorScheme,
        colors: c.colors as ThemeColors,
      };
      installTheme(theme);
      setActiveTheme(entry.id);
      saveSettings({ theme: colorScheme, activeThemeId: entry.id });

    } else if (entry.kind === 'persona') {
      const c = entry.entry.content as { name?: string; color?: string; systemPrompt?: string };
      addPersona({
        name: c.name ?? entry.name,
        color: c.color,
        systemPrompt: c.systemPrompt ?? '',
        version: entry.entry.version,
      });

  } else if (entry.kind === 'prompt') {
      const c = entry.entry.content as { template?: string; variables?: PromptVariable[] };
      addTemplate({
        name: entry.name,
        description: entry.description,
        author: entry.author,
        verified: entry.verified,
        version: entry.entry.version,
        template: c.template ?? '',
        variables: c.variables ?? [],
        fromRegistry: true,
      });

    } else if (entry.kind === 'profile') {
      const c = entry.entry.content as { tiers?: Record<string, string>; taskOverrides?: Record<string, string> };
      addProfile({
        name: entry.name,
        description: entry.description,
        author: entry.author,
        verified: entry.verified,
        version: entry.entry.version,
        tiers: c.tiers ?? {},
        taskOverrides: c.taskOverrides,
        fromRegistry: true,
      });
    }
  };

  const handleRemove = (entry: UnifiedEntry) => {
    if (entry.kind === 'theme') {
      uninstallTheme(entry.id);
    } else if (entry.kind === 'persona') {
      // persona removal is handled via PersonasSettings — skip here
    } else if (entry.kind === 'prompt') {
      const match = installedTemplates.find((t) => t.name === entry.name);
      if (match) removeTemplate(match.id);
    } else if (entry.kind === 'profile') {
      const match = installedProfiles.find((p) => p.name === entry.name);
      if (match) removeProfile(match.id);
    }
  };

  /** Remove the old installed copy then re-install the latest version from the registry. */
  const handleUpdate = (entry: UnifiedEntry) => {
    if (entry.kind === 'theme') {
      // installTheme dedupes by id, so calling handleAdd is sufficient
      handleAdd(entry);
    } else if (entry.kind === 'persona') {
      const personaName = (entry.entry.content as { name?: string }).name ?? entry.name;
      const existing = installedPersonas.find((p) => p.name === personaName);
      if (existing) deletePersona(existing.id);
      handleAdd(entry);
    } else if (entry.kind === 'prompt') {
      const existing = installedTemplates.find((t) => t.name === entry.name);
      if (existing) removeTemplate(existing.id);
      handleAdd(entry);
    } else if (entry.kind === 'profile') {
      const existing = installedProfiles.find((p) => p.name === entry.name);
      if (existing) removeProfile(existing.id);
      handleAdd(entry);
    }
  };

  // Loading/error state for the active registry type
  const activeRegistryType: RegistryType | null =
    effectiveType === 'theme'   ? 'themes'
    : effectiveType === 'persona' ? 'personas'
    : effectiveType === 'prompt'  ? 'prompts'
    : effectiveType === 'profile' ? 'profiles'
    : null;

  const isRegistryLoading = activeRegistryType ? !!regLoading[activeRegistryType] : false;
  const registryError     = activeRegistryType ? regErrors[activeRegistryType] : undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700 flex-shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Marketplace
        </p>

        {/* Search input */}
        <div className="relative mb-2">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search… or type @theme, @persona…"
            className="w-full bg-slate-700/60 text-slate-200 placeholder-slate-500 text-xs rounded-lg pl-7 pr-7 py-1.5 outline-none focus:ring-1 focus:ring-blue-500/60"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Type filter pills — scrollable row */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {TYPE_PILLS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handlePillClick(id)}
              className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                effectiveType === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto flex-shrink-0 text-[10px] text-slate-600 self-center">
            {entries.length}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {isRegistryLoading && entries.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8 px-4">Loading…</p>
        ) : registryError && entries.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8 px-4">{registryError}</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8 px-4">No results</p>
        ) : (
          entries.map((entry) => (
            <MarketplaceRow
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              onAdd={() => handleAdd(entry)}
              onRemove={() => handleRemove(entry)}
              onUpdate={() => handleUpdate(entry)}
            />
          ))
        )}
      </div>
    </div>
  );
}

