import React from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';

export default function WelcomeScreen() {
  const { conversations, addConversation, openTab } = useConversationStore();
  const { setActiveConversation, setShowSettings } = useUiStore();
  const { settings } = useSettingsStore();

  const recent = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 7);

  const handleNew = () => {
    if (!settings) return;
    const conv = addConversation({
      providerId: settings.defaultProviderId,
      model: settings.defaultModel,
    });
    openTab?.(conv.id);
    setActiveConversation(conv.id);
  };

  const handleOpen = (id: string) => {
    openTab?.(id);
    setActiveConversation(id);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 min-h-0 select-none overflow-y-auto">
      <div className="flex flex-col items-center w-full max-w-2xl px-8 py-12">

        {/* Logo */}
        <div className="mb-6 opacity-[0.07]">
          <img
            src="/app-icon.png"
            alt=""
            className="w-36 h-36 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-slate-200 mb-1 tracking-tight">OpenConduit</h1>
        <p className="text-sm text-slate-500 mb-12">The AI Chat Interface You've Been Waiting For.</p>   

        {/* Two-column content grid */}
        <div className="w-full grid grid-cols-2 gap-12">

          {/* Start */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Start</p>
            <div className="space-y-0.5">
              <WelcomeItem
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
                label="New Conversation"
                hint="⌘T"
                onClick={handleNew}
              />
              <WelcomeItem
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                label="Open Settings"
                hint="⌘,"
                onClick={() => setShowSettings(true)}
              />
            </div>
          </div>

          {/* Recent */}
          {recent.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Recent</p>
              <div className="space-y-0.5">
                {recent.map((conv) => (
                  <WelcomeItem
                    key={conv.id}
                    icon={
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    }
                    label={conv.title ?? 'Conversation'}
                    onClick={() => handleOpen(conv.id)}
                    truncate
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface WelcomeItemProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  truncate?: boolean;
}

function WelcomeItem({ icon, label, hint, onClick, truncate }: WelcomeItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-800/60 transition-colors group text-left"
    >
      <span className="flex-shrink-0 text-slate-500 group-hover:text-slate-400 transition-colors">{icon}</span>
      <span className={truncate ? 'truncate flex-1' : 'flex-1'}>{label}</span>
      {hint && (
        <span className="flex-shrink-0 text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors ml-auto">{hint}</span>
      )}
    </button>
  );
}
