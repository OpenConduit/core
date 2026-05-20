import React, { useRef, useState, useCallback } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';
import { useUiStore } from '../stores/uiStore';
import { exportAsJson, exportAsMarkdown, downloadFile } from '../lib/export';
import type { ConversationFolder } from '../types';

// ── Layout constants ───────────────────────────────────────────────────────
const INDENT = 16;
const BASE_X = 8;

// ── Close-on-outside-click ─────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, fn]);
}

// ── Indent guide lines ─────────────────────────────────────────────────────
function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: `${BASE_X + i * INDENT + INDENT / 2}px`, backgroundColor: 'rgba(100,116,139,0.18)' }}
        />
      ))}
    </>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4C1.5 3.17 2.17 2.5 3 2.5h3.293l1.5 1.5H13A1.5 1.5 0 0114.5 5.5v1.25H1V4z" fill="#dcb67a"/>
      <path d="M1 6.75h14L13.7 13.33A1.5 1.5 0 0112.22 14.5H3.78A1.5 1.5 0 012.3 13.33L1 6.75z" fill="#dcb67a"/>
    </svg>
  ) : (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4C1.5 3.17 2.17 2.5 3 2.5h3.293l1.5 1.5H13A1.5 1.5 0 0114.5 5.5v7A1.5 1.5 0 0113 14H3A1.5 1.5 0 011.5 12.5V4z" fill="#c09a5b"/>
    </svg>
  );
}

function ChatIcon({ color }: { color?: string }) {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M2 2.5A1.5 1.5 0 013.5 1h9A1.5 1.5 0 0114 2.5v8A1.5 1.5 0 0112.5 12H9l-3 3v-3H3.5A1.5 1.5 0 012 10.5v-8z" fill={color ?? '#75beff'}/>
    </svg>
  );
}

function FileIcon({ language }: { language?: string }) {
  const colorMap: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f1e05a', jsx: '#f1e05a',
    py: '#3572a5', md: '#519aba', json: '#9cdcfe', html: '#e44d26', css: '#563d7c',
  };
  const fill = language ? (colorMap[language] ?? '#cccccc') : '#cccccc';
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M9 1.5H3.5A1.5 1.5 0 002 3v10A1.5 1.5 0 003.5 14.5h9A1.5 1.5 0 0014 13V6L9 1.5z" fill={fill} opacity="0.85"/>
      <path d="M9 1.5V5.5A.5.5 0 009.5 6H14L9 1.5z" fill="rgba(255,255,255,0.2)"/>
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 flex-shrink-0 text-slate-500 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="currentColor"
    >
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
    </svg>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────
