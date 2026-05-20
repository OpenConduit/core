import React, { useEffect, useRef, useState } from 'react';
import { useDebugConsoleStore, type DebugLevel, type LogCategory } from '../../stores/debugConsoleStore';

const LEVELS: DebugLevel[] = ['debug', 'log', 'info', 'warn', 'error'];
const LEVEL_ORDER: Record<DebugLevel | 'all', number> = { all: -1, debug: 0, log: 1, info: 2, warn: 3, error: 4 };

const LEVEL_STYLES: Record<DebugLevel, { badge: string; text: string; label: string }> = {
  debug: { badge: 'bg-slate-800 text-slate-500',    text: 'text-slate-500',   label: 'DBG'   },
  log:   { badge: 'bg-slate-700 text-slate-300',    text: 'text-slate-300',   label: 'LOG'   },
  info:  { badge: 'bg-blue-900/60 text-blue-300',   text: 'text-blue-200',    label: 'INFO'  },
  warn:  { badge: 'bg-yellow-900/60 text-yellow-300', text: 'text-yellow-200', label: 'WARN'  },
  error: { badge: 'bg-red-900/60 text-red-300',     text: 'text-red-200',     label: 'ERROR' },
};

const CATEGORY_STYLES: Record<LogCategory, string> = {
  provider: 'text-violet-400',
  mcp:      'text-cyan-400',
  routing:  'text-amber-400',
  settings: 'text-slate-400',
  app:      'text-green-400',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function DataPreview({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  if (data === undefined) return null;
  const str = JSON.stringify(data, null, 2);
  const isShort = str.length <= 60 && !str.includes('\n');
  if (isShort) return <span className="font-mono text-slate-400 ml-2">{str}</span>;
  return (
    <span className="ml-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-slate-500 hover:text-slate-300 font-mono text-[10px] underline"
      >
        {open ? 'hide' : 'show data'}
      </button>
      {open && (
        <pre className="mt-1 ml-2 text-slate-400 text-[11px] bg-slate-900 rounded p-2 overflow-x-auto max-h-40">
          {str}
        </pre>
      )}
    </span>
  );
}

export default function DebugConsoleTab() {
  const { entries, clear } = useDebugConsoleStore();
  const [filter, setFilter] = useState<DebugLevel | 'all'>('info');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const visible = filter === 'all'
    ? entries
    : entries.filter((e) => LEVEL_ORDER[e.level] >= LEVEL_ORDER[filter]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [visible.length, autoScroll]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-[12px]">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b border-slate-800">
        {/* Level filter */}
        <div className="flex items-center gap-1">
          {(['all', ...LEVELS] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === lvl
                  ? lvl === 'all'
                    ? 'bg-slate-600 text-slate-100'
                    : LEVEL_STYLES[lvl as DebugLevel].badge
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {lvl === 'all' ? 'ALL' : LEVEL_STYLES[lvl as DebugLevel].label}
            </button>
          ))}
        </div>

        <span className="text-slate-700 select-none">|</span>

        <label className="flex items-center gap-1 cursor-pointer text-slate-500 hover:text-slate-300 select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-blue-500 w-3 h-3"
          />
          auto-scroll
        </label>

        <span className="flex-1" />

        <span className="text-slate-700">{visible.length} entries</span>

        <button
          onClick={clear}
          className="text-slate-600 hover:text-slate-300 transition-colors px-1"
          title="Clear console"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto font-mono">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600">
            No entries{filter !== 'all' ? ` at level "${filter}"` : ''}
          </div>
        ) : (
          visible.map((entry) => {
            const s = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                className="flex items-baseline gap-2 px-3 py-0.5 hover:bg-slate-900 border-b border-slate-900/50 leading-5"
              >
                <span className="flex-shrink-0 text-slate-600 text-[10px] tabular-nums">
                  {fmtTime(entry.ts)}
                </span>
                <span className={`flex-shrink-0 text-[9px] font-semibold px-1 rounded ${s.badge}`}>
                  {s.label}
                </span>
                {entry.category && (
                  <span className={`flex-shrink-0 text-[9px] font-medium ${CATEGORY_STYLES[entry.category]}`}>
                    [{entry.category}]
                  </span>
                )}
                <span className={`break-all ${s.text}`}>{entry.message}</span>
                <DataPreview data={entry.data} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
