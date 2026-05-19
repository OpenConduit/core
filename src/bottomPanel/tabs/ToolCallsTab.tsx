import React, { useState } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import type { ToolCall } from '../../types';

function fmtDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function JsonCollapsible({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const str = JSON.stringify(value, null, 2);
  const isSmall = str.length < 80 && !str.includes('\n');
  if (isSmall) {
    return (
      <span className="font-mono text-slate-400 text-[11px]">{str}</span>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
      >
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 6 10">
          <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        {label}
      </button>
      {open && (
        <pre className="mt-1 text-[11px] font-mono text-slate-400 bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {str}
        </pre>
      )}
    </div>
  );
}

function ToolCallRow({ tc, index }: { tc: ToolCall; index: number }) {
  const statusColor = tc.pending
    ? 'text-amber-400'
    : tc.isError
    ? 'text-red-400'
    : 'text-emerald-400';

  const statusLabel = tc.pending ? 'pending' : tc.isError ? 'error' : 'ok';

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Index */}
        <span className="text-[10px] text-slate-600 tabular-nums w-5 text-right flex-shrink-0">
          {index + 1}
        </span>

        {/* Tool name */}
        <span className="text-[12px] font-mono text-slate-200 truncate flex-1 min-w-0">
          {tc.name}
        </span>

        {/* Server badge */}
        {tc.serverId && (
          <span className="text-[10px] text-slate-600 bg-slate-800 rounded px-1.5 py-0.5 flex-shrink-0 truncate max-w-[100px]">
            {tc.serverId}
          </span>
        )}

        {/* Duration */}
        {tc.durationMs !== undefined && (
          <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
            {fmtDuration(tc.durationMs)}
          </span>
        )}

        {/* Status */}
        <span className={`text-[10px] font-medium flex-shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Input / Output — collapsible */}
      <div className="pl-7 flex flex-col gap-1">
        <JsonCollapsible value={tc.input} label="input" />
        {!tc.pending && tc.result !== undefined && (
          <JsonCollapsible value={tc.result} label={tc.isError ? 'error' : 'output'} />
        )}
      </div>
    </div>
  );
}

export default function ToolCallsTab({ conversationId }: { conversationId: string | null }) {
  const conversations = useConversationStore((s) => s.conversations);
  const conv = conversations.find((c) => c.id === conversationId);

  const toolCalls: ToolCall[] = conv?.messages.flatMap((m) => m.toolCalls ?? []) ?? [];

  if (!conversationId || !conv) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        No active conversation
      </div>
    );
  }

  if (toolCalls.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-3">
      {toolCalls.map((tc, i) => (
        <ToolCallRow key={tc.id} tc={tc} index={i} />
      ))}
    </div>
  );
}
