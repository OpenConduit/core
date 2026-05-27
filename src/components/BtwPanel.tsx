import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUiStore } from '../stores/uiStore';

interface Props {
  convId: string;
  onClose: () => void;
}

export default function BtwPanel({ convId, onClose }: Props) {
  const entries = useUiStore((s) => s.btwHistory[convId] ?? []);
  const clearBtwHistory = useUiStore((s) => s.clearBtwHistory);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const count = entries.length;
  const hasStreaming = entries.some((e) => e.isStreaming);

  return (
    <div className="absolute bottom-[72px] right-4 z-30 w-[440px] max-w-[calc(100vw-2rem)] flex flex-col rounded-xl border border-purple-700/40 bg-slate-900/98 shadow-2xl backdrop-blur-sm overflow-hidden"
      style={{ maxHeight: '520px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            BTW
            {hasStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {count === 0 ? 'no questions yet' : `${count} question${count > 1 ? 's' : ''} · not saved`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button
              onClick={() => clearBtwHistory(convId)}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800"
              title="Clear BTW history for this conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
            title="Close BTW panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Context notice */}
      <div className="px-3 py-1.5 bg-purple-950/30 border-b border-purple-900/20 flex-shrink-0">
        <p className="text-[10px] text-purple-400/70 leading-relaxed">
          Replies use your current conversation as context but are <span className="font-medium text-purple-400">not written back</span> to the main thread.
        </p>
      </div>

      {/* Entry list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {count === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-slate-600 select-none">
            Type a question with /btw
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {entries.map((entry) => (
              <div key={entry.id} className="px-3 py-3 space-y-2">
                {/* Question */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 mt-0.5 flex-shrink-0">You</span>
                  <p className="text-xs text-slate-200 leading-relaxed flex-1">{entry.question}</p>
                </div>
                {/* Answer */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-purple-500 mt-0.5 flex-shrink-0">AI</span>
                  <div className="text-xs text-slate-100 leading-relaxed flex-1 prose-ai min-w-0">
                    {entry.answer ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer}</ReactMarkdown>
                    ) : null}
                    {entry.isStreaming && (
                      <span className="inline-block w-1 h-3.5 bg-purple-400 animate-pulse ml-0.5 rounded-sm align-middle" />
                    )}
                    {!entry.answer && !entry.isStreaming && (
                      <span className="text-slate-600 italic">No response</span>
                    )}
                  </div>
                </div>
                {/* Timestamp */}
                <p className="text-[10px] text-slate-700 pl-8">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
