import React from 'react';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { getContextLimit, fmtTok } from '../utils/context';

interface Props {
  conversationId: string;
}

export default function ContextWarningBanner({ conversationId }: Props) {
  const analyticsRecords = useAnalyticsStore((s) => s.records);
  const conversations = useConversationStore((s) => s.conversations);
  const { settings } = useSettingsStore();
  const isCompacting = useUiStore((s) => s.compactingConversationIds.has(conversationId));

  const conv = conversations.find((c) => c.id === conversationId);
  const model = conv?.model ?? '';
  const providerId = conv?.providerId ?? '';
  const providerCtx = settings?.providers?.find((p) => p.id === providerId)?.modelContextWindows?.[model] ?? null;
  const contextLimit = providerCtx ?? getContextLimit(model);

  // Use the most recent record's inputTokens as the context fill estimate.
  // Each record's inputTokens already includes the full conversation history, so
  // summing all turns would wildly overstate usage.
  const convRecords = analyticsRecords.filter((r) => r.conversationId === conversationId);
  const lastRecord = convRecords[convRecords.length - 1] ?? null;
  const usedTokens = lastRecord
    ? lastRecord.usage.inputTokens + lastRecord.usage.outputTokens
    : 0;

  const ctxPct = contextLimit && usedTokens > 0
    ? Math.min((usedTokens / contextLimit) * 100, 100)
    : null;

  // Only show at 70%+
  if (!ctxPct || ctxPct < 70) return null;

  const isCritical = ctxPct >= 90;

  return (
    <div
      className={`mx-3 mb-2 px-3 py-2 rounded-lg border flex items-center gap-2 text-xs ${
        isCritical
          ? 'bg-red-950/50 border-red-700/60 text-red-300'
          : 'bg-amber-950/40 border-amber-700/50 text-amber-300'
      }`}
    >
      <span>{isCritical ? '🔴' : '🟡'}</span>
      <span className="flex-1">
        Context {isCritical ? 'nearly full' : 'getting full'}{' '}
        <span className="opacity-70">
          ({fmtTok(usedTokens)}{contextLimit ? `/${fmtTok(contextLimit)}` : ''} · {ctxPct.toFixed(0)}%)
        </span>
        {isCompacting ? ' — Summarizing…' : ' — click the token counter in the toolbar to manage'}
      </span>
    </div>
  );
}
