import type { AppSettings, Conversation, McpTool, Message, Persona, AiTask } from '../types';
import type { SavedFile } from '../stores/filesStore';
import type { ExtensionAPI, ExtensionManifest } from './types';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';
import { useSavedFilesStore } from '../stores/filesStore';
import { useTasksStore } from '../stores/tasksStore';
import { useUiStore } from '../stores/uiStore';
import { messageDecoratorRegistry } from './messageDecoratorRegistry';
import { toolContributionRegistry } from './toolContributionRegistry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    return (acc as Record<string, unknown>)?.[key];
  }, obj);
}

function buildSettingsUpdate(
  existing: object,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { [parts[0]]: value };
  }
  const [top, ...rest] = parts;
  const child = (existing as Record<string, unknown>)[top] ?? {};
  const nested = buildSettingsUpdate(child as object, rest.join('.'), value);
  return { [top]: { ...(child as object), ...nested } };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a scoped `ExtensionAPI` object for the given extension manifest.
 *
 * Write-access methods are gated behind `manifest.permissions`. Extensions
 * that attempt a write without the corresponding permission receive a console
 * warning and the operation is a no-op.
 *
 * Call this once per extension, typically from `extensionRegistry` after the
 * extension has been registered.
 */
export function createExtensionAPI(manifest: ExtensionManifest): ExtensionAPI {
  const id = manifest.id;
  const permissions = manifest.permissions ?? [];
  const canWriteConversations = permissions.includes('conversations.write');
  const canWriteSettings = permissions.includes('settings.write');

  return {
    // ── Conversations ──────────────────────────────────────────────────────

    conversations: {
      getActive(): Conversation | null {
        const { conversations } = useConversationStore.getState();
        const activeId = useUiStore.getState().activeConversationId;
        return conversations.find((c) => c.id === activeId) ?? null;
      },

      getAll(): Conversation[] {
        return useConversationStore.getState().conversations;
      },

      list(): Conversation[] {
        return useConversationStore.getState().conversations;
      },

      sendMessage(text: string): void {
        if (!canWriteConversations) {
          console.warn(
            `[Extension ${id}] sendMessage requires the "conversations.write" permission.`,
          );
          return;
        }
        useUiStore.getState().injectMessage(text);
      },

      onNewMessage(cb: (msg: Message) => void): () => void {
        // Capture current messages so we only fire for genuinely new ones.
        const activeId = useUiStore.getState().activeConversationId;
        let prevMessages: Message[] = activeId
          ? (useConversationStore
              .getState()
              .conversations.find((c) => c.id === activeId)?.messages ?? [])
          : [];

        return useConversationStore.subscribe((state) => {
          const currentActiveId = useUiStore.getState().activeConversationId;
          if (!currentActiveId) return;
          const conv = state.conversations.find((c) => c.id === currentActiveId);
          if (!conv) return;
          if (conv.messages.length > prevMessages.length) {
            conv.messages.slice(prevMessages.length).forEach((m) => cb(m));
          }
          prevMessages = conv.messages;
        });
      },
    },

    // ── Settings ───────────────────────────────────────────────────────────

    settings: {
      get<T>(key: string): T | undefined {
        return getNestedValue(useSettingsStore.getState().settings, key) as T | undefined;
      },

      getAll(): AppSettings | null {
        return useSettingsStore.getState().settings;
      },

      set(key: string, value: unknown): void {
        if (!canWriteSettings) {
          console.warn(
            `[Extension ${id}] settings.set requires the "settings.write" permission.`,
          );
          return;
        }
        const settings = useSettingsStore.getState().settings;
        if (!settings) return;
        const update = buildSettingsUpdate(settings, key, value);
        void useSettingsStore.getState().saveSettings(update as Partial<AppSettings>);
      },

      onChange(key: string, cb: (value: unknown) => void): () => void {
        return useSettingsStore.subscribe((state, prevState) => {
          const prev = getNestedValue(prevState.settings, key);
          const next = getNestedValue(state.settings, key);
          if (next !== prev) cb(next);
        });
      },
    },

    // ── UI ─────────────────────────────────────────────────────────────────

    ui: {
      registerMessageDecorator(decorator) {
        const key = `${id}:decorator:${Math.random().toString(36).slice(2)}`;
        return messageDecoratorRegistry.register(key, decorator);
      },

      showNotification(opts) {
        useUiStore.getState().addNotification({
          title: opts.message,
          variant: opts.type ?? 'info',
          source: id,
        });
      },

      getActivePanel(): string {
        return useUiStore.getState().activePanel;
      },
    },

    // ── Store ──────────────────────────────────────────────────────────────

    store: {
      getPersonas(): Persona[] {
        return usePersonasStore.getState().personas;
      },

      getSavedFiles(): SavedFile[] {
        return useSavedFilesStore.getState().files;
      },

      getTasks(): AiTask[] {
        return useTasksStore.getState().tasks;
      },
    },

    // ── Tools ──────────────────────────────────────────────────────────────

    tools: {
      register(toolDef: Omit<McpTool, 'serverId'>, handler) {
        return toolContributionRegistry.register(toolDef, handler);
      },

      list(): McpTool[] {
        return toolContributionRegistry.getTools().filter(
          (t) => t.serverId === '__extension__',
        );
      },
    },
  };
}
