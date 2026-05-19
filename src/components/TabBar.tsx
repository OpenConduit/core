import React from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';

export default function TabBar() {
  const conversations = useConversationStore((s) => s.conversations);
  const openTabs = useConversationStore((s) => s.openTabs);
  const closeTab = useConversationStore((s) => s.closeTab);
  const openTab = useConversationStore((s) => s.openTab);
  const addConversation = useConversationStore((s) => s.addConversation);
  const { activeConversationId, setActiveConversation } = useUiStore();
  const { settings } = useSettingsStore();
  const { personas } = usePersonasStore();

  // Filter out stale IDs (deleted conversations)
  const validTabs = (openTabs ?? []).filter((id) => conversations.some((c) => c.id === id));

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const idx = validTabs.indexOf(id);
    const isActive = id === activeConversationId;
    closeTab?.(id);
    if (isActive) {
      const remaining = validTabs.filter((t) => t !== id);
      if (remaining.length > 0) {
        setActiveConversation(remaining[Math.min(idx, remaining.length - 1)]);
      } else {
        setActiveConversation(null);
      }
    }
  };

  const handleNewTab = () => {
    if (!settings) return;
    const conv = addConversation({
      providerId: settings.defaultProviderId,
      model: settings.defaultModel,
    });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
  };

  return (
    <div
      className="flex items-stretch bg-slate-950 border-b border-slate-700 overflow-x-auto flex-shrink-0 h-9"
      style={{
        scrollbarWidth: 'none',
      } as React.CSSProperties}
    >
      {validTabs.map((id) => {
        const conv = conversations.find((c) => c.id === id);
        const isActive = id === activeConversationId;
        const personaColor = conv?.personaId
          ? personas.find((p) => p.id === conv.personaId)?.color
          : undefined;

        return (
          <div
            key={id}
            onClick={() => setActiveConversation(id)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`relative group flex items-center gap-1.5 px-3 min-w-0 max-w-[200px] w-[160px] flex-shrink-0 cursor-pointer border-r border-slate-700 text-xs transition-colors select-none ${
              isActive
                ? 'bg-slate-900 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            {personaColor && (
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: personaColor }}
              />
            )}
            <span className="truncate flex-1 text-[11px]">
              {conv?.title ?? 'Conversation'}
            </span>
            <button
              onClick={(e) => handleClose(e, id)}
              className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 hover:text-red-400 transition-all"
              title="Close tab"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Active tab indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </div>
        );
      })}

      {/* New tab button */}
      <button
        onClick={handleNewTab}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex-shrink-0 px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
        title="New tab (⌘T)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
