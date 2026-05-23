import type React from 'react';
import type { CommandContribution } from '../commands/commandRegistry';
import type { SlashCommand } from '../commands/slashCommandRegistry';
import type {
  BeforeSendHook,
  OnResponseHook,
  OnStreamChunkHook,
  OnToolCallHook,
} from '../hooks/hookRegistry';
import type { BottomPanelTab } from '../bottomPanel/bottomPanelRegistry';
import type { AppSettings, McpTool, SettingsContribution, Conversation, Message, Persona, AiTask } from '../types';
import type { SavedFile } from '../stores/filesStore';
import type { MessageDecorator } from './messageDecoratorRegistry';
import type { ToolHandler } from './toolContributionRegistry';

// ─── Shared primitives ────────────────────────────────────────────────────────

/** A function that removes a subscription or registration when called. */
export type Unsubscribe = () => void;

// Re-export so consumers only need to import from this file.
export type { MessageDecorator } from './messageDecoratorRegistry';

// ─── Extension API ────────────────────────────────────────────────────────────

/**
 * Runtime API object passed to an extension's `activate` function.
 * This is the only sanctioned way for an extension to interact with core
 * application state — it provides scoped, permission-gated access to
 * conversations, settings, UI, and shared stores.
 *
 * Write-access methods (`conversations.sendMessage`, `settings.set`) require
 * the corresponding permission string to be declared in the extension manifest.
 */
export interface ExtensionAPI {
  /** Read and interact with conversations. */
  conversations: {
    /** Returns the currently active conversation, or `null` if none. */
    getActive(): Conversation | null;
    /** Returns all conversations in the store. */
    getAll(): Conversation[];
    /** Alias for {@link getAll}. */
    list(): Conversation[];
    /**
     * Injects a message into the active conversation as if the user typed it.
     * Requires the `'conversations.write'` permission.
     */
    sendMessage(text: string): void;
    /**
     * Subscribe to new messages arriving in the active conversation.
     * Returns an unsubscribe function.
     */
    onNewMessage(cb: (msg: Message) => void): Unsubscribe;
  };

  /** Read and write extension-specific settings. */
  settings: {
    /** Read a settings value by its dot-separated key. */
    get<T>(key: string): T | undefined;
    /** Returns the full settings object, or `null` if not yet loaded. */
    getAll(): AppSettings | null;
    /**
     * Persist a settings value by its dot-separated key.
     * Requires the `'settings.write'` permission.
     */
    set(key: string, value: unknown): void;
    /**
     * Subscribe to changes for a specific settings key.
     * Returns an unsubscribe function.
     */
    onChange(key: string, cb: (value: unknown) => void): Unsubscribe;
  };

  /** UI integration points. */
  ui: {
    /**
     * Register a decorator rendered below each chat message.
     * Returns an unsubscribe function that removes the decorator.
     */
    registerMessageDecorator(decorator: MessageDecorator): Unsubscribe;
    /** Display a notification in the app's notification center. */
    showNotification(opts: {
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
    }): void;
    /** Returns the id of the currently active sidebar panel (e.g. `'chats'`, `'marketplace'`). */
    getActivePanel(): string;
  };

  /** Read-only access to shared application stores. */
  store: {
    /** Returns all defined personas. */
    getPersonas(): Persona[];
    /** Returns all saved files. */
    getSavedFiles(): SavedFile[];
    /** Returns the current task list. */
    getTasks(): AiTask[];
  };

  /**
   * Register AI tools that the language model can call during a conversation.
   * The tool definition is forwarded to the AI provider alongside MCP tools.
   * When the AI calls the tool, `handler` is invoked in the renderer with the
   * tool's input arguments and must return a string result.
   *
   * Returns an unsubscribe function that removes the tool registration.
   */
  tools: {
    register(
      toolDef: Omit<McpTool, 'serverId'>,
      handler: ToolHandler,
    ): Unsubscribe;
    /** Returns all tools currently registered by this extension. */
    list(): McpTool[];
  };
}

// ─── Activity Bar ─────────────────────────────────────────────────────────────

/**
 * An activity bar contribution registers a sidebar panel accessible via the
 * left-hand icon strip. The `panelId` becomes the `ActivityPanel` id stored in
 * `uiStore`.
 */
export interface ActivityBarContribution {
  /** Stable panel identifier. Must be unique across all extensions. */
  panelId: string;
  /** Tooltip / aria-label shown on the icon button. */
  label: string;
  /** Icon rendered in the activity bar button (React element, typically an SVG). */
  icon: React.ReactNode;
  /** The sidebar panel component rendered when this item is active. */
  panel: React.ComponentType;
  /**
   * Render order within the dynamic section (lower = higher in the bar).
   * Built-in structural items (chats, marketplace) are always first/last.
   * @default 50
   */
  order?: number;
}

// ─── Extension Manifest ───────────────────────────────────────────────────────

/**
 * The manifest for a registered extension. First-party built-ins and
 * marketplace-installed extensions share this shape.
 */
export interface ExtensionManifest {
  /** Namespaced identifier, e.g. `'openconduit.personas'`. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** SemVer version string. */
  version: string;
  description?: string;
  author?: string;
  /**
   * When `true` the extension runs in a sandboxed iframe (Phase 5).
   * First-party builtins are always `false` (or omitted).
   * All marketplace-installed extensions default to `true`.
   */
  sandboxed?: boolean;
  /**
   * Declared permissions that gate write-access `ExtensionAPI` methods.
   *
   * Recognised values:
   * - `'conversations.write'` — allows `api.conversations.sendMessage()`
   * - `'settings.write'`      — allows `api.settings.set()`
   */
  permissions?: string[];
  /**
   * Called once after the extension is registered.
   * Receives a scoped `ExtensionAPI` object as its only argument.
   * First-party builtins can use this instead of reaching into stores directly.
   */
  activate?: (api: ExtensionAPI) => void | Promise<void>;
  contributes?: {
    /** Sidebar panels contributed to the ActivityBar. */
    activityBarItems?: ActivityBarContribution[];
    /** Commands contributed to the command palette + keyboard shortcuts. */
    commands?: CommandContribution[];
    /** Slash commands contributed to the chat input autocomplete. */
    slashCommands?: SlashCommand[];
    /** Tabs contributed to the bottom panel. */
    bottomPanelTabs?: BottomPanelTab[];
    /** A settings section contributed to the Settings panel. */
    settingsTab?: SettingsContribution;
    /** Hooks into the AI chat pipeline. */
    hooks?: {
      beforeSend?: BeforeSendHook;
      onResponse?: OnResponseHook;
      onStreamChunk?: OnStreamChunkHook;
      onToolCall?: OnToolCallHook;
    };
    /**
     * Static tool declarations. These are registered automatically before
     * `activate` is called, so the AI can use them even if the extension
     * doesn't register a handler. For dynamic tools (or tools that need
     * runtime settings), prefer `api.tools.register()` in `activate`.
     */
    tools?: Array<Omit<McpTool, 'serverId'> & { handler: ToolHandler }>;
  };
}
