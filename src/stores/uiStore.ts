import { create } from 'zustand';
import type { AppNotification, ToolApprovalRequest } from '../types';

export type ActivityPanel = 'chats' | 'personas' | 'marketplace';

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

  // ── Notifications (#33) ──────────────────────────────────────────────────
  // addNotification accepts a partial payload; id, timestamp, and read are
  // set automatically. This keeps the API clean for #38 extension callers.
  notifications: AppNotification[];
  addNotification: (payload: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
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
}));
