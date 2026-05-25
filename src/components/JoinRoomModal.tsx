/**
 * JoinRoomModal — shown when a deep-link room invite arrives.
 * Lets the user pick a display name and colour before joining.
 */

import React, { useState } from 'react';
import { useCollaborationStore } from '../stores/collaborationStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';

const PALETTE = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#84CC16',
];

export function JoinRoomModal() {
  const { pendingInviteRoomId, clearPendingInvite, setRoom } = useCollaborationStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingInviteRoomId) return null;
  const roomId = pendingInviteRoomId;

  const handleJoin = async () => {
    if (joining) return;
    setError(null);
    const displayName = name.trim() || 'Guest';
    setJoining(true);

    try {
      const { conversations, folders, createFolder, addConversation, openTab, updateConversation } =
        useConversationStore.getState();
      const uiStore = useUiStore.getState();

      // Find an existing conversation tied to this room, or create a new one.
      let targetConv = conversations.find((c) => c.liveRoomId === roomId) ?? null;
      if (!targetConv) {
        let sharedFolder = folders.find((f) => f.name === 'Shared' && f.parentId === null);
        if (!sharedFolder) sharedFolder = createFolder('Shared');
        targetConv = addConversation({
          title: `${displayName}'s room`,
          folderId: sharedFolder.id,
          liveRoomId: roomId,
        });
      } else if (!targetConv.liveRoomId) {
        updateConversation(targetConv.id, { liveRoomId: roomId });
      }

      openTab(targetConv.id);
      uiStore.setActiveConversation(targetConv.id);

      await window.api!.collab!.join(roomId, displayName, color);
      setRoom(roomId, `https://share.openconduit.ai/rooms/${roomId}`, targetConv.id);
      clearPendingInvite();
    } catch {
      setError('Could not connect to the room. Check your network and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-80 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-slate-100">Join live room</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pick a name other participants will see.
          </p>
        </div>

        {/* Name input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Guest"
            maxLength={32}
            autoFocus
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Colour picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  color === c
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => clearPendingInvite()}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}
