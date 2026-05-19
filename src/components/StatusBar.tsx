import React, { useMemo } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import type { ProviderType } from '../types';

// Provider colour dots (matches brand palette)
const PROVIDER_COLORS: Partial<Record<ProviderType, string>> & Record<string, string> = {
  anthropic: '#a855f7',
  openai:    '#22c55e',
  gemini:    '#3b82f6',
  lmstudio:  '#f59e0b',
  ollama:    '#64748b',
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd < 0.001)  return `~$${usd.toFixed(6)}`;
  if (usd < 0.01)   return `~$${usd.toFixed(4)}`;
  if (usd < 1)      return `~$${usd.toFixed(3)}`;
  return `~$${usd.toFixed(2)}`;
}

export default function StatusBar() {
  const { activeConversationId } = useUiStore();
  const { conversations } = useConversationStore();
  const { settings } = useSettingsStore();
  const records = useAnalyticsStore((s) => s.records);

  const conv = conversations.find((c) => c.id === activeConversationId);

  // Sum token usage across all messages in the active conversation
  const tokens = useMemo(() => {
    if (!conv) return null;
    const totals = conv.messages.reduce(
      (acc, m) => {
        if (m.usage) {
          acc.input  += m.usage.inputTokens;
          acc.output += m.usage.outputTokens;
        }
        return acc;
      },
      { input: 0, output: 0 },
    );
    return totals.input === 0 && totals.output === 0 ? null : totals;
  }, [conv]);

  // Sum cost from analytics records for this conversation
  const costUsd = useMemo(() => {
    if (!activeConversationId) return null;
    const convRecords = records.filter((r) => r.conversationId === activeConversationId);
    if (convRecords.length === 0) return null;
    const total = convRecords.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    return total > 0 ? total : null;
  }, [records, activeConversationId]);

  // Model / routing profile label
  const providerId   = conv?.providerId   ?? settings?.defaultProviderId ?? '';
  const model        = conv?.model        ?? settings?.defaultModel       ?? '';
  const provider     = settings?.providers.find((p) => p.id === providerId);
  const providerType = (provider?.type ?? providerId) as ProviderType;
  const dotColor     = PROVIDER_COLORS[providerType] ?? '#64748b';

  const activeProfile = conv?.routingProfileId
    ? (settings?.routingProfiles ?? []).find((p) => p.id === conv?.routingProfileId)
    : undefined;

  const modelLabel    = activeProfile ? activeProfile.name : model;
  const providerLabel = activeProfile ? undefined : provider?.name;

  const routingOn  = settings?.routing?.enabled;
  const showRouting = routingOn || !!activeProfile;

  if (!conv) return null;

  return (
    <div
      className="flex-shrink-0 h-6 bg-slate-950 border-t border-slate-800 flex items-center px-3 gap-4 text-[11px] text-slate-500 select-none overflow-hidden"
      role="status"
      aria-label="Status bar"
    >
      {/* Model / routing profile indicator */}
      {modelLabel && (
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="truncate text-slate-400">
            {providerLabel ? `${providerLabel} · ${modelLabel}` : modelLabel}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Routing badge */}
      {showRouting && (
        <div className="flex items-center gap-1 text-blue-500/60">
          <span aria-hidden>⚡</span>
          <span>{activeProfile ? activeProfile.name : 'Routing'}</span>
        </div>
      )}

      {/* Token counter  ↑ input / ↓ output */}
      {tokens && (
        <div className="flex items-center gap-1 tabular-nums">
          <span className="text-slate-600">↑</span>
          <span>{fmtTokens(tokens.input)}</span>
          <span className="text-slate-700">/</span>
          <span className="text-slate-600">↓</span>
          <span>{fmtTokens(tokens.output)}</span>
          <span className="text-slate-600 ml-0.5">tok</span>
        </div>
      )}

      {/* Cost estimate */}
      {costUsd !== null && (
        <span className="tabular-nums text-slate-400">{fmtCost(costUsd)}</span>
      )}

      {/* Notification bell */}
      <button
        className="flex items-center justify-center w-4 h-4 text-slate-600 hover:text-slate-400 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    </div>
  );
}
