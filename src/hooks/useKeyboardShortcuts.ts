import { useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Global keyboard shortcut handler.
 *
 * All app-wide keybindings live here so they're easy to audit and extend.
 * This hook is the precursor to the #38 command registry — each entry here
 * will become a `CommandContribution` with an `id`, `label`, and `keybinding`.
 *
 * Current bindings:
 *   ⌘K  — Open command palette
 *   ⌘,  — Open settings
 *   ⌘T  — New conversation
 *   ⌘N  — New conversation (alias)
 *   ⌘W  — Close active tab
 */
export function useKeyboardShortcuts() {
  const { settings } = useSettingsStore();
  const { addConversation, openTabs, openTab, closeTab } = useConversationStore();
  const {
    activeConversationId,
    setActiveConversation,
    setShowSettings,
    setCommandPaletteOpen,
    toggleBottomPanel,
  } = useUiStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘J — Toggle bottom panel
      if (mod && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // ⌘K — Command palette
      if (mod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // ⌘, — Settings
      if (mod && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
        return;
      }

      // ⌘T / ⌘N — New conversation
      if (mod && (e.key === 't' || e.key === 'n')) {
        e.preventDefault();
        if (settings) {
          const conv = addConversation({
            providerId: settings.defaultProviderId,
            model: settings.defaultModel,
          });
          openTab?.(conv.id);
          setActiveConversation(conv.id);
        }
        return;
      }

      // ⌘W — Close active tab
      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeConversationId) {
          const tabs = openTabs ?? [];
          const idx = tabs.indexOf(activeConversationId);
          closeTab?.(activeConversationId);
          const remaining = tabs.filter((t) => t !== activeConversationId);
          setActiveConversation(
            remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)] : null,
          );
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    settings,
    addConversation,
    openTab,
    closeTab,
    openTabs,
    activeConversationId,
    setActiveConversation,
    setShowSettings,
    setCommandPaletteOpen,
    toggleBottomPanel,
  ]);
}
