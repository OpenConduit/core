import type React from 'react';
import type { ActivityBarContribution, ExtensionManifest } from './types';

/**
 * Tracks all registered extensions and their contributions.
 *
 * Mirrors the pattern of `commandRegistry` — a lightweight singleton that
 * collects contributions at module-evaluation time and exposes read-only views
 * to components.
 *
 * Usage:
 * ```ts
 * // Register (typically in a builtins/ file or an installed extension loader)
 * extensionRegistry.registerExtension(manifest, contributions);
 *
 * // Read (in ActivityBar, App, etc.)
 * const items = extensionRegistry.getActivityBarItems();
 * const Panel = extensionRegistry.getSidebarPanel('personas');
 * ```
 */
class ExtensionRegistry {
  private readonly manifests = new Map<string, ExtensionManifest>();
  private readonly activityBarItems: ActivityBarContribution[] = [];
  private readonly listeners = new Set<() => void>();

  /**
   * Register an extension and its contributions.
   * Calling this twice with the same `manifest.id` is a no-op (idempotent).
   */
  registerExtension(
    manifest: ExtensionManifest,
    contributions: {
      activityBarItems?: ActivityBarContribution[];
    } = {}
  ): void {
    if (this.manifests.has(manifest.id)) return;
    this.manifests.set(manifest.id, manifest);

    if (contributions.activityBarItems) {
      for (const item of contributions.activityBarItems) {
        // Guard against duplicate panelIds
        if (!this.activityBarItems.some((i) => i.panelId === item.panelId)) {
          this.activityBarItems.push(item);
        }
      }
    }

    this.notify();
  }

  /** Notify all subscribers that the registry has changed. */
  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /**
   * Subscribe to registry changes. Called whenever a new extension registers.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Returns all contributed activity bar items sorted by `order` (ascending).
   * Items without an explicit order default to 50.
   */
  getActivityBarItems(): ActivityBarContribution[] {
    return [...this.activityBarItems].sort(
      (a, b) => (a.order ?? 50) - (b.order ?? 50)
    );
  }

  /**
   * Looks up the sidebar panel component for a given panel id.
   * Returns `undefined` for ids that belong to structural built-ins
   * (e.g. `'chats'`, `'marketplace'`) which are rendered by `App` directly.
   */
  getSidebarPanel(panelId: string): React.ComponentType | undefined {
    return this.activityBarItems.find((i) => i.panelId === panelId)?.panel;
  }

  /** Returns the manifest for a registered extension, or `undefined`. */
  getManifest(id: string): ExtensionManifest | undefined {
    return this.manifests.get(id);
  }

  /** Returns all registered manifests (read-only snapshot). */
  getAllManifests(): ExtensionManifest[] {
    return [...this.manifests.values()];
  }
}

export const extensionRegistry = new ExtensionRegistry();
