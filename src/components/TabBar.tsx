import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';
import ModelPickerButton from './ModelPickerButton';

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export default function TabBar() {
  const conversations = useConversationStore((s) => s.conversations);
  const openTabs = useConversationStore((s) => s.openTabs);
  const closeTab = useConversationStore((s) => s.closeTab);
  const openTab = useConversationStore((s) => s.openTab);
  const addConversation = useConversationStore((s) => s.addConversation);
  const updateConversation = useConversationStore((s) => s.updateConversation);
  const {
    activeConversationId,
    setActiveConversation,
    setShowSettings,
    setCompareMode,
  } = useUiStore();
  const { settings, models, loadModels } = useSettingsStore();
  const { personas } = usePersonasStore();

  // Rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const validTabs = (openTabs ?? []).filter((id) => conversations.some((c) => c.id === id));
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const activePersona = activeConv?.personaId
    ? personas.find((p) => p.id === activeConv.personaId)
    : undefined;

  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  // Dismiss context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const onMouse = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const closeTabAndRefocus = useCallback((id: string) => {
    const idx = validTabs.indexOf(id);
    const isActive = id === activeConversationId;
    closeTab?.(id);
    if (isActive) {
      const remaining = validTabs.filter((t) => t !== id);
      setActiveConversation(remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)] : null);
    }
  }, [validTabs, activeConversationId, closeTab, setActiveConversation]);

  const handleClose = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTabAndRefocus(id);
  }, [closeTabAndRefocus]);

  const handleNewTab = useCallback(() => {
    if (!settings) return;
    const conv = addConversation({ providerId: settings.defaultProviderId, model: settings.defaultModel });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
  }, [settings, addConversation, openTab, setActiveConversation]);

  // Double-click to rename
  const startRename = useCallback((id: string, currentTitle: string) => {
    setRenamingTabId(id);
    setRenameDraft(currentTitle ?? '');
    setContextMenu(null);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingTabId && renameDraft.trim()) {
      updateConversation(renamingTabId, { title: renameDraft.trim() });
    }
    setRenamingTabId(null);
  }, [renamingTabId, renameDraft, updateConversation]);

  // Context menu
  const openContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ tabId: id, x: e.clientX, y: e.clientY });
  }, []);

  const closeOthers = useCallback((keepId: string) => {
    validTabs.filter((id) => id !== keepId).forEach((id) => closeTab?.(id));
    setActiveConversation(keepId);
    setContextMenu(null);
  }, [validTabs, closeTab, setActiveConversation]);

  const closeToTheRight = useCallback((fromId: string) => {
    const idx = validTabs.indexOf(fromId);
    validTabs.slice(idx + 1).forEach((id) => closeTab?.(id));
    setContextMenu(null);
  }, [validTabs, closeTab]);

  const closeAll = useCallback(() => {
    validTabs.forEach((id) => closeTab?.(id));
    setActiveConversation(null);
    setContextMenu(null);
  }, [validTabs, closeTab, setActiveConversation]);

  return (
    <>
      <div className="flex items-stretch bg-slate-950 border-b border-slate-700 flex-shrink-0 h-9">
        {/* Left: scrollable tab strip */}
        <div
          className="flex items-stretch overflow-x-auto flex-1 min-w-0"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {validTabs.map((id) => {
            const conv = conversations.find((c) => c.id === id);
            const isActive = id === activeConversationId;
            const personaColor = conv?.personaId
              ? personas.find((p) => p.id === conv.personaId)?.color
              : undefined;
            const isRenaming = renamingTabId === id;

            return (
              <div
                key={id}
                onClick={() => !isRenaming && setActiveConversation(id)}
                onDoubleClick={() => !isRenaming && startRename(id, conv?.title ?? '')}
                onContextMenu={(e) => openContextMenu(e, id)}
                style={noDrag}
                className={`relative group flex items-center gap-1.5 px-3 min-w-0 max-w-[200px] w-[160px] flex-shrink-0 cursor-pointer border-r border-slate-700 text-xs transition-colors select-none ${
                  isActive
                    ? 'bg-slate-900 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {personaColor && !isRenaming && (
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: personaColor }}
                  />
                )}

                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                      if (e.key === 'Escape') { e.preventDefault(); setRenamingTabId(null); }
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-slate-700 text-slate-100 text-[11px] rounded px-1.5 py-0.5 outline-none border border-blue-500"
                  />
                ) : (
                  <span className="truncate flex-1 text-[11px]">
                    {conv?.title ?? 'Conversation'}
                  </span>
                )}

                {!isRenaming && (
                  <button
                    onClick={(e) => handleClose(e, id)}
                    className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 hover:text-red-400 transition-all"
                    title="Close tab"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </div>
            );
          })}

          {/* New tab button */}
          <button
            onClick={handleNewTab}
            style={noDrag}
            className="flex-shrink-0 px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
            title="New tab (⌘T)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Divider + right-side per-conversation controls */}
        {activeConversationId && activeConv && settings && (
          <>
            <div className="w-px bg-slate-700 flex-shrink-0 self-stretch" />
            <div className="flex items-center gap-0.5 px-2 flex-shrink-0" style={noDrag}>

              {/* Persona badge */}
              {activePersona && (
                <div
                  style={{
                    backgroundColor: `${activePersona.color ?? '#64748b'}25`,
                    borderColor: activePersona.color ?? '#64748b',
                  }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border flex-shrink-0 mr-1"
                  title={`Persona: ${activePersona.name}`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0"
                    style={{ backgroundColor: activePersona.color ?? '#64748b' }}
                  >
                    {activePersona.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-slate-300 font-medium max-w-[80px] truncate">{activePersona.name}</span>
                </div>
              )}

              {/* Model / routing profile picker */}
              <ModelPickerButton
                settings={settings}
                models={models}
                loadModels={loadModels}
                conversationId={activeConversationId}
                conv={activeConv}
              />


              {/* Compare models */}
              <button
                onClick={() => setCompareMode(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                title="Compare models"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                title="Settings (⌘,)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tab right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[200px] text-xs"
        >
          {/* Rename */}
          <button
            onClick={() => {
              const conv = conversations.find((c) => c.id === contextMenu.tabId);
              startRename(contextMenu.tabId, conv?.title ?? '');
            }}
            className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 flex items-center justify-between gap-4 transition-colors"
          >
            <span>Rename</span>
            <span className="text-slate-500 text-[10px]">Double-click</span>
          </button>

          <div className="border-t border-slate-700 my-1" />

          {/* Close */}
          <button
            onClick={() => { closeTabAndRefocus(contextMenu.tabId); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 flex items-center justify-between gap-4 transition-colors"
          >
            <span>Close</span>
            <span className="text-slate-500 text-[10px]">⌘W</span>
          </button>

          {/* Close Others */}
          {validTabs.length > 1 && (
            <button
              onClick={() => closeOthers(contextMenu.tabId)}
              className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Close Others
            </button>
          )}

          {/* Close to the Right */}
          {validTabs.indexOf(contextMenu.tabId) < validTabs.length - 1 && (
            <button
              onClick={() => closeToTheRight(contextMenu.tabId)}
              className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Close to the Right
            </button>
          )}

          {/* Close All */}
          <button
            onClick={closeAll}
            className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close All
          </button>

          <div className="border-t border-slate-700 my-1" />

          {/* New Conversation */}
          <button
            onClick={() => { handleNewTab(); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 flex items-center justify-between gap-4 transition-colors"
          >
            <span>New Conversation</span>
            <span className="text-slate-500 text-[10px]">⌘T</span>
          </button>
        </div>
      )}
    </>
  );
}
