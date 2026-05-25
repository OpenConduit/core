/**
 * CollaborationBar — shows when the user is in a live collaboration room.
 *
 * Displays:
 *   - Participant presence avatars with color rings
 *   - Lock indicator (whose turn it is to send)
 *   - "Request turn" / "Release turn" button
 *   - Invite link copy button
 *   - Room settings (gear icon) — AI mode toggle for host
 *   - Leave button
 */

import React, { useState, useCallback } from 'react';
import { useCollaborationStore, useHasLock, useIsHost } from '../stores/collaborationStore';
import { useUiStore } from '../stores/uiStore';

interface CollaborationBarProps {
  /** Called when the user leaves the room. */
  onLeave?: () => void;
}

export function CollaborationBar({ onLeave }: CollaborationBarProps) {
  const { roomId, inviteUrl, participants, lockHolder, myId, isConnected, isConnecting, connectionError } = useCollaborationStore();
  const hasLock = useHasLock();
  const isHost = useIsHost();
  const { showRoomSettings, setShowRoomSettings } = useUiStore();
  const [copied, setCopied] = useState(false);
  const [requesting, setRequesting] = useState(false);

  if (!roomId) return null;

  const lockHolderName = participants.find((p) => p.id === lockHolder)?.name ?? null;

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [inviteUrl]);

  const handleRequestLock = useCallback(async () => {
    if (!window.api?.collab) return;
    setRequesting(true);
    try {
      await window.api.collab.lockRequest();
    } finally {
      setRequesting(false);
    }
  }, []);

  const handleReleaseLock = useCallback(async () => {
    await window.api?.collab?.lockRelease();
  }, []);

  const handleLeave = useCallback(async () => {
    await window.api?.collab?.leave();
    useCollaborationStore.getState().clearRoom();
    onLeave?.();
  }, [onLeave]);

  const handleSetAiMode = useCallback((mode: 'own' | 'host') => {
    window.api?.collab?.send({ type: 'set_ai_mode', mode });
  }, []);

  return (
    <div className="flex flex-col bg-[#1a2744] border-b border-[#2d4a7a] text-sm">
      {/* Main bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Connection indicator */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isConnecting ? 'bg-yellow-400 animate-pulse' :
            isConnected  ? 'bg-emerald-400' :
                           'bg-red-500'
          }`}
          title={isConnecting ? 'Connecting…' : isConnected ? 'Connected' : connectionError ?? 'Disconnected'}
        />

        {/* Participant avatars */}
        <div className="flex items-center -space-x-1.5">
          {participants.map((p) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ring-2 ring-[#1a2744]"
              style={{ backgroundColor: p.color }}
              title={p.name + (p.id === myId ? ' (you)' : '')}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>

        {/* Participant names */}
        <span className="text-[#94a3b8] hidden sm:block truncate max-w-[140px]">
          {participants.map((p) => p.id === myId ? `${p.name} (you)` : p.name).join(', ')}
        </span>

        {/* Lock status / turn indicator */}
        <div className="flex items-center gap-1.5 ml-1">
          {hasLock ? (
            <>
              <span className="text-emerald-400 font-medium">Your turn</span>
              <button
                onClick={handleReleaseLock}
                className="px-2 py-0.5 rounded text-xs bg-[#263349] hover:bg-[#334155] text-[#f8fafc] transition-colors"
              >
                Done
              </button>
            </>
          ) : lockHolder ? (
            <span className="text-[#94a3b8]">
              <span className="font-medium" style={{ color: participants.find((p) => p.id === lockHolder)?.color }}>
                {lockHolderName}
              </span>
              {' '}is typing…
            </span>
          ) : (
            <button
              onClick={handleRequestLock}
              disabled={requesting || !isConnected}
              className="px-2.5 py-0.5 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {requesting ? 'Requesting…' : 'Request turn'}
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Invite link */}
        {inviteUrl && (
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#263349] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
            title="Copy invite link"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 3H6a3 3 0 000 6h1m-1 4h4a3 3 0 000-6h-1" />
              </svg>
            )}
            {copied ? 'Copied!' : 'Invite'}
          </button>
        )}

        {/* Room settings gear (host only) */}
        {isHost && (
          <button
            onClick={() => setShowRoomSettings(!showRoomSettings)}
            className={`p-1 rounded transition-colors ${showRoomSettings ? 'text-white bg-[#334155]' : 'text-[#94a3b8] hover:text-white hover:bg-[#263349]'}`}
            title="Room settings"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 10a2 2 0 100-4 2 2 0 000 4z"/>
              <path d="M13.3 6.7l-.9-.5a5 5 0 000-1.4l.9-.5a1 1 0 00.4-1.4l-.5-.8a1 1 0 00-1.4-.4l-.9.5a5 5 0 00-1.2-.7V1a1 1 0 00-1-1H7a1 1 0 00-1 1v1.1a5 5 0 00-1.2.7l-.9-.5a1 1 0 00-1.4.4l-.5.8a1 1 0 00.4 1.4l.9.5a5 5 0 000 1.4l-.9.5a1 1 0 00-.4 1.4l.5.8a1 1 0 001.4.4l.9-.5a5 5 0 001.2.7V15a1 1 0 001 1h1a1 1 0 001-1v-1.1a5 5 0 001.2-.7l.9.5a1 1 0 001.4-.4l.5-.8a1 1 0 00-.4-1.4z"/>
            </svg>
          </button>
        )}

        {/* Leave */}
        <button
          onClick={handleLeave}
          className="px-2 py-0.5 rounded text-xs bg-[#263349] hover:bg-red-900/40 text-[#94a3b8] hover:text-red-400 transition-colors"
          title="Leave room"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
