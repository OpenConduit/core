import { useRef, useEffect, useState, createElement } from 'react';
import { buildSandboxDocument } from './buildSandboxDocument';
import type { SandboxToHostMessage, HostToSandboxMessage } from './protocol';

/** Minimal type for the extensions bridge exposed by the Electron preload. */
interface ExtensionsApi {
  readFile: (filePath: string) => Promise<string>;
}
type ApiWindow = Window & { api?: { extensions?: ExtensionsApi } };

interface SandboxedPanelProps {
  /** The extension's namespaced id — used for debug labels only. */
  extensionId: string;
  /** Absolute path to the extension's bundled JS entry point. */
  entryPoint: string;
}

/**
 * Renders a sandboxed third-party extension panel inside an isolated iframe.
 *
 * Lifecycle:
 * 1. On mount, reads the extension bundle from disk via the Electron preload
 *    bridge (`window.api.extensions.readFile`).
 * 2. Wraps the code in a full HTML document that includes the OpenConduit
 *    sandbox runtime shim (see `buildSandboxDocument`).
 * 3. Creates a `blob:` URL for the document and sets it as the iframe `src`.
 * 4. Listens for postMessage calls from the extension (e.g. `oc:api`) and
 *    proxies them to the appropriate host service.
 *
 * Security:
 * - `sandbox="allow-scripts"` only — no same-origin, navigation, or forms.
 * - `event.source` is verified before processing any incoming message.
 * - The blob URL is revoked when the component unmounts.
 */
export function SandboxedPanel({ extensionId, entryPoint }: SandboxedPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Load the extension bundle and build the sandbox document */
  useEffect(() => {
    const api = (window as ApiWindow).api;
    if (!api?.extensions?.readFile) {
      setError('Extension bridge not available.');
      return;
    }

    let objectUrl: string | null = null;

    api.extensions
      .readFile(entryPoint)
      .then((code) => {
        const html = buildSandboxDocument(code);
        const blob = new Blob([html], { type: 'text/html' });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err: unknown) => {
        console.error(`[SandboxedPanel:${extensionId}] Failed to load bundle:`, err);
        setError('Failed to load extension.');
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [extensionId, entryPoint]);

  /* Handle postMessage calls from the extension */
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      const msg = event.data as SandboxToHostMessage;
      if (typeof msg?.type !== 'string' || !msg.type.startsWith('oc:')) return;

      if (msg.type === 'oc:api') {
        // Proxy ExtensionAPI calls to the host — full implementation tracked in #55.
        console.warn(`[SandboxedPanel:${extensionId}] api.${msg.path}() called but ExtensionAPI is not yet implemented (#55).`);
        const response: HostToSandboxMessage = {
          type: 'oc:api-response',
          id: msg.id,
          error: 'ExtensionAPI not yet implemented. See issue #55.',
        };
        frame.contentWindow?.postMessage(response, '*');
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [extensionId]);

  if (error) {
    return createElement(
      'div',
      { style: { padding: 16, color: '#f87171', fontSize: 12 } },
      error
    );
  }

  if (!blobUrl) {
    return createElement(
      'div',
      { style: { padding: 16, color: '#94a3b8', fontSize: 12 } },
      'Loading extension\u2026'
    );
  }

  return createElement('iframe', {
    ref: iframeRef,
    src: blobUrl,
    sandbox: 'allow-scripts',
    title: `Extension: ${extensionId}`,
    style: { width: '100%', height: '100%', border: 'none', display: 'block' },
  });
}
