import { useEffect } from 'react';
import { commandRegistry } from '../commands/commandRegistry';
import '../commands/coreCommandContributions';

/**
 * Global keyboard shortcut handler.
 *
 * Keybindings are driven by `commandRegistry` — each `CommandContribution`
 * with a `keybinding` field is automatically wired here. To add or change a
 * shortcut, register (or update) a command in `coreCommandContributions.ts`
 * or from an extension via `commandRegistry.register(...)`.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      for (const cmd of commandRegistry.getAll()) {
        const kb = cmd.keybinding;
        if (!kb) continue;

        const keyMatch = e.key.toLowerCase() === kb.key.toLowerCase();
        const modMatch = (kb.mod ?? false) === mod;
        const shiftMatch = (kb.shift ?? false) === e.shiftKey;
        const altMatch = (kb.alt ?? false) === e.altKey;

        if (keyMatch && modMatch && shiftMatch && altMatch) {
          // Respect when-guard before consuming the event
          if (cmd.when && !cmd.when()) continue;
          e.preventDefault();
          cmd.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // registry is a stable module-level reference
}
