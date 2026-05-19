import React, { useRef, useState } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';
import { useUiStore } from '../stores/uiStore';
import { exportAsJson, exportAsMarkdown, downloadFile } from '../lib/export';

export default function Sidebar() {
  const { conversations, addConversation, deleteConversation, openTab } = useConversationStore();
  const { settings } = useSettingsStore();
  const { personas } = usePersonasStore();
  const { activeConversationId, setActiveConversation } = useUiStore();
  const [query, setQuery] = useState('');
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const hasCustomPersonas = personas.some((p) => !p.isDefault);

  const startConversation = (personaId?: string) => {
    const persona = personaId ? personas.find((p) => p.id === personaId) : undefined;
    const conv = addConversation({
      providerId: persona?.defaultProviderId ?? settings?.defaultProviderId,
      model: persona?.defaultModel ?? settings?.defaultModel,
      personaId: personaId,
    });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
    setShowPersonaPicker(false);
  };

  const handleNew = () => {
    if (hasCustomPersonas) {
      setShowPersonaPicker((v) => !v);
    } else {
      startConversation();
    }
  };

  const handleExport = (e: React.MouseEvent, id: string, format: 'json' | 'md') => {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    if (format === 'json') {
      downloadFile(exportAsJson(conv), `${conv.title}.json`, 'application/json');
    } else {
      downloadFile(exportAsMarkdown(conv), `${conv.title}.md`, 'text/markdown');
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteConversation(id);
      if (activeConversationId === id) setActiveConversation(null);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex flex-col gap-2">
      {/* New chat button + persona picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
          {hasCustomPersonas && (
            <svg className="w-3 h-3 ml-auto opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {showPersonaPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-1.5">
              <p className="text-xs text-slate-500 px-2 py-1">Choose a persona</p>
              {personas.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
                  onClick={() => startConversation(p.isDefault ? undefined : p.id)}
                >
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: p.color ?? '#64748b' }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    {p.systemPrompt && (
                      <div className="text-xs text-slate-400 truncate">{p.systemPrompt}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
        {conversations.length > 0 && (
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-700/60 text-slate-200 placeholder-slate-500 text-xs rounded-lg pl-7 pr-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500/60"
            />
          </div>
        )}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-slate-500 text-xs text-center px-4 py-6">No conversations yet</p>
        )}
        {(() => {
          const filtered = query.trim()
            ? conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
            : conversations;
          if (conversations.length > 0 && filtered.length === 0) {
            return <p className="text-slate-500 text-xs text-center px-4 py-6">No matches</p>;
          }
          return filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            id={conv.id}
            title={conv.title}
            active={conv.id === activeConversationId}
            updatedAt={conv.updatedAt}
            personaColor={conv.personaId ? (personas.find((p) => p.id === conv.personaId)?.color) : undefined}
            personaName={conv.personaId ? (personas.find((p) => p.id === conv.personaId)?.name) : undefined}
            onClick={() => { openTab?.(conv.id); setActiveConversation(conv.id); }}
            onDelete={(e) => handleDelete(e, conv.id)}
            onExportJson={(e) => handleExport(e, conv.id, 'json')}
            onExportMd={(e) => handleExport(e, conv.id, 'md')}
          />
          ));
        })()}
      </div>

    </>
  );
}

interface ConversationItemProps {
  id: string;
  title: string;
  active: boolean;
  updatedAt: number;
  personaColor?: string;
  personaName?: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onExportJson: (e: React.MouseEvent) => void;
  onExportMd: (e: React.MouseEvent) => void;
}

function ConversationItem({
  title,
  active,
  updatedAt,
  personaColor,
  personaName,
  onClick,
  onDelete,
  onExportJson,
  onExportMd,
}: ConversationItemProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const date = new Date(updatedAt);
  const label =
    // eslint-disable-next-line react-hooks/purity
    Date.now() - updatedAt < 86_400_000
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center px-3 py-2 mx-2 rounded-lg cursor-pointer text-sm transition-colors ${
        active
          ? 'bg-slate-700 text-slate-100'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {personaColor && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: personaColor }}
              title={personaName}
            />
          )}
          <p className="truncate">{title}</p>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>

      {/* Context menu trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all ml-1"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          onBlur={() => setMenuOpen(false)}
          className="absolute right-0 top-8 z-50 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 min-w-[140px]"
        >
          {[
            { label: 'Export JSON', action: onExportJson },
            { label: 'Export Markdown', action: onExportMd },
            { label: 'Delete', action: onDelete, danger: true },
          ].map(({ label, action, danger }) => (
            <button
              key={label}
              onClick={(e) => {
                setMenuOpen(false);
                action(e);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-600 transition-colors ${
                danger ? 'text-red-400 hover:text-red-300' : 'text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
