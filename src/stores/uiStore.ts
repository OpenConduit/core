import { create } from 'zustand';
import type { AppNotification, ToolApprovalRequest } from '../types';

/**
 * Panel identifier stored in `uiStore`. Built-in panels are `'chats'` and
 * `'marketplace'`. Extension-contributed panels use their `panelId` string.
 * Widened to `string` so `extensionRegistry` contributions are accepted
 * without a type assertion.
 */
export type ActivityPanel = string;

interface UiState {
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activePanel: ActivityPanel;
  setActivePanel: (panel: ActivityPanel) => void;
  pendingApprovals: ToolApprovalRequest[];
  addPendingApproval: (req: ToolApprovalRequest) => void;
  removePendingApproval: (toolId: string) => void;
  showSystemPrompt: boolean;
  setShowSystemPrompt: (v: boolean) => void;
  showParameters: boolean;
  setShowParameters: (v: boolean) => void;
  isCompacting: boolean;
  setIsCompacting: (v: boolean) => void;
  isCompareMode: boolean;
  setCompareMode: (v: boolean) => void;
  showFilesPanel: boolean;
  setShowFilesPanel: (v: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  keyboardShortcutsOpen: boolean;
  setKeyboardShortcutsOpen: (v: boolean) => void;

  // ── Bottom panel (#18) ───────────────────────────────────────────────────
  bottomPanelOpen: boolean;
  setBottomPanelOpen: (v: boolean) => void;
  toggleBottomPanel: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (h: number) => void;
  bottomPanelActiveTab: string;
  setBottomPanelActiveTab: (tab: string) => void; 
  // addNotification accepts a partial payload; id, timestamp, and read are
  // set automatically. This keeps the API clean for #38 extension callers.
  notifications: AppNotification[];
  addNotification: (payload: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;

  // ── Extension message injection (#55) ────────────────────────────────────
  /** Message text queued by an extension via `api.conversations.sendMessage()`. */
  injectedMessage: string | null;
  /** Set a message to be sent programmatically by the active conversation. */
  injectMessage: (text: string) => void;
  /** Clear the injected message after it has been consumed. */
  clearInjectedMessage: () => void;

  // ── Secondary sidebar (#28) ───────────────────────────────────────────────
  secondarySidebarOpen: boolean;
  setSecondarySidebarOpen: (v: boolean) => void;
  toggleSecondarySidebar: () => void;
  secondarySidebarWidth: number;
  setSecondarySidebarWidth: (w: number) => void;
  secondarySidebarPanel: 'context' | 'outline' | 'related';
  setSecondarySidebarPanel: (panel: 'context' | 'outline' | 'related') => void;

  // ── Split pane (#29) ─────────────────────────────────────────────────────
  splitPaneOpen: boolean;
  splitPaneWidth: number;
  setSplitPaneWidth: (w: number) => void;
  splitPaneContent: { type: 'code' | 'file' | 'preview' | 'conversation'; language?: string; payload: string } | null;
  openSplitPane: (content: { type: 'code' | 'file' | 'preview' | 'conversation'; language?: string; payload: string }) => void;
  closeSplitPane: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeConversationId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  showSettings: false,
  setShowSettings: (v) => set({ showSettings: v }),

  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  activePanel: (localStorage.getItem('oc-active-panel') as ActivityPanel) ?? 'chats',
  setActivePanel: (panel) => { localStorage.setItem('oc-active-panel', panel); set({ activePanel: panel }); },

  pendingApprovals: [],
  addPendingApproval: (req) =>
    set((s) => ({ pendingApprovals: [...s.pendingApprovals, req] })),
  removePendingApproval: (toolId) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((a) => a.toolCall.id !== toolId),
    })),

  showSystemPrompt: false,
  setShowSystemPrompt: (v) => set({ showSystemPrompt: v }),

  showParameters: false,
  setShowParameters: (v) => set({ showParameters: v }),

  isCompacting: false,
  setIsCompacting: (v) => set({ isCompacting: v }),

  isCompareMode: false,
  setCompareMode: (v) => set({ isCompareMode: v }),

  showFilesPanel: false,
  setShowFilesPanel: (v) => set({ showFilesPanel: v }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  keyboardShortcutsOpen: false,
  setKeyboardShortcutsOpen: (v) => set({ keyboardShortcutsOpen: v }),

  bottomPanelOpen: false,
  setBottomPanelOpen: (v) => set({ bottomPanelOpen: v }),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  bottomPanelHeight: (() => {
    const saved = localStorage.getItem('oc-bottom-panel-height');
    return saved ? Number(saved) : 240;
  })(),
  setBottomPanelHeight: (h) => {
    localStorage.setItem('oc-bottom-panel-height', String(h));
    set({ bottomPanelHeight: h });
  },
  bottomPanelActiveTab: localStorage.getItem('oc-bottom-panel-tab') ?? 'tool-calls',
  setBottomPanelActiveTab: (tab) => {
    localStorage.setItem('oc-bottom-panel-tab', tab);
    set({ bottomPanelActiveTab: tab });
  },
  notifications: [],
  addNotification: (payload) =>
    set((s) => ({
      notifications: [
        { ...payload, id: crypto.randomUUID(), timestamp: Date.now(), read: false, source: payload.source ?? 'app' },
        ...s.notifications,
      ].slice(0, 100),
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),

  injectedMessage: null,
  injectMessage: (text) => set({ injectedMessage: text }),
  clearInjectedMessage: () => set({ injectedMessage: null }),

  secondarySidebarOpen: false,
  setSecondarySidebarOpen: (v) => set({ secondarySidebarOpen: v }),
  toggleSecondarySidebar: () => set((s) => ({ secondarySidebarOpen: !s.secondarySidebarOpen })),
  secondarySidebarWidth: (() => {
    const saved = localStorage.getItem('oc-secondary-sidebar-width');
    return saved ? Number(saved) : 280;
  })(),
  setSecondarySidebarWidth: (w) => {
    localStorage.setItem('oc-secondary-sidebar-width', String(w));
    set({ secondarySidebarWidth: w });
  },
  secondarySidebarPanel: (localStorage.getItem('oc-secondary-sidebar-panel') as 'context' | 'outline' | 'related') ?? 'context',
  setSecondarySidebarPanel: (panel) => {
    localStorage.setItem('oc-secondary-sidebar-panel', panel);
    set({ secondarySidebarPanel: panel });
  },

  splitPaneOpen: false,
  splitPaneWidth: (() => {
    const saved = localStorage.getItem('oc-split-pane-width');
    return saved ? Number(saved) : 420;
  })(),
  setSplitPaneWidth: (w) => {
    localStorage.setItem('oc-split-pane-width', String(w));
    set({ splitPaneWidth: w });
  },
  splitPaneContent: null,
  openSplitPane: (content) => set({ splitPaneOpen: true, splitPaneContent: content }),
  closeSplitPane: () => set({ splitPaneOpen: false, splitPaneContent: null }),
}));
