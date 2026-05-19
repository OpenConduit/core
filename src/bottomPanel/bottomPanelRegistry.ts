import React from 'react';

/**
 * A single tab contribution for the bottom panel (#18).
 *
 * Core registers built-in tabs in coreBottomPanelContributions.ts.
 * Extensions (#38) call register() from their activation code.
 */
export interface BottomPanelTab {
  /** Unique tab identifier, e.g. 'tool-calls'. Extensions use 'my-ext.my-tab'. */
  id: string;
  /** Label shown in the tab strip */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Sort order — lower numbers appear first */
  order: number;
  /** The tab content. Receives the active conversation id. */
  content: React.ReactNode | ((conversationId: string | null) => React.ReactNode);
}

const _registry = new Map<string, BottomPanelTab>();

export const bottomPanelRegistry = {
  register(tab: BottomPanelTab): void {
    _registry.set(tab.id, tab);
  },

  unregister(id: string): void {
    _registry.delete(id);
  },

  get(id: string): BottomPanelTab | undefined {
    return _registry.get(id);
  },

  /** All registered tabs sorted by order. */
  getAll(): BottomPanelTab[] {
    return Array.from(_registry.values()).sort((a, b) => a.order - b.order);
  },
};
