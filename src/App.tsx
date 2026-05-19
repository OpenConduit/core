import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CompareArea from './components/CompareArea';
import SettingsPanel from './components/SettingsPanel';
import ActivityBar from './components/ActivityBar';
import ChromeBar from './components/ChromeBar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import PersonasPanel from './components/PersonasPanel';
import MarketplaceSidebarPanel from './components/MarketplaceSidebarPanel';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { useConversationStore } from './stores/conversationStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;

export default function App() {
  const { loadSettings, settings } = useSettingsStore();
  const { activeConversationId, setActiveConversation, setShowSettings, isCompareMode, sidebarOpen, activePanel, setCommandPaletteOpen } = useUiStore();
  const { conversations, openTabs, openTab } = useConversationStore();
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('oc-sidebar-width');
    return saved ? Number(saved) : 240;
  });
  const sidebarWidthRef = useRef(sidebarWidth);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + ev.clientX - startX));
      sidebarWidthRef.current = w;
      setSidebarWidth(w);
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('oc-sidebar-width', String(sidebarWidthRef.current));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Bootstrap: load settings from main process
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply theme class to <html>
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const theme = settings.theme;
    if (theme === 'dark') {
      root.classList.add('dark');
      return;
    } else if (theme === 'light') {
      root.classList.remove('dark');
      return;
    }
    // system — apply immediately and watch for OS preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e: MediaQueryListEvent | MediaQueryList) => {
      root.classList.toggle('dark', e.matches);
    };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.theme]);

  // If no active conversation, restore from open tabs or open the most recent conversation.
  // Also ensure the active conversation is always present in the tab strip (e.g. after restart).
  useEffect(() => {
    const tabs = openTabs ?? [];
    if (activeConversationId) {
      if (!tabs.includes(activeConversationId)) {
        openTab?.(activeConversationId);
      }
      return;
    }
    // Restore first valid open tab on startup (e.g. after restart)
    const firstValid = tabs.find((id) => conversations.some((c) => c.id === id));
    if (firstValid) {
      setActiveConversation(firstValid);
    }
    // No else-if auto-open: intentionally empty tabs (e.g. close all) shows the welcome screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length, activeConversationId]);

  // Open settings on first launch (no providers configured)
  useEffect(() => {
    if (settings && settings.providers.length === 0) {
      setShowSettings(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.providers.length]);

  // Global keyboard shortcuts (see hooks/useKeyboardShortcuts.ts)
  useKeyboardShortcuts();

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Full-width window chrome — traffic light area + search */}
      <ChromeBar onSearchClick={() => setCommandPaletteOpen(true)} />

      {/* Content row below the tab bar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <ActivityBar />

        {/* Primary sidebar — panel content switches based on active activity bar item */}
        {sidebarOpen && (
          <aside
            style={{ width: sidebarWidth }}
            className="relative flex-shrink-0 bg-slate-800 flex flex-col border-r border-slate-700 overflow-hidden"
          >
            {activePanel === 'chats' && <Sidebar />}
            {activePanel === 'personas' && (
              <div className="flex-1 overflow-y-auto p-4">
                <PersonasPanel />
              </div>
            )}
            {activePanel === 'marketplace' && <MarketplaceSidebarPanel />}

            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 group"
            >
              <div className="absolute inset-y-0 right-0 w-px bg-slate-700 group-hover:bg-blue-500 transition-colors duration-150" />
            </div>
          </aside>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TabBar />
          {isCompareMode ? (
            <CompareArea />
          ) : (
            <ChatArea conversationId={activeConversationId} />
          )}
        </div>
      </div>

      <StatusBar />

      {/* Settings overlay — triggered by ⌘, or activity bar gear */}
      <SettingsPanel />

      {/* Command palette — triggered by ⌘K or ChromeBar search button */}
      <CommandPalette />
    </div>
  );
}
