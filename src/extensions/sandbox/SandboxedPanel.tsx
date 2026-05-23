import { useRef, useEffect, useState, createElement } from 'react';
import { buildSandboxDocument } from './buildSandboxDocument';
import type { SandboxToHostMessage, HostToSandboxMessage } from './protocol';
import type { ExtensionAPI } from '../types';
import { createExtensionAPI } from '../extensionHost';

/**
 * API methods that return subscription/unsubscribe functions cannot be
 * serialised over the postMessage bridge. They are blocked with a clear error.
 */
const SUBSCRIPTION_METHODS = new Set([
  'conversations.onNewMessage',
  'settings.onChange',
  'ui.registerMessageDecorator',
]);

async function dispatchApiCall(
  api: ExtensionAPI,
  path: string,
  args: unknown[],
): Promise<unknown> {
  if (SUBSCRIPTION_METHODS.has(path)) {
    throw new Error(
      `"${path}" is a subscription method and cannot be called over the sandbox bridge.`,
    );
  }

  const parts = path.split('.');
  if (parts.length !== 2) throw new Error(`Invalid API path: "${path}"`);
  const [ns, method] = parts;

  const namespace = (api as unknown as Record<string, unknown>)[ns];
  if (!namespace || typeof namespace !== 'object') {
    throw new Error(`Unknown API namespace: "${ns}"`);
  }

  const fn = (namespace as Record<string, unknown>)[method];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown API method: "${path}"`);
  }

  return await (fn as (...a: unknown[]) => unknown)(...args);
}

/** Minimal type for the extensions bridge exposed by the Electron preload. */
interface ExtensionsApi {
  readFile: (filePath: string) => Promise<string>;
}
type ApiWindow = Window & { api?: { extensions?: ExtensionsApi } };

/** Returns 'dark' if the host document has the Tailwind `dark` class on <html>. */
function getHostTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

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

  // Lazily-created ExtensionAPI instance scoped to this sandboxed extension.
  // Sandboxed extensions are granted all permissions — the iframe sandbox is
  // the security boundary.
  const apiRef = useRef<ExtensionAPI | null>(null);
  function getApi(): ExtensionAPI {
    if (!apiRef.current) {
      apiRef.current = createExtensionAPI({
        id: extensionId,
        name: extensionId,
        version: '0.0.0',
        sandboxed: true,
        permissions: ['conversations.write', 'settings.write'],
      });
    }
    return apiRef.current;
  }

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
        const html = buildSandboxDocument(code, getHostTheme());
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

  /* Watch for host theme changes and forward them to the iframe */
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow) return;
      const msg: HostToSandboxMessage = { type: 'oc:theme', theme: getHostTheme() };
      frame.contentWindow.postMessage(msg, '*');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /* Handle postMessage calls from the extension */
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      const msg = event.data as SandboxToHostMessage;
      if (typeof msg?.type !== 'string' || !msg.type.startsWith('oc:')) return;

      if (msg.type === 'oc:api') {
        const callId = msg.id;
        dispatchApiCall(getApi(), msg.path, msg.args)
          .then((result) => {
            const response: HostToSandboxMessage = { type: 'oc:api-response', id: callId, result };
            frame.contentWindow?.postMessage(response, '*');
          })
          .catch((err: unknown) => {
            const response: HostToSandboxMessage = {
              type: 'oc:api-response',
              id: callId,
              error: err instanceof Error ? err.message : String(err),
            };
            frame.contentWindow?.postMessage(response, '*');
          });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* eslint-disable react-hooks/refs -- passing a ref object to createElement is standard React;
     the linter incorrectly flags the ref prop as "accessing ref during render". */
  return createElement('iframe', {
    ref: iframeRef,
    src: blobUrl,
    sandbox: 'allow-scripts',
    title: `Extension: ${extensionId}`,
    style: { width: '100%', height: '100%', border: 'none', display: 'block' },
  });
  /* eslint-enable react-hooks/refs */
}
