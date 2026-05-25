import React, { useEffect } from 'react';
import WelcomeScreen from './WelcomeScreen';
import MessageList from './MessageList';
import InputBar from './InputBar';
import SystemPromptEditor from './SystemPromptEditor';
import ParameterControls from './ParameterControls';
import ContextWarningBanner from './ContextWarningBanner';
import { CollaborationBar } from './CollaborationBar';
import { JoinRoomModal } from './JoinRoomModal';
import { SidePanel } from './SidePanel';
import { useChat } from '../hooks/useChat';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useCollaborationStore } from '../stores/collaborationStore';

interface Props {
  conversationId: string | null;
}

export default function ChatArea({ conversationId }: Props) {
  const { conversation, isStreaming, isCompacting, sendMessage, abortStream, approveToolCall, sendAnswers, compactContext, trimOldMessages } = useChat(conversationId);
  const { settings } = useSettingsStore();
  const { clearMessages } = useConversationStore();
  const { activeConversationId, showConversationSettings, setShowConversationSettings, setShowSystemPrompt, setShowParameters, showRoomSettings, setShowRoomSettings } = useUiStore();
  const collabConversationId = useCollaborationStore((s) => s.conversationId);
  const aiMode = useCollaborationStore((s) => s.aiMode);
  const participants = useCollaborationStore((s) => s.participants);
  const myId = useCollaborationStore((s) => s.myId);
  const isSharedChat = !!conversationId && conversationId === collabConversationId;

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
    return (
      <>
        <JoinRoomModal />
        <WelcomeScreen />
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-900 relative">
      <JoinRoomModal />
      {isSharedChat && <CollaborationBar />}
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
        <SidePanel title="Conversation Settings" onClose={() => setShowConversationSettings(false)}>
          <SystemPromptEditor conversationId={conversationId} />
          <ParameterControls
            conversationId={conversationId}
            defaultParams={settings?.defaultParameters ?? { temperature: 0.7, topP: 1, maxTokens: 4096 }}
          />
        </SidePanel>
      )}

      {/* Room Settings side panel (host only, shown when gear is clicked) */}
      {showRoomSettings && isSharedChat && (
        <SidePanel title="Room Settings" onClose={() => setShowRoomSettings(false)}>
          <RoomSettingsContent
            aiMode={aiMode}
            participants={participants}
            myId={myId}
            onSetAiMode={(mode) => {
              useCollaborationStore.getState().setAiMode(mode);
              window.api?.collab?.send({ type: 'set_ai_mode', mode });
            }}
          />
        </SidePanel>
      )}
    </div>
  );
}

// ── Room Settings panel content ────────────────────────────────────────────────

interface RoomSettingsContentProps {
  aiMode: 'own' | 'host';
  participants: Array<{ id: string; name: string; color: string }>;
  myId: string | null;
  onSetAiMode: (mode: 'own' | 'host') => void;
}

function RoomSettingsContent({ aiMode, participants, myId, onSetAiMode }: RoomSettingsContentProps) {
  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* AI mode */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">AI Model</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSetAiMode('own')}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
              aiMode === 'own'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Each uses own model
            <span className={`block text-xs mt-0.5 font-normal ${aiMode === 'own' ? 'text-blue-200' : 'text-slate-500'}`}>
              Every participant calls AI with their own API key
            </span>
          </button>
          <button
            onClick={() => onSetAiMode('host')}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
              aiMode === 'host'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Host relays AI
            <span className={`block text-xs mt-0.5 font-normal ${aiMode === 'host' ? 'text-blue-200' : 'text-slate-500'}`}>
              All AI calls run on the host's machine — guests need no API key
            </span>
          </button>
        </div>
      </div>

      {/* Participants */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Participants ({participants.length})
        </p>
        <div className="flex flex-col gap-1.5">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 py-1">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-slate-200">
                {p.name}
                {p.id === myId && <span className="text-slate-500 ml-1.5 text-xs">(you)</span>}
              </span>
            </div>
          ))}
          {participants.length === 0 && (
            <p className="text-xs text-slate-500">No participants yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
