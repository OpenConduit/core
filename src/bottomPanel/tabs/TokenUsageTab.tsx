import React, { useMemo } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useAnalyticsStore } from '../../stores/analyticsStore';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number | null): string {
  if (usd === null) return '—';
  if (usd < 0.001) return `<$0.001`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export default function TokenUsageTab({ conversationId }: { conversationId: string | null }) {
  const conversations = useConversationStore((s) => s.conversations);
  const records = useAnalyticsStore((s) => s.records);

  const conv = conversations.find((c) => c.id === conversationId);

  const rows = useMemo(() => {
    if (!conv) return [];
    return conv.messages
      .filter((m) => m.role === 'assistant' && m.usage)
      .map((m, i) => {
        const convRecords = records.filter(
          (r) => r.conversationId === conv.id && r.model === m.model,
        );
        // Best-effort: match by position (records are newest-first)
        const record = convRecords[convRecords.length - 1 - i] ?? null;
        return {
          id: m.id,
          index: i + 1,
          model: m.model ?? '—',
          input: m.usage!.inputTokens,
          output: m.usage!.outputTokens,
          costUsd: record?.costUsd ?? null,
        };
      });
  }, [conv, records]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          input: acc.input + r.input,
          output: acc.output + r.output,
          cost: acc.cost + (r.costUsd ?? 0),
        }),
        { input: 0, output: 0, cost: 0 },
      ),
    [rows],
  );

  const handleExportCsv = () => {
    const header = 'turn,model,input_tokens,output_tokens,cost_usd';
    const body = rows
      .map((r) => `${r.index},${r.model},${r.input},${r.output},${r.costUsd ?? ''}`)
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `token-usage-${conversationId?.slice(0, 8) ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!conversationId || !conv) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        No active conversation
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        No token usage recorded yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[11px] tabular-nums">
          <thead className="sticky top-0 bg-slate-950 z-10">
            <tr className="text-slate-600 border-b border-slate-800">
              <th className="text-left px-3 py-1.5 font-normal">#</th>
              <th className="text-left px-3 py-1.5 font-normal">Model</th>
              <th className="text-right px-3 py-1.5 font-normal">Input</th>
              <th className="text-right px-3 py-1.5 font-normal">Output</th>
              <th className="text-right px-3 py-1.5 font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 text-slate-600">{r.index}</td>
                <td className="px-3 py-1.5 text-slate-400 font-mono truncate max-w-[140px]">{r.model}</td>
                <td className="px-3 py-1.5 text-slate-300 text-right">{fmtTokens(r.input)}</td>
                <td className="px-3 py-1.5 text-slate-300 text-right">{fmtTokens(r.output)}</td>
                <td className="px-3 py-1.5 text-slate-400 text-right">{fmtCost(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
          {/* Totals footer */}
          <tfoot className="sticky bottom-0 bg-slate-950">
            <tr className="border-t border-slate-700 text-slate-300 font-medium">
              <td className="px-3 py-1.5 text-slate-500" colSpan={2}>Total</td>
              <td className="px-3 py-1.5 text-right">{fmtTokens(totals.input)}</td>
              <td className="px-3 py-1.5 text-right">{fmtTokens(totals.output)}</td>
              <td className="px-3 py-1.5 text-right">{fmtCost(totals.cost > 0 ? totals.cost : null)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Export button */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-800 flex justify-end">
        <button
          onClick={handleExportCsv}
          className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  );
}
