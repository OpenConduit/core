import React, { useRef, useState, useCallback, useEffect } from 'react';
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
  useEffect(() => {
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
          style={{ left: `${BASE_X + i * INDENT + INDENT / 2}px`, backgroundColor: 'rgba(100,116,139,0.22)' }}
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
  const fill = language ? (colorMap[language] ?? '#94a3b8') : '#94a3b8';
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

// ── Global context menu (fixed-position, cursor-anchored) ──────────────────
type CtxMenuItem = { label: string; action: () => void; danger?: boolean } | { info: string } | 'sep';

interface CtxMenuState { x: number; y: number; items: CtxMenuItem[] }

function GlobalCtxMenu({ state, onClose }: { state: CtxMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const MENU_W = 196;
  const adjustedX = state.x + MENU_W > window.innerWidth ? state.x - MENU_W : state.x;
  const approxH = state.items.length * 26 + 8;
  const adjustedY = state.y + approxH > window.innerHeight ? state.y - approxH : state.y;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 9999, width: MENU_W }}
      className="bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="my-1 h-px bg-slate-700/70" />
        ) : 'info' in item ? (
          <div key={i} className="px-3 py-[4px] text-[11px] text-slate-500 select-none">{item.info}</div>
        ) : (
          <button
            key={item.label}
            onClick={() => { onClose(); item.action(); }}
            className={`w-full text-left px-3 py-[5px] text-[12px] transition-colors hover:bg-slate-700 ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-slate-300'}`}
          >
            {item.label}
          </button>
        )
      )}
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
      <div className="bg-slate-900 border border-slate-700 rounded-md shadow-2xl w-full max-w-lg p-5 mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-slate-200 mb-1">AI Instructions — {folder.name}</h3>
        <p className="text-[12px] text-slate-400 mb-3">
          Overrides the system prompt for all conversations in this folder (and subfolders, unless they define their own).
        </p>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full bg-slate-950 border border-slate-700 rounded text-[13px] text-slate-200 p-3 resize-y outline-none focus:border-blue-500/60 font-mono"
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

