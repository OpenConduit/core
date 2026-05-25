import type { Conversation } from '../types';

export function exportAsJson(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2);
}

export function exportAsMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title}`, ''];

  for (const msg of conversation.messages) {
    const role =
      msg.role === 'user'
        ? '**User**'
        : msg.role === 'assistant'
          ? '**Assistant**'
          : msg.role === 'system'
            ? '**System**'
            : '**Tool Result**';

    const ts = new Date(msg.timestamp).toLocaleString();
    lines.push(`### ${role} — ${ts}`, '');

    if (msg.content) lines.push(msg.content, '');

    if (msg.toolCalls?.length) {
      for (const tc of msg.toolCalls) {
        lines.push(`> **Tool call:** \`${tc.name}\``);
        lines.push('> ```json');
        lines.push('> ' + JSON.stringify(tc.input, null, 2).replace(/\n/g, '\n> '));
        lines.push('> ```');
        if (tc.result !== undefined) {
          lines.push(`> **Result:** ${String(tc.result)}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── HTML export (self-contained, dark theme) ─────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderMd(raw: string): string {
  const e = esc(raw);
  const fenced = e.replace(/```([a-z]*)\n?([\s\S]*?)```/g,
    (_: string, lang: string, code: string) =>
      `<pre class="cb"><code${lang ? ` class="language-${lang}"` : ''}>${code.trim()}</code></pre>`);
  const inline = fenced.replace(/`([^`\n]+)`/g, '<code class="ic">$1</code>');
  const bold = inline.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const italic = bold.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return italic.replace(/\n/g, '<br>');
}

const HTML_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f172a;--s:#1e293b;--s2:#263349;--b:#334155;--t:#f8fafc;--m:#94a3b8;--p:#3b82f6;--q:#8b5cf6;--a:#06b6d4;--ub:#1d3a5f;--cb:#0f172a;--tb:#1a2744;--thb:#231c3d;--f:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--mono:'JetBrains Mono','Fira Code',Menlo,monospace}
body{background:var(--bg);color:var(--t);font-family:var(--f);line-height:1.6;min-height:100vh}
a{color:var(--a)}
.ph{background:var(--s);border-bottom:1px solid var(--b);padding:18px 24px;position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:10px}
.logo{font-size:14px;font-weight:700;background:linear-gradient(135deg,var(--p),var(--q));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sep{color:var(--b)}.ct{font-size:15px;font-weight:600}.cm{font-size:13px;color:var(--m);margin-left:auto}
main{max-width:820px;margin:0 auto;padding:24px 16px 80px;display:flex;flex-direction:column;gap:12px}
.msg{border-radius:12px;overflow:hidden;border:1px solid var(--b)}
.msg.user{background:var(--ub);border-color:#2d4a7a}.msg.assistant{background:var(--s)}
.mh{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--b);font-size:13px}
.rl{font-weight:600}.msg.user .rl{color:#60a5fa}.msg.assistant .rl{color:#a78bfa}
.mb{font-size:11px;background:var(--s2);border:1px solid var(--b);border-radius:4px;padding:1px 6px;color:var(--m);font-family:var(--mono)}
.ts{margin-left:auto;color:var(--m);font-size:12px}
.mbody{padding:14px}.mc{white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.7}
.cb{background:var(--cb);border:1px solid var(--b);border-radius:8px;padding:12px 14px;overflow-x:auto;font-family:var(--mono);font-size:13px;line-height:1.6;margin:8px 0;white-space:pre}
.ic{background:var(--cb);border:1px solid var(--b);border-radius:4px;padding:1px 5px;font-family:var(--mono);font-size:13px}
details.th{background:var(--thb);border:1px solid #3b2d6e;border-radius:8px;margin-bottom:10px;overflow:hidden}
details.th>summary{padding:8px 12px;cursor:pointer;font-size:13px;font-style:italic;color:#c4b5fd;list-style:none}
details.th>summary::before{content:'▶';font-size:10px;margin-right:6px}
details.th[open]>summary::before{transform:rotate(90deg);display:inline-block}
.thc{padding:10px 12px;border-top:1px solid #3b2d6e;font-size:13px;color:#c4b5fd;white-space:pre-wrap}
details.tc{background:var(--tb);border:1px solid #2d4a7a;border-radius:8px;margin:6px 0;overflow:hidden}
details.tc>summary{padding:8px 12px;cursor:pointer;font-size:13px;color:var(--a);list-style:none}
details.tc>summary::before{content:'▶ ⚙ ';font-size:10px}
details.tc[open]>summary::before{content:'▼ ⚙ '}
.tcb{padding:10px 12px;border-top:1px solid #2d4a7a}
.sl{font-size:11px;font-weight:600;color:var(--m);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
footer{text-align:center;padding:24px;font-size:13px;color:var(--m);border-top:1px solid var(--b)}`;

export function exportAsHtml(conversation: Conversation): string {
  const msgs = conversation.messages.filter((m) => m.role !== 'system');
  const count = msgs.length;

  const msgsHtml = msgs.map((msg) => {
    const isUser = msg.role === 'user';
    const isAst = msg.role === 'assistant';
    const label = isUser ? 'User' : isAst ? 'Assistant' : msg.role.replace(/_/g, ' ');
    const cls = isUser ? 'user' : isAst ? 'assistant' : 'other';

    let body = '';

    if (msg.thinking) {
      body += `<details class="th"><summary>Thinking…</summary><div class="thc">${esc(msg.thinking)}</div></details>`;
    }

    if (msg.content) {
      body += `<div class="mc">${renderMd(msg.content)}</div>`;
    }

    if (msg.toolCalls?.length) {
      for (const tc of msg.toolCalls) {
        const inp = esc(JSON.stringify(tc.input, null, 2));
        const res = tc.result !== undefined ? esc(String(tc.result)) : '';
        body += `<details class="tc"><summary><code>${esc(tc.name)}</code></summary><div class="tcb"><div class="sl">Input</div><pre class="cb"><code>${inp}</code></pre>${res ? `<div class="sl">Result</div><pre class="cb"><code>${res}</code></pre>` : ''}</div></details>`;
      }
    }

    const modelBadge = msg.model ? `<span class="mb">${esc(msg.model)}</span>` : '';

    return `<div class="msg ${cls}"><div class="mh"><span class="rl">${label}</span>${modelBadge}<span class="ts">${fmtTs(msg.timestamp)}</span></div><div class="mbody">${body}</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(conversation.title)} — OpenConduit</title>
<style>${HTML_CSS}</style>
</head>
<body>
<header class="ph">
  <span class="logo">OpenConduit</span>
  <span class="sep">/</span>
  <span class="ct">${esc(conversation.title)}</span>
  <span class="cm">${count} message${count === 1 ? '' : 's'}</span>
</header>
<main>${msgsHtml}</main>
<footer>Exported from <a href="https://openconduit.ai" rel="noopener noreferrer">OpenConduit</a></footer>
</body>
</html>`;
}
