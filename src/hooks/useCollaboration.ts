/**
 * useCollaboration — subscribes to room events from the main process,
 * updates collaborationStore, and bridges stream events to conversationStore.
 *
 * Mount this once in the App root when window.api.collab is available.
 */

import { useEffect } from 'react';
import type { CollabServerEvent, Message } from '../types';
import { useCollaborationStore } from '../stores/collaborationStore';
import { useConversationStore } from '../stores/conversationStore';

export function useCollaboration(activeConversationId: string | null, enabled = false) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || !window.api?.collab) return;

    const unsubEvents = window.api.collab.onEvent((rawEvent: unknown) => {
      const event = rawEvent as CollabServerEvent;
      const collabStore = useCollaborationStore.getState();
      const convStore = useConversationStore.getState();

      // Always route to the conversation the room was started from, not the currently active one
      const targetConversationId = collabStore.conversationId ?? activeConversationId;

      collabStore.handleEvent(event, (msgEvent) => {
        if (!targetConversationId) return;

        switch (msgEvent.type) {
          case 'message_add':
            convStore.addMessage(targetConversationId, msgEvent.message as Message);
            break;

          case 'stream_start': {
            const placeholder: Message = {
              id: msgEvent.messageId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
            };
            convStore.addMessage(targetConversationId, placeholder);
            break;
          }

          case 'stream_chunk':
            convStore.appendToMessage(targetConversationId, msgEvent.messageId, msgEvent.delta);
            break;

          case 'stream_end':
            convStore.updateMessage(targetConversationId, msgEvent.messageId, {
              ...(msgEvent.message as Message),
              isStreaming: false,
            });
            break;
        }
      });
    });

    // Handle deep-link join invites: openconduit://join?roomId=…
    // Don't auto-join — show JoinRoomModal so user can pick a name first.
    const unsubInvite = window.api.collab.onInvite?.((roomId: string) => {
      const collabStore = useCollaborationStore.getState();
      if (collabStore.roomId === roomId) return;
      collabStore.setPendingInvite(roomId);
    }) ?? (() => undefined);

    return () => { unsubEvents(); unsubInvite(); };
  }, [activeConversationId, enabled]);
}
