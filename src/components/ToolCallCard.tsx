import React, { useEffect, useState } from 'react';
import type { ToolCall } from '../types';

interface Props {
  toolCall: ToolCall;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

/** Summarise input args as a compact "key: val, …" string for the collapsed view */
function argSummary(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '()';
  const parts = entries.slice(0, 2).map(([k, v]) => {
    const val = typeof v === 'string' ? (v.length > 40 ? v.slice(0, 40) + '…' : v) : JSON.stringify(v);
    return `${k}: ${val}`;
  });
  const suffix = entries.length > 2 ? ` +${entries.length - 2} more` : '';
  return parts.join(', ') + suffix;
}

export default function ToolCallCard({ toolCall, onApprove, onDeny }: Props) {
  const isPending = !!toolCall.pending;
  const isDenied = toolCall.approved === false;
  const isError = !!toolCall.isError;

  const [open, setOpen] = useState(isPending);
  useEffect(() => { if (!isPending) setOpen(false); }, [isPending]);

  // Left-border accent by state
  const borderAccent = isPending
    ? 'border-l-amber-500/70'
    : isDenied
      ? 'border-l-slate-600'
      : isError
        ? 'border-l-red-500/60'
        : 'border-l-slate-600';

  const statusDot = isPending
    ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
    : isDenied
      ? <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
      : isError
        ? <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
        : <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 shrink-0" />;

  const resultText = toolCall.result === undefined
    ? undefined
    : typeof toolCall.result === 'string'
      ? toolCall.result
      : JSON.stringify(toolCall.result, null, 2);

  return (
    <div className={`rounded-lg border border-slate-700/40 border-l-2 ${borderAccent} bg-slate-900/60 text-xs overflow-hidden`}>
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
        onClick={() => !isPending && setOpen((o) => !o)}
        aria-expanded={open}
      >
        {statusDot}

        {/* Server badge */}
        {toolCall.serverId && (
          <span className="font-mono text-[10px] bg-slate-800 text-slate-400 rounded px-1.5 py-0.5 shrink-0 border border-slate-700/60">
            {toolCall.serverId.length > 16 ? toolCall.serverId.slice(0, 16) + '…' : toolCall.serverId}
          </span>
        )}

        {/* Tool name */}
        <span className="font-mono font-medium text-slate-200 shrink-0">{toolCall.name}</span>

        {/* Collapsed arg preview */}
        {!open && (
          <span className="font-mono text-slate-500 truncate flex-1 text-[11px]">{argSummary(toolCall.input)}</span>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Duration */}
          {toolCall.durationMs !== undefined && (
            <span className="text-[10px] text-slate-600 font-sans">
              {toolCall.durationMs < 1000 ? `${toolCall.durationMs}ms` : `${(toolCall.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}

          {/* Pending approve/deny */}
          {isPending && onApprove && onDeny && (
            <div className="flex gap-1.5 font-sans">
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(toolCall.id); }}
                className="px-2 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
              >
                Allow
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeny(toolCall.id); }}
                className="px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white transition-colors"
              >
                Deny
              </button>
            </div>
          )}

          {/* Chevron */}
          {!isPending && (
            <svg
              className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {open && (
        <div className="border-t border-slate-700/40">
          {/* Arguments */}
          <div className="px-3 pt-2.5 pb-2">
            <p className="text-[9px] uppercase tracking-widest text-slate-600 font-sans mb-1.5">Arguments</p>
            <pre className="font-mono text-slate-300 whitespace-pre-wrap break-all text-[11px] leading-relaxed max-h-52 overflow-y-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {!isPending && resultText !== undefined && (
            <div className="border-t border-slate-700/40 px-3 pt-2.5 pb-2">
              <p className="text-[9px] uppercase tracking-widest text-slate-600 font-sans mb-1.5">
                Result{isError && <span className="ml-2 text-red-400 normal-case tracking-normal">· error</span>}
              </p>
              <pre className={`font-mono whitespace-pre-wrap break-all text-[11px] leading-relaxed max-h-52 overflow-y-auto ${isError ? 'text-red-300' : 'text-slate-300'}`}>
                {resultText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
