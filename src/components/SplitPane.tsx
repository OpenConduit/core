import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { PaneContext } from '../contexts/PaneContext';
import ChatArea from './ChatArea';
import ModelPickerButton from './ModelPickerButton';

const PREVIEWABLE = new Set(['html', 'svg']);

const IconClose = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCopyDone = () => (
  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// ── PaneCodeViewer — shared renderer for code / file / preview content ────────
export interface PaneCodeContent {
  type: 'code' | 'file' | 'preview';
  language?: string;
  payload: string;
}

interface CodeViewerProps {
  content: PaneCodeContent;
  onClose: () => void;
}

export function PaneCodeViewer({ content, onClose }: CodeViewerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const canPreview = content.type === 'code' && PREVIEWABLE.has(content.language ?? '');
  const label = content.language ?? content.type;

  const highlighted = useMemo(() => {
    if (content.type !== 'code') return null;
    const lang = content.language ?? 'plaintext';
    try {
      const resolved = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(content.payload, { language: resolved }).value;
    } catch {
      return content.payload;
    }
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content.payload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
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
          <button
            onClick={handleCopy}
            title="Copy"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {copied ? <IconCopyDone /> : <IconCopy />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <IconClose />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {showPreview && canPreview ? (
          <PanePreview language={content.language ?? ''} code={content.payload} />
        ) : content.type === 'code' || content.type === 'file' ? (
          <pre className="h-full bg-slate-900 overflow-auto">
            <code
              className={`hljs language-${content.language ?? 'plaintext'} text-[12px] p-4 block font-mono leading-relaxed`}
              dangerouslySetInnerHTML={{ __html: highlighted ?? content.payload }}
            />
          </pre>
        ) : (
          <PanePreview language={content.language ?? 'html'} code={content.payload} />
        )}
      </div>
    </>
  );
}

function PanePreview({ language, code }: { language: string; code: string }) {
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
      title="Pane preview"
    />
  );
}

// ── SplitPane — right-side pane, mirrors left pane capabilities ───────────────
export default function SplitPane() {
  const { splitPaneContent, closeSplitPane, openSplitPane, rightPaneTabs, closeRightPaneTab } = useUiStore();
  const { settings, models, loadModels } = useSettingsStore();
  const { conversations } = useConversationStore();

  if (!splitPaneContent) return null;

  // Conversation mode — tab bar + full ChatArea (mirrors left pane TabBar)
  if (splitPaneContent.type === 'conversation') {
    const activeId = splitPaneContent.payload;
    const conv = conversations.find((c) => c.id === activeId);
    return (
      <PaneContext.Provider value="right">
        <div className="flex flex-col min-w-0 min-h-0 border-l border-slate-700 bg-slate-900 overflow-hidden h-full">
          {/* Tab bar — same h-9 bg-slate-950 as left TabBar */}
          <div className="flex items-stretch bg-slate-950 border-b border-slate-700 flex-shrink-0 h-9 overflow-hidden">
            {/* Conversation tabs */}
            <div className="flex items-stretch flex-1 overflow-hidden min-w-0">
              {rightPaneTabs.map((tabId) => {
                const tabConv = conversations.find((c) => c.id === tabId);
                const isActive = tabId === activeId;
                return (
                  <div
                    key={tabId}
                    onClick={() => openSplitPane({ type: 'conversation', payload: tabId })}
                    className={`relative flex items-center gap-1.5 px-3 cursor-pointer border-r border-slate-700 max-w-[160px] min-w-0 select-none transition-colors group flex-shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                    <span className="text-[11px] truncate flex-1 min-w-0">
                      {tabConv?.title || 'New Conversation'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeRightPaneTab(tabId); }}
                      title="Close tab"
                      className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 hover:text-red-400 transition-all"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Right side: model picker + close pane */}
            <div className="flex items-center gap-0.5 flex-shrink-0 px-1">
              {conv && (
                <ModelPickerButton
                  settings={settings}
                  models={models}
                  loadModels={loadModels}
                  conversationId={activeId}
                  conv={conv}
                />
              )}
              <button
                onClick={closeSplitPane}
                title="Close pane"
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0"
              >
                <IconClose />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ChatArea conversationId={activeId} />
          </div>
        </div>
      </PaneContext.Provider>
    );
  }

  // Code / File / Preview mode
  return (
    <PaneContext.Provider value="right">
      <div className="flex flex-col min-w-0 min-h-0 border-l border-slate-700 bg-slate-900 overflow-hidden h-full">
        <PaneCodeViewer content={splitPaneContent as PaneCodeContent} onClose={closeSplitPane} />
      </div>
    </PaneContext.Provider>
  );
}
