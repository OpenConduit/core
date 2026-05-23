/**
 * Slash-command registry for the chat input.
 *
 * Extensions (first-party and third-party) register entries here. When the
 * user types `/` in the message input a filtered autocomplete dropdown is
 * shown. Selecting a command calls `execute(args, context)`.
 *
 * Usage:
 * ```ts
 * slashCommandRegistry.register({
 *   trigger: 'clear',
 *   description: 'Clear all messages in this chat',
 *   execute: (_args, ctx) => { ctx.chat?.clear?.(); },
 * });
 * ```
 */

import type React from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Runtime context passed to a slash command's execute function. */
export interface SlashCommandContext {
  /** The active conversation ID, or null if none. */
  conversationId: string | null;
  /** Replace the textarea content. Pass '' to clear it. */
  setContent: (text: string) => void;
  /** Chat-level callbacks injected by InputBar. */
  chat?: {
    /** Clear all messages in the current conversation. */
    clear?: () => void;
    /** AI-summarize and compact the current conversation. */
    compact?: () => void;
    /** Trim oldest messages to reduce context usage. */
    trim?: () => void;
    /** Open the folder picker for agent context. */
    pickFolder?: () => Promise<void>;
  };
}

/** A slash command that can be invoked from the chat input. */
export interface SlashCommand {
  /**
   * The trigger word typed after the slash, lowercase, no spaces.
   * e.g. `'clear'` matches `/clear`.
   */
  trigger: string;
  /** Short description shown in the autocomplete dropdown. */
  description: string;
  /** Optional grouping label shown in the dropdown header. */
  category?: 'chat' | 'navigation' | 'context' | 'custom' | string;
  /** Optional icon (React element, e.g. a small SVG). */
  icon?: React.ReactNode;
  /**
   * Called when the user selects this command.
   *
   * - Return a `string` to place in the textarea after execution (useful for
   *   commands that scaffold further input, e.g. `/system `).
   * - Return `void` / `undefined` to clear the textarea.
   * - May be async.
   */
  execute: (
    args: string,
    context: SlashCommandContext,
  ) => void | string | Promise<void | string>;
}

// ─── Registry ──────────────────────────────────────────────────────────────

class SlashCommandRegistry {
  private readonly commands = new Map<string, SlashCommand>();

  /** Register a slash command. Re-registering the same trigger is a no-op. */
  register(command: SlashCommand): void {
    if (this.commands.has(command.trigger)) return;
    this.commands.set(command.trigger, command);
  }

  /** Unregister a slash command by its trigger word. */
  unregister(trigger: string): void {
    this.commands.delete(trigger);
  }

  /** Returns all registered slash commands in registration order. */
  getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Returns commands whose trigger starts with `prefix` (case-insensitive).
   * An empty prefix returns all commands.
   */
  getMatching(prefix: string): SlashCommand[] {
    const lower = prefix.toLowerCase();
    return this.getAll().filter((c) => c.trigger.startsWith(lower));
  }
}

export const slashCommandRegistry = new SlashCommandRegistry();
