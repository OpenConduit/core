import React from 'react';
import WelcomeScreen from './WelcomeScreen';
import MessageList from './MessageList';
import InputBar from './InputBar';
import SystemPromptEditor from './SystemPromptEditor';
import ParameterControls from './ParameterControls';
import ContextWarningBanner from './ContextWarningBanner';
import { useChat } from '../hooks/useChat';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useEffect } from 'react';

interface Props {
  conversationId: string | null;
}

export default function ChatArea({ conversationId }: Props) {
  const { conversation, isStreaming, isCompacting, sendMessage, abortStream, approveToolCall, sendAnswers, compactContext, trimOldMessages } = useChat(conversationId);
  const { settings } = useSettingsStore();
  const { clearMessages } = useConversationStore();
  const { activeConversationId, showConversationSettings, setShowConversationSettings, setShowSystemPrompt, setShowParameters } = useUiStore();

  const handleClear = () => {
    if (activeConversationId) clearMessages(activeConversationId);
  };

  // Auto-expand both sections when the panel opens
  useEffect(() => {
    if (showConversationSettings) {
      setShowSystemPrompt(true);
      setShowParameters(true);
    }
  }, [showConversationSettings, setShowSystemPrompt, setShowParameters]);

  if (!conversationId) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-900 relative">
      <MessageList
        messages={conversation?.messages ?? []}
        conversationId={conversationId ?? undefined}
        onApprove={(id) => approveToolCall(id, true)}
        onDeny={(id) => approveToolCall(id, false)}
        onSendAnswers={sendAnswers}
      />

      {conversationId && (
        <ContextWarningBanner conversationId={conversationId} />
      )}

      <InputBar
        onSend={sendMessage}
        onAbort={abortStream}
        onClear={conversationId ? handleClear : undefined}
        onCompact={compactContext}
        onTrim={trimOldMessages}
        isStreaming={isStreaming}
        isCompacting={isCompacting}
        disabled={!conversationId}
        conversationId={conversationId}
      />

      {/* Conversation Settings side panel */}
      {showConversationSettings && conversationId && (
        <div
          className="absolute inset-0 z-40 flex items-stretch justify-end"
          onClick={() => setShowConversationSettings(false)}
        >
          <div
            className="w-80 flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
              <h2 className="text-sm font-semibold text-slate-100">Conversation Settings</h2>
              <button
                onClick={() => setShowConversationSettings(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-700"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SystemPromptEditor conversationId={conversationId} />
            <ParameterControls
              conversationId={conversationId}
              defaultParams={settings?.defaultParameters ?? { temperature: 0.7, topP: 1, maxTokens: 4096 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
