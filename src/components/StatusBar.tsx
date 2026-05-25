import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useCollaborationStore } from '../stores/collaborationStore';
import type { ProviderType } from '../types';
import NotificationBell from './NotificationBell';
import { extensionRegistry } from '../extensions/extensionRegistry';
import type { StatusBarItemContribution } from '../extensions/types';

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
  const { activeConversationId, bottomPanelOpen, toggleBottomPanel } = useUiStore();
  const { conversations } = useConversationStore();
  const { settings } = useSettingsStore();
  const records = useAnalyticsStore((s) => s.records);
  const { roomId, inviteUrl, participants, setRoom, clearRoom } = useCollaborationStore();
  const collabConversationId = useCollaborationStore((s) => s.conversationId);
  const isOnSharedChat = !!activeConversationId && activeConversationId === collabConversationId;

  const conv = conversations.find((c) => c.id === activeConversationId);

  // ── Share state ──────────────────────────────────────────────────────────
  const [shareUrl, setShareUrl]     = useState<string | null>(null);
  const [sharing, setSharing]       = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const sharePopoverRef             = useRef<HTMLDivElement>(null);

  // ── Live room state ──────────────────────────────────────────────────────
  const [startingRoom, setStartingRoom] = useState(false);
  const [roomCopied, setRoomCopied]     = useState(false);

  // Extension-contributed status bar items
  const [leftItems, setLeftItems] = useState<StatusBarItemContribution[]>(
    () => extensionRegistry.getStatusBarItems('left'),
  );
  const [rightItems, setRightItems] = useState<StatusBarItemContribution[]>(
    () => extensionRegistry.getStatusBarItems('right'),
  );
  useEffect(() => {
    return extensionRegistry.subscribe(() => {
      setLeftItems(extensionRegistry.getStatusBarItems('left'));
      setRightItems(extensionRegistry.getStatusBarItems('right'));
    });
  }, []);

  // Close share popover when clicking outside
  useEffect(() => {
    if (!shareUrl) return;
    const handler = (e: MouseEvent) => {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(e.target as Node)) {
        setShareUrl(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    if (!conv || sharing || !window.api?.conversation) return;
    setSharing(true);
    setShareUrl(null);
    try {
      const { url } = await window.api.conversation.share(conv as unknown);
      setShareUrl(url);
    } catch { /* silently fail — no credentials / network */ }
    finally { setSharing(false); }
  }, [conv, sharing]);

  const handleCopyShare = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [shareUrl]);

  const handleStartRoom = useCallback(async () => {
    if (!conv || startingRoom || !window.api?.collab) return;
    setStartingRoom(true);
    try {
      const result = await window.api.collab.create(conv);
      await window.api.collab.join(result.roomId, 'You', '#3B82F6');
      setRoom(result.roomId, result.inviteUrl, activeConversationId ?? '', true);
    } catch { /* ignore */ }
    finally { setStartingRoom(false); }
  }, [conv, startingRoom, setRoom, activeConversationId]);

  const handleCopyRoomLink = useCallback(async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setRoomCopied(true);
    setTimeout(() => setRoomCopied(false), 2000);
  }, [inviteUrl]);

  const handleLeaveRoom = useCallback(async () => {
    await window.api?.collab?.leave();
    clearRoom();
  }, [clearRoom]);

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

  return (
    <div
      className="flex-shrink-0 h-6 bg-slate-950 border-t border-slate-800 flex items-center px-3 gap-4 text-[11px] text-slate-500 select-none"
      role="status"
      aria-label="Status bar"
    >
      {/* ── Share + Live buttons (desktop only, conversation must be active) ── */}
      {conv && (
        <div className="relative flex items-center gap-0.5">

          {/* Share button */}
          {window.api?.conversation && (
            <div ref={sharePopoverRef} className="relative">
              <button
                onClick={handleShare}
                disabled={sharing}
                title="Share conversation"
                className="flex items-center gap-1 px-1.5 h-5 rounded hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                {sharing ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="3" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="12" cy="13" r="1.5" />
                    <path strokeLinecap="round" d="M5.5 7l5-3M5.5 9l5 3" />
                  </svg>
                )}
                <span>Share</span>
              </button>

              {/* Share URL popover */}
              {shareUrl && (
                <div className="absolute bottom-7 left-0 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2.5 w-80 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Shared link</span>
                    <div className="flex-1 h-px bg-slate-800" />
                    <button onClick={() => setShareUrl(null)} className="text-slate-600 hover:text-slate-400 text-xs leading-none">✕</button>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1.5">
                    <span className="text-xs text-slate-300 truncate flex-1 font-mono">{shareUrl}</span>
                    <button
                      onClick={handleCopyShare}
                      className="flex-shrink-0 text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                    >
                      {shareCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Anyone with this link can view a read-only snapshot. Expires in 30 days.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Live collaboration button */}
          {window.api?.collab && !roomId && (
            <button
              onClick={handleStartRoom}
              disabled={startingRoom}
              title="Start a live collaboration room"
              className="flex items-center gap-1 px-1.5 h-5 rounded hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8">
                <circle cx="5.5" cy="5" r="2" />
                <path strokeLinecap="round" d="M1.5 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                <circle cx="11.5" cy="5" r="2" />
                <path strokeLinecap="round" d="M9.5 13.5c0-2.2 1.8-4 4-4" />
              </svg>
              <span>{startingRoom ? 'Starting…' : 'Live'}</span>
            </button>
          )}

          {/* Active room indicator */}
          {roomId && (
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnSharedChat ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-700'}`} />
              {isOnSharedChat ? (
                <span className="text-emerald-400 font-medium">
                  Live · {participants.length} {participants.length === 1 ? 'person' : 'people'}
                </span>
              ) : (
                <button
                  onClick={() => {
                    const { setActiveConversation } = useUiStore.getState();
                    if (collabConversationId) setActiveConversation(collabConversationId);
                  }}
                  className="text-emerald-700 hover:text-emerald-400 transition-colors font-medium"
                  title="Go to live conversation"
                >
                  Live (other chat)
                </button>
              )}
              {isOnSharedChat && inviteUrl && (
                <button
                  onClick={handleCopyRoomLink}
                  title="Copy invite link"
                  className="text-slate-600 hover:text-slate-400 transition-colors text-[10px]"
                >
                  {roomCopied ? '✓' : '⎘'}
                </button>
              )}
              <button
                onClick={handleLeaveRoom}
                title="Leave live room"
                className="text-slate-600 hover:text-red-400 transition-colors text-[10px] ml-0.5"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Model / routing profile indicator — only when a conversation is active */}
      {conv && modelLabel && (
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

      {/* Extension-contributed left items */}
      {leftItems.map((item) => (
        <item.render key={item.id} />
      ))}

      <div className="flex-1" />

      {/* Routing badge */}
      {conv && showRouting && (
        <div className="flex items-center gap-1 text-blue-500/60">
          <span aria-hidden>⚡</span>
          <span>{activeProfile ? activeProfile.name : 'Routing'}</span>
        </div>
      )}

      {/* Token counter  ↑ input / ↓ output */}
      {conv && tokens && (
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
      {conv && costUsd !== null && (
        <span className="tabular-nums text-slate-400">{fmtCost(costUsd)}</span>
      )}

      {/* Extension-contributed right items */}
      {rightItems.map((item) => (
        <item.render key={item.id} />
      ))}

      {/* Notification bell */}
      <NotificationBell />

      {/* Bottom panel toggle (⌘J) */}
      <button
        onClick={toggleBottomPanel}
        title="Toggle panel (⌘J)"
        className={`flex items-center gap-1 transition-colors ${
          bottomPanelOpen ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
    </div>
  );
}
