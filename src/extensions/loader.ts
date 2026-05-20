import type { InstalledExtensionInfo } from '../types';

/** Minimal shape of the extensions bridge exposed by the Electron preload. */
interface ExtensionsApi {
  getInstalled: () => Promise<InstalledExtensionInfo[]>;
  readFile: (filePath: string) => Promise<string>;
}

type ApiWindow = Window & { api?: { extensions?: ExtensionsApi } };

/**
 * Loads extensions installed to `userData/extensions/` at app startup.
 *
 * Flow:
 *  1. Call `window.api.extensions.getInstalled()` via the preload bridge to
 *     get the list of installed extensions and their entry point paths.
 *  2. For each extension, ask the preload to read the bundled JS file
 *     (`window.api.extensions.readFile(path)`) — the preload runs in Node
 *     context and can access the filesystem even though the renderer cannot.
 *  3. Wrap the source in a Blob URL and `import()` it so the extension
 *     module runs in the renderer context, giving it full access to the DOM
 *     and React tree.
 *  4. Each extension's entry point is expected to call
 *     `window.__openConduit.extensionRegistry.registerExtension(...)` which
 *     propagates to `ActivityBar` and any other registry consumers.
 *
 * Silent failures: a missing or broken extension never crashes the app —
 * the error is logged and loading continues with the next extension.
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
    let blobUrl: string | null = null;
    try {
      const code = await api.extensions.readFile(ext.entryPoint);

      // Wrap in a Blob URL so the renderer can import() it as an ES module
      const blob = new Blob([code], { type: 'text/javascript' });
      blobUrl = URL.createObjectURL(blob);

      // @vite-ignore tells Vite's bundler to leave this dynamic import alone
      await import(/* @vite-ignore */ blobUrl);
    } catch (err) {
      console.error(`[ExtensionLoader] Failed to load extension "${ext.id}":`, err);
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
  }
}
