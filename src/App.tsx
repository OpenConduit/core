import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CompareArea from './extensions/builtins/compare/CompareArea';
import SettingsPanel from './components/SettingsPanel';
import ActivityBar from './components/ActivityBar';
import ChromeBar from './components/ChromeBar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import BottomPanel from './components/BottomPanel';
import CommandPalette from './components/CommandPalette';
import KeyboardShortcutsPanel from './components/KeyboardShortcutsPanel';
import MarketplaceSidebarPanel from './components/MarketplaceSidebarPanel';
import SecondarySidebar from './components/SecondarySidebar';
import SplitPane, { PaneCodeViewer } from './components/SplitPane';
import { PaneContext } from './contexts/PaneContext';
// Register all built-in extensions (side-effect import)
import './extensions';
import { extensionRegistry } from './extensions/extensionRegistry';
import { loadInstalledExtensions } from './extensions/loader';
import { hookRegistry } from './hooks/hookRegistry';
import { commandRegistry } from './commands/commandRegistry';
import { bottomPanelRegistry } from './bottomPanel/bottomPanelRegistry';
import { settingsRegistry } from './settings/settingsRegistry';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { useConversationStore } from './stores/conversationStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemesStore } from './stores/themesStore';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SPLIT_PANE_MIN = 280;
const SPLIT_PANE_MAX = 800;

export default function App() {
  const { loadSettings, settings } = useSettingsStore();
  const {
    activeConversationId, setActiveConversation, setShowSettings,
    isCompareMode, sidebarOpen, activePanel, setCommandPaletteOpen,
    secondarySidebarOpen, secondarySidebarWidth, setSecondarySidebarWidth: _setSecondarySidebarWidth,
    splitPaneOpen, splitPaneWidth, setSplitPaneWidth,
    leftPaneContent, closeLeftPane,
  } = useUiStore();
  const { conversations, openTabs, openTab } = useConversationStore();
  const { restoreTheme, setActiveTheme } = useThemesStore();
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('oc-sidebar-width');
    return saved ? Number(saved) : 240;
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  const splitWidthRef = useRef(splitPaneWidth);
  const secondaryWidthRef = useRef(secondarySidebarWidth);

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

  const handleSplitResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = splitWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(SPLIT_PANE_MIN, Math.min(SPLIT_PANE_MAX, startWidth + (startX - ev.clientX)));
      splitWidthRef.current = w;
      setSplitPaneWidth(w);
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setSplitPaneWidth]);

  // Keep refs in sync with store values (restored from localStorage on mount)
  useEffect(() => { splitWidthRef.current = splitPaneWidth; }, [splitPaneWidth]);
  useEffect(() => { secondaryWidthRef.current = secondarySidebarWidth; }, [secondarySidebarWidth]);

  // Bootstrap: load settings from main process
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Expose the extension SDK surface on window so dynamically-loaded extension
  // bundles can call extensionRegistry.registerExtension() without bundling core.
  useEffect(() => {
    (window as Window & { __openConduit?: unknown }).__openConduit = {
      extensionRegistry,
      hookRegistry,
      commandRegistry,
      bottomPanelRegistry,
      settingsRegistry,
    };
    // Load marketplace-installed extensions from userData/extensions/
    loadInstalledExtensions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore active custom theme CSS vars on mount
  useEffect(() => {
    restoreTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync active marketplace theme from settings (handles app restart)
  useEffect(() => {
    if (!settings) return;
    setActiveTheme(settings.activeThemeId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.activeThemeId]);

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
            {activePanel === 'marketplace' && <MarketplaceSidebarPanel />}
            {/* Extension-contributed sidebar panels */}
            {(() => {
              const ExtPanel = extensionRegistry.getSidebarPanel(activePanel);
              if (!ExtPanel) return null;
              return (
                <div className="flex-1 overflow-y-auto p-4">
                  <ExtPanel />
                </div>
              );
            })()}

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
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left pane — TabBar + body (chat or code/file/preview viewer) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <TabBar />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {isCompareMode ? (
                  <CompareArea />
                ) : leftPaneContent ? (
                  <PaneContext.Provider value="left">
                    <div className="flex flex-col h-full">
                      <PaneCodeViewer content={leftPaneContent} onClose={closeLeftPane} />
                    </div>
                  </PaneContext.Provider>
                ) : (
                  <PaneContext.Provider value="left">
                    <ChatArea conversationId={activeConversationId} />
                  </PaneContext.Provider>
                )}
              </div>
            </div>
            {/* Right pane */}
            {splitPaneOpen && (
              <>
                <div
                  onMouseDown={handleSplitResizeStart}
                  className="w-1 flex-shrink-0 cursor-col-resize group"
                >
                  <div className="h-full w-px bg-slate-700 group-hover:bg-blue-500 transition-colors duration-150" />
                </div>
                <div style={{ width: splitPaneWidth }} className="flex-shrink-0 flex flex-col min-h-0">
                  <SplitPane />
                </div>
              </>
            )}
          </div>
          <BottomPanel />
        </div>

          {/* Secondary sidebar (#28) */}
          {secondarySidebarOpen && (
            <SecondarySidebar />
          )}
        </div>

        <StatusBar />

        {/* Settings overlay — triggered by ⌘, or activity bar gear */}
        <SettingsPanel />

        {/* Command palette — triggered by ⌘K or ChromeBar search button */}
        <CommandPalette />

        {/* Keyboard shortcuts editor — triggered by Manage › Keyboard Shortcuts */}
        <KeyboardShortcutsPanel />
      </div>
    );
  }
