import type { SettingsContribution } from '../types';

/**
 * Registry of all SettingsContribution entries.
 *
 * Core registers its built-in sections in coreContributions.ts.
 * Extensions (Phase 4 / #38) will call register() from their manifest loader.
 *
 * Modelled after hookRegistry — a plain singleton so it works outside React.
 */

const _registry = new Map<string, SettingsContribution>();

export const settingsRegistry = {
  register(contribution: SettingsContribution): void {
    _registry.set(contribution.id, contribution);
  },

  unregister(id: string): void {
    _registry.delete(id);
  },

  get(id: string): SettingsContribution | undefined {
    return _registry.get(id);
  },

  /** Returns all contributions sorted by their `order` field. */
  getAll(): SettingsContribution[] {
    return Array.from(_registry.values()).sort((a, b) => a.order - b.order);
  },
};
