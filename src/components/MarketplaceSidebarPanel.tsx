import React, { useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { uuidv4 } from './MarketplacePanel';
import { MCP_REGISTRY } from '../data/mcpRegistry';
import { PROVIDER_REGISTRY } from '../data/providerRegistry';
import type { ProviderConfig, McpServerConfig, McpTransport } from '../types';

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
      <div className="w-7 h-7 flex-shrink-0 bg-white rounded-lg p-0.5 flex items-center justify-center">
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
    'Free tier': 'bg-green-900/40 text-green-400 border-green-700',
    'Free':      'bg-green-900/40 text-green-400 border-green-700',
    'API Key':   'bg-amber-900/40 text-amber-400 border-amber-700',
    'Local':     'bg-sky-900/40   text-sky-400   border-sky-700',
    'Local install': 'bg-sky-900/40 text-sky-400 border-sky-700',
    'Enterprise':'bg-purple-900/40 text-purple-400 border-purple-700',
    'Self-hosted':'bg-slate-700    text-slate-300 border-slate-600',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colours[label] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
      {label}
    </span>
  );
}

// ─── Type pill ────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'provider' | 'mcp';

const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'provider', label: 'Providers' },
  { id: 'mcp',      label: 'MCP' },
];

// ─── Unified entry ────────────────────────────────────────────────────────────

type UnifiedEntry =
  | { kind: 'provider'; id: string; name: string; description: string; badge: string; installed: boolean; emoji?: string }
  | { kind: 'mcp';      id: string; name: string; description: string; badge?: string; installed: boolean; emoji: string; notes?: string };

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketplaceSidebarPanel() {
  const [query, setQuery]   = useState('');
  const [typePill, setTypePill] = useState<TypeFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, saveSettings } = useSettingsStore();

  // Parse @mcp / @provider prefix from raw query
  const atMatch = query.match(/^@(mcp|provider)\s*/i);
  const prefixType: TypeFilter = atMatch
    ? (atMatch[1].toLowerCase() === 'mcp' ? 'mcp' : 'provider')
    : 'all';
  const effectiveType: TypeFilter = atMatch ? prefixType : typePill;
  const cleanQuery = query.replace(/^@\w+\s*/, '').toLowerCase().trim();

  // Sync pill when @ prefix is typed
  const handleQueryChange = (val: string) => {
    setQuery(val);
    const m = val.match(/^@(mcp|provider)\s*/i);
    if (m) setTypePill(m[1].toLowerCase() === 'mcp' ? 'mcp' : 'provider');
  };

  const handlePillClick = (id: TypeFilter) => {
    setTypePill(id);
    // Clear any @ prefix from input when clicking a pill
    setQuery((q) => q.replace(/^@\w+\s*/, ''));
    inputRef.current?.focus();
  };

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

    let pool: UnifiedEntry[] =
      effectiveType === 'provider' ? providers
      : effectiveType === 'mcp'    ? mcpServers
      : [...providers, ...mcpServers];

    if (cleanQuery) {
      pool = pool.filter(
        (e) =>
          e.name.toLowerCase().includes(cleanQuery) ||
          e.description.toLowerCase().includes(cleanQuery),
      );
    }

    return pool;
  }, [settings, effectiveType, cleanQuery]);

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
    } else {
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
    }
  };

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
            placeholder="Search… or type @mcp, @provider"
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

        {/* Type filter pills */}
        <div className="flex gap-1">
          {TYPE_PILLS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handlePillClick(id)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                effectiveType === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-600 self-center">
            {entries.length}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {entries.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8 px-4">No results</p>
        ) : (
          entries.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-700/40 transition-colors"
            >
              <EntryIcon id={entry.id} name={entry.name} emoji={entry.emoji} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-xs font-medium text-slate-200 truncate">{entry.name}</span>
                  {/* Kind badge */}
                  <span className={`text-[9px] font-semibold px-1 py-px rounded uppercase tracking-wide ${
                    entry.kind === 'provider'
                      ? 'bg-indigo-900/60 text-indigo-300'
                      : 'bg-teal-900/60 text-teal-300'
                  }`}>
                    {entry.kind === 'provider' ? 'Provider' : 'MCP'}
                  </span>
                  {entry.badge && <Badge label={entry.badge} />}
                  {entry.installed && (
                    <span className="text-[9px] font-semibold px-1 py-px rounded uppercase tracking-wide bg-green-900/40 text-green-400">
                      Added
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">
                  {entry.description}
                </p>
                {entry.kind === 'mcp' && entry.notes && (
                  <p className="text-[10px] text-amber-400/70 mt-0.5 leading-tight line-clamp-1">
                    ℹ️ {entry.notes}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleAdd(entry)}
                className={`flex-shrink-0 text-[11px] px-2 py-1 rounded-lg font-medium transition-colors ${
                  entry.installed
                    ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {entry.installed ? 'Re-add' : '+ Add'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

