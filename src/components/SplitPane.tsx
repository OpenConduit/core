import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js';
import { useUiStore } from '../stores/uiStore';
import ChatArea from './ChatArea';

const PREVIEWABLE = new Set(['html', 'svg']);

export default function SplitPane() {
  const { splitPaneContent, closeSplitPane } = useUiStore();
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const content = splitPaneContent;

  const highlighted = useMemo(() => {
    if (!content || content.type !== 'code') return null;
    const lang = content.language ?? 'plaintext';
    try {
      const resolved = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(content.payload, { language: resolved }).value;
    } catch {
      return content.payload;
    }
  }, [content]);

  if (!content) return null;

  // ── Conversation mode — full interactive ChatArea ─────────────────────────
  if (content.type === 'conversation') {
    return (
      <div className="flex flex-col min-w-0 min-h-0 border-l border-slate-700 bg-slate-900 overflow-hidden">
        {/* Thin toolbar just for close */}
        <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 border-b border-slate-700 flex-shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">Split chat</span>
          <button
            onClick={closeSplitPane}
            title="Close pane (⌘\\)"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatArea conversationId={content.payload} />
        </div>
      </div>
    );
  }

  const canPreview = content.type === 'code' && PREVIEWABLE.has(content.language ?? '');
  const label = content.language ?? content.type;

  const handleCopy = () => {
    navigator.clipboard.writeText(content.payload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col min-w-0 min-h-0 border-l border-slate-700 bg-slate-900 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 border-b border-slate-700 flex-shrink-0">
        <span className="text-[11px] font-mono text-slate-400">{label}</span>
        <div className="flex items-center gap-1">
          {canPreview && (
            <button
              onClick={() => setShowPreview((p) => !p)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                showPreview
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {showPreview ? 'Code' : 'Preview'}
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            onClick={closeSplitPane}
            title="Close pane (⌘\\)"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto min-h-0">
        {showPreview && canPreview ? (
          <SplitPanePreview language={content.language ?? ''} code={content.payload} />
        ) : content.type === 'code' || content.type === 'file' ? (
          <pre className="h-full bg-slate-900 overflow-auto">
            <code
              className={`hljs language-${content.language ?? 'plaintext'} text-[12px] p-4 block font-mono leading-relaxed`}
              dangerouslySetInnerHTML={{ __html: highlighted ?? content.payload }}
            />
          </pre>
        ) : (
          // Preview type — render as iframe
          <SplitPanePreview language={content.language ?? 'html'} code={content.payload} />
        )}
      </div>
    </div>
  );
}

function SplitPanePreview({ language, code }: { language: string; code: string }) {
  const srcDoc =
    language === 'svg'
      ? `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:16px;min-height:100vh">${code}</body></html>`
      : code;

  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full h-full bg-white"
      style={{ border: 'none' }}
      title="Split pane preview"
    />
  );
}
