import { SANDBOX_RUNTIME } from './runtime';

/**
 * CSS custom-property tokens injected into every sandbox document.
 *
 * Extensions use `var(--oc-*)` in their stylesheets instead of hardcoded
 * colours. The host controls which values are active by setting
 * `data-theme="light"` (default) or `data-theme="dark"` on `<html>`.
 * The runtime shim updates this attribute when the host theme changes.
 */
const SANDBOX_THEME_VARS = `
  :root, html[data-theme="light"] {
    --oc-bg:                #ffffff;
    --oc-bg-surface:        #f8fafc;
    --oc-bg-card:           #f1f5f9;
    --oc-text:              #0f172a;
    --oc-text-muted:        #64748b;
    --oc-text-heading:      #0f172a;
    --oc-border:            #e2e8f0;
    --oc-code-bg:           #f8fafc;
    --oc-code-text:         #0369a1;
    --oc-section-title:     #94a3b8;
    --oc-btn-bg:            #3b82f6;
    --oc-btn-hover:         #2563eb;
    --oc-btn-disabled-bg:   #94a3b8;
    --oc-btn-disabled-text: #f8fafc;
    --oc-badge-bg:          #f1f5f9;
    --oc-badge-border:      #e2e8f0;
    --oc-badge-text:        #7c3aed;
    --oc-status-ok:         #16a34a;
    --oc-status-err:        #dc2626;
    --oc-pre-bg:            #f8fafc;
    --oc-pre-text:          #0369a1;
  }
  html[data-theme="dark"] {
    --oc-bg:                #0f172a;
    --oc-bg-surface:        #1e293b;
    --oc-bg-card:           #1e293b;
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

