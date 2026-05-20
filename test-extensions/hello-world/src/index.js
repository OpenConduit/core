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
    /* Settings rows */
    .settings-rows { display: flex; flex-direction: column; gap: 8px; }
    .setting-row {
      border: 1px solid var(--oc-border); border-radius: 6px; padding: 8px 10px;
      display: flex; flex-direction: column; gap: 4px; background: var(--oc-bg);
    }
    .setting-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .setting-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .setting-label { font-size: 12px; font-weight: 500; color: var(--oc-text); }
    .setting-key { font-family: monospace; font-size: 10px; color: var(--oc-text-muted); }
    .setting-controls { display: flex; align-items: center; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
    .setting-btn { padding: 3px 8px; font-size: 11px; }
    .setting-btn.get { background: var(--oc-bg); color: var(--oc-text); border: 1px solid var(--oc-border); }
    .setting-btn.get:hover { background: var(--oc-bg-surface); }
    .setting-desc { font-size: 11px; color: var(--oc-text-muted); }
    .setting-status { font-size: 11px; color: var(--oc-text-muted); min-height: 14px; }
    .setting-status.ok  { color: var(--oc-status-ok); }
    .setting-status.err { color: var(--oc-status-err); }
    input[type="number"] {
      background: var(--oc-bg); border: 1px solid var(--oc-border); border-radius: 6px;
      color: var(--oc-text); font-size: 12px; padding: 5px 8px; outline: none; width: 72px;
    }
    input[type="number"]:focus { border-color: var(--oc-btn-bg); }
    input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; accent-color: var(--oc-btn-bg); flex-shrink: 0; }
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
      <p>Fires <code>oc:api</code> calls and shows live host responses via the <code>ExtensionAPI</code> bridge.</p>
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
      <div class="section-title">Extension Settings</div>
      <p>Read or write this extension\'s settings via <code>settings.get</code> / <code>settings.set</code>.</p>
      <button id="btn-settings-read-all" style="align-self:flex-start">Read all from host</button>
      <div class="settings-rows" id="settings-rows"></div>
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
  { path: 'conversations.getAll',    args: []         },
  { path: 'settings.get',            args: ['theme']  },
  { path: 'store.getPersonas',       args: []         },
  { path: 'store.getTasks',          args: []         },
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

// ─── 7. Extension settings ───────────────────────────────────────────────────
const EXTENSION_SETTINGS = [
  {
    key:         'test.hello-world.greeting',
    type:        'string',
    default:     'Hello!',
    label:       'Greeting message',
    description: 'Custom greeting shown at the top of the panel.',
  },
  {
    key:         'test.hello-world.autoRefresh',
    type:        'boolean',
    default:     false,
    label:       'Auto-refresh on open',
    description: 'Automatically refresh API data when the panel opens.',
  },
  {
    key:         'test.hello-world.maxItems',
    type:        'number',
    default:     10,
    label:       'Max items',
    description: 'Maximum number of items to display in lists.',
  },
];

const settingsRows = document.getElementById('settings-rows');

EXTENSION_SETTINGS.forEach((s, i) => {
  let inputHtml;
  if (s.type === 'boolean') {
    inputHtml = `<input type="checkbox" id="setting-input-${i}" ${s.default ? 'checked' : ''} />`;
  } else if (s.type === 'number') {
    inputHtml = `<input type="number" id="setting-input-${i}" value="${s.default}" />`;
  } else {
    inputHtml = `<input type="text" id="setting-input-${i}" value="${s.default}" style="max-width:160px" />`;
  }

  const row = document.createElement('div');
  row.className = 'setting-row';
  row.innerHTML = `
    <div class="setting-header">
      <div class="setting-info">
        <span class="setting-label">${s.label}</span>
        <span class="setting-key">${s.key}</span>
      </div>
      <div class="setting-controls">
        ${inputHtml}
        <button class="setting-btn get" id="setting-btn-get-${i}">Get</button>
        <button class="setting-btn" id="setting-btn-set-${i}">Set</button>
      </div>
    </div>
    <div class="setting-desc">${s.description}</div>
    <div class="setting-status" id="setting-status-${i}"></div>
  `;
  settingsRows.appendChild(row);

  async function getSettingValue() {
    const statusEl = document.getElementById('setting-status-' + i);
    statusEl.textContent = 'reading…';
    statusEl.className = 'setting-status';
    try {
      const resp = await callApi('settings.get', [s.key]);
      if (resp.error) {
        statusEl.textContent = `stub (expected until #55): ${resp.error}`;
        statusEl.className = 'setting-status err';
      } else {
        const input = document.getElementById('setting-input-' + i);
        if (s.type === 'boolean') input.checked = !!resp.result;
        else input.value = resp.result !== undefined ? String(resp.result) : String(s.default);
        statusEl.textContent = 'read ok';
        statusEl.className = 'setting-status ok';
      }
    } catch (err) {
      document.getElementById('setting-status-' + i).textContent = err.message;
      document.getElementById('setting-status-' + i).className = 'setting-status err';
    }
  }

  document.getElementById('setting-btn-get-' + i).addEventListener('click', getSettingValue);

  document.getElementById('setting-btn-set-' + i).addEventListener('click', async () => {
    const statusEl = document.getElementById('setting-status-' + i);
    const input    = document.getElementById('setting-input-' + i);
    const value    = s.type === 'boolean' ? input.checked
                   : s.type === 'number'  ? Number(input.value)
                   : input.value;

    statusEl.textContent = 'saving…';
    statusEl.className = 'setting-status';
    try {
      const resp = await callApi('settings.set', [s.key, value]);
      if (resp.error) {
        statusEl.textContent = `stub (expected until #55): ${resp.error}`;
        statusEl.className = 'setting-status err';
      } else {
        statusEl.textContent = 'saved ok';
        statusEl.className = 'setting-status ok';
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'setting-status err';
    }
  });
});

document.getElementById('btn-settings-read-all').addEventListener('click', async () => {
  for (let i = 0; i < EXTENSION_SETTINGS.length; i++) {
    const s = EXTENSION_SETTINGS[i];
    const statusEl = document.getElementById('setting-status-' + i);
    statusEl.textContent = 'reading…';
    statusEl.className = 'setting-status';
    try {
      const resp = await callApi('settings.get', [s.key]);
      if (resp.error) {
        statusEl.textContent = 'stub (expected until #55)';
        statusEl.className = 'setting-status err';
      } else {
        const input = document.getElementById('setting-input-' + i);
        if (s.type === 'boolean') input.checked = !!resp.result;
        else input.value = resp.result !== undefined ? String(resp.result) : String(s.default);
        statusEl.textContent = 'read ok';
        statusEl.className = 'setting-status ok';
      }
    } catch {
      const statusEl2 = document.getElementById('setting-status-' + i);
      statusEl2.textContent = 'error';
      statusEl2.className = 'setting-status err';
    }
  }
});

// ─── 8. Sandbox security checks ─────────────────────────────────────────────────
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
