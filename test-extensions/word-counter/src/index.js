/**
 * ref.word-counter — OpenConduit reference extension
 *
 * Demonstrates:
 *   - Self-registration via window.__openConduit.extensionRegistry
 *   - Reading conversation data with api.conversations.getActive() / getAll()
 *   - Theme awareness via oc:theme postMessage
 *   - Sandbox API call/response pattern
 *
 * What it does:
 *   Displays a live statistics panel for the active conversation — message
 *   counts by role, total word count, and an estimated token count.
 *   A "Refresh" button re-fetches the latest data on demand.
 *
 * Installation:
 *   Copy this folder to userData/extensions/ref.word-counter/
 *   The entryPoint path in extension.json is resolved to an absolute path
 *   by the Electron preload before it is passed to the sandbox loader.
 */

// ─── 1. Register ──────────────────────────────────────────────────────────────
window.__openConduit.extensionRegistry.registerExtension(
  {
    id: 'ref.word-counter',
    name: 'Word Counter',
    version: '1.0.0',
    description: 'Shows live statistics for the active conversation.',
  },
  {
    activityBarItems: [
      { panelId: 'ref.word-counter', label: 'Word Counter', order: 91 },
    ],
  }
);

// ─── 2. Sandbox API bridge ────────────────────────────────────────────────────
// The sandbox shim in runtime.ts exposes window.__openConduit but NOT the full
// ExtensionAPI. API calls must go through the postMessage bridge documented in
// src/extensions/sandbox/protocol.ts.

let _msgId = 0;
const _pending = new Map();

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || typeof msg.type !== 'string') return;

  // oc:api-response — resolve a pending callApi() promise
  if (msg.type === 'oc:api-response') {
    const cb = _pending.get(msg.id);
    if (cb) { _pending.delete(msg.id); cb(msg); }
  }

  // oc:theme — keep our CSS variables in sync with the host app theme
  if (msg.type === 'oc:theme') {
    document.documentElement.dataset.theme = msg.theme;
    updateThemeLabel(msg.theme);
  }
});

/**
 * Call an ExtensionAPI method over the postMessage bridge.
 * @param {string} path  Dot-separated path, e.g. 'conversations.getActive'
 * @param {unknown[]} args  Arguments forwarded to the method
 * @returns {Promise<{result?: unknown, error?: string}>}
 */
function callApi(path, args = []) {
  return new Promise((resolve) => {
    const id = String(_msgId++);
    _pending.set(id, resolve);
    window.parent.postMessage({ type: 'oc:api', id, path, args }, '*');
  });
}

// ─── 3. Helpers ───────────────────────────────────────────────────────────────

/** Count words in a string (splits on whitespace). */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Very rough token estimate: GPT-style tokenizers average ~0.75 words per
 * token, so tokens ≈ words / 0.75 ≈ words * 1.33.
 */
function estimateTokens(wordCount) {
  return Math.round(wordCount * 1.33);
}

// ─── 4. Panel HTML ────────────────────────────────────────────────────────────
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

    /* Stat grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .stat-card {
      background: var(--oc-bg);
      border: 1px solid var(--oc-border);
      border-radius: 6px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--oc-text-heading);
      line-height: 1;
    }
    .stat-label {
      font-size: 11px;
      color: var(--oc-text-muted);
    }

    /* Active conversation info */
    .conv-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--oc-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .conv-meta {
      font-size: 11px;
      color: var(--oc-text-muted);
    }

    /* Role breakdown */
    .role-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .role-label { color: var(--oc-text-muted); }
    .role-count { font-weight: 600; color: var(--oc-text); font-variant-numeric: tabular-nums; }

    button {
      background: var(--oc-btn-bg);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
      align-self: flex-start;
    }
    button:hover { background: var(--oc-btn-hover); }
    button:disabled {
      background: var(--oc-btn-disabled-bg);
      color: var(--oc-btn-disabled-text);
      cursor: not-allowed;
    }

    .empty-state {
      color: var(--oc-text-muted);
      font-size: 12px;
      text-align: center;
      padding: 16px 0;
    }

    .theme-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;
      background: var(--oc-btn-bg);
    }
  </style>

  <div class="panel">

    <div>
      <h2>Word Counter</h2>
      <p style="margin-top: 4px">Statistics for the active conversation.</p>
    </div>

    <!-- Active conversation info -->
    <div class="section" id="conv-section">
      <div class="section-title">Active Conversation</div>
      <div id="conv-info" class="empty-state">No active conversation</div>
    </div>

    <!-- Stats grid -->
    <div class="section" id="stats-section" style="display: none">
      <div class="section-title">Totals</div>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value" id="stat-messages">—</span>
          <span class="stat-label">Messages</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-words">—</span>
          <span class="stat-label">Words</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-tokens">—</span>
          <span class="stat-label">Est. tokens</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-chars">—</span>
          <span class="stat-label">Characters</span>
        </div>
      </div>
    </div>

    <!-- Breakdown by role -->
    <div class="section" id="breakdown-section" style="display: none">
      <div class="section-title">By Role</div>
      <div class="role-row">
        <span class="role-label">User messages</span>
        <span class="role-count" id="stat-user">—</span>
      </div>
      <div class="role-row">
        <span class="role-label">Assistant messages</span>
        <span class="role-count" id="stat-assistant">—</span>
      </div>
      <div class="role-row">
        <span class="role-label">System messages</span>
        <span class="role-count" id="stat-system">—</span>
      </div>
    </div>

    <!-- All conversations summary -->
    <div class="section">
      <div class="section-title">All Conversations</div>
      <div class="role-row">
        <span class="role-label">Total conversations</span>
        <span class="role-count" id="stat-total-convs">—</span>
      </div>
    </div>

    <button id="btn-refresh">Refresh</button>

  </div>
