/**
 * Hello World — OpenConduit comprehensive sandbox test extension
 *
 * Covers all Phase 5 sandbox platform features:
 *  1. Self-registration via window.__openConduit.extensionRegistry
 *  2. Theme awareness — live badge + real-time response to oc:theme
 *  3. API Explorer — preset paths (conversations, settings, ui) + freeform calls
 *  4. Sandbox isolation — security checks for parent access, storage, cookies
 */

// ─── 1. Self-registration ─────────────────────────────────────────────────────
window.__openConduit.extensionRegistry.registerExtension(
  {
    id: 'test.hello-world',
    name: 'Hello World',
    version: '0.1.0',
    description: 'Comprehensive Phase 5 sandbox test extension.',
  },
  {
    activityBarItems: [
      { panelId: 'test.hello-world', label: 'Hello World (sandbox test)', order: 90 },
    ],
  }
);

// ─── 2. Panel HTML ────────────────────────────────────────────────────────────
const root = document.getElementById('root');

root.innerHTML = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--oc-bg);
      color: var(--oc-text);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
    }
    .panel { padding: 16px; display: flex; flex-direction: column; gap: 12px; padding-bottom: 32px; }
    h2 {
      margin: 0; font-size: 14px; font-weight: 600; color: var(--oc-text-heading);
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    p { margin: 0; color: var(--oc-text-muted); line-height: 1.5; }
    code {
      background: var(--oc-pre-bg); border: 1px solid var(--oc-border); border-radius: 4px;
      padding: 0 4px; font-size: 11px; color: var(--oc-pre-text);
    }
    .badge {
      display: inline-block; background: var(--oc-badge-bg); border: 1px solid var(--oc-badge-border);
      border-radius: 6px; padding: 2px 8px; font-size: 11px; color: var(--oc-badge-text); font-weight: 600;
    }
    .section {
      background: var(--oc-bg-surface); border: 1px solid var(--oc-border); border-radius: 8px;
      padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--oc-card-shadow);
    }
    .section-title { font-size: 11px; font-weight: 600; color: var(--oc-section-title); text-transform: uppercase; letter-spacing: 0.05em; }
    .kv { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .kv-key { color: var(--oc-text-muted); flex-shrink: 0; }
    .kv-val { color: var(--oc-text); font-family: monospace; font-size: 12px; text-align: right; word-break: break-all; }
    button {
      background: var(--oc-btn-bg); color: #fff; border: none; border-radius: 6px;
      padding: 6px 12px; font-size: 12px; cursor: pointer; transition: background .15s; white-space: nowrap; flex-shrink: 0;
    }
    button:hover { background: var(--oc-btn-hover); }
    button:disabled { background: var(--oc-btn-disabled-bg); color: var(--oc-btn-disabled-text); cursor: not-allowed; }
    pre {
      margin: 0; background: var(--oc-pre-bg); border: 1px solid var(--oc-border); border-radius: 6px;
      padding: 10px; font-size: 11px; color: var(--oc-pre-text); overflow: auto;
      white-space: pre-wrap; word-break: break-all;
    }
    input[type="text"] {
      background: var(--oc-bg); border: 1px solid var(--oc-border); border-radius: 6px;
      color: var(--oc-text); font-size: 12px; font-family: monospace; padding: 5px 8px;
      outline: none; flex: 1; min-width: 0;
    }
    input[type="text"]::placeholder { color: var(--oc-text-muted); opacity: 0.7; }
    input[type="text"]:focus { border-color: var(--oc-btn-bg); }
    .status { font-size: 11px; color: var(--oc-text-muted); }
    .status.ok  { color: var(--oc-status-ok); }
    .status.err { color: var(--oc-status-err); }
    .divider { border: none; border-top: 1px solid var(--oc-border); margin: 2px 0; }
    /* Theme badge */
    .theme-badge {
      display: inline-block; border-radius: 99px; padding: 2px 10px;
      font-size: 11px; font-weight: 600; border: 1px solid transparent;
      transition: background .2s, color .2s, border-color .2s;
    }
    .theme-badge.light { background: #fefce8; border-color: #fde68a; color: #92400e; }
    .theme-badge.dark  { background: #1e1b4b; border-color: #3730a3; color: #a5b4fc; }
    /* Preset table */
    .preset-table { display: flex; flex-direction: column; gap: 4px; }
    .preset-row { display: flex; flex-direction: column; gap: 4px; }
    .preset-header { display: flex; align-items: center; gap: 8px; }
    .preset-path { flex: 1; font-family: monospace; font-size: 12px; color: var(--oc-text); overflow: hidden; text-overflow: ellipsis; }
    .preset-args-tag {
      font-family: monospace; font-size: 10px; color: var(--oc-text-muted);
      background: var(--oc-pre-bg); border: 1px solid var(--oc-border);
      border-radius: 4px; padding: 1px 5px; flex-shrink: 0;
    }
    .preset-btn { padding: 3px 9px; font-size: 11px; }
    .preset-status { font-size: 11px; min-width: 56px; text-align: right; flex-shrink: 0; }
    .preset-status.calling { color: var(--oc-text-muted); }
    .preset-status.ok  { color: var(--oc-status-ok); }
    .preset-status.err { color: var(--oc-status-err); }
    .preset-result { display: none; }
    /* Freeform */
    .row-inline { display: flex; gap: 6px; align-items: center; }
    /* Security checks */
    .check-results { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
    .check-row {
      display: flex; align-items: center; gap: 8px; font-size: 12px;
      padding: 5px 8px; background: var(--oc-bg); border: 1px solid var(--oc-border); border-radius: 6px;
    }
    .check-icon { font-weight: 700; flex-shrink: 0; font-size: 13px; }
    .check-icon.ok   { color: var(--oc-status-ok); }
    .check-icon.fail { color: var(--oc-status-err); }
    .check-label { flex: 1; font-family: monospace; font-size: 11px; }
    .check-note { color: var(--oc-text-muted); font-size: 11px; }
  </style>

  <div class="panel">

    <div>
      <h2>Hello World <span class="badge">sandboxed</span></h2>
      <p style="margin-top:6px">Phase 5 comprehensive sandbox test — registration, theme, API protocol, settings, and isolation.</p>
    </div>

    <div class="section">
      <div class="section-title">Extension Info</div>
      <div class="kv"><span class="kv-key">id</span>      <span class="kv-val">test.hello-world</span></div>
      <div class="kv"><span class="kv-key">name</span>    <span class="kv-val">Hello World</span></div>
      <div class="kv"><span class="kv-key">version</span> <span class="kv-val">0.1.0</span></div>
      <div class="kv"><span class="kv-key">sandbox</span> <span class="kv-val">allow-scripts only</span></div>
      <div class="kv"><span class="kv-key">origin</span>  <span class="kv-val">blob: (null/opaque)</span></div>
    </div>

    <div class="section">
      <div class="section-title">Theme</div>
      <div class="kv">
        <span class="kv-key">current</span>
        <span id="theme-badge" class="theme-badge">—</span>
      </div>
      <p>Updates live via <code>oc:theme</code> when the host theme changes.</p>
    </div>

    <div class="section">
      <div class="section-title">API Explorer</div>
      <p>Fires <code>oc:api</code> calls and shows host responses. All paths return the <em>"not yet implemented"</em> stub until issue #55 lands.</p>
      <hr class="divider" />
      <div class="section-title" style="font-size:10px">Preset paths</div>
      <div class="preset-table" id="preset-table"></div>
      <hr class="divider" />
      <div class="section-title" style="font-size:10px">Custom call</div>
      <div class="row-inline">
        <input type="text" id="custom-path" placeholder="path, e.g. settings.get" value="settings.get" />
        <input type="text" id="custom-args" placeholder="args JSON" value='["theme"]' style="max-width:130px" />
        <button id="btn-custom">Call</button>
      </div>
      <div id="custom-status" class="status" style="min-height:14px"></div>
      <pre id="custom-out" style="display:none"></pre>
    </div>

    <div class="section">
      <div class="section-title">Sandbox Security</div>
      <p>Verify <code>sandbox="allow-scripts"</code> blocks access to the host frame, storage, and cookies.</p>
      <button id="btn-checks" style="align-self:flex-start">Run security checks</button>
      <div class="check-results" id="check-results"></div>
    </div>

  </div>
`;

// ─── 3. API utilities ─────────────────────────────────────────────────────────
let _msgId = 0;
const _pending = new Map();

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'oc:api-response') {
    const cb = _pending.get(msg.id);
    if (cb) { _pending.delete(msg.id); cb(msg); }
  }

  if (msg.type === 'oc:theme') {
    applyTheme(msg.theme);
  }
});

function callApi(path, args = []) {
  return new Promise((resolve) => {
    const id = String(_msgId++);
    _pending.set(id, resolve);
    window.parent.postMessage({ type: 'oc:api', id, path, args }, '*');
  });
}

// ─── 4. Theme badge ───────────────────────────────────────────────────────────
function applyTheme(theme) {
  const badge = document.getElementById('theme-badge');
  if (!badge) return;
  badge.textContent = theme;
  badge.className = 'theme-badge ' + theme;
}

// Initialise from the data-theme attribute the host baked into the document
applyTheme(document.documentElement.dataset.theme || 'light');

// ─── 5. Preset API paths ──────────────────────────────────────────────────────
const PRESETS = [
  { path: 'conversations.getActive', args: []         },
  { path: 'conversations.list',      args: []         },
  { path: 'settings.get',            args: ['theme']  },
  { path: 'settings.getAll',         args: []         },
  { path: 'ui.getActivePanel',       args: []         },
];

const presetTable = document.getElementById('preset-table');

PRESETS.forEach((preset, i) => {
  const argsLabel = preset.args.length ? JSON.stringify(preset.args) : '(no args)';
  const row = document.createElement('div');
  row.className = 'preset-row';
  row.innerHTML = `
    <div class="preset-header">
      <span class="preset-path">${preset.path}</span>
      <span class="preset-args-tag">${argsLabel}</span>
      <button class="preset-btn" id="preset-btn-${i}">Test</button>
      <span class="preset-status" id="preset-status-${i}"></span>
    </div>
    <pre class="preset-result" id="preset-result-${i}"></pre>
  `;
  presetTable.appendChild(row);

  document.getElementById('preset-btn-' + i).addEventListener('click', async () => {
    const btn    = document.getElementById('preset-btn-' + i);
    const status = document.getElementById('preset-status-' + i);
    const result = document.getElementById('preset-result-' + i);

    btn.disabled = true;
    status.textContent = 'calling…';
    status.className = 'preset-status calling';
    result.style.display = 'none';

    try {
      const resp = await callApi(preset.path, preset.args);
      result.textContent = JSON.stringify(resp, null, 2);
      result.style.display = 'block';
      status.textContent = resp.error ? 'stub ↩' : 'ok';
      status.className = 'preset-status ' + (resp.error ? 'err' : 'ok');
    } catch (err) {
      result.textContent = err.message;
      result.style.display = 'block';
      status.textContent = 'error';
      status.className = 'preset-status err';
    } finally {
      btn.disabled = false;
    }
  });
});

// ─── 6. Custom freeform call ──────────────────────────────────────────────────
document.getElementById('btn-custom').addEventListener('click', async () => {
  const pathEl   = document.getElementById('custom-path');
  const argsEl   = document.getElementById('custom-args');
  const statusEl = document.getElementById('custom-status');
  const outEl    = document.getElementById('custom-out');

  const path = pathEl.value.trim();
  if (!path) return;

  let args = [];
  try { args = JSON.parse(argsEl.value || '[]'); } catch { args = []; }

  statusEl.textContent = 'calling…';
  statusEl.className = 'status';
  outEl.style.display = 'none';

  try {
    const resp = await callApi(path, args);
    outEl.textContent = JSON.stringify(resp, null, 2);
    outEl.style.display = 'block';
    statusEl.textContent = resp.error ? 'error (expected stub)' : 'ok';
    statusEl.className = 'status ' + (resp.error ? 'err' : 'ok');
  } catch (err) {
    outEl.textContent = err.message;
    outEl.style.display = 'block';
    statusEl.textContent = 'exception';
    statusEl.className = 'status err';
  }
});

// ─── 7. Sandbox security checks ───────────────────────────────────────────────
const CHECKS = [
  {
    label: 'parent.document access',
    run() { void window.parent.document.title; return { pass: false, note: 'accessible!' }; },
  },
  {
    label: 'top.document access',
    run() { void window.top.document.title; return { pass: false, note: 'accessible!' }; },
  },
  {
    label: 'localStorage access',
    run() { void localStorage.getItem('x'); return { pass: false, note: 'accessible (unexpected)' }; },
  },
  {
    label: 'sessionStorage access',
    run() { void sessionStorage.getItem('x'); return { pass: false, note: 'accessible (unexpected)' }; },
  },
  {
    label: 'document.cookie read',
    run() {
      const val = document.cookie;
      if (val === '') return { pass: true, note: 'empty (null origin)' };
      return { pass: false, note: `leaked: "${val}"` };
    },
  },
  {
    label: 'parent !== window (in frame)',
    run() {
      const nested = window.parent !== window;
      return { pass: nested, note: nested ? 'confirmed in frame' : 'unexpected: running top-level' };
    },
  },
];

document.getElementById('btn-checks').addEventListener('click', () => {
  const container = document.getElementById('check-results');

  container.innerHTML = CHECKS.map((check) => {
    let result;
    try {
      result = check.run();
    } catch {
      result = { pass: true, note: 'SecurityError (blocked)' };
    }
    const icon = result.pass ? '✓' : '✗';
    const cls  = result.pass ? 'ok' : 'fail';
    return `<div class="check-row">
      <span class="check-icon ${cls}">${icon}</span>
      <span class="check-label">${check.label}</span>
      <span class="check-note">${result.note}</span>
    </div>`;
  }).join('');
});
