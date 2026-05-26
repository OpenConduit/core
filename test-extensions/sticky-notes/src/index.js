/**
 * ref.sticky-notes — OpenConduit reference extension
 *
 * Demonstrates:
 *   - Self-registration via window.__openConduit.extensionRegistry
 *   - Reading settings with api.settings.get()
 *   - Writing settings with api.settings.set()  (requires settings.write)
 *   - Declaring settings contributions in extension.json
 *   - Debounced auto-save
 *   - Theme awareness via oc:theme postMessage
 *
 * What it does:
 *   A simple markdown-aware scratchpad. Notes are persisted in the app's
 *   settings store under the key "ref.sticky-notes.content" so they survive
 *   app restarts. A font-size setting lets the user adjust the editor.
 *
 * Permissions:
 *   Sandboxed extensions are automatically granted all permissions (the iframe
 *   sandbox IS the security boundary). In extension.json the permissions field
 *   is documented informational-only. If you port this to an in-process
 *   extension you would need to add "settings.write" to the permissions array
 *   in your manifest.
 *
 * Installation:
 *   Copy this folder to userData/extensions/ref.sticky-notes/
 */

// ─── 1. Register ──────────────────────────────────────────────────────────────
window.__openConduit.extensionRegistry.registerExtension(
  {
    id: 'ref.sticky-notes',
    name: 'Sticky Notes',
    version: '1.0.0',
    description: 'A persistent scratchpad stored in extension settings.',
  },
  {
    activityBarItems: [
      { panelId: 'ref.sticky-notes', label: 'Sticky Notes', order: 93 },
    ],
    settings: [
      {
        key: 'ref.sticky-notes.content',
        type: 'string',
        default: '',
        title: 'Notes content',
        description: 'Notes saved by the Sticky Notes extension.',
      },
      {
        key: 'ref.sticky-notes.fontSize',
        type: 'number',
        default: 13,
        title: 'Font size',
        description: 'Font size (px) for the notes editor.',
      },
    ],
  }
);

// ─── 2. Sandbox API bridge ────────────────────────────────────────────────────
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
    document.documentElement.dataset.theme = msg.theme;
  }
});

function callApi(path, args = []) {
  return new Promise((resolve) => {
    const id = String(_msgId++);
    _pending.set(id, resolve);
    window.parent.postMessage({ type: 'oc:api', id, path, args }, '*');
  });
}

// ─── 3. Debounce helper ───────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that waits `ms` milliseconds after the
 * last call before executing.
 */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── 4. Panel HTML ────────────────────────────────────────────────────────────
document.getElementById('root').innerHTML = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      height: 100%;
      margin: 0;
      background: var(--oc-bg);
      color: var(--oc-text);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
    }

    /* Full-height flex layout so the textarea stretches to fill the panel */
    .layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 16px;
      gap: 10px;
    }

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--oc-text-heading); }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* Font-size control */
    .font-size-control {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--oc-text-muted);
    }
    .font-size-control button {
      background: var(--oc-bg-surface);
      color: var(--oc-text);
      border: 1px solid var(--oc-border);
      border-radius: 4px;
      padding: 2px 7px;
      font-size: 12px;
      cursor: pointer;
      line-height: 1.4;
    }
    .font-size-control button:hover { background: var(--oc-border); }
    .font-size-val { min-width: 24px; text-align: center; color: var(--oc-text); }

    .clear-btn {
      background: transparent;
      color: var(--oc-text-muted);
      border: 1px solid var(--oc-border);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
    }
    .clear-btn:hover { color: var(--oc-status-err); border-color: var(--oc-status-err); }

    /* The main textarea */
    textarea {
      flex: 1;
      resize: none;
      background: var(--oc-bg-surface);
      color: var(--oc-text);
      border: 1px solid var(--oc-border);
      border-radius: 8px;
      padding: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      outline: none;
      transition: border-color 0.15s;
    }
    textarea:focus { border-color: var(--oc-btn-bg); }
    textarea::placeholder { color: var(--oc-text-muted); opacity: 0.7; }

    .footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      font-size: 11px;
      color: var(--oc-text-muted);
    }
    .save-status { transition: opacity 0.3s; }
    .save-status.saved  { color: var(--oc-status-ok); }
    .save-status.saving { color: var(--oc-text-muted); }
    .save-status.error  { color: var(--oc-status-err); }
    .char-count { font-variant-numeric: tabular-nums; }
  </style>

  <div class="layout">

    <div class="header-row">
      <h2>Sticky Notes</h2>
    </div>

    <div class="toolbar">
      <!-- Font size picker -->
      <div class="font-size-control">
        <button id="btn-font-down" title="Decrease font size">−</button>
        <span class="font-size-val" id="font-size-val">13</span>
        <button id="btn-font-up"   title="Increase font size">+</button>
        <span>px</span>
      </div>

      <!-- Clear button -->
      <button class="clear-btn" id="btn-clear" title="Clear notes">Clear</button>
    </div>

    <textarea
      id="notes-editor"
      placeholder="Type your notes here… they are saved automatically."
      spellcheck="true"
    ></textarea>

    <div class="footer-row">
      <span class="save-status" id="save-status"></span>
      <span class="char-count" id="char-count">0 characters</span>
    </div>

  </div>
