import { SANDBOX_RUNTIME } from './runtime';

/**
 * Wraps an extension's bundled JavaScript in a complete HTML document.
 *
 * The resulting document:
 * 1. Injects the OpenConduit runtime shim so `window.__openConduit` is
 *    available before any extension code executes.
 * 2. Loads the extension's entry point as an ES module (`type="module"`)
 *    inside a `<script>` tag — the module can use top-level `await` and
 *    import other bundled dependencies (already inlined by the extension's
 *    own build step).
 *
 * The document is loaded via a `blob:` URL inside an iframe with
 * `sandbox="allow-scripts"` only. No same-origin flag is granted, so the
 * extension has no access to the host window's globals, cookies, or storage.
 */
export function buildSandboxDocument(extensionCode: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <!-- OpenConduit sandbox runtime (injected by host) -->
  <script>${SANDBOX_RUNTIME}</script>
  <!-- Extension entry point -->
  <script type="module">${extensionCode}</script>
</body>
</html>`;
}