`;

// ─── 5. Rendering ─────────────────────────────────────────────────────────────

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatNumber(n) {
  return n.toLocaleString();
}

/** Render the panel with data from the API. */
async function refresh() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  try {
    // Fetch the active conversation and all conversations in parallel.
    const [activeResp, allResp] = await Promise.all([
      callApi('conversations.getActive'),
      callApi('conversations.getAll'),
    ]);

    const conv = activeResp.result;
    const all  = allResp.result ?? [];

    // Update total conversations count.
    setText('stat-total-convs', formatNumber(all.length));

    const convInfo = document.getElementById('conv-info');

    if (!conv) {
      convInfo.className = 'empty-state';
      convInfo.textContent = 'No active conversation — open a chat first.';
      document.getElementById('stats-section').style.display = 'none';
      document.getElementById('breakdown-section').style.display = 'none';
      return;
    }

    // Show active conversation title + model.
    convInfo.className = '';
    convInfo.innerHTML = `
      <div class="conv-title">${escapeHtml(conv.title || 'Untitled conversation')}</div>
      <div class="conv-meta" style="margin-top: 4px">
        ${conv.model ? escapeHtml(conv.model) : 'No model set'}
        ${conv.providerId ? ' · ' + escapeHtml(conv.providerId) : ''}
      </div>
    `;

    // Compute statistics from the messages array.
    const messages = conv.messages ?? [];
    let totalWords = 0;
    let totalChars = 0;
    let userCount = 0;
    let assistantCount = 0;
    let systemCount = 0;

    for (const msg of messages) {
      const text = (typeof msg.content === 'string' ? msg.content : '') +
                   (Array.isArray(msg.content)
                     ? msg.content.map(p => (typeof p === 'string' ? p : p.text ?? '')).join(' ')
                     : '');

      totalWords += countWords(text);
      totalChars += text.length;

      if (msg.role === 'user')      userCount++;
      else if (msg.role === 'assistant') assistantCount++;
      else if (msg.role === 'system')    systemCount++;
    }

    setText('stat-messages',  formatNumber(messages.length));
    setText('stat-words',     formatNumber(totalWords));
    setText('stat-tokens',    formatNumber(estimateTokens(totalWords)));
    setText('stat-chars',     formatNumber(totalChars));
    setText('stat-user',      formatNumber(userCount));
    setText('stat-assistant', formatNumber(assistantCount));
    setText('stat-system',    formatNumber(systemCount));

    document.getElementById('stats-section').style.display = '';
    document.getElementById('breakdown-section').style.display = '';

  } catch (err) {
    console.error('[ref.word-counter] refresh failed:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
  }
}

/** Escape HTML special characters to prevent XSS from conversation data. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 6. Theme helper ──────────────────────────────────────────────────────────
function updateThemeLabel(theme) {
  // Nothing extra to update in this panel; the CSS variables do the work.
  // Kept as a hook in case you want to add theme-specific UI.
}

// ─── 7. Event wiring ──────────────────────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', refresh);

// Auto-refresh on first load.
refresh();
