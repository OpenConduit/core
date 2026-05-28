import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useConversationStore } from '../stores/conversationStore';
import { service } from '../services';

// ── helpers ─────────────────────────────────────────────────────────────────

function buildConversationContext(messages: { role: string; content: unknown }[]): string {
  return messages
    .slice(-30) // cap at last 30 messages to avoid huge payloads
    .map((m) => {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `[${m.role.toUpperCase()}]: ${text}`;
    })
    .join('\n\n');
}

// ── component ────────────────────────────────────────────────────────────────

export default function FeedbackModal() {
  const { feedbackModal, closeFeedbackModal } = useUiStore();
  const { conversations } = useConversationStore();

  // Step for bug reports when a conversation is available:
  // 'scope' — ask "in this chat or in general"
  // 'form'  — show the feedback form
  type Step = 'scope' | 'form';
  const [step, setStep] = useState<Step>('form');
  const [includeConversation, setIncludeConversation] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const modal = feedbackModal;

  // Reset form state when modal opens
  useEffect(() => {
    if (!modal) return;
    setTitle('');
    setDescription('');
    setState('idle');
    setError('');
    setIncludeConversation(false);

    if (modal.type === 'bug' && modal.conversationId) {
      setStep('scope');
    } else {
      setStep('form');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [modal]);

  // Focus title when form step is shown
  useEffect(() => {
    if (step === 'form') setTimeout(() => titleRef.current?.focus(), 50);
  }, [step]);

  if (!modal) return null;

  const conversation = conversations.find((c) => c.id === modal.conversationId);

  function handleScopeChoice(withChat: boolean) {
    setIncludeConversation(withChat);
    setStep('form');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    let fullDescription = description.trim();
    if (includeConversation && conversation?.messages?.length) {
      const ctx = buildConversationContext(conversation.messages as { role: string; content: unknown }[]);
      fullDescription = `${fullDescription}\n\n---\n**Conversation context:**\n\`\`\`\n${ctx}\n\`\`\``;
    }

    setState('loading');
    setError('');
    try {
      await service.updater.submitFeedback({
        type: modal.type,
        title: title.trim(),
        description: fullDescription,
      });
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }

  const isBug = modal.type === 'bug';
  const typeLabel = isBug ? 'Bug Report' : 'Feature Request';
  const typeEmoji = isBug ? '🐛' : '✨';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeFeedbackModal(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{typeEmoji} {typeLabel}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBug ? 'Opens a pre-filled GitHub issue in your browser.' : 'Tell us about a feature you would love to see.'}
            </p>
          </div>
          <button
            onClick={closeFeedbackModal}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none -mt-1 ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step: scope (bug-in-chat only) */}
        {step === 'scope' && (
          <div className="px-5 pb-5 flex flex-col gap-4">
            <p className="text-sm text-slate-300">Is this bug specific to <span className="font-medium text-slate-100">this conversation</span>, or a general issue?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleScopeChoice(true)}
                className="flex-1 flex flex-col gap-1 items-center px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500 transition-colors text-sm"
              >
                <span className="text-base">💬</span>
                <span className="font-medium text-slate-100">In this chat</span>
                <span className="text-[11px] text-slate-500 text-center">Attaches recent messages as context</span>
              </button>
              <button
                onClick={() => handleScopeChoice(false)}
                className="flex-1 flex flex-col gap-1 items-center px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500 transition-colors text-sm"
              >
                <span className="text-base">🌐</span>
                <span className="font-medium text-slate-100">In general</span>
                <span className="text-[11px] text-slate-500 text-center">Plain report, no chat context</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="px-5 pb-5 flex flex-col gap-3">
            {/* Context pill */}
            {includeConversation && (
              <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-950/40 border border-blue-800/40 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 5h12M2 8h8M2 11h5" />
                </svg>
                <span>Last 30 messages will be attached as context.</span>
                <button type="button" onClick={() => handleScopeChoice(false)} className="ml-auto text-blue-500 hover:text-blue-300">Remove</button>
              </div>
            )}

            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBug ? 'Short summary of the bug' : 'Short summary of the feature'}
              maxLength={120}
              required
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />

            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isBug
                  ? 'What happened? Steps to reproduce, expected vs. actual behaviour…'
                  : 'Describe the feature and why it would be useful…'
              }
              required
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />

            {state === 'success' ? (
              <div className="rounded-lg bg-green-950/40 border border-green-700/40 px-3 py-2.5 text-sm text-green-300 flex items-center gap-2">
                <span>✓</span>
                <span>Opening GitHub… finish submitting in your browser.</span>
                <button type="button" onClick={closeFeedbackModal} className="ml-auto text-xs text-green-500 hover:text-green-300">Close</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {state === 'error' && <p className="text-xs text-red-400 flex-1">{error}</p>}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={state === 'loading' || !title.trim() || !description.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state === 'loading' ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
