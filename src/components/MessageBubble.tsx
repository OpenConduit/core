import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, AiQuestion } from '../types';
import type { MessageDecorator } from '../extensions/messageDecoratorRegistry';
import ToolCallCard from './ToolCallCard';
import QuestionsCard from './QuestionsCard';
import ArtifactBlock from './ArtifactBlock';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';

interface Props {
  message: Message;
  messageIndex?: number;
  conversationId?: string;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
  onSendAnswers?: (questions: AiQuestion[], answers: Record<string, string>) => void;
  /** Extension-contributed decorators rendered below each message bubble. */
  decorators?: MessageDecorator[];
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const MessageBubble = memo(function MessageBubble({ message, messageIndex, conversationId, onApprove, onDeny, onSendAnswers, decorators }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  // Activity panel: thinking + tool calls unified
  const toolCount = message.toolCalls?.length ?? 0;
  const hasActivity = isAssistant && (!!message.thinking || toolCount > 0);
  const hasPendingTools = message.toolCalls?.some((tc) => tc.pending) ?? false;
  const [activityOpen, setActivityOpen] = useState(!!message.isStreaming || hasPendingTools);
  const wasStreamingRef = React.useRef(message.isStreaming);
  React.useEffect(() => {
    if (wasStreamingRef.current && !message.isStreaming) {
      if (!hasPendingTools) setActivityOpen(false);
      wasStreamingRef.current = false;
    }
  }, [message.isStreaming, hasPendingTools]);
  React.useEffect(() => {
    if (hasPendingTools) setActivityOpen(true);
  }, [hasPendingTools]);

  const totalToolMs = message.toolCalls?.reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0) ?? 0;
  const activityLabel = message.isStreaming
    ? 'Working…'
    : toolCount > 0
      ? totalToolMs > 0
        ? `Worked for ${formatDuration(totalToolMs)}${toolCount > 1 ? ` · ${toolCount} tools` : ''}`
        : `Used ${toolCount} tool${toolCount > 1 ? 's' : ''}`
      : 'Thinking';

  const effectiveActivityOpen = activityOpen || hasPendingTools;

  const [branched, setBranched] = useState(false);
  const debugMode = useSettingsStore((s) => s.settings?.labs?.debugMode ?? false);
  const { branchConversation, openTab } = useConversationStore();
  const { setActiveConversation } = useUiStore();

  function handleBranch() {
    if (!conversationId || messageIndex === undefined) return;
    const branch = branchConversation(conversationId, messageIndex);
    openTab?.(branch.id);
    setActiveConversation(branch.id);
    setBranched(true);
    setTimeout(() => setBranched(false), 2000);
  }

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadRaw() {
    const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${message.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} px-4 py-1.5`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white mr-2.5 mt-0.5 flex-shrink-0">
          AI
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Activity panel: thinking + tool calls unified */}
        {hasActivity && (
          <div className="w-full mb-2">
            {/* Toggle row */}
            <button
              onClick={() => setActivityOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors select-none mb-1"
            >
              {message.isStreaming ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              ) : (
                <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{activityLabel}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${effectiveActivityOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Expanded content */}
            {effectiveActivityOpen && (
              <div className="pl-3 border-l border-slate-700/40 space-y-1">
                {/* Extended thinking */}
                {message.thinking && (
                  <div className="text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 rounded px-2.5 py-2 max-h-52 overflow-y-auto">
                    {message.thinking}
                  </div>
                )}
                {/* Tool calls */}
                {message.toolCalls?.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} onApprove={onApprove} onDeny={onDeny} />
                ))}
              </div>
            )}
          </div>
        )}
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'
          }`}
        >
          {/* Attachments */}
          {message.attachments?.map((att) => (
            <div key={att.id} className="mb-2">
              {att.mimeType.startsWith('image/') ? (
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.name}
                  className="max-w-full max-h-64 rounded-lg"
                />
              ) : (
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {att.name}
                </div>
              )}
            </div>
          ))}

          {/* Content */}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-ai">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className ?? '');
                    const codeStr = String(children).replace(/\n$/, '');
                    if (match) {
                      return (
                        <ArtifactBlock
                          language={match[1]}
                          code={codeStr}
                          conversationId={conversationId}
                        />
                      );
                    }
                    return (
                      <code className="bg-slate-700 text-pink-300 px-1.5 py-0.5 rounded text-[12px] font-mono">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && !message.toolCalls?.length && (
            <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 rounded-sm align-middle" />
          )}
        </div>

