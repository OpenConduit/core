/**
 * OpenConduit sandbox runtime shim.
 *
 * This string is injected as an inline `<script>` tag into the sandboxed
 * extension iframe *before* the extension's own entry-point code runs. It
 * provides `window.__openConduit` so that extension code written for the
 * in-process API continues to work unchanged inside the sandbox.
 *
 * Security notes:
 * - The iframe is loaded with `sandbox="allow-scripts"` only. Same-origin
 *   access, navigation, forms, popups and top-level browsing are all blocked.
 * - The runtime posts to `'*'` because the host origin is a blob: URL and
 *   therefore unpredictable. The host verifies `event.source` instead.
 * - React component references passed to `contributions.activityBarItems[].panel`
 *   are silently dropped — sandboxed extensions own their entire iframe UI and
 *   cannot inject React components into the host tree.
 */
export const SANDBOX_RUNTIME = /* javascript */ `(function () {
  'use strict';

  var _msgId = 0;
  var _pending = Object.create(null);

  /* ── Incoming messages from the host ──────────────────────────────────── */
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'oc:api-response') {
      var cb = _pending[msg.id];
      if (cb) { delete _pending[msg.id]; cb(msg.result, msg.error); }
    }
    if (msg.type === 'oc:theme' && (msg.theme === 'light' || msg.theme === 'dark')) {
      document.documentElement.dataset.theme = msg.theme;
    }
  });

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  function post(data) {
    window.parent.postMessage(data, '*');
  }

  /**
   * Serialise contributions to a plain-object form safe for postMessage.
   * Function values (e.g. React components) are stripped.
   */
  function serializeContribs(contributions) {
    if (!contributions) return {};
    var out = {};
    if (Array.isArray(contributions.activityBarItems)) {
      out.activityBarItems = contributions.activityBarItems.map(function (item) {
        return {
          panelId: item.panelId,
          label: item.label,
          order: item.order,
          iconSvg: typeof item.iconSvg === 'string' ? item.iconSvg : undefined,
        };
      });
    }
    return out;
  }

  /* ── window.__openConduit shim ─────────────────────────────────────────── */
  window.__openConduit = {
    extensionRegistry: {
      /**
       * Called by the extension's entry point to declare its manifest and
       * contributions. Mirrors the in-process signature so that extension code
       * doesn't need to know it's running in a sandbox.
       */
      registerExtension: function (manifest, contributions) {
        post({
          type: 'oc:register',
          manifest: {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            author: manifest.author,
          },
          contributions: serializeContribs(contributions),
        });
      },
    },
  };

  /* Signal to the host that the runtime is ready. */
  post({ type: 'oc:ready' });
})();`;
