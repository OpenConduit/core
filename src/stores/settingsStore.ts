import { create } from 'zustand';
import type { AppSettings } from '../types';
import { service } from '../services';
import { debugConsole } from '../utils/debugConsole';

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
    debugConsole.log('Settings loaded', { defaultProvider: settings.defaultProviderId, defaultModel: settings.defaultModel, providerCount: settings.providers.length });
  },

  saveSettings: async (partial) => {
    const updated = await service.settings.set(partial);
    set({ settings: updated });
  },

  loadModels: async (providerId: string) => {
    const list = await service.models.list(providerId);
    set((s) => ({ models: { ...s.models, [providerId]: list } }));
  },

  refreshMcpStatus: async () => {
    const status = await service.mcp.getStatus();
    set({ mcpStatus: status });
    const connected = Object.values(status).filter(Boolean).length;
    debugConsole.debug('MCP status refreshed', { total: Object.keys(status).length, connected });
  },
}));
