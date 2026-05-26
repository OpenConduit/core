/**
 * ref.export-conversation — OpenConduit reference extension
 *
 * Demonstrates:
 *   - Self-registration via window.__openConduit.extensionRegistry
 *   - Reading conversation data with api.conversations.getActive()
 *   - Triggering host notifications with api.ui.showNotification()
 *   - Clipboard access from inside the sandbox iframe
 *   - Theme awareness via oc:theme postMessage
 *
 * What it does:
 *   Displays the active conversation and lets the user copy it to the
 *   clipboard as either Markdown (with role headers and fenced code blocks)
 *   or plain text. A host notification confirms the copy.
 *
 * Notes on clipboard:
 *   The sandbox has no special clipboard permission. `navigator.clipboard`
 *   is available inside the iframe because the Clipboard API only needs a
 *   user gesture (button click), not a same-origin check. If it fails, the
 *   extension falls back to a hidden <textarea> + execCommand('copy').
 *
 * Installation:
 *   Copy this folder to userData/extensions/ref.export-conversation/
 */

// ─── 1. Register ──────────────────────────────────────────────────────────────
window.__openConduit.extensionRegistry.registerExtension(
  {
    id: 'ref.export-conversation',
    name: 'Export Conversation',
    version: '1.0.0',
    description: 'Export the active conversation as Markdown or plain text.',
  },
  {
    activityBarItems: [
      { panelId: 'ref.export-conversation', label: 'Export Conversation', order: 92 },
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

// ─── 3. Converters ────────────────────────────────────────────────────────────

/**
 * Convert a conversation object to a Markdown string.
 * Roles are formatted as level-3 headers; code blocks inside message text
 * are passed through as-is.
 * @param {object} conv
 * @returns {string}
 */
function toMarkdown(conv) {
  const lines = [];
  const title = conv.title || 'Untitled Conversation';
  lines.push(`# ${title}`);
  lines.push('');

  if (conv.model) {
    lines.push(`> Model: **${conv.model}**${conv.providerId ? ` (${conv.providerId})` : ''}`);
    lines.push('');
  }

  const messages = conv.messages ?? [];
  for (const msg of messages) {
    const role = (msg.role || 'unknown').charAt(0).toUpperCase() +
                 (msg.role || 'unknown').slice(1);
    lines.push(`### ${role}`);
    lines.push('');

    const text = extractText(msg.content);
    lines.push(text);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Convert a conversation object to a plain-text string.
 * @param {object} conv
 * @returns {string}
 */
function toPlainText(conv) {
  const lines = [];
  const title = conv.title || 'Untitled Conversation';
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  if (conv.model) {
    lines.push(`Model: ${conv.model}${conv.providerId ? ` (${conv.providerId})` : ''}`);
    lines.push('');
  }

  const messages = conv.messages ?? [];
  for (const msg of messages) {
    const role = (msg.role || 'unknown').toUpperCase();
    lines.push(`[${role}]`);
    lines.push(extractText(msg.content));
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Extract a plain string from a message content field.
 * Content can be a bare string or an array of content parts.
 * @param {string | Array} content
 * @returns {string}
 */
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          return part.text ?? '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

// ─── 4. Clipboard helpers ─────────────────────────────────────────────────────

/**
 * Write text to the clipboard. Prefers the modern Clipboard API with a
 * fallback to document.execCommand for older contexts.
 * @param {string} text
 * @returns {Promise<boolean>} true on success
 */
async function copyToClipboard(text) {
  // Modern path — works in a sandboxed iframe as long as it was triggered by
  // a user gesture (button click).
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback.
    }
  }

  // Legacy fallback path.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    return ok;
  } finally {
    document.body.removeChild(ta);
  }
}

// ─── 5. Panel HTML ────────────────────────────────────────────────────────────
document.getElementById('root').innerHTML = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--oc-bg);
      color: var(--oc-text);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
    }

    .panel { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--oc-text-heading); }
    p  { margin: 0; color: var(--oc-text-muted); line-height: 1.5; }

    .section {
      background: var(--oc-bg-surface);
      border: 1px solid var(--oc-border);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--oc-section-title);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .conv-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--oc-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .conv-meta { font-size: 11px; color: var(--oc-text-muted); margin-top: 4px; }

    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

    button {
      background: var(--oc-btn-bg);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: var(--oc-btn-hover); }
    button:disabled {
      background: var(--oc-btn-disabled-bg);
      color: var(--oc-btn-disabled-text);
      cursor: not-allowed;
    }
    .btn-secondary {
      background: var(--oc-bg);
      color: var(--oc-text);
      border: 1px solid var(--oc-border);
    }
    .btn-secondary:hover { background: var(--oc-bg-surface); }

    .empty-state {
      color: var(--oc-text-muted);
      font-size: 12px;
      text-align: center;
      padding: 12px 0;
    }

    .status-msg {
      font-size: 12px;
      color: var(--oc-status-ok);
      min-height: 18px;
      margin-top: 4px;
    }
    .status-msg.err { color: var(--oc-status-err); }

    /* Message preview */
    .msg-preview {
      font-size: 11px;
      color: var(--oc-text-muted);
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--oc-bg);
      border: 1px solid var(--oc-border);
      border-radius: 6px;
      padding: 8px;
      max-height: 160px;
      overflow: auto;
    }

    .kv-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .kv-label { color: var(--oc-text-muted); }
    .kv-value { font-weight: 500; color: var(--oc-text); }
  </style>

  <div class="panel">

    <div>
      <h2>Export Conversation</h2>
      <p style="margin-top: 4px">Copy the active chat to your clipboard as Markdown or plain text.</p>
    </div>

    <!-- Active conversation info -->
    <div class="section">
      <div class="section-title">Active Conversation</div>
      <div id="conv-info" class="empty-state">No active conversation</div>
    </div>

    <!-- Export actions (hidden until a conversation is loaded) -->
    <div class="section" id="export-section" style="display: none">
      <div class="section-title">Export As</div>
      <div class="btn-row">
        <button id="btn-markdown">Copy as Markdown</button>
        <button id="btn-plaintext" class="btn-secondary">Copy as Plain Text</button>
      </div>
      <div class="status-msg" id="status-msg"></div>
    </div>

    <!-- Preview (populated after load) -->
    <div class="section" id="preview-section" style="display: none">
      <div class="section-title">Preview (Markdown)</div>
      <div class="kv-row">
        <span class="kv-label">Messages</span>
        <span class="kv-value" id="preview-msg-count">—</span>
      </div>
      <div class="kv-row">
        <span class="kv-label">Characters</span>
        <span class="kv-value" id="preview-char-count">—</span>
      </div>
      <pre class="msg-preview" id="msg-preview"></pre>
    </div>

    <button id="btn-refresh" class="btn-secondary" style="align-self: flex-start">
      Refresh
    </button>

  </div>
