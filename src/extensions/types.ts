import type React from 'react';
import type { CommandContribution } from '../commands/commandRegistry';
import type {
  BeforeSendHook,
  OnResponseHook,
  OnStreamChunkHook,
  OnToolCallHook,
} from '../hooks/hookRegistry';
import type { BottomPanelTab } from '../bottomPanel/bottomPanelRegistry';
import type { SettingsContribution } from '../types';

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
  contributes?: {
    /** Sidebar panels contributed to the ActivityBar. */
    activityBarItems?: ActivityBarContribution[];
    /** Commands contributed to the command palette + keyboard shortcuts. */
    commands?: CommandContribution[];
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
  };
}
