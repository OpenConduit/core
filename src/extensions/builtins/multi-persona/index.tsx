import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { extensionRegistry } from '../../extensionRegistry';
import { useConversationStore } from '../../../stores/conversationStore';
import { useUiStore } from '../../../stores/uiStore';
import { usePersonasStore } from '../personas/personasStore';
import { service } from '../../../services';
import type { ChatRequest, Message, Persona, StreamEnd, StreamError } from '../../../types';
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
    "You are participating in a multi-persona panel discussion. " +
    "The other panelists' initial responses are shown in the conversation. " +
    "React thoughtfully: agree, disagree, build on their points, or offer a new angle. " +
    "Keep your response focused and concise.";
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
    // Yield to the microtask queue so the store has fully written all round-1 content.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const freshConv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === conversationId);
    if (!freshConv) return;

    // Gather completed round-1 assistant responses.
    const round1Messages = freshConv.messages.filter(
      (m) => m.role === 'assistant' && m.content && m.personaId,
    );
    if (round1Messages.length === 0) return;

    // Collapse all round-1 responses into a SINGLE assistant message followed by
    // a user nudge. This produces a valid alternating user→assistant→user sequence
    // that every provider (Anthropic, OpenAI, etc.) accepts. Sending multiple
    // consecutive `role: 'assistant'` messages causes Anthropic to reject the
    // request, which is why round 2 previously produced empty messages.
    const round1Content = round1Messages
      .map((m) => {
        const p = usePersonasStore.getState().getPersona(m.personaId!);
        return `**${p?.name ?? 'Assistant'}**: ${m.content}`;
      })
      .join('\n\n');

    const discussionMessages: Message[] = [
      ...request.messages,
      {
        id: uuidv4(),
        role: 'assistant' as const,
        content: `Here are the initial responses from all panel members:\n\n${round1Content}`,
        timestamp: Date.now(),
      },
      {
        id: uuidv4(),
        role: 'user' as const,
        content: 'Please react to the above responses — agree, disagree, build on them, or offer a new angle.',
        timestamp: Date.now(),
      },
    ];

    for (const persona of personas) {
      const discussionRequest: ChatRequest = { ...request, messages: discussionMessages };
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