        {/* AI clarifying questions */}
        {message.aiQuestions?.length && onSendAnswers && (
          <div className="w-full">
            <QuestionsCard
              questions={message.aiQuestions}
              onSubmit={(answers) => onSendAnswers(message.aiQuestions!, answers)}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-1 px-1">
          {message.model && (
            <span className="text-[10px] text-slate-500">{message.model}</span>
          )}
          {/* Routing indicator */}
          {isAssistant && message.routingDecision &&
            (message.routingDecision.finalModel !== message.routingDecision.originalModel ||
              message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId) && (
            <span className="relative group cursor-help flex items-center gap-1">
              <span className="text-[10px] text-slate-600">·</span>
              <span className="text-[10px] text-slate-600">
                c{message.routingDecision.complexity}
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                <span className="block font-medium text-slate-200 mb-0.5">{message.routingDecision.reason}</span>
                <span className="text-slate-400">task · {message.routingDecision.taskType}</span>
              </span>
            </span>
          )}
          <span className="text-[10px] text-slate-600">
            {(() => {
              const d = new Date(message.timestamp);
              const now = new Date();
              const isToday =
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate();
              return isToday
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                    ' ' +
                    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}
          </span>
          {isAssistant && message.usage && (
            <span className="text-[10px] text-slate-600" title={`${message.usage.inputTokens.toLocaleString()} in / ${message.usage.outputTokens.toLocaleString()} out`}>
              {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} tok
            </span>
          )}
          {isAssistant && !message.isStreaming && (
            <button
              onClick={handleCopy}
              title="Copy message"
              className="ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5"
            >
              {copied ? (
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          {conversationId && messageIndex !== undefined && !message.isStreaming && (
            <button
              onClick={handleBranch}
              title="Branch conversation here"
              className="ml-1 text-[10px] text-slate-600 hover:text-green-400 transition-colors flex items-center gap-0.5"
            >
              {branched ? (
                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12m0 0a3 3 0 106 0m-6 0a3 3 0 006 0m0 0V9m0 0a3 3 0 106 0 3 3 0 00-6 0" />
                </svg>
              )}
            </button>
          )}
          {debugMode && isAssistant && (
            <button
              onClick={downloadRaw}
              title="Download raw message JSON"
              className="ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              raw
            </button>
          )}
        </div>

        {/* Routing debug panel — only when Labs › Debug Mode is on */}
        {debugMode && isAssistant && message.routingDecision && (
          <div className="mt-1.5 mx-1 rounded border border-blue-700/30 bg-blue-950/20 px-2.5 py-1.5 text-[10px] text-slate-400 font-mono space-y-0.5">
            <div className="text-blue-400/70 font-sans font-semibold tracking-wide mb-1">routing debug</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>
                <span className="text-slate-500">complexity </span>
                <span className={
                  message.routingDecision.complexity === 3 ? 'text-red-400' :
                  message.routingDecision.complexity === 2 ? 'text-yellow-400' :
                  'text-green-400'
                }>{message.routingDecision.complexity}</span>
              </span>
              <span>
                <span className="text-slate-500">task </span>
                <span className="text-slate-300">{message.routingDecision.taskType}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500">original </span>
              <span className="text-slate-300">{message.routingDecision.originalProviderId} / {message.routingDecision.originalModel}</span>
            </div>
            <div>
              <span className="text-slate-500">final    </span>
              <span className={
                message.routingDecision.finalModel !== message.routingDecision.originalModel ||
                message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId
                  ? 'text-blue-300' : 'text-slate-300'
              }>{message.routingDecision.finalProviderId} / {message.routingDecision.finalModel}</span>
            </div>
            <div>
              <span className="text-slate-500">reason   </span>
              <span className="text-slate-300">{message.routingDecision.reason}</span>
            </div>
          </div>
        )}

        {/* Extension-contributed decorators */}
        {decorators && decorators.length > 0 && (
          <div className="w-full mt-1 space-y-1">
            {decorators.map((d, i) => {
              const node = d(message);
              return node ? <React.Fragment key={i}>{node}</React.Fragment> : null;
            })}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 ml-2.5 mt-0.5 flex-shrink-0">
          U
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
