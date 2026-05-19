import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { usePersonasStore } from '../stores/personasStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultItem =
  | { kind: 'conversation'; id: string; title: string; updatedAt: number; model?: string; providerId?: string }
  | { kind: 'command'; id: string; label: string; shortcut?: string; icon: React.ReactNode; action: () => void }
  | { kind: 'model'; providerId: string; providerName: string; model: string }
  | { kind: 'persona'; id: string; name: string; color: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconChat = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const IconNew = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
  </svg>
);
const IconSidebar = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconSettings = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconClose = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconCompare = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
  </svg>
);

// ─── Mode hint ────────────────────────────────────────────────────────────────

function ModeHint({ mode }: { mode: string }) {
  if (mode === 'command') return <span className="text-blue-400/70 text-[11px]">Commands</span>;
  if (mode === 'model')   return <span className="text-purple-400/70 text-[11px]">Switch model</span>;
  if (mode === 'persona') return <span className="text-emerald-400/70 text-[11px]">Switch persona</span>;
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setShowSettings, setSidebarOpen, sidebarOpen, setCompareMode, activeConversationId, setActiveConversation } = useUiStore();
  const { conversations, addConversation, openTab, closeTab, updateConversation, openTabs } = useConversationStore();
  const { settings, models, loadModels } = useSettingsStore();
  const { personas } = usePersonasStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery('');
    setActiveIdx(0);
  }, [setCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  // Detect prefix mode
  const mode = useMemo(() => {
    if (query.startsWith('>')) return 'command';
    if (query.startsWith('@')) return 'model';
    if (query.startsWith('#')) return 'persona';
    return 'default';
  }, [query]);

  const bareQuery = useMemo(() => {
    if (mode !== 'default') return query.slice(1).trimStart();
    return query;
  }, [mode, query]);

  // Load models when switching to model mode
  useEffect(() => {
    if (mode === 'model' && settings) {
      settings.providers.forEach((p) => { if (!models[p.id]) loadModels(p.id); });
    }
  }, [mode, settings, models, loadModels]);

  // ── Build result list ──────────────────────────────────────────────────────

  const commands = useMemo((): ResultItem[] => {
    const list: ResultItem[] = [
      {
        kind: 'command', id: 'new-conv', label: 'New conversation', shortcut: '⌘T', icon: IconNew,
        action: () => {
          if (!settings) return;
          const conv = addConversation({ providerId: settings.defaultProviderId, model: settings.defaultModel });
          openTab?.(conv.id);
          setActiveConversation(conv.id);
          close();
        },
      },
      {
        kind: 'command', id: 'toggle-sidebar', label: 'Toggle sidebar', icon: IconSidebar,
        action: () => { setSidebarOpen(!sidebarOpen); close(); },
      },
      {
        kind: 'command', id: 'open-settings', label: 'Open settings', shortcut: '⌘,', icon: IconSettings,
        action: () => { setShowSettings(true); close(); },
      },
      {
        kind: 'command', id: 'close-tab', label: 'Close tab', shortcut: '⌘W', icon: IconClose,
        action: () => {
          if (!activeConversationId) return;
          const tabs = openTabs ?? [];
          const idx = tabs.indexOf(activeConversationId);
          closeTab?.(activeConversationId);
          const remaining = tabs.filter((t) => t !== activeConversationId);
          setActiveConversation(remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)] : null);
          close();
        },
      },
      {
        kind: 'command', id: 'compare', label: 'Compare models', icon: IconCompare,
        action: () => { setCompareMode(true); close(); },
      },
    ];
    if (!bareQuery) return list;
    return list.filter((c): c is Extract<ResultItem, { kind: 'command' }> => c.kind === 'command' && matches(c.label, bareQuery));
  }, [settings, addConversation, openTab, closeTab, openTabs, activeConversationId, setActiveConversation, setSidebarOpen, sidebarOpen, setShowSettings, setCompareMode, close, bareQuery]);

  const results = useMemo((): ResultItem[] => {
    if (mode === 'command') return commands;

    if (mode === 'model') {
      const items: ResultItem[] = [];
      if (settings) {
        for (const provider of settings.providers) {
          const all = [...(provider.customModels ?? []), ...(models[provider.id] ?? []).filter((m) => !provider.customModels?.includes(m))];
          for (const m of all) {
            if (!bareQuery || matches(m, bareQuery) || matches(provider.name, bareQuery)) {
              items.push({ kind: 'model', providerId: provider.id, providerName: provider.name, model: m });
            }
          }
        }
      }
      return items;
    }

    if (mode === 'persona') {
      return personas
        .filter((p) => !bareQuery || matches(p.name, bareQuery))
        .map((p) => ({ kind: 'persona' as const, id: p.id, name: p.name, color: p.color ?? '#64748b' }));
    }

    // Default: recent conversations + commands
    const convItems: ResultItem[] = conversations
      .filter((c) => !bareQuery || matches(c.title, bareQuery))
      .slice(0, 8)
      .map((c) => ({ kind: 'conversation', id: c.id, title: c.title, updatedAt: c.updatedAt, model: c.model, providerId: c.providerId }));

    const cmdItems = commands.slice(0, bareQuery ? commands.length : 3);
    return [...convItems, ...cmdItems];
  }, [mode, commands, conversations, settings, models, personas, bareQuery]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results.length, query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // ── Execute selected result ────────────────────────────────────────────────

  const execute = useCallback((item: ResultItem) => {
    if (item.kind === 'conversation') {
      openTab?.(item.id);
      setActiveConversation(item.id);
      close();
    } else if (item.kind === 'command') {
      item.action();
    } else if (item.kind === 'model') {
      if (activeConversationId) {
        updateConversation(activeConversationId, { providerId: item.providerId, model: item.model, routingProfileId: undefined });
      }
      close();
    } else if (item.kind === 'persona') {
      if (activeConversationId) {
        updateConversation(activeConversationId, { personaId: item.id });
      }
      close();
    }
  }, [openTab, setActiveConversation, close, activeConversationId, updateConversation]);

  // ── Keyboard handler ───────────────────────────────────────────────────────

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIdx]) execute(results[activeIdx]);
    }
  }, [close, results, activeIdx, execute]);

  if (!commandPaletteOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-[600px] mx-4 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === 'command' ? 'Type a command…' :
              mode === 'model'   ? 'Search models…' :
              mode === 'persona' ? 'Search personas…' :
              'Search conversations, > commands, @ models, # personas'
            }
            className="flex-1 bg-transparent text-slate-100 text-sm outline-none placeholder-slate-500 min-w-0"
          />
          <ModeHint mode={mode} />
          <kbd className="text-[10px] text-slate-500 font-mono hidden sm:block">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[400px] py-1">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">No results</div>
          )}

          {results.map((item, idx) => {
            const isActive = idx === activeIdx;
            const base = `flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isActive ? 'bg-slate-700' : 'hover:bg-slate-700/50'}`;

            if (item.kind === 'conversation') return (
              <div key={item.id} className={base} onMouseEnter={() => setActiveIdx(idx)} onClick={() => execute(item)}>
                <span className="text-slate-500 flex-shrink-0">{IconChat}</span>
                <span className="flex-1 text-sm text-slate-200 truncate">{item.title}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{relativeTime(item.updatedAt)}</span>
              </div>
            );

            if (item.kind === 'command') return (
              <div key={item.id} className={base} onMouseEnter={() => setActiveIdx(idx)} onClick={() => execute(item)}>
                <span className="text-blue-400/80 flex-shrink-0">{item.icon}</span>
                <span className="flex-1 text-sm text-slate-200">{item.label}</span>
                {item.shortcut && <kbd className="text-[10px] text-slate-500 font-mono">{item.shortcut}</kbd>}
              </div>
            );

            if (item.kind === 'model') return (
              <div key={`${item.providerId}/${item.model}`} className={base} onMouseEnter={() => setActiveIdx(idx)} onClick={() => execute(item)}>
                <span className="text-purple-400/80 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                  </svg>
                </span>
                <span className="flex-1 text-sm text-slate-200 truncate">{item.model}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{item.providerName}</span>
              </div>
            );

            if (item.kind === 'persona') return (
              <div key={item.id} className={base} onMouseEnter={() => setActiveIdx(idx)} onClick={() => execute(item)}>
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-sm text-slate-200">{item.name}</span>
              </div>
            );

            return null;
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700/60 text-[11px] text-slate-600">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">&gt;</kbd> commands</span>
          <span><kbd className="font-mono">@</kbd> models</span>
          <span><kbd className="font-mono">#</kbd> personas</span>
        </div>
      </div>
    </div>
  );
}
