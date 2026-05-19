// Core types
export * from './types';

// Services
export { service, initService } from './services';
export type { AppService } from './services/appService';

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
