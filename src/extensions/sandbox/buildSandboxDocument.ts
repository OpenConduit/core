import { SANDBOX_RUNTIME } from './runtime';

/**
 * CSS custom-property tokens injected into every sandbox document.
 *
 * `:root` defines the **light** defaults; `:root[data-theme="dark"]`
 * overrides them with dark values. Using `:root` for defaults (rather than
 * `html[data-theme="light"]`) avoids attribute-selector specificity issues
 * and ensures variables resolve on first paint even before the extension
 * script runs.
 *
 * The runtime shim keeps `document.documentElement.dataset.theme` in sync
 * with the host via `oc:theme` postMessage so live theme switches work.
 */
const SANDBOX_THEME_VARS = `
  :root {
    --oc-bg:                #f1f5f9;
    --oc-bg-surface:        #ffffff;
    --oc-text:              #1e293b;
    --oc-text-muted:        #64748b;
    --oc-text-heading:      #0f172a;
    --oc-border:            #cbd5e1;
    --oc-code-bg:           #f8fafc;
    --oc-code-text:         #0369a1;
    --oc-section-title:     #64748b;
    --oc-btn-bg:            #3b82f6;
    --oc-btn-hover:         #2563eb;
    --oc-btn-disabled-bg:   #cbd5e1;
    --oc-btn-disabled-text: #94a3b8;
    --oc-badge-bg:          #ede9fe;
    --oc-badge-border:      #ddd6fe;
    --oc-badge-text:        #7c3aed;
    --oc-status-ok:         #16a34a;
    --oc-status-err:        #dc2626;
    --oc-pre-bg:            #f8fafc;
    --oc-pre-text:          #0369a1;
    --oc-card-shadow:       0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  }
  :root[data-theme="dark"] {
    --oc-bg:                #0f172a;
    --oc-bg-surface:        #1e293b;
    --oc-text:              #e2e8f0;
    --oc-text-muted:        #94a3b8;
    --oc-text-heading:      #f1f5f9;
    --oc-border:            #334155;
    --oc-code-bg:           #0f172a;
    --oc-code-text:         #7dd3fc;
    --oc-section-title:     #64748b;
    --oc-btn-bg:            #3b82f6;
    --oc-btn-hover:         #2563eb;
    --oc-btn-disabled-bg:   #334155;
    --oc-btn-disabled-text: #64748b;
    --oc-badge-bg:          #1e293b;
    --oc-badge-border:      #334155;
    --oc-badge-text:        #7c3aed;
    --oc-status-ok:         #34d399;
    --oc-status-err:        #f87171;
    --oc-pre-bg:            #0f172a;
    --oc-pre-text:          #7dd3fc;
    --oc-card-shadow:       none;
  }
`;

/**
 * Wraps an extension's bundled JavaScript in a complete HTML document.
 *
 * The resulting document:
 * 1. Sets `data-theme` on `<html>` to match the host app's current theme.
 * 2. Injects OpenConduit CSS custom-property tokens for both themes so
 *    extension stylesheets can use `var(--oc-*)` without hardcoding colours.
 * 3. Injects the OpenConduit runtime shim so `window.__openConduit` is
 *    available before any extension code executes.
 * 4. Loads the extension's entry point as an ES module (`type="module"`)
 *    inside a `<script>` tag — the module can use top-level `await` and
 *    import other bundled dependencies (already inlined by the extension's
 *    own build step).
 *
 * The document is loaded via a `blob:` URL inside an iframe with
 * `sandbox="allow-scripts"` only. No same-origin flag is granted, so the
 * extension has no access to the host window's globals, cookies, or storage.
 */
export function buildSandboxDocument(extensionCode: string, theme: 'light' | 'dark' = 'light'): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: var(--oc-bg, #ffffff); color: var(--oc-text, #0f172a); }
    #root { height: 100%; }
    ${SANDBOX_THEME_VARS}
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

