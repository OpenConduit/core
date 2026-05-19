import React from 'react';

/**
 * A command contribution — the core unit of the #38 extension platform.
 *
 * Commands appear in the command palette (via `>` prefix) and optionally
 * bind a keyboard shortcut. Extensions register commands here; the runtime
 * activates them without touching any built-in component.
 */
export interface CommandContribution {
  /** Unique namespaced id, e.g. 'core.newConversation' or 'my-ext.doThing' */
  id: string;
  /** Label shown in the command palette */
  label: string;
  /** Short human-readable shortcut hint shown in the palette, e.g. '⌘T' */
  shortcut?: string;
  /**
   * Machine-readable keybinding for useKeyboardShortcuts to bind.
   * `key` is the KeyboardEvent.key value (case-insensitive).
   */
  keybinding?: {
    key: string;
    mod?: boolean;   // metaKey || ctrlKey
    shift?: boolean;
    alt?: boolean;
  };
  /** Icon rendered in the command palette result row */
  icon?: React.ReactNode;
  /**
   * The handler. Receives no arguments — use closures or store.getState()
   * for any runtime context you need.
   */
  action: () => void;
  /**
   * Optional guard — when present, the command is hidden from the palette
   * and its keybinding is ignored if this returns false.
   */
  when?: () => boolean;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const _registry = new Map<string, CommandContribution>();

export const commandRegistry = {
  /** Register a command. Re-registering the same id replaces the previous entry. */
  register(cmd: CommandContribution): void {
    _registry.set(cmd.id, cmd);
  },

  /** Remove a command by id. */
  unregister(id: string): void {
    _registry.delete(id);
  },

  /** Get a single command by id. */
  get(id: string): CommandContribution | undefined {
    return _registry.get(id);
  },

  /** All registered commands in registration order. */
  getAll(): CommandContribution[] {
    return Array.from(_registry.values());
  },

  /**
   * Execute a command by id.
   * Respects the `when` guard — silently no-ops if the guard returns false.
   */
  execute(id: string): void {
    const cmd = _registry.get(id);
    if (!cmd) return;
    if (cmd.when && !cmd.when()) return;
    cmd.action();
  },
};
