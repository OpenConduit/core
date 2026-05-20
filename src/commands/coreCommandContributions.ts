/**
 * Core built-in command contributions.
 *
 * Import this file as a side-effect to register all built-in commands:
 *   import './commands/coreCommandContributions';
 *
 * Actions use store.getState() so they work outside React — keybinding
 * handlers and extension callers can invoke them without a component context.
 */
import React from 'react';
import { commandRegistry } from './commandRegistry';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { service } from '../services';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconNew = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M12 4v16m8-8H4' }));

const IconSidebar = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M4 6h16M4 12h16M4 18h16' }));

const IconSettings = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })));

const IconClose = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M6 18L18 6M6 6l12 12' }));

const IconCompare = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' }));

const IconPanel = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z' }));

const IconSecondarySidebar = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 3h10a2 2 0 012 2v14a2 2 0 01-2 2H9M9 3v18' }));

const IconSplit = React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5, d: 'M12 3v18M3 12h18' }));

// ─── Registrations ────────────────────────────────────────────────────────────

commandRegistry.register({
  id: 'core.newConversation',
  label: 'New conversation',
  shortcut: '⌘T',
  keybinding: { key: 't', mod: true },
  icon: IconNew,
  action: () => {
    const { settings } = useSettingsStore.getState();
    if (!settings) return;
    const { addConversation, openTab } = useConversationStore.getState();
    const { setActiveConversation, setCommandPaletteOpen } = useUiStore.getState();
    const conv = addConversation({ providerId: settings.defaultProviderId, model: settings.defaultModel });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
    setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.newConversationAlt',
  label: 'New conversation',
  keybinding: { key: 'n', mod: true },
  // No shortcut hint — alias only, don't show twice in palette
  when: () => false,
  action: () => commandRegistry.execute('core.newConversation'),
});

commandRegistry.register({
  id: 'core.toggleSidebar',
  label: 'Toggle sidebar',
  icon: IconSidebar,
  action: () => {
    const { sidebarOpen, setSidebarOpen } = useUiStore.getState();
    setSidebarOpen(!sidebarOpen);
    useUiStore.getState().setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.openSettings',
  label: 'Open settings',
  shortcut: '⌘,',
  keybinding: { key: ',', mod: true },
  icon: IconSettings,
  action: () => {
    const { setShowSettings, setCommandPaletteOpen } = useUiStore.getState();
    setShowSettings(true);
    setCommandPaletteOpen(false);
  },
});

// Only visible when the IPC channel is available (Electron shell)
commandRegistry.register({
  id: 'core.openSettingsFile',
  label: 'Open settings.json',
  icon: IconSettings,
  when: () => {
    try { return 'openSettingsFile' in service.config; } catch { return false; }
  },
  action: () => {
    (service.config as typeof service.config & { openSettingsFile(): Promise<void> }).openSettingsFile();
    useUiStore.getState().setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.closeTab',
  label: 'Close tab',
  shortcut: '⌘W',
  keybinding: { key: 'w', mod: true },
  icon: IconClose,
  when: () => !!useUiStore.getState().activeConversationId,
  action: () => {
    const { activeConversationId, setActiveConversation, setCommandPaletteOpen } = useUiStore.getState();
    const { openTabs, closeTab } = useConversationStore.getState();
    if (!activeConversationId) return;
    const tabs = openTabs ?? [];
    const idx = tabs.indexOf(activeConversationId);
    closeTab?.(activeConversationId);
    const remaining = tabs.filter((t) => t !== activeConversationId);
    setActiveConversation(remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)] : null);
    setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.compareModels',
  label: 'Compare models',
  icon: IconCompare,
  action: () => {
    useUiStore.getState().setCompareMode(true);
    useUiStore.getState().setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.toggleBottomPanel',
  label: 'Toggle bottom panel',
  shortcut: '⌘J',
  keybinding: { key: 'j', mod: true },
  icon: IconPanel,
  action: () => {
    useUiStore.getState().toggleBottomPanel();
  },
});

commandRegistry.register({
  id: 'core.openCommandPalette',
  label: 'Open command palette',
  shortcut: '⌘K',
  keybinding: { key: 'k', mod: true },
  icon: IconPanel,
  // Hidden from the palette itself — triggered by keybinding or external
  when: () => false,
  action: () => {
    useUiStore.getState().setCommandPaletteOpen(true);
  },
});

commandRegistry.register({
  id: 'core.openKeyboardShortcuts',
  label: 'Open keyboard shortcuts',
  icon: IconSettings,
  action: () => {
    const { setKeyboardShortcutsOpen, setCommandPaletteOpen } = useUiStore.getState();
    setCommandPaletteOpen(false);
    setKeyboardShortcutsOpen(true);
  },
});

commandRegistry.register({
  id: 'core.toggleSecondarySidebar',
  label: 'Toggle secondary sidebar',
  shortcut: '⌘⇧B',
  keybinding: { key: 'b', mod: true, shift: true },
  icon: IconSecondarySidebar,
  action: () => {
    useUiStore.getState().toggleSecondarySidebar();
    useUiStore.getState().setCommandPaletteOpen(false);
  },
});

commandRegistry.register({
  id: 'core.toggleSplitPane',
  label: 'Toggle split pane',
  shortcut: '⌘\\',
  keybinding: { key: '\\', mod: true },
  icon: IconSplit,
  action: () => {
    const { splitPaneOpen, openSplitPane, closeSplitPane, splitPaneContent } = useUiStore.getState();
    if (splitPaneOpen) {
      closeSplitPane();
    } else if (splitPaneContent) {
      openSplitPane(splitPaneContent);
    }
    useUiStore.getState().setCommandPaletteOpen(false);
  },
});
