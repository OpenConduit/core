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

/** Resolves when the stream for `messageId` ends; rejects on error. */
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

/** Build the system prompt for a discussion-round turn. */
function buildDiscussionPrompt(personaSystemPrompt: string | undefined, baseSystemPrompt: string | undefined): string {
  const discussion =
    "You are participating in a multi-persona discussion. The other personas have just responded " +
    "to the user's message — their replies are now visible in the conversation above. " +
    "Read their perspectives and add your own reaction: agree, disagree, build on their points, " +
    "or offer a new angle. Keep your response focused and concise.";
  return [personaSystemPrompt, baseSystemPrompt, discussion].filter(Boolean).join('\n\n');
}

/** Send one persona turn and wait for the stream to finish. */
async function sendPersonaTurn(
  conversationId: string,
  persona: Persona,
  request: ChatRequest,
  setIsStreaming: (v: boolean) => void,
  isDiscussionRound = false,
): Promise<void> {
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

  const systemPrompt = isDiscussionRound
    ? buildDiscussionPrompt(persona.systemPrompt, request.systemPrompt)
    : (persona.systemPrompt || request.systemPrompt);

  const personaRequest: ChatRequest = {
    ...request,
    messageId,
    providerId: persona.defaultProviderId ?? request.providerId,
    model: persona.defaultModel ?? request.model,
    parameters: { ...request.parameters, ...(persona.parameters ?? {}) },
    systemPrompt,
  };

  const streamDone = waitForStream(messageId);
  setIsStreaming(true);
  await service.chat.send(personaRequest);
  await streamDone;
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

  // ── Round 1: each persona responds to the user's message ─────────────────
  for (const persona of personas) {
    await sendPersonaTurn(conversationId, persona, request, setIsStreaming);
  }

  // ── Round 2 (discussion): each persona reacts to the others' responses ───
  if (conv?.panelDiscussionMode) {
    const freshConv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === conversationId);
    if (!freshConv) return;

    // Build updated message history that includes all round-1 responses
    const allMessages = freshConv.messages.filter(
      (m) => m.role !== 'assistant' || !!(m.content || m.toolCalls?.length),
    );

    for (const persona of personas) {
      const discussionRequest: ChatRequest = { ...request, messages: allMessages };
      await sendPersonaTurn(conversationId, persona, discussionRequest, setIsStreaming, true);
    }
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

