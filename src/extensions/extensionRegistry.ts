import { createElement } from 'react';
import type React from 'react';
import type {
  ActivityBarContribution,
  ExtensionManifest,
  MainViewContribution,
  SplitPaneViewContribution,
  SecondarySidebarPanelContribution,
  StatusBarItemContribution,
  StoreSliceContribution,
  MessageBadgeContribution,
  ConversationModeContribution,
} from './types';
import type { SettingsProperty } from '../types';
import type { SandboxContributions, SerializableSandboxManifest } from './sandbox/protocol';
import { SandboxedPanel } from './sandbox/SandboxedPanel';
import { commandRegistry } from '../commands/commandRegistry';
import { slashCommandRegistry } from '../commands/slashCommandRegistry';
import { hookRegistry } from '../hooks/hookRegistry';
import { bottomPanelRegistry } from '../bottomPanel/bottomPanelRegistry';
import { settingsRegistry } from '../settings/settingsRegistry';
import { createExtensionAPI } from './extensionHost';
import { toolContributionRegistry } from './toolContributionRegistry';

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
  private readonly mainViewMap = new Map<string, MainViewContribution>();
  private readonly splitPaneViewMap = new Map<string, SplitPaneViewContribution>();
  private readonly secondarySidebarPanelList: SecondarySidebarPanelContribution[] = [];
  private readonly statusBarItemsList: StatusBarItemContribution[] = [];
  private readonly storeSlices = new Map<string, StoreSliceContribution>();
  private readonly messageBadgesList: MessageBadgeContribution[] = [];
  private readonly conversationModeMap = new Map<string, ConversationModeContribution>();

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

    // ── Slash commands ────────────────────────────────────────────────────────
    if (contributions.slashCommands) {
      for (const cmd of contributions.slashCommands) {
        slashCommandRegistry.register(cmd);
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

    // ── Static tool contributions ─────────────────────────────────────────────
    if (contributions.tools) {
      for (const { handler, ...toolDef } of contributions.tools) {
        toolContributionRegistry.register(toolDef, handler);
      }
    }

    // ── Main view contributions ───────────────────────────────────────────────
    if (contributions.mainViews) {
      for (const view of contributions.mainViews) {
        if (!this.mainViewMap.has(view.id)) {
          this.mainViewMap.set(view.id, view);
        }
      }
    }

    // ── Split pane view contributions ─────────────────────────────────────────
    if (contributions.splitPaneViews) {
      for (const view of contributions.splitPaneViews) {
        if (!this.splitPaneViewMap.has(view.id)) {
          this.splitPaneViewMap.set(view.id, view);
        }
      }
    }

    // ── Secondary sidebar panel contributions ─────────────────────────────────
    if (contributions.secondarySidebarPanels) {
      for (const panel of contributions.secondarySidebarPanels) {
        if (!this.secondarySidebarPanelList.some((p) => p.id === panel.id)) {
          this.secondarySidebarPanelList.push(panel);
        }
      }
    }

    // ── Status bar items ──────────────────────────────────────────────────────
    if (contributions.statusBarItems) {
      for (const item of contributions.statusBarItems) {
        if (!this.statusBarItemsList.some((i) => i.id === item.id)) {
          this.statusBarItemsList.push(item);
        }
      }
    }

    // ── Store slices ──────────────────────────────────────────────────────────
    if (contributions.stores) {
      for (const slice of contributions.stores) {
        if (!this.storeSlices.has(slice.id)) {
          this.storeSlices.set(slice.id, slice);
        }
      }
    }

    // ── Message badges ────────────────────────────────────────────────────────
    if (contributions.messageBadges) {
      for (const badge of contributions.messageBadges) {
        if (!this.messageBadgesList.some((b) => b.id === badge.id)) {
          this.messageBadgesList.push(badge);
        }
      }
    }

    // ── Conversation modes ────────────────────────────────────────────────────
    if (contributions.conversationModes) {
      for (const mode of contributions.conversationModes) {
        if (!this.conversationModeMap.has(mode.id)) {
          this.conversationModeMap.set(mode.id, mode);
        }
      }
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

  // ── Main view getters ─────────────────────────────────────────────────────

  /**
   * Looks up the main-view component registered under the given `id`.
   * Returns `undefined` when no extension has registered that id.
   */
  getMainView(id: string): React.ComponentType | undefined {
    return this.mainViewMap.get(id)?.component;
  }

  /** Returns all registered main-view contributions. */
  getAllMainViews(): MainViewContribution[] {
    return [...this.mainViewMap.values()];
  }

  // ── Split pane view getters ───────────────────────────────────────────────

  /**
   * Looks up the split-pane view registered under the given `id`.
   * Returns `undefined` for built-in types (`'conversation'`, `'code'`, etc.).
   */
  getSplitPaneView(id: string): SplitPaneViewContribution | undefined {
    return this.splitPaneViewMap.get(id);
  }

  /** Returns all registered split-pane view contributions. */
  getAllSplitPaneViews(): SplitPaneViewContribution[] {
    return [...this.splitPaneViewMap.values()];
  }

  // ── Secondary sidebar panel getters ───────────────────────────────────────

  /**
   * Returns all extension-contributed secondary sidebar panels sorted by
   * `order` ascending (default 50), then by registration order.
   */
  getSecondarySidebarPanels(): SecondarySidebarPanelContribution[] {
    return [...this.secondarySidebarPanelList].sort(
      (a, b) => (a.order ?? 50) - (b.order ?? 50)
    );
  }

  // ── Status bar item getters ───────────────────────────────────────────────

  /**
   * Returns status bar items for the given side (or all items if `align` is
   * omitted), sorted by `order` ascending (default 50).
   */
  getStatusBarItems(align?: 'left' | 'right'): StatusBarItemContribution[] {
    const items = align
      ? this.statusBarItemsList.filter((i) => (i.align ?? 'right') === align)
      : [...this.statusBarItemsList];
    return items.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }

  // ── Store slice getters ───────────────────────────────────────────────────

  /**
   * Returns the Zustand store registered under `id`, or `undefined` if not
   * found. Cast the return value to the expected store type at the call site.
   */
  getStore(id: string): unknown {
    return this.storeSlices.get(id)?.store;
  }

  /** Returns all registered store slice contributions. */
  getAllStoreSlices(): StoreSliceContribution[] {
    return [...this.storeSlices.values()];
  }

  // ── Message badge getters ─────────────────────────────────────────────────

  /** Returns all registered message badge contributions. */
  getMessageBadges(): MessageBadgeContribution[] {
    return [...this.messageBadgesList];
  }

  // ── Conversation mode getters ─────────────────────────────────────────────

  /**
   * Returns the conversation mode registered under `id`, or `undefined` if
   * no extension has registered that id.
   */
  getConversationMode(id: string): ConversationModeContribution | undefined {
    return this.conversationModeMap.get(id);
  }

  /** Returns all registered conversation mode contributions. */
  getAllConversationModes(): ConversationModeContribution[] {
    return [...this.conversationModeMap.values()];
  }
}

export const extensionRegistry = new ExtensionRegistry();

// Merge all extension-contributed tools into every ChatRequest via a single
// global beforeSend hook. Runs after all extension-specific hooks so tools
// registered dynamically in activate() are included.
hookRegistry.registerBeforeSend('__core__.extensionTools', (request) => {
  const tools = toolContributionRegistry.getTools();
  if (tools.length === 0) return request;
  const existing = request.builtinTools ?? [];
  // Avoid duplicates if a tool is already present (e.g. injected by its own beforeSend hook)
  const newTools = tools.filter((t) => !existing.some((e) => e.name === t.name));
  if (newTools.length === 0) return request;
  return { ...request, builtinTools: [...existing, ...newTools] };
});
