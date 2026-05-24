import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { extensionRegistry } from '../../extensionRegistry';
import { useConversationStore } from '../../../stores/conversationStore';
import { useUiStore } from '../../../stores/uiStore';
import { usePersonasStore } from '../personas/personasStore';
import { service } from '../../../services';
import type { ChatRequest, Persona, StreamEnd, StreamError } from '../../../types';
import type { SendContext } from '../../types';
import MultiPersonaPanel from './MultiPersonaPanel';

const MODE_ID = 'multiPersona';

const MULTI_PERSONA_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

/**
 * Returns a Promise that resolves when the stream for `messageId` ends,
 * or rejects if a stream error is received for that message.
 */
function waitForStream(messageId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const unsubEnd = service.chat.onEnd((data: StreamEnd) => {
      if (data.messageId === messageId) {
        unsubEnd();
        unsubErr();
        resolve();
      }
    });
    const unsubErr = service.chat.onError((data: StreamError) => {
      if (data.messageId === messageId) {
        unsubEnd();
        unsubErr();
        reject(new Error(data.error));
      }
    });
  });
}

async function onSend({ conversationId, request }: SendContext): Promise<void> {
  const { setIsStreaming } = useUiStore.getState();
  const conv = useConversationStore
    .getState()
    .conversations.find((c) => c.id === conversationId);

  const personas: Persona[] = (conv?.panelPersonaIds ?? [])
    .map((id) => usePersonasStore.getState().getPersona(id))
    .filter((p): p is Persona => !!p);

  if (personas.length === 0) return;

  for (const persona of personas) {
    const messageId = uuidv4();

    useConversationStore.getState().addMessage(conversationId, {
      id: messageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
      model: persona.defaultModel ?? request.model,
      providerId: persona.defaultProviderId ?? request.providerId,
      personaId: persona.id,
    });

    const personaRequest: ChatRequest = {
      ...request,
      messageId,
      providerId: persona.defaultProviderId ?? request.providerId,
      model: persona.defaultModel ?? request.model,
      parameters: { ...request.parameters, ...(persona.parameters ?? {}) },
      systemPrompt: persona.systemPrompt || request.systemPrompt,
    };

    const streamDone = waitForStream(messageId);
    setIsStreaming(true);
    await service.chat.send(personaRequest);
    await streamDone;
  }
}

extensionRegistry.registerExtension(
  {
    id: 'openconduit.multiPersona',
    name: 'Multi-Persona Panel',
    version: '1.0.0',
    description: 'Run multiple personas in one conversation, each responding to the same messages.',
    author: 'OpenConduit',
  },
  {
    activityBarItems: [
      {
        panelId: 'multiPersona',
        label: 'Multi-Persona',
        icon: MULTI_PERSONA_ICON,
        panel: MultiPersonaPanel,
        order: 30,
      },
    ],
    conversationModes: [
      {
        id: MODE_ID,
        label: 'Multi-Persona Panel',
        icon: () => MULTI_PERSONA_ICON,
        onSend,
      },
    ],
  }
);
