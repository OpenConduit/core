import type { InstalledExtensionInfo } from '../types';
import { extensionRegistry } from './extensionRegistry';

/** Minimal shape of the extensions bridge exposed by the Electron preload. */
interface ExtensionsApi {
  getInstalled: () => Promise<InstalledExtensionInfo[]>;
  readFile: (filePath: string) => Promise<string>;
}

type ApiWindow = Window & { api?: { extensions?: ExtensionsApi } };

/**
 * Loads extensions installed to `userData/extensions/` at app startup.
 *
 * Two loading paths:
 *
 * **Sandboxed (Phase 5 — default for all marketplace extensions):**
 * When `ext.manifest` is present (pre-read by the Electron preload from the
 * extension's `extension.json`), the extension is registered in
 * `extensionRegistry` without running its code. Each activity-bar panel
 * contribution is backed by a `SandboxedPanel` that lazily fetches and runs
 * the extension bundle inside a sandboxed iframe (`sandbox="allow-scripts"`)
 * only when the panel is first opened.
 *
 * **Legacy direct-import (fallback):**
 * When `ext.manifest` is absent, the extension bundle is read from disk,
 * wrapped in a Blob URL, and dynamically imported in the main renderer
 * context. This preserves backward compatibility with extensions published
 * before `extension.json` was required.
 *
 * Silent failures: a broken extension never crashes the app — the error is
 * logged and loading continues with the next extension.
 */
export async function loadInstalledExtensions(): Promise<void> {
  const api = (window as ApiWindow).api;
  if (!api?.extensions?.getInstalled) return;

  let installed: InstalledExtensionInfo[];
  try {
    installed = await api.extensions.getInstalled();
  } catch (err) {
    console.error('[ExtensionLoader] Failed to fetch installed extensions:', err);
    return;
  }

  for (const ext of installed) {
    try {
      if (ext.manifest) {
        // ── Sandboxed path (Phase 5) ──────────────────────────────────────────
        // The manifest was pre-read by the preload; register contributions now
        // so the ActivityBar can show the extension immediately. The bundle is
        // only fetched when the user opens the panel (lazy activation).
        extensionRegistry.registerSandboxedExtension(
          ext.manifest,
          ext.manifest.contributes ?? {},
          ext.entryPoint
        );
      } else {
        // ── Legacy direct-import path ─────────────────────────────────────────
        // Read the bundle, wrap in a Blob URL, import in the main renderer.
        // The extension self-registers via window.__openConduit.extensionRegistry.
        let blobUrl: string | null = null;
        try {
          const code = await api.extensions.readFile(ext.entryPoint);
          const blob = new Blob([code], { type: 'text/javascript' });
          blobUrl = URL.createObjectURL(blob);
          // @vite-ignore tells Vite's bundler to leave this dynamic import alone
          await import(/* @vite-ignore */ blobUrl);
        } finally {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }
      }
    } catch (err) {
      console.error(`[ExtensionLoader] Failed to load extension "${ext.id}":`, err);
    }
  }
}