`;

// ─── 6. State ─────────────────────────────────────────────────────────────────
let currentConv = null;

// ─── 7. Rendering ─────────────────────────────────────────────────────────────

function setStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'status-msg err' : 'status-msg';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refresh() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  try {
    const resp = await callApi('conversations.getActive');
    currentConv = resp.result;

    const convInfo    = document.getElementById('conv-info');
    const exportSec   = document.getElementById('export-section');
    const previewSec  = document.getElementById('preview-section');

    if (!currentConv) {
      convInfo.className = 'empty-state';
      convInfo.textContent = 'No active conversation — open a chat first.';
      exportSec.style.display = 'none';
      previewSec.style.display = 'none';
      return;
    }

    const messages = currentConv.messages ?? [];
    const md = toMarkdown(currentConv);

    convInfo.className = '';
    convInfo.innerHTML = `
      <div class="conv-title">${escapeHtml(currentConv.title || 'Untitled conversation')}</div>
      <div class="conv-meta">
        ${messages.length} message${messages.length !== 1 ? 's' : ''}
        ${currentConv.model ? ' · ' + escapeHtml(currentConv.model) : ''}
      </div>
    `;

    document.getElementById('preview-msg-count').textContent =
      messages.length.toLocaleString();
    document.getElementById('preview-char-count').textContent =
      md.length.toLocaleString();

    // Show first ~500 chars of the Markdown in the preview box.
    document.getElementById('msg-preview').textContent =
      md.slice(0, 500) + (md.length > 500 ? '\n…' : '');

    exportSec.style.display  = '';
    previewSec.style.display = '';
    setStatus('');

  } catch (err) {
    console.error('[ref.export-conversation] refresh failed:', err);
    setStatus('Failed to load conversation data.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
  }
}

// ─── 8. Export handlers ───────────────────────────────────────────────────────

document.getElementById('btn-markdown').addEventListener('click', async () => {
  if (!currentConv) return;

  const md = toMarkdown(currentConv);
  const ok = await copyToClipboard(md);

  if (ok) {
    setStatus('✓ Copied Markdown to clipboard');
    // Also notify the host app so a toast appears in the main window.
    await callApi('ui.showNotification', [{
      message: 'Conversation copied as Markdown',
      type: 'success',
    }]);
  } else {
    setStatus('Copy failed — your browser may have blocked clipboard access.', true);
  }
});

document.getElementById('btn-plaintext').addEventListener('click', async () => {
  if (!currentConv) return;

  const text = toPlainText(currentConv);
  const ok = await copyToClipboard(text);

  if (ok) {
    setStatus('✓ Copied plain text to clipboard');
    await callApi('ui.showNotification', [{
      message: 'Conversation copied as plain text',
      type: 'success',
    }]);
  } else {
    setStatus('Copy failed — your browser may have blocked clipboard access.', true);
  }
});

document.getElementById('btn-refresh').addEventListener('click', refresh);

// Auto-load on open.
refresh();
