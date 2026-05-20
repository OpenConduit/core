import { create } from 'zustand';
import type { AppSettings } from '../types';
import { service } from '../services';
import { debugConsole } from '../utils/debugConsole';
import { useDebugConsoleStore, type LogCategory } from './debugConsoleStore';

function syncLoggingCategories(settings: AppSettings) {
  const l = settings.logging;
  if (!l) {
    useDebugConsoleStore.getState().setEnabledCategories(new Set());
    return;
  }
  const cats = new Set<LogCategory>();
  if (l.provider) cats.add('provider');
  if (l.mcp)      cats.add('mcp');
  if (l.routing)  cats.add('routing');
  if (l.settings) cats.add('settings');
  cats.add('app'); // 'app' category always enabled
  useDebugConsoleStore.getState().setEnabledCategories(cats);
}

interface SettingsState {
  settings: AppSettings | null;
  models: Record<string, string[]>;
  mcpStatus: Record<string, boolean>;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  loadModels: (providerId: string) => Promise<void>;
  refreshMcpStatus: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, _get) => ({
  settings: null,
  models: {},
  mcpStatus: {},

  loadSettings: async () => {
    const settings = await service.settings.get();
    set({ settings });
    syncLoggingCategories(settings);
    debugConsole.log('Settings loaded', { defaultProvider: settings.defaultProviderId, defaultModel: settings.defaultModel, providerCount: settings.providers.length }, 'settings');
  },

  saveSettings: async (partial) => {
    const updated = await service.settings.set(partial);
    set({ settings: updated });
    syncLoggingCategories(updated);
  },

  loadModels: async (providerId: string) => {
    const list = await service.models.list(providerId);
    set((s) => ({ models: { ...s.models, [providerId]: list } }));
  },

  refreshMcpStatus: async () => {
    const status = await service.mcp.getStatus();
    set({ mcpStatus: status });
    const connected = Object.values(status).filter(Boolean).length;
    debugConsole.debug('MCP status refreshed', { total: Object.keys(status).length, connected }, 'settings');
  },
}));