// ── Move-to-folder modal picker ────────────────────────────────────────────
function MoveFolderModal({ folders, currentFolderId, onMove, onClose }: {
  folders: ConversationFolder[];
  currentFolderId: string | null | undefined;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-md shadow-2xl w-72 p-4 mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-slate-200 mb-3">Move to folder</h3>
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          <button
            onClick={() => { onMove(null); onClose(); }}
            className={`w-full text-left px-3 py-[5px] text-[12px] rounded transition-colors hover:bg-slate-700 ${currentFolderId == null ? 'text-blue-400' : 'text-slate-300'}`}
          >
            Root (no folder)
          </button>
          {buildList(null).map((f) => (
            <button
              key={f.id}
              onClick={() => { onMove(f.id); onClose(); }}
              style={{ paddingLeft: `${12 + getDepth(f.id) * 12}px` }}
              className={`w-full text-left py-[5px] pr-3 text-[12px] rounded transition-colors hover:bg-slate-700 truncate ${currentFolderId === f.id ? 'text-blue-400' : 'text-slate-300'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="px-3 py-1 text-[12px] text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
        </div>
      </div>
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
        <div
          key={f.id}
          style={{ paddingLeft: `${BASE_X + depth * INDENT + INDENT / 2 + 2}px` }}
          className="group relative h-[22px] flex items-center gap-1.5 pr-1 text-[13px] text-slate-400 hover:bg-slate-700/25 cursor-default select-none"
        >
          <IndentGuides depth={depth} />
          <FileIcon language={f.language} />
          <span className="flex-1 truncate">{f.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); deleteFolderFile(f.id); }}
            title="Remove"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/60 transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
  isRenaming: boolean;
  onRenameEnd: (name: string) => void;
  onToggle: (id: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function FolderRow({ folder, depth, isRenaming, onRenameEnd, onToggle, onContextMenu, isDragOver, onDragOver, onDragLeave, onDrop }: FolderRowProps) {
  const [renameValue, setRenameValue] = useState(folder.name);
  useEffect(() => { setRenameValue(folder.name); }, [folder.name]);

  return (
    <div
      style={{ paddingLeft: `${BASE_X + depth * INDENT}px` }}
      className={`group relative h-[22px] flex items-center gap-1 pr-1 text-[13px] text-slate-300 cursor-pointer select-none border-l-2 border-transparent transition-colors
        ${isDragOver ? 'bg-blue-500/15 border-blue-500/60' : 'hover:bg-slate-700/40'}`}
      onClick={() => !isRenaming && onToggle(folder.id)}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <IndentGuides depth={depth} />
      <Chevron open={!folder.collapsed} />
      <FolderIcon open={!folder.collapsed} />
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => onRenameEnd(renameValue)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameEnd(renameValue);
            if (e.key === 'Escape') onRenameEnd(folder.name);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-slate-950 border border-blue-500 px-1 text-[13px] text-slate-200 outline-none rounded-sm"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate">{folder.name}</span>
      )}
      {folder.systemPrompt?.trim() && (
        <span title="Has AI instructions" className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mr-0.5" />
      )}
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
  isRenaming: boolean;
  onRenameEnd: (name: string) => void;
  isDragging: boolean;
  isBranch?: boolean;
  personaColor?: string;
  personaName?: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onOpenInSplit: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ConversationItem({
  title, depth, active, updatedAt, isRenaming, onRenameEnd, isDragging, isBranch,
  personaColor, personaName, onClick, onContextMenu, onOpenInSplit, onDragStart, onDragEnd,
}: ConversationItemProps) {
  const [renameValue, setRenameValue] = useState(title);
  useEffect(() => { setRenameValue(title); }, [title]);

  const date = new Date(updatedAt);
  const dateLabel = Date.now() - updatedAt < 86_400_000
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={isRenaming ? undefined : onClick}
      onContextMenu={onContextMenu}
      title={`${title}\n${dateLabel}${personaName ? `\nPersona: ${personaName}` : ''}`}
      style={{ paddingLeft: `${BASE_X + depth * INDENT + INDENT / 2 + 2}px` }}
      className={`group relative h-[22px] flex items-center gap-1.5 pr-1 text-[13px] cursor-pointer select-none border-l-2 transition-colors
        ${active ? 'bg-slate-700 text-slate-100 border-blue-500' : 'text-slate-300 hover:bg-slate-700/40 border-transparent'}
        ${isDragging ? 'opacity-40' : ''}`}
    >
      <IndentGuides depth={depth} />
      {isBranch ? (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke={active ? '#6ee7b7' : '#34d399'} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 3v12m0 0a3 3 0 106 0m-6 0a3 3 0 006 0m0 0V9m0 0a3 3 0 106 0 3 3 0 00-6 0" />
        </svg>
      ) : (
        <ChatIcon color={active ? '#93c5fd' : (personaColor ?? '#75beff')} />
      )}
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => onRenameEnd(renameValue)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameEnd(renameValue);
            if (e.key === 'Escape') onRenameEnd(title);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-slate-950 border border-blue-500 px-1 text-[13px] text-slate-200 outline-none rounded-sm"
        />
      ) : (
        <span className="flex-1 truncate">{title}</span>
      )}
      {!isRenaming && (
        <button
          onClick={onOpenInSplit}
          title="Open in split pane"
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600/60 flex-shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18h10a2 2 0 012 2v14a2 2 0 01-2 2H9m0-18v18" />
          </svg>
        </button>
      )}
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
    <div ref={ref} className="absolute top-full right-0 mt-px bg-slate-900 border border-slate-700 rounded shadow-xl z-20 overflow-hidden min-w-[160px]">
      {personas.map((p) => (
        <button
          key={p.id}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors text-left"
          onClick={() => { onSelect(p.isDefault ? undefined : p.id); onClose(); }}
        >
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
  const {
    conversations, addConversation, deleteConversation, updateConversation,
    openTab, folders, createFolder, updateFolder, deleteFolder,
    toggleFolderCollapsed, moveConversation, detachBranch,
  } = useConversationStore();
  const { settings } = useSettingsStore();
  const { personas } = usePersonasStore();
  const { activeConversationId, setActiveConversation, openSplitPane } = useUiStore();

  const [query, setQuery] = useState('');
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [instructionsFolder, setInstructionsFolder] = useState<ConversationFolder | null>(null);
  const [movePickerConvId, setMovePickerConvId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  // drag-and-drop state
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const hasCustomPersonas = personas.some((p) => !p.isDefault);

  const startConversation = (personaId?: string, folderId?: string | null) => {
    const persona = personaId ? personas.find((p) => p.id === personaId) : undefined;
    const conv = addConversation({
      providerId: persona?.defaultProviderId ?? settings?.defaultProviderId,
      model: persona?.defaultModel ?? settings?.defaultModel,
      personaId,
      ...(folderId != null ? { folderId } : {}),
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

  // Delete key on selected conversation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!activeConversationId) return;
      e.preventDefault();
      handleDeleteConversation(activeConversationId);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeConversationId]);

  const handleDeleteFolder = (id: string) => {
    if (confirm('Delete folder and move all conversations to root?')) deleteFolder(id);
  };

  const handleFolderRenameEnd = (id: string, name: string) => {
    if (name.trim()) updateFolder(id, { name: name.trim() });
    setRenamingFolderId(null);
  };

  const handleConvRenameEnd = (id: string, name: string) => {
    if (name.trim()) updateConversation(id, { title: name.trim() });
    setRenamingConvId(null);
  };

  // ── Drag and drop handlers ─────────────────────────────────────────────
  const handleConvDragStart = (e: React.DragEvent, convId: string) => {
    e.dataTransfer.setData('text/plain', convId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingConvId(convId);
  };

  const handleConvDragEnd = () => {
    setDraggingConvId(null);
    setDragOverFolderId(null);
    setDragOverRoot(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
    setDragOverRoot(false);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const convId = e.dataTransfer.getData('text/plain');
    if (convId) moveConversation(convId, folderId);
    setDragOverFolderId(null);
    setDraggingConvId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (draggingConvId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverRoot(true);
      setDragOverFolderId(null);
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const convId = e.dataTransfer.getData('text/plain');
    if (convId) moveConversation(convId, null);
    setDragOverRoot(false);
    setDraggingConvId(null);
  };

  // ── Context menu builders ──────────────────────────────────────────────
  const openConvCtxMenu = (e: React.MouseEvent, conv: { id: string; folderId?: string | null; branchOf?: string; createdAt?: number }) => {
    e.preventDefault();
    e.stopPropagation();
    const { id, folderId, branchOf, createdAt } = conv;
    const createdLabel = createdAt
      ? `Created ${new Date(createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : undefined;
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        ...(createdLabel ? [{ info: createdLabel } as CtxMenuItem, 'sep' as CtxMenuItem] : []),
        { label: 'Open', action: () => { openTab?.(id); setActiveConversation(id); } },
        { label: 'Open in Split Pane', action: () => openSplitPane({ type: 'conversation', payload: id }) },
        'sep',
        { label: 'Rename', action: () => setRenamingConvId(id) },
        ...(branchOf ? [] : [{ label: 'Move to Folder\u2026', action: () => setMovePickerConvId(id) } as CtxMenuItem]),
        ...(branchOf ? ['sep' as CtxMenuItem, { label: 'Detach Branch', action: () => detachBranch(id) } as CtxMenuItem] : []),
        'sep',
        { label: 'Export JSON', action: () => handleExport(id, 'json') },
        { label: 'Export Markdown', action: () => handleExport(id, 'md') },
        'sep',
        { label: 'Delete', action: () => handleDeleteConversation(id), danger: true },
      ],
    });
    void folderId;
  };

  const openFolderCtxMenu = (e: React.MouseEvent, folder: ConversationFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'New Chat in Folder', action: () => startConversation(undefined, folder.id) },
        { label: 'New Subfolder', action: () => { const sub = createFolder('New Folder', folder.id); updateFolder(folder.id, { collapsed: false }); setRenamingFolderId(sub.id); } },
        'sep',
        { label: 'Edit AI Instructions', action: () => setInstructionsFolder(folder) },
        { label: 'Rename', action: () => { setRenamingFolderId(folder.id); } },
        'sep',
        { label: folder.collapsed ? 'Expand' : 'Collapse', action: () => toggleFolderCollapsed(folder.id) },
        'sep',
        { label: 'Delete Folder', action: () => handleDeleteFolder(folder.id), danger: true },
      ],
    });
  };

  // ── Tree renderer ──────────────────────────────────────────────────────
  const renderTree = useCallback((parentFolderId: string | null, depth: number): React.ReactNode => {
    const childFolders = folders.filter((f) => f.parentId === parentFolderId).sort((a, b) => a.order - b.order);
    // Exclude branch conversations that have their parent in this view (they render nested)
    const convs = conversations
      .filter((c) => (c.folderId ?? null) === parentFolderId && (!c.branchOf || !conversations.find((p) => p.id === c.branchOf)))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const renderBranches = (parentConvId: string, branchDepth: number): React.ReactNode => {
      const branches = conversations
        .filter((c) => c.branchOf === parentConvId)
        .sort((a, b) => a.createdAt - b.createdAt);
      return branches.map((branch) => (
        <React.Fragment key={branch.id}>
          <ConversationItem
            id={branch.id}
            depth={branchDepth}
            title={branch.title}
            active={branch.id === activeConversationId}
            updatedAt={branch.updatedAt}
            isRenaming={renamingConvId === branch.id}
            onRenameEnd={(name) => handleConvRenameEnd(branch.id, name)}
            isDragging={draggingConvId === branch.id}
            isBranch
            personaColor={branch.personaId ? personas.find((p) => p.id === branch.personaId)?.color : undefined}
            personaName={branch.personaId ? personas.find((p) => p.id === branch.personaId)?.name : undefined}
            onClick={() => { openTab?.(branch.id); setActiveConversation(branch.id); }}
            onContextMenu={(e) => openConvCtxMenu(e, { id: branch.id, folderId: branch.folderId, branchOf: branch.branchOf, createdAt: branch.createdAt })}
            onOpenInSplit={(e) => { e.stopPropagation(); openSplitPane({ type: 'conversation', payload: branch.id }); }}
            onDragStart={(e) => handleConvDragStart(e, branch.id)}
            onDragEnd={handleConvDragEnd}
          />
          {renderBranches(branch.id, branchDepth + 1)}
        </React.Fragment>
      ));
    };

    return (
      <>
        {childFolders.map((folder) => (
          <React.Fragment key={folder.id}>
            <FolderRow
              folder={folder}
              depth={depth}
              isRenaming={renamingFolderId === folder.id}
              onRenameEnd={(name) => handleFolderRenameEnd(folder.id, name)}
              onToggle={toggleFolderCollapsed}
              onContextMenu={(e) => openFolderCtxMenu(e, folder)}
              isDragOver={dragOverFolderId === folder.id}
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
            />
            {!folder.collapsed && (
              <>
                {renderTree(folder.id, depth + 1)}
                <FolderFileRows folderId={folder.id} depth={depth + 1} />
              </>
            )}
          </React.Fragment>
        ))}
        {convs.map((conv) => (
          <React.Fragment key={conv.id}>
          <ConversationItem
            id={conv.id}
            depth={depth}
            title={conv.title}
            active={conv.id === activeConversationId}
            updatedAt={conv.updatedAt}
            isRenaming={renamingConvId === conv.id}
            onRenameEnd={(name) => handleConvRenameEnd(conv.id, name)}
            isDragging={draggingConvId === conv.id}
            personaColor={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.color : undefined}
            personaName={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.name : undefined}
            onClick={() => { openTab?.(conv.id); setActiveConversation(conv.id); }}
            onContextMenu={(e) => openConvCtxMenu(e, { id: conv.id, folderId: conv.folderId, branchOf: conv.branchOf, createdAt: conv.createdAt })}
            onOpenInSplit={(e) => { e.stopPropagation(); openSplitPane({ type: 'conversation', payload: conv.id }); }}
            onDragStart={(e) => handleConvDragStart(e, conv.id)}
            onDragEnd={handleConvDragEnd}
          />
          {renderBranches(conv.id, depth + 1)}
          </React.Fragment>
        ))}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, conversations, activeConversationId, personas, renamingFolderId, renamingConvId, draggingConvId, dragOverFolderId]);

  const isSearching = query.trim().length > 0;
  const filtered = isSearching ? conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase())) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase select-none">Conversations</span>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              onClick={() => hasCustomPersonas ? setShowPersonaPicker((v) => !v) : startConversation()}
              title="New Chat"
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {showPersonaPicker && <PersonaPicker personas={personas} onSelect={startConversation} onClose={() => setShowPersonaPicker(false)} />}
          </div>
          <button onClick={handleNewFolder} title="New Folder" className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      {(conversations.length > 0 || folders.length > 0) && (
        <div className="px-2 pb-1.5 flex-shrink-0">
          <div className="relative flex items-center">
            <svg className="absolute left-1.5 w-3 h-3 text-slate-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full h-[22px] bg-slate-900/70 rounded-sm text-[13px] text-slate-300 placeholder-slate-600 pl-6 pr-2 outline-none border border-transparent focus:border-blue-500/60"
            />
          </div>
        </div>
      )}

      {/* Tree */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden transition-colors ${dragOverRoot ? 'bg-blue-500/5' : ''}`}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={handleRootDrop}
      >
        {conversations.length === 0 && folders.length === 0 && (
          <p className="text-[12px] text-slate-600 text-center px-4 py-8">No conversations yet</p>
        )}
        {isSearching ? (
          filtered && filtered.length === 0 ? (
            <p className="text-[12px] text-slate-600 text-center px-4 py-8">No results</p>
          ) : (
            filtered?.map((conv) => (
              <ConversationItem
                key={conv.id}
                id={conv.id}
                depth={0}
                title={conv.title}
                active={conv.id === activeConversationId}
                updatedAt={conv.updatedAt}
                isRenaming={renamingConvId === conv.id}
                onRenameEnd={(name) => handleConvRenameEnd(conv.id, name)}
                isDragging={draggingConvId === conv.id}
                personaColor={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.color : undefined}
                personaName={conv.personaId ? personas.find((p) => p.id === conv.personaId)?.name : undefined}
                onClick={() => { openTab?.(conv.id); setActiveConversation(conv.id); }}
                onContextMenu={(e) => openConvCtxMenu(e, { id: conv.id, folderId: conv.folderId, branchOf: conv.branchOf, createdAt: conv.createdAt })}
                onOpenInSplit={(e) => { e.stopPropagation(); openSplitPane({ type: 'conversation', payload: conv.id }); }}
                onDragStart={(e) => handleConvDragStart(e, conv.id)}
                onDragEnd={handleConvDragEnd}
              />
            ))
          )
        ) : (
          renderTree(null, 0)
        )}

        {/* Root drop zone indicator */}
        {draggingConvId && dragOverRoot && (
          <div className="mx-2 my-1 h-0.5 rounded bg-blue-500/60" />
        )}
      </div>

      {/* Modals & overlays */}
      {instructionsFolder && (
        <InstructionsModal
          folder={instructionsFolder}
          onSave={(prompt) => updateFolder(instructionsFolder.id, { systemPrompt: prompt })}
          onClose={() => setInstructionsFolder(null)}
        />
      )}
      {movePickerConvId && (
        <MoveFolderModal
          folders={folders}
          currentFolderId={conversations.find((c) => c.id === movePickerConvId)?.folderId}
          onMove={(fId) => { moveConversation(movePickerConvId, fId); setMovePickerConvId(null); }}
          onClose={() => setMovePickerConvId(null)}
        />
      )}
      {ctxMenu && <GlobalCtxMenu state={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}
