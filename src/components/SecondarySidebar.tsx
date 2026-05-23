import React, { useRef } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSavedFilesStore, type SavedFile } from '../stores/filesStore';
import { extensionRegistry } from '../extensions/extensionRegistry';

// ── Stable slot for extension-contributed secondary sidebar panels ─────────────
function ExtSecondarySidebarPanel({ panelId }: { panelId: string }) {
  const panel = extensionRegistry.getSecondarySidebarPanels().find((p) => p.id === panelId);
  if (!panel) return null;
  return React.createElement(panel.component);
}

const SECONDARY_SIDEBAR_MIN = 200;
const SECONDARY_SIDEBAR_MAX = 640;

const TABS = [
  { id: 'context', label: 'Context' },
  { id: 'outline', label: 'Outline' },
  { id: 'related', label: 'Related' },
] as const;

export default function SecondarySidebar() {
  const {
    secondarySidebarPanel,
    setSecondarySidebarPanel,
    secondarySidebarWidth,
    setSecondarySidebarWidth,
    toggleSecondarySidebar,
    activeConversationId,
  } = useUiStore();
  const { conversations } = useConversationStore();
  const { files } = useSavedFilesStore();

  const widthRef = useRef(secondarySidebarWidth);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      // Dragging left = grows, dragging right = shrinks
      const w = Math.max(
        SECONDARY_SIDEBAR_MIN,
        Math.min(SECONDARY_SIDEBAR_MAX, startWidth + (startX - ev.clientX)),
      );
      widthRef.current = w;
      setSecondarySidebarWidth(w);
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const conversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  // Files associated with the active conversation
  const contextFiles = files.filter((f) => f.conversationId === activeConversationId);

  // AI message "outline" — first line of each assistant message
  const outlineItems = (conversation?.messages ?? [])
    .filter((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim())
    .map((m) => {
      const text = typeof m.content === 'string' ? m.content : '';
      const first = text.split('\n').find((l) => l.trim()) ?? '';
      return first.length > 80 ? first.slice(0, 80) + '…' : first;
    });

  return (
    <aside
      style={{ width: secondarySidebarWidth }}
      className="relative flex-shrink-0 bg-slate-800 flex flex-col border-l border-slate-700 overflow-hidden"
    >
      {/* Left-edge drag handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20 group"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-slate-700 group-hover:bg-blue-500 transition-colors duration-150" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Panel</span>
        <button
          onClick={toggleSecondarySidebar}
          title="Close panel (⌘⇧B)"
          className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex gap-0.5 px-2 pb-1 flex-shrink-0 border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSecondarySidebarPanel(tab.id)}
            className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
              secondarySidebarPanel === tab.id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {extensionRegistry.getSecondarySidebarPanels().map((panel) => (
          <button
            key={panel.id}
            onClick={() => setSecondarySidebarPanel(panel.id)}
            className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
              secondarySidebarPanel === panel.id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {secondarySidebarPanel === 'context' && (
          <ContextTab files={contextFiles} />
        )}
        {secondarySidebarPanel === 'outline' && (
          <OutlineTab items={outlineItems} />
        )}
        {secondarySidebarPanel === 'related' && (
          <RelatedTab />
        )}
        {(() => {
          const extPanel = extensionRegistry.getSecondarySidebarPanels().find(
            (p) => p.id === secondarySidebarPanel
          );
          if (!extPanel) return null;
          return <ExtSecondarySidebarPanel panelId={secondarySidebarPanel} />;
        })()}
      </div>
    </aside>
  );
}

// ─── Context tab ─────────────────────────────────────────────────────────────

function ContextTab({ files }: { files: SavedFile[] }) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        message="No files saved for this conversation"
      />
    );
  }

  return (
    <ul className="py-1">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 transition-colors group">
          <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[12px] text-slate-300 truncate flex-1">{f.name}</span>
          <span className="text-[10px] text-slate-600 flex-shrink-0">
            {f.size < 1024 ? `${f.size}B` : `${Math.round(f.size / 1024)}KB`}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Outline tab ──────────────────────────────────────────────────────────────

function OutlineTab({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8M4 18h12" />
          </svg>
        }
        message="No messages yet"
      />
    );
  }

  return (
    <ul className="py-1">
      {items.map((item, i) => (
        <li
          key={i}
          className="px-3 py-2 text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors cursor-default flex items-start gap-2"
        >
          <span className="text-slate-600 flex-shrink-0 tabular-nums mt-px">{i + 1}.</span>
          <span className="truncate">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Related tab ─────────────────────────────────────────────────────────────

function RelatedTab() {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      }
      message="Related conversations coming soon"
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full min-h-32 px-4 text-center">
      <span className="text-slate-600">{icon}</span>
      <p className="text-[12px] text-slate-500">{message}</p>
    </div>
  );
}
