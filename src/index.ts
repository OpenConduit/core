// Core types
export * from './types';

// Services
export { service, initService } from './services';
export type { AppService } from './services/appService';

// Settings contribution registry (#37)
export { settingsRegistry } from './settings/settingsRegistry';
import './settings/coreContributions'; // side-effect: registers core sections

// Bottom panel registry (#18)
export { bottomPanelRegistry } from './bottomPanel/bottomPanelRegistry';
export type { BottomPanelTab } from './bottomPanel/bottomPanelRegistry';
export { debugConsole } from './utils/debugConsole';
export type { DebugLevel, DebugEntry } from './stores/debugConsoleStore';

// Command registry (#38)
export { commandRegistry } from './commands/commandRegistry';
export type { CommandContribution } from './commands/commandRegistry';

// Extension platform (#38)
export { extensionRegistry } from './extensions/extensionRegistry';
export type { ExtensionManifest, ActivityBarContribution } from './extensions/types';
import './commands/coreCommandContributions'; // side-effect: registers built-in commands

// Themes store (#25 / #22)
export { useThemesStore, BUILT_IN_THEMES } from './stores/themesStore';
export type { InstalledTheme, ThemeColors } from './types';

// Keybindings store
export { useKeybindingsStore, getEffectiveBinding } from './stores/keybindingsStore';
export type { Binding } from './stores/keybindingsStore';

// Registry store (live marketplace)
export { useRegistryStore } from './stores/registryStore';
export type { RegistryType, RegistryEntry } from './stores/registryStore';

// Prompt templates store
export { usePromptTemplatesStore } from './stores/promptTemplatesStore';
export type { InstalledPromptTemplate, PromptVariable } from './stores/promptTemplatesStore';

// Routing profiles store
export { useRoutingProfilesStore } from './stores/routingProfilesStore';
export type { InstalledRoutingProfile, RoutingTiers } from './stores/routingProfilesStore';

// Root component
export { default as App } from './App';

// Components (individually exported for use in non-desktop contexts)
export { default as ChatArea } from './components/ChatArea';
export { default as CompareArea } from './components/CompareArea';
export { default as Sidebar } from './components/Sidebar';
export { default as SettingsPanel } from './components/SettingsPanel';
export type { ExtraTab as SettingsPanelExtraTab } from './components/SettingsPanel';
export { default as MessageBubble } from './components/MessageBubble';
export { default as InputBar } from './components/InputBar';
export { default as ToolCallCard } from './components/ToolCallCard';
export { default as ContextWarningBanner } from './components/ContextWarningBanner';
export { default as SystemPromptEditor } from './components/SystemPromptEditor';
export { default as TasksPanel } from './components/TasksPanel';
export { default as PersonasPanel } from './components/PersonasPanel';
export { default as StatusBar } from './components/StatusBar';
export { default as CommandPalette } from './components/CommandPalette';
export { default as KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';
export { default as WelcomeScreen } from './components/WelcomeScreen';
export { default as NotificationBell } from './components/NotificationBell';

// Stores
export { useConversationStore } from './stores/conversationStore';
export { useSettingsStore } from './stores/settingsStore';
export { useAnalyticsStore } from './stores/analyticsStore';
export { useTasksStore } from './stores/tasksStore';
export { useUiStore } from './stores/uiStore';
export { usePersonasStore } from './stores/personasStore';

// Hooks
export { useChat } from './hooks/useChat';
export { useCompare } from './hooks/useCompare';
export type { CompareColumn, CompareMessage } from './hooks/useCompare';

// Utilities
export { getContextLimit, estimateTokens, fmtTok } from './utils/context';
export { exportAsJson, exportAsMarkdown, downloadFile } from './lib/export';
