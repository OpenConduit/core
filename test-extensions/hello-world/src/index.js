/**
 * Hello World — OpenConduit test extension (third-party / sandboxed)
 *
 * This is the extension's entry-point source. It is loaded inside a sandboxed
 * iframe by SandboxedPanel; the OpenConduit runtime shim is injected before
 * this code runs, so `window.__openConduit` is already available.
 *
 * What this extension tests:
 *  1. Self-registration via window.__openConduit.extensionRegistry
 *  2. Rendering arbitrary HTML/CSS inside the sandboxed panel
 *  3. Sending oc:api calls to the host (should return the "not yet
 *     implemented" stub until issue #55 lands)
 *  4. Receiving oc:api-response messages back from the host
 *
 * To install for manual testing, point the Electron preload's extension
 * scanner at this directory (or copy it to userData/extensions/hello-world/).
 * The preload must read extension.json and include it in InstalledExtensionInfo.
 */

// ─── 1. Self-registration ────────────────────────────────────────────────────
//
// Even though the host pre-registers from extension.json at startup, calling
// registerExtension() here is good practice — it mirrors how a real third-party
// extension would be written and lets the extension pass additional runtime data
// (e.g. a hook). The registry's idempotency check makes this a no-op on the
// host side for contributions already registered from the manifest.

window.__openConduit.extensionRegistry.registerExtension(
  {
    id: 'test.hello-world',
    name: 'Hello World',
    version: '0.1.0',
    description: 'Sandbox test extension.',
  },
  {
    activityBarItems: [
      {
        panelId: 'test.hello-world',
        label: 'Hello World (sandbox test)',
        order: 90,
      },
    ],
  }
);

// ─── 2. Panel UI ─────────────────────────────────────────────────────────────

const root = document.getElementById('root');

root.innerHTML = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: var(--oc-bg); color: var(--oc-text); font-family: system-ui, sans-serif; font-size: 13px; }
    .panel { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--oc-text-heading); }
    p  { margin: 0; color: var(--oc-text-muted); line-height: 1.5; }
    .badge {
      display: inline-block;
      background: var(--oc-badge-bg);
      border: 1px solid var(--oc-badge-border);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--oc-badge-text);
      font-weight: 600;
    }
    .section { background: var(--oc-bg-surface); border: 1px solid var(--oc-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .section-title { font-size: 11px; font-weight: 600; color: var(--oc-section-title); text-transform: uppercase; letter-spacing: 0.05em; }
    .kv { display: flex; justify-content: space-between; gap: 8px; }
    .kv-key { color: var(--oc-text-muted); }
    .kv-val { color: var(--oc-text); font-family: monospace; font-size: 12px; }
    button {
      background: var(--oc-btn-bg); color: #fff; border: none; border-radius: 6px;
      padding: 6px 12px; font-size: 12px; cursor: pointer; transition: background .15s;
    }
    button:hover { background: var(--oc-btn-hover); }
    button:disabled { background: var(--oc-btn-disabled-bg); color: var(--oc-btn-disabled-text); cursor: not-allowed; }
    pre {
      margin: 0; background: var(--oc-pre-bg); border: 1px solid var(--oc-border); border-radius: 6px;
      padding: 10px; font-size: 11px; color: var(--oc-pre-text); overflow: auto;
      white-space: pre-wrap; word-break: break-all;
    }
    .status { font-size: 11px; color: var(--oc-text-muted); }
    .status.ok  { color: var(--oc-status-ok); }
    .status.err { color: var(--oc-status-err); }
  </style>

  <div class="panel">
    <div>
      <h2>Hello World <span class="badge">sandboxed</span></h2>
      <p style="margin-top:6px">Running inside a Phase 5 sandbox iframe (<code>sandbox="allow-scripts"</code>).</p>
    </div>

    <div class="section">
      <div class="section-title">Extension info</div>
      <div class="kv"><span class="kv-key">id</span>      <span class="kv-val">test.hello-world</span></div>
      <div class="kv"><span class="kv-key">version</span> <span class="kv-val">0.1.0</span></div>
      <div class="kv"><span class="kv-key">origin</span>  <span class="kv-val">blob: URL (sandboxed)</span></div>
    </div>

    <div class="section">
      <div class="section-title">Sandbox protocol test</div>
      <p>Send an <code>oc:api</code> call to the host and display the response.<br>
         Should return the <em>"not yet implemented"</em> stub until issue #55 lands.</p>
      <button id="btn-api">Send oc:api call</button>
      <div id="api-status" class="status">Waiting…</div>
      <pre id="api-output">(no response yet)</pre>
    </div>

    <div class="section">
      <div class="section-title">window access check</div>
      <p>Verify that the sandbox prevents access to the host's globals.</p>
      <button id="btn-escape">Attempt host escape</button>
      <div id="escape-status" class="status">Waiting…</div>
    </div>
  </div>
`;

// ─── 3. oc:api call test ─────────────────────────────────────────────────────

let apiMsgId = 0;
const apiPending = new Map();

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'oc:api-response') {
    const resolve = apiPending.get(msg.id);
    if (resolve) { apiPending.delete(msg.id); resolve(msg); }
  }
});

function callHostApi(path, args = []) {
  return new Promise((resolve) => {
    const id = String(apiMsgId++);
    apiPending.set(id, resolve);
    window.parent.postMessage({ type: 'oc:api', id, path, args }, '*');
  });
}

document.getElementById('btn-api').addEventListener('click', async () => {
  const btn = document.getElementById('btn-api');
  const status = document.getElementById('api-status');
  const output = document.getElementById('api-output');

  btn.disabled = true;
  status.className = 'status';
  status.textContent = 'Sending oc:api → conversations.getActive …';

  try {
    const response = await callHostApi('conversations.getActive', []);
    output.textContent = JSON.stringify(response, null, 2);
    if (response.error) {
      status.className = 'status err';
      status.textContent = `Host responded with error (expected until #55): ${response.error}`;
    } else {
      status.className = 'status ok';
      status.textContent = 'Host responded successfully.';
    }
  } catch (err) {
    status.className = 'status err';
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

// ─── 4. Sandbox escape attempt ───────────────────────────────────────────────
//
// Demonstrates that the sandbox actually works: the extension cannot read
// host globals like localStorage, document.cookie, or window.parent.document.

document.getElementById('btn-escape').addEventListener('click', () => {
  const status = document.getElementById('escape-status');
  const results = [];

  try {
    const val = window.parent.document.title;
    results.push(`FAIL — read parent.document.title: "${val}"`);
  } catch {
    results.push('PASS — parent.document inaccessible (cross-origin block)');
  }

  try {
    const val = localStorage.getItem('test');
    results.push(`NOTE — localStorage accessible: "${val}" (allow-same-origin not set, this is expected to throw in strict sandbox)`);
  } catch {
    results.push('PASS — localStorage blocked');
  }

  const allPassed = results.every((r) => r.startsWith('PASS'));
  status.className = allPassed ? 'status ok' : 'status err';
  status.textContent = results.join(' | ');
});