`;

// ─── 5. State ─────────────────────────────────────────────────────────────────
const CONTENT_KEY   = 'ref.sticky-notes.content';
const FONT_SIZE_KEY = 'ref.sticky-notes.fontSize';
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

let currentFontSize = 13;

// ─── 6. DOM refs ──────────────────────────────────────────────────────────────
const editor      = document.getElementById('notes-editor');
const saveStatus  = document.getElementById('save-status');
const charCount   = document.getElementById('char-count');
const fontSizeVal = document.getElementById('font-size-val');

// ─── 7. Helpers ───────────────────────────────────────────────────────────────

function setFontSize(size) {
  currentFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  editor.style.fontSize = `${currentFontSize}px`;
  fontSizeVal.textContent = String(currentFontSize);
}

function updateCharCount() {
  const len = editor.value.length;
  charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
}

function setSaveStatus(state, text) {
  saveStatus.className = `save-status ${state}`;
  saveStatus.textContent = text;
}

// ─── 8. Save & Load ───────────────────────────────────────────────────────────

/** Persist the current editor contents to settings. */
async function save() {
  setSaveStatus('saving', 'Saving…');
  try {
    // settings.set requires the path 'settings.set' with args [key, value].
    await callApi('settings.set', [CONTENT_KEY, editor.value]);
    setSaveStatus('saved', '✓ Saved');
    // Fade the "Saved" label after 2 s.
    setTimeout(() => {
      if (saveStatus.textContent === '✓ Saved') {
        saveStatus.style.opacity = '0';
        setTimeout(() => { saveStatus.style.opacity = '1'; saveStatus.textContent = ''; }, 300);
      }
    }, 2000);
  } catch (err) {
    console.error('[ref.sticky-notes] save failed:', err);
    setSaveStatus('error', '✗ Save failed');
  }
}

/** Persist the current font size to settings. */
async function saveFontSize() {
  try {
    await callApi('settings.set', [FONT_SIZE_KEY, currentFontSize]);
  } catch (err) {
    console.error('[ref.sticky-notes] saveFontSize failed:', err);
  }
}

/** Load persisted content and font size from settings. */
async function load() {
  setSaveStatus('saving', 'Loading…');
  try {
    const [contentResp, fontResp] = await Promise.all([
      callApi('settings.get', [CONTENT_KEY]),
      callApi('settings.get', [FONT_SIZE_KEY]),
    ]);

    const content  = contentResp.result;
    const fontSize = fontResp.result;

    editor.value = typeof content === 'string' ? content : '';
    setFontSize(typeof fontSize === 'number' ? fontSize : 13);
    updateCharCount();
    setSaveStatus('', '');
  } catch (err) {
    console.error('[ref.sticky-notes] load failed:', err);
    setSaveStatus('error', '✗ Failed to load');
  }
}

// ─── 9. Event wiring ──────────────────────────────────────────────────────────

const debouncedSave = debounce(save, 800);

editor.addEventListener('input', () => {
  updateCharCount();
  setSaveStatus('saving', 'Unsaved changes…');
  debouncedSave();
});

document.getElementById('btn-font-down').addEventListener('click', () => {
  setFontSize(currentFontSize - 1);
  saveFontSize();
});

document.getElementById('btn-font-up').addEventListener('click', () => {
  setFontSize(currentFontSize + 1);
  saveFontSize();
});

document.getElementById('btn-clear').addEventListener('click', async () => {
  if (editor.value === '') return;
  // Simple confirmation via the window.confirm available inside the iframe.
  if (!confirm('Clear all notes? This cannot be undone.')) return;
  editor.value = '';
  updateCharCount();
  await save();
});

// ─── 10. Init ─────────────────────────────────────────────────────────────────
load();
