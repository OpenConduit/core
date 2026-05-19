import { useEffect } from 'react';
import { commandRegistry } from '../commands/commandRegistry';
import { useKeybindingsStore, getEffectiveBinding } from '../stores/keybindingsStore';
import { useUiStore } from '../stores/uiStore';
import '../commands/coreCommandContributions';

/**
 * Global keyboard shortcut handler.
 *
 * Keybindings are driven by `commandRegistry` — each `CommandContribution`
 * with a `keybinding` field is automatically wired here. User overrides from
 * `keybindingsStore` take precedence over the default registry bindings.
 *
 * Shortcuts are suppressed while the Keyboard Shortcuts panel is open so that
 * key combos can be recorded there without accidentally firing commands.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Suppress all shortcuts while the keyboard shortcuts editor is open —
      // the panel's KeyRow recorder captures input with capture:true instead.
      if (useUiStore.getState().keyboardShortcutsOpen) return;

      const mod = e.metaKey || e.ctrlKey;
      const { overrides } = useKeybindingsStore.getState();

      for (const cmd of commandRegistry.getAll()) {
        const kb = getEffectiveBinding(cmd, overrides);
        if (!kb) continue;

        const keyMatch = e.key.toLowerCase() === kb.key.toLowerCase();
        const modMatch = (kb.mod ?? false) === mod;
        const shiftMatch = (kb.shift ?? false) === e.shiftKey;
        const altMatch = (kb.alt ?? false) === e.altKey;

        if (keyMatch && modMatch && shiftMatch && altMatch) {
          e.preventDefault();
          cmd.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // registry and stores are stable module-level references
}
