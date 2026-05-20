import { createElement } from 'react';
import type React from 'react';
import type { ActivityBarContribution, ExtensionManifest } from './types';
import type { SettingsProperty } from '../types';
import type { SandboxContributions, SerializableSandboxManifest } from './sandbox/protocol';
import { SandboxedPanel } from './sandbox/SandboxedPanel';
import { commandRegistry } from '../commands/commandRegistry';
import { hookRegistry } from '../hooks/hookRegistry';
import { bottomPanelRegistry } from '../bottomPanel/bottomPanelRegistry';
import { settingsRegistry } from '../settings/settingsRegistry';
import { createExtensionAPI } from './extensionHost';

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
    contributions: NonNullable<ExtensionManifest['contributes']> = {}
  ): void {
    if (this.manifests.has(manifest.id)) return;
    this.manifests.set(manifest.id, manifest);

    // ── Activity bar ──────────────────────────────────────────────────────────
    if (contributions.activityBarItems) {
      for (const item of contributions.activityBarItems) {
        if (!this.activityBarItems.some((i) => i.panelId === item.panelId)) {
          this.activityBarItems.push(item);
        }
      }
    }

    // ── Commands ──────────────────────────────────────────────────────────────
    if (contributions.commands) {
      for (const cmd of contributions.commands) {
        commandRegistry.register(cmd);
      }
    }

    // ── Bottom panel tabs ─────────────────────────────────────────────────────
    if (contributions.bottomPanelTabs) {
      for (const tab of contributions.bottomPanelTabs) {
        bottomPanelRegistry.register(tab);
      }
    }

    // ── Settings tab ──────────────────────────────────────────────────────────
    if (contributions.settingsTab) {
      settingsRegistry.register(contributions.settingsTab);
    }

    // ── Chat pipeline hooks ───────────────────────────────────────────────────
    if (contributions.hooks) {
      const { hooks } = contributions;
      const prefix = manifest.id;
      if (hooks.beforeSend)    hookRegistry.registerBeforeSend(`${prefix}.beforeSend`, hooks.beforeSend);
      if (hooks.onResponse)    hookRegistry.registerOnResponse(`${prefix}.onResponse`, hooks.onResponse);
      if (hooks.onStreamChunk) hookRegistry.registerOnStreamChunk(`${prefix}.onStreamChunk`, hooks.onStreamChunk);
      if (hooks.onToolCall)    hookRegistry.registerOnToolCall(`${prefix}.onToolCall`, hooks.onToolCall);
    }

    // ── activate(api) ─────────────────────────────────────────────────────
    if (manifest.activate) {
      try {
        void manifest.activate(createExtensionAPI(manifest));
      } catch (err) {
        console.error(`[ExtensionRegistry] activate() failed for "${manifest.id}":`, err);
      }
    }

    this.notify();
  }

  /**
   * Register a sandboxed third-party extension (Phase 5).
   *
   * Unlike `registerExtension`, this path is used for marketplace-installed
   * extensions whose manifest was pre-read by the Electron preload. The
   * extension's entry-point bundle is **not** executed in the main renderer;
   * instead each activity bar panel contribution is backed by a
   * `SandboxedPanel` that loads the bundle lazily inside a sandboxed iframe
   * when the panel is first opened.
   *
   * Calling this twice with the same `manifest.id` is a no-op (idempotent).
   */
  registerSandboxedExtension(
    manifest: SerializableSandboxManifest,
    contributions: SandboxContributions,
    entryPoint: string
  ): void {
    if (this.manifests.has(manifest.id)) return;

    // Store a synthetic ExtensionManifest so getManifest() / getAllManifests() work.
    this.manifests.set(manifest.id, { ...manifest, sandboxed: true });

    if (contributions.activityBarItems) {
      for (const item of contributions.activityBarItems) {
        if (this.activityBarItems.some((i) => i.panelId === item.panelId)) continue;

        // Capture loop variables for the closure.
        const extId = manifest.id;
        const ep = entryPoint;

        // Generic puzzle-piece icon for sandboxed extensions.
        // Extensions can provide a custom icon via `iconSvg` in a future release.
        const icon = item.iconSvg
          ? createElement('span', {
              dangerouslySetInnerHTML: { __html: item.iconSvg },
              style: { display: 'flex', alignItems: 'center' },
            })
          : createElement(
              'svg',
              { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              createElement('path', {
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 1.5,
                d: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
              })
            );

        const PanelComponent: React.ComponentType = () =>
          createElement(SandboxedPanel, { extensionId: extId, entryPoint: ep });

        this.activityBarItems.push({
          panelId: item.panelId,
          label: item.label,
          order: item.order,
          icon,
          panel: PanelComponent,
        });
      }
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    if (contributions.settings && contributions.settings.length > 0) {
      settingsRegistry.register({
        id: manifest.id,
        label: manifest.name,
        order: 100,
        sections: [
          {
            title: 'Preferences',
            properties: contributions.settings.map((s, idx) => {
              const rawSegment = s.key.split('.').pop() ?? s.key;
              const derivedTitle = rawSegment
                .replace(/([A-Z])/g, ' $1')
                .replace(/^[a-z]/, (c) => c.toUpperCase());
              return {
                type: s.type,
                key: s.key,
                title: s.title ?? derivedTitle,
                description: s.description,
                default: s.default,
                order: idx + 1,
              } as SettingsProperty;
            }),
          },
        ],
      });
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