function ContextMenu({ items, onClose }: {
  items: Array<{ label: string; action: () => void; danger?: boolean }>;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-6 z-50 bg-[#1f2937] rounded border border-[#374151] shadow-2xl py-1 min-w-[170px]">
      {items.map(({ label, action, danger }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); onClose(); action(); }}
          className={`w-full text-left px-3 py-[5px] text-[12px] hover:bg-[#094771] hover:text-white transition-colors ${danger ? 'text-red-400' : 'text-[#cccccc]'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── AI Instructions Modal ──────────────────────────────────────────────────
function InstructionsModal({ folder, onSave, onClose }: {
  folder: ConversationFolder;
  onSave: (prompt: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(folder.systemPrompt ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1e1e2e] border border-[#3c3c3c] rounded-md shadow-2xl w-full max-w-lg p-5 mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-[#cccccc] mb-1">AI Instructions — {folder.name}</h3>
        <p className="text-[12px] text-slate-400 mb-3">
          Overrides the system prompt for all conversations in this folder (and subfolders, unless they define their own).
        </p>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full bg-[#0f0f0f] border border-[#3c3c3c] rounded text-[13px] text-[#cccccc] p-3 resize-y outline-none focus:border-blue-500/60 font-mono"
          placeholder="You are a helpful assistant specialized in…"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1 text-[12px] text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={() => { onSave(value); onClose(); }} className="px-3 py-1 text-[12px] bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Move-to-folder picker ─────────────────────────────────────────────────
function MoveFolderPicker({ folders, currentFolderId, onMove, onClose }: {
  folders: ConversationFolder[];
  currentFolderId: string | null | undefined;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const getDepth = (id: string | null): number => {
    if (!id) return 0;
    const f = folders.find((x) => x.id === id);
    return f ? 1 + getDepth(f.parentId) : 0;
  };
  const buildList = (parentId: string | null): ConversationFolder[] => {
    const ch = folders.filter((f) => f.parentId === parentId).sort((a, b) => a.order - b.order);
    return ch.flatMap((f) => [f, ...buildList(f.id)]);
  };

  return (
    <div ref={ref} className="absolute right-0 top-6 z-50 bg-[#1f2937] rounded border border-[#374151] shadow-2xl py-1 min-w-[180px] max-h-60 overflow-y-auto">
      <p className="text-[11px] text-slate-500 px-3 py-1">Move to folder</p>
      <button onClick={() => { onMove(null); onClose(); }} className={`w-full text-left px-3 py-[5px] text-[12px] hover:bg-[#094771] hover:text-white transition-colors ${currentFolderId == null ? 'text-blue-400' : 'text-[#cccccc]'}`}>
        Root (no folder)
      </button>
      {buildList(null).map((f) => (
        <button key={f.id} onClick={() => { onMove(f.id); onClose(); }} style={{ paddingLeft: `${12 + getDepth(f.id) * 10}px` }}
          className={`w-full text-left py-[5px] pr-3 text-[12px] hover:bg-[#094771] hover:text-white transition-colors truncate ${currentFolderId === f.id ? 'text-blue-400' : 'text-[#cccccc]'}`}>
          {f.name}
        </button>
      ))}
    </div>
  );
}

// ── Folder file rows (inline) ─────────────────────────────────────────────
function FolderFileRows({ folderId, depth }: { folderId: string; depth: number }) {
  const { folderFiles, deleteFolderFile } = useConversationStore();
  const files = folderFiles.filter((f) => f.folderId === folderId);
  if (files.length === 0) return null;

  return (
    <>
      {files.map((f) => (
        <div key={f.id} style={{ paddingLeft: `${BASE_X + depth * INDENT + INDENT / 2 + 2}px` }}
          className="group relative h-[22px] flex items-center gap-1.5 pr-1 text-[13px] text-[#9d9d9d] hover:bg-slate-700/25 cursor-default select-none">
          <IndentGuides depth={depth}/>
          <FileIcon language={f.language}/>
          <span className="flex-1 truncate">{f.name}</span>
          <button onClick={(e) => { e.stopPropagation(); deleteFolderFile(f.id); }} title="Remove"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/60 transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
    </>
  );
}

// ── Folder Row ─────────────────────────────────────────────────────────────
interface FolderRowProps {
  folder: ConversationFolder;
  depth: number;
  renamingId: string | null;
  onRenameStart: (id: string) => void;
  onRenameEnd: (id: string, name: string) => void;
  onNewSubfolder: (parentId: string) => void;
  onEditInstructions: (folder: ConversationFolder) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

function FolderRow({ folder, depth, renamingId, onRenameStart, onRenameEnd, onNewSubfolder, onEditInstructions, onDelete, onToggle }: FolderRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRenaming = renamingId === folder.id;
  useClickOutside(menuRef, () => setMenuOpen(false));

  return (
    <div style={{ paddingLeft: `${BASE_X + depth * INDENT}px` }}
      className="group relative h-[22px] flex items-center gap-1 pr-1 text-[13px] text-[#cccccc] hover:bg-slate-700/30 cursor-pointer select-none"
      onClick={() => !isRenaming && onToggle(folder.id)}>
      <IndentGuides depth={depth}/>
      <Chevron open={!folder.collapsed}/>
      <FolderIcon open={!folder.collapsed}/>

      {isRenaming ? (
        <input autoFocus value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => onRenameEnd(folder.id, renameValue)}
          onKeyDown={(e) => { if (e.key === 'Enter') onRenameEnd(folder.id, renameValue); if (e.key === 'Escape') onRenameEnd(folder.id, folder.name); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-[#3c3c3c] border border-[#007fd4] px-1 text-[13px] text-[#cccccc] outline-none"/>
      ) : (
        <span className="flex-1 min-w-0 truncate">{folder.name}</span>
      )}

      {folder.systemPrompt?.trim() && (
        <span title="Has AI instructions" className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"/>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 ml-0.5">
        <button onClick={(e) => { e.stopPropagation(); onNewSubfolder(folder.id); }} title="New Subfolder"
          className="p-0.5 rounded text-slate-500 hover:text-[#cccccc] hover:bg-slate-600/60">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </button>
        <div ref={menuRef} className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} title="More actions…"
            className="p-0.5 rounded text-slate-500 hover:text-[#cccccc] hover:bg-slate-600/60">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
            </svg>
          </button>
          {menuOpen && (
            <ContextMenu onClose={() => setMenuOpen(false)} items={[
              { label: 'Rename', action: () => { onRenameStart(folder.id); setRenameValue(folder.name); } },
              { label: 'New Subfolder', action: () => onNewSubfolder(folder.id) },
              { label: 'Edit AI Instructions', action: () => onEditInstructions(folder) },
              { label: 'Delete Folder', action: () => onDelete(folder.id), danger: true },
            ]}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Conversation Item ──────────────────────────────────────────────────────
interface ConversationItemProps {
  id: string;
  depth: number;
  title: string;
  active: boolean;
  updatedAt: number;
  folderId?: string | null;
  folders: ConversationFolder[];
  personaColor?: string;
  personaName?: string;
  onClick: () => void;
  onDelete: () => void;
  onExportJson: () => void;
  onExportMd: () => void;
  onOpenInSplit: (e: React.MouseEvent) => void;
  onMove: (folderId: string | null) => void;
}

function ConversationItem({ depth, title, active, updatedAt, folderId, folders, personaColor, personaName, onClick, onDelete, onExportJson, onExportMd, onOpenInSplit, onMove }: ConversationItemProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  useClickOutside(menuRef, () => { setMenuOpen(false); setShowMovePicker(false); });

  const date = new Date(updatedAt);
  const dateLabel = Date.now() - updatedAt < 86_400_000
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div onClick={onClick}
      title={`${title}\n${dateLabel}${personaName ? `\nPersona: ${personaName}` : ''}`}
      style={{ paddingLeft: `${BASE_X + depth * INDENT + INDENT / 2 + 2}px` }}
      className={`group relative h-[22px] flex items-center gap-1.5 pr-1 text-[13px] cursor-pointer select-none ${active ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-slate-700/30'}`}>
      <IndentGuides depth={depth}/>
      <ChatIcon color={active ? '#ffffff' : (personaColor ?? '#75beff')}/>
      <span className="flex-1 truncate">{title}</span>

      <div className={`flex items-center gap-0.5 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button onClick={onOpenInSplit} title="Open in split pane"
          className="p-0.5 rounded text-slate-400 hover:text-[#cccccc] hover:bg-slate-600/60">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18h10a2 2 0 012 2v14a2 2 0 01-2 2H9m0-18v18"/>
          </svg>
        </button>
        <div ref={menuRef} className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); setShowMovePicker(false); }} title="More actions…"
            className="p-0.5 rounded text-slate-400 hover:text-[#cccccc] hover:bg-slate-600/60">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
            </svg>
          </button>
          {menuOpen && !showMovePicker && (
            <ContextMenu onClose={() => setMenuOpen(false)} items={[
              { label: 'Move to folder\u2026', action: () => setShowMovePicker(true) },
              { label: 'Export JSON', action: onExportJson },
              { label: 'Export Markdown', action: onExportMd },
              { label: 'Delete', action: onDelete, danger: true },
            ]}/>
          )}
          {menuOpen && showMovePicker && (
            <MoveFolderPicker folders={folders} currentFolderId={folderId}
              onMove={(fId) => { onMove(fId); setMenuOpen(false); setShowMovePicker(false); }}
              onClose={() => { setMenuOpen(false); setShowMovePicker(false); }}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Persona picker ─────────────────────────────────────────────────────────
function PersonaPicker({ personas, onSelect, onClose }: {
  personas: Array<{ id: string; name: string; color?: string; systemPrompt?: string; isDefault?: boolean }>;
  onSelect: (personaId?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  return (
    <div ref={ref} className="absolute top-full right-0 mt-px bg-[#1f2937] border border-[#374151] rounded shadow-xl z-20 overflow-hidden min-w-[160px]">
      {personas.map((p) => (
        <button key={p.id}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#cccccc] hover:bg-[#094771] hover:text-white transition-colors text-left"
          onClick={() => { onSelect(p.isDefault ? undefined : p.id); onClose(); }}>
          <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: p.color ?? '#64748b' }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { conversations, addConversation, deleteConversation, openTab, folders, createFolder, updateFolder, deleteFolder, toggleFolderCollapsed, moveConversation } = useConversationStore();
  const { settings } = useSettingsStore();
  const { personas } = usePersonasStore();
  const { activeConversationId, setActiveConversation, openSplitPane } = useUiStore();

  const [query, setQuery] = useState('');
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [instructionsFolder, setInstructionsFolder] = useState<ConversationFolder | null>(null);

  const hasCustomPersonas = personas.some((p) => !p.isDefault);

  const startConversation = (personaId?: string) => {
    const persona = personaId ? personas.find((p) => p.id === personaId) : undefined;
    const conv = addConversation({
      providerId: persona?.defaultProviderId ?? settings?.defaultProviderId,
      model: persona?.defaultModel ?? settings?.defaultModel,
      personaId,
    });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
    setShowPersonaPicker(false);
  };

  const handleNewFolder = () => {
    const folder = createFolder('New Folder');
    setRenamingFolderId(folder.id);
  };

  const handleExport = (id: string, format: 'json' | 'md') => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    if (format === 'json') downloadFile(exportAsJson(conv), `${conv.title}.json`, 'application/json');
    else downloadFile(exportAsMarkdown(conv), `${conv.title}.md`, 'text/markdown');
  };

  const handleDeleteConversation = (id: string) => {
    if (confirm('Delete this conversation?')) {
      deleteConversation(id);
      if (activeConversationId === id) setActiveConversation(null);
    }
  };

  const handleDeleteFolder = (id: string) => {
    if (confirm('Delete folder and move all conversations to root?')) deleteFolder(id);
  };

  const handleFolderRenameEnd = (id: string, name: string) => {
    if (name.trim()) updateFolder(id, { name: name.trim() });
    setRenamingFolderId(null);
  };

  const renderTree = useCallback((parentFolderId: string | null, depth: number): React.ReactNode => {
    const childFolders = folders.filter((f) => f.parentId === parentFolderId).sort((a, b) => a.order - b.order);
    const convs = conversations.filter((c) => (c.folderId ?? null) === parentFolderId).sort((a, b) => b.updatedAt - a.updatedAt);

    return (
      <>
        {childFolders.map((folder) => (
          <React.Fragment key={folder.id}>
            <FolderRow
              folder={folder} depth={depth} renamingId={renamingFolderId}
              onRenameStart={setRenamingFolderId}
              onRenameEnd={handleFolderRenameEnd}
              onNewSubfolder={(pid) => { const sub = createFolder('New Folder', pid); updateFolder(folder.id, { collapsed: false }); setRenamingFolderId(sub.id); }}
              onEditInstructions={setInstructionsFolder}
              onDelete={handleDeleteFolder}
              onToggle={toggleFolderCollapsed}
            />
            {!folder.collapsed && (
              <>
                {renderTree(folder.id, depth + 1)}
                <FolderFileRows folderId={folder.id} depth={depth + 1}/>
              </>
            )}
          </React.Fragment>
        ))}
        {convs.map((conv) => (
          <ConversationItem
            key={conv.id} id={conv.id} depth={depth} title={conv.title}
            active={conv.id === activeConversationId} updatedAt={conv.updatedAt}
            folderId={conv.folderId} folders={folders}
            personaColor={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.color : undefined}
            personaName={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.name : undefined}
            onClick={() => { openTab?.(conv.id); setActiveConversation(conv.id); }}
            onDelete={() => handleDeleteConversation(conv.id)}
            onExportJson={() => handleExport(conv.id, 'json')}
            onExportMd={() => handleExport(conv.id, 'md')}
            onOpenInSplit={(e) => { e.stopPropagation(); openSplitPane({ type: 'conversation', payload: conv.id }); }}
            onMove={(fId) => moveConversation(conv.id, fId)}
          />
        ))}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, conversations, activeConversationId, personas, renamingFolderId]);

  const isSearching = query.trim().length > 0;
  const filtered = isSearching ? conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase())) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase select-none">Conversations</span>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button onClick={() => hasCustomPersonas ? setShowPersonaPicker((v) => !v) : startConversation()} title="New Chat"
              className="p-1 rounded text-slate-500 hover:text-[#cccccc] hover:bg-slate-700/50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            {showPersonaPicker && <PersonaPicker personas={personas} onSelect={startConversation} onClose={() => setShowPersonaPicker(false)}/>}
          </div>
          <button onClick={handleNewFolder} title="New Folder"
            className="p-1 rounded text-slate-500 hover:text-[#cccccc] hover:bg-slate-700/50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      {(conversations.length > 0 || folders.length > 0) && (
        <div className="px-2 pb-1.5 flex-shrink-0">
          <div className="relative flex items-center">
            <svg className="absolute left-1.5 w-3 h-3 text-slate-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
              className="w-full h-[22px] bg-[#3c3c3c] text-[13px] text-[#cccccc] placeholder-slate-600 pl-6 pr-2 outline-none focus:outline focus:outline-1 focus:outline-[#007fd4]"/>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {conversations.length === 0 && folders.length === 0 && (
          <p className="text-[12px] text-slate-600 text-center px-4 py-8">No conversations yet</p>
        )}
        {isSearching ? (
          filtered && filtered.length === 0 ? (
            <p className="text-[12px] text-slate-600 text-center px-4 py-8">No results</p>
          ) : (
            filtered?.map((conv) => (
              <ConversationItem
                key={conv.id} id={conv.id} depth={0} title={conv.title}
                active={conv.id === activeConversationId} updatedAt={conv.updatedAt}
                folderId={conv.folderId} folders={folders}
                personaColor={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.color : undefined}
                personaName={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.name : undefined}
                onClick={() => { openTab?.(conv.id); setActiveConversation(conv.id); }}
                onDelete={() => handleDeleteConversation(conv.id)}
                onExportJson={() => handleExport(conv.id, 'json')}
                onExportMd={() => handleExport(conv.id, 'md')}
                onOpenInSplit={(e) => { e.stopPropagation(); openSplitPane({ type: 'conversation', payload: conv.id }); }}
                onMove={(fId) => moveConversation(conv.id, fId)}
              />
            ))
          )
        ) : (
          renderTree(null, 0)
        )}
      </div>

      {instructionsFolder && (
        <InstructionsModal folder={instructionsFolder}
          onSave={(prompt) => updateFolder(instructionsFolder.id, { systemPrompt: prompt })}
          onClose={() => setInstructionsFolder(null)}/>
      )}
    </div>
  );
}
