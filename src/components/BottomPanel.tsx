import React, { useCallback, useRef } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useConversationStore } from '../stores/conversationStore';
import { bottomPanelRegistry } from '../bottomPanel/bottomPanelRegistry';
import '../bottomPanel/coreBottomPanelContributions'; // side-effect: registers built-in tabs

const PANEL_MIN = 100;
const PANEL_MAX = 600;

export default function BottomPanel() {
  const {
    bottomPanelOpen,
    setBottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
    bottomPanelActiveTab,
    setBottomPanelActiveTab,
    activeConversationId,
  } = useUiStore();

  const heightRef = useRef(bottomPanelHeight);
  const tabs = bottomPanelRegistry.getAll();

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = heightRef.current;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        const h = Math.max(PANEL_MIN, Math.min(PANEL_MAX, startH - (ev.clientY - startY)));
        heightRef.current = h;
        setBottomPanelHeight(h);
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [setBottomPanelHeight],
  );

  if (!bottomPanelOpen) return null;

  const activeTab = tabs.find((t) => t.id === bottomPanelActiveTab) ?? tabs[0];

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-slate-950 border-t border-slate-800 overflow-hidden"
      style={{ height: bottomPanelHeight }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="flex-shrink-0 h-1 cursor-row-resize group"
      >
        <div className="h-full bg-transparent group-hover:bg-blue-500/40 transition-colors duration-150" />
      </div>

      {/* Header — tab strip + close button */}
      <div className="flex-shrink-0 flex items-center border-b border-slate-800 px-2 h-8">
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBottomPanelActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded flex-shrink-0 transition-colors ${
                tab.id === (activeTab?.id ?? '')
                  ? 'text-slate-200 bg-slate-800'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={() => setBottomPanelOpen(false)}
          className="flex-shrink-0 ml-2 p-1 text-slate-600 hover:text-slate-300 rounded transition-colors"
          aria-label="Close panel"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab && (
          typeof activeTab.content === 'function'
            ? activeTab.content(activeConversationId)
            : activeTab.content
        )}
      </div>
    </div>
  );
}
