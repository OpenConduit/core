import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BackgroundAssistantPanel from './BackgroundAssistantPanel';
import { useBackgroundAssistantStore } from './backgroundAssistantStore';
import { extensionRegistry } from '../../extensionRegistry';
import { messageDecoratorRegistry } from '../../messageDecoratorRegistry';
import { hookRegistry } from '../../../hooks/hookRegistry';
import { service } from '../../../services';
import { useConversationStore } from '../../../stores/conversationStore';
import { useUiStore } from '../../../stores/uiStore';
import type { Message } from '../../../types';

// ─── Icon ─────────────────────────────────────────────────────────────────────

const BACKGROUND_ASSISTANT_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

// ─── Per-message note card (decorator) ───────────────────────────────────────

function NoteDecoratorCard({ message }: { message: Message }) {
  const notes = useBackgroundAssistantStore((s) => s.notesByMessageId[message.id]) ?? [];
  const [open, setOpen] = React.useState(false);

  if (notes.length === 0) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-blue-500/20 bg-slate-900/70 overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800/60 transition-colors"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-medium text-blue-400">Background note</span>
        {notes.length > 1 && (
          <span className="text-xs text-slate-500">· {notes.length}</span>
        )}
        <svg
          className={`ml-auto w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-blue-500/10 prose-ai text-slate-200 text-sm leading-relaxed">
          {notes.map((n, i) => (
            <div key={n.id} className={i > 0 ? 'mt-4 pt-4 border-t border-slate-700/40' : ''}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.text}</ReactMarkdown>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Trigger-phrase flag ──────────────────────────────────────────────────────
// Set by beforeSend when the outgoing message matches the trigger phrase.
// Cleared after the next onResponse hook runs.

let _triggerPending = false;

// ─── Background completion helper ────────────────────────────────────────────

async function runBackgroundCompletion(assistantMessage: Message): Promise<void> {
  const { config, addNote, setRunning } = useBackgroundAssistantStore.getState();
  const activeId = useUiStore.getState().activeConversationId;
  if (!activeId) return;

  const conversation = useConversationStore
    .getState()
    .conversations.find((c) => c.id === activeId);
  if (!conversation) return;

  const settings = (await service.settings.get()) ?? null;
  const providerId = (config.providerId || settings?.defaultProviderId) ?? '';
  const model = (config.model || settings?.defaultModel) ?? '';
  if (!providerId || !model) return;

  const contextMessages = conversation.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  setRunning(true);
  try {
    const result = await service.chat.complete({
      providerId,
      model,
      systemPrompt: config.persona,
      messages: contextMessages,
    });
    if (result.text.trim()) {
      addNote(assistantMessage.id, {
        id: `${assistantMessage.id}-${Date.now()}`,
        text: result.text.trim(),
        createdAt: Date.now(),
      });
    }
  } finally {
    setRunning(false);
  }
}

// ─── Extension registration ───────────────────────────────────────────────────

extensionRegistry.registerExtension(
  {
    id: 'openconduit.backgroundAssistant',
    name: 'Background Assistant',
    version: '1.0.0',
    description:
      'A silent secondary assistant that observes conversations and surfaces fact-checks, ' +
      'counter-arguments, and synthesis on demand.',
    author: 'OpenConduit',

    activate(_api) {
      // ── beforeSend: detect trigger phrase for "onRequest" mode ──────────────
      hookRegistry.registerBeforeSend('openconduit.backgroundAssistant', (request) => {
        const { config } = useBackgroundAssistantStore.getState();
        if (!config.enabled || config.triggerMode !== 'onRequest') return request;
        const phrase = config.triggerPhrase.trim().toLowerCase();
        const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user');
        if (phrase && lastUserMsg?.content.toLowerCase().includes(phrase)) {
          _triggerPending = true;
        }
        return request;
      });

      // ── onResponse: run background call after each assistant message ─────────
      hookRegistry.registerOnResponse('openconduit.backgroundAssistant', async (msg: Message) => {
        if (msg.role !== 'assistant') return;
        const { config } = useBackgroundAssistantStore.getState();
        if (!config.enabled) return;

        const shouldRun =
          config.triggerMode === 'afterEachResponse' ||
          (config.triggerMode === 'onRequest' && _triggerPending);

        if (shouldRun) {
          _triggerPending = false;
          await runBackgroundCompletion(msg);
        }
      });

      // ── message decorator: collapsible note card below each assistant bubble ──
      messageDecoratorRegistry.register(
        'openconduit.backgroundAssistant',
        (msg: Message) =>
          msg.role === 'assistant' ? <NoteDecoratorCard message={msg} /> : null,
      );
    },
  },
  {
    activityBarItems: [
      {
        panelId: 'backgroundAssistant',
        label: 'Background Assistant',
        icon: BACKGROUND_ASSISTANT_ICON,
        panel: BackgroundAssistantPanel,
        order: 35,
      },
    ],

    stores: [
      {
        id: 'openconduit.backgroundAssistant.store',
        store: useBackgroundAssistantStore,
      },
    ],

    settingsTab: {
      id: 'background-assistant',
      label: 'Background Assistant',
      order: 44,
      sections: [
        {
          title: 'Background Assistant',
          description:
            'A silent secondary model that observes the conversation and can surface ' +
            'fact-checks, counter-arguments, or synthesis on demand.',
          properties: [
            {
              key: 'backgroundAssistant.enabled',
              title: 'Enable Background Assistant',
              type: 'boolean',
              description: 'Activate the background assistant for this session.',
              default: false,
              order: 1,
            },
            {
              key: 'backgroundAssistant.triggerMode',
              title: 'Trigger Mode',
              type: 'string',
              enum: ['onDemand', 'afterEachResponse', 'onRequest'],
              enumDescriptions: [
                'On demand — run manually from the side panel',
                'After each response — automatically analyse every assistant message',
                'On trigger phrase — run when the user message contains the trigger phrase',
              ],
              description: 'When to invoke the background assistant.',
              default: 'onDemand',
              order: 2,
            },
            {
              key: 'backgroundAssistant.triggerPhrase',
              title: 'Trigger Phrase',
              type: 'string',
              placeholder: '/verify',
              description:
                'Text that must appear in the user message to trigger analysis (used in "On trigger phrase" mode).',
              default: '/verify',
              order: 3,
            },
          ],
        },
        {
          title: 'Model',
          description: 'Provider and model used for background calls.',
          properties: [
            {
              key: 'backgroundAssistant.providerId',
              title: 'Provider',
              type: 'string',
              placeholder: 'Leave empty to use the app default provider',
              description: 'Provider id for background calls.',
              order: 1,
            },
            {
              key: 'backgroundAssistant.model',
              title: 'Model',
              type: 'string',
              placeholder: 'Leave empty to use the app default model',
              description: 'Model name for background calls.',
              order: 2,
            },
          ],
        },
        {
          title: 'Persona',
          description: 'System prompt sent to the background assistant.',
          properties: [
            {
              key: 'backgroundAssistant.persona',
              title: 'System Prompt',
              type: 'string',
              multiline: true,
              placeholder: 'You are a critical background assistant…',
              description: 'Instructions that define how the background assistant behaves.',
              default:
                'You are a critical background assistant. Your job is to review the ' +
                'assistant message above and identify any factual errors, unsupported ' +
                'claims, logical gaps, or opportunities to add useful context. Be concise ' +
                'and direct. If everything looks correct, say so briefly.',
              order: 1,
            },
          ],
        },
      ],
    },
  },
);
