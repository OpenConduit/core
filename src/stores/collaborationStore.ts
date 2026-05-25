import { create } from 'zustand';
import type { CollabParticipant, CollabServerEvent, Message } from '../types';

// ─── Palette for auto-assigning participant colors ────────────────────────────
const PALETTE = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#84CC16',
];

export function nextPaletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface CollaborationState {
  /** null = not in a room */
  roomId: string | null;
  inviteUrl: string | null;
  /** The conversationId this room was started from — events always route here. */
  conversationId: string | null;
  participants: CollabParticipant[];
  /** participantId who currently holds the send lock */
  lockHolder: string | null;
  /** The participantId assigned to this local client by the server */
  myId: string | null;
  isConnected: boolean;
  /** True between join() and the first 'sync' event */
  isConnecting: boolean;
  /** Last connection error message, if any */
  connectionError: string | null;
  /** AI model routing mode for the room */
  aiMode: 'own' | 'host';
  /** participantId of the room host (first joiner / creator) */
  hostId: string | null;
  /** True when this client created the room (local fallback before server confirms hostId) */
  isLocalHost: boolean;
  /** Set when a deep-link invite arrives — shows JoinRoomModal before joining */
  pendingInviteRoomId: string | null;

  // ─── Actions ───────────────────────────────────────────────────────────────
  setRoom: (roomId: string, inviteUrl: string, conversationId: string, isLocalHost?: boolean) => void;
  clearRoom: () => void;
  setConnecting: (value: boolean) => void;
  /** Optimistically update aiMode locally (host-side, before server confirmation). */
  setAiMode: (mode: 'own' | 'host') => void;
  setPendingInvite: (roomId: string) => void;
  clearPendingInvite: () => void;
  handleEvent: (
    event: CollabServerEvent,
    /** Called by useCollaboration when message events arrive — updates the conversation store. */
    onMessage: (event: CollabServerEvent) => void,
  ) => void;
}

export const useCollaborationStore = create<CollaborationState>()((set, get) => ({
  roomId: null,
  inviteUrl: null,
  conversationId: null,
  participants: [],
  lockHolder: null,
  myId: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  aiMode: 'own',
  hostId: null,
  isLocalHost: false,
  pendingInviteRoomId: null,

  setRoom: (roomId, inviteUrl, conversationId, isLocalHost = false) => set({ roomId, inviteUrl, conversationId, isConnecting: true, connectionError: null, isLocalHost }),
  clearRoom: () => set({
    roomId: null,
    inviteUrl: null,
    conversationId: null,
    participants: [],
    lockHolder: null,
    myId: null,
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    aiMode: 'own',
    hostId: null,
    isLocalHost: false,
  }),
  setConnecting: (value) => set({ isConnecting: value }),
  setAiMode: (mode) => set({ aiMode: mode }),
  setPendingInvite: (roomId) => set({ pendingInviteRoomId: roomId }),
  clearPendingInvite: () => set({ pendingInviteRoomId: null }),

  handleEvent: (event, onMessage) => {
    switch (event.type) {
      case 'sync':
        set({
          participants: event.participants,
          lockHolder: event.lockHolder,
          myId: event.yourId,
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          aiMode: event.aiMode ?? 'own',
          hostId: event.hostId ?? null,
        });
        break;

      case 'settings_update':
        set({ aiMode: event.aiMode, hostId: event.hostId });
        break;

      case 'participant_joined':
        set((s) => ({ participants: [...s.participants, event.participant] }));
        break;

      case 'participant_left':
        set((s) => ({
          participants: s.participants.filter((p) => p.id !== event.participantId),
        }));
        break;

      case 'lock_granted':
        set({ lockHolder: event.participantId });
        break;

      case 'lock_released':
        set({ lockHolder: event.nextHolder });
        break;

      case 'lock_denied':
        // UI can read connectionError to show a brief toast
        break;

      case 'error':
        set({ connectionError: event.message, isConnected: false });
        break;

      // Delegate message/stream events to the caller (useCollaboration hook)
      case 'message_add':
      case 'stream_start':
      case 'stream_chunk':
      case 'stream_end':
      case 'typing':
        onMessage(event);
        break;
    }
  },
}));

/** Returns true if the local user currently holds the send lock. */
export function useHasLock(): boolean {
  const { myId, lockHolder } = useCollaborationStore();
  return !!myId && myId === lockHolder;
}

/** Returns true if the local user is the room host. */
export function useIsHost(): boolean {
  const { myId, hostId, isLocalHost } = useCollaborationStore();
  // isLocalHost: set immediately when this client created the room (before server confirms)
  // myId === hostId: confirmed by server after sync
  return isLocalHost || (!!myId && myId === hostId);
}

/** Returns the local participant's color from the participants list. */
export function useMyColor(): string {
  const { myId, participants } = useCollaborationStore();
  const me = participants.find((p) => p.id === myId);
  return me?.color ?? PALETTE[0];
}
