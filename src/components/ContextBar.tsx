import React from 'react';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getContextLimit, fmtTok } from '../utils/context';

interface Props {
  conversationId: string;
}

export default function ContextBar({ conversationId }: Props) {
  const records = useAnalyticsStore((s) => s.records);
  const conversations = useConversationStore((s) => s.conversations);
  const { settings } = useSettingsStore();

  const conv = conversations.find((c) => c.id === conversationId);
  const model = conv?.model ?? '';
  const providerId = conv?.providerId ?? '';
  // Provider-configured context window takes priority over built-in table
  const providerCtx = settings?.providers?.find((p) => p.id === providerId)?.modelContextWindows?.[model] ?? null;
  const limit = providerCtx ?? getContextLimit(model);

  // Use the most recent record's inputTokens as the context fill estimate.
  // Each record's inputTokens already includes the full conversation history sent
  // to the model, so summing across all turns would wildly overstate usage.
  const convRecords = records.filter((r) => r.conversationId === conversationId);
  const lastRecord = convRecords[convRecords.length - 1] ?? null;
  const usedTokens = lastRecord
    ? lastRecord.usage.inputTokens + lastRecord.usage.outputTokens
    : 0;

  // If no usage data yet and no known limit, render nothing
  if (usedTokens === 0 && limit === null) return null;

  const pct = limit ? Math.min((usedTokens / limit) * 100, 100) : null;
  const color =
    pct === null
      ? 'bg-slate-600'
      : pct >= 90
      ? 'bg-red-500'
      : pct >= 70
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const label =
    limit != null
      ? `${fmtTok(usedTokens)} / ${fmtTok(limit)} tokens (${pct!.toFixed(0)}%)`
      : `${fmtTok(usedTokens)} tokens used`;

  return (
    <div className="px-4 pb-2 flex items-center gap-2.5">
      {/* Bar */}
      {limit !== null && (
        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Label */}
      <span
        className={`text-[10px] whitespace-nowrap ${
          pct !== null && pct >= 90
            ? 'text-red-400'
            : pct !== null && pct >= 70
            ? 'text-amber-400'
            : 'text-slate-600'
        }`}
      >
        {label}
      </span>

      {/* Warning icon at ≥90% */}
      {pct !== null && pct >= 90 && (
        <svg
          className="w-3 h-3 text-red-400 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="Context window nearly full"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}
