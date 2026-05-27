import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, AiQuestion } from '../types';
import type { MessageDecorator } from '../extensions/messageDecoratorRegistry';
import type { MessageBadgeContribution } from '../extensions/types';
import ToolCallCard from './ToolCallCard';
import QuestionsCard from './QuestionsCard';
import ArtifactBlock from './ArtifactBlock';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { usePersonasStore } from '../stores/personasStore';

interface Props {
  message: Message;
  messageIndex?: number;
  conversationId?: string;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
  onSendAnswers?: (questions: AiQuestion[], answers: Record<string, string>) => void;
  /** Called when the user wants to edit a user message — populates the input bar. */
  onStartEdit?: (messageId: string, content: string) => void;
  /** Extension-contributed decorators rendered below each message bubble. */
  decorators?: MessageDecorator[];
  /** Extension-contributed badges rendered in the message metadata row. */
  badges?: MessageBadgeContribution[];
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const MessageBubble = memo(function MessageBubble({ message, messageIndex, conversationId, onApprove, onDeny, onSendAnswers, onStartEdit, decorators, badges }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  // Thinking section: collapsible, like ChatWise "Thought for Xs ▼"
  const hasThinking = isAssistant && !!message.thinking;
  const [thinkingOpen, setThinkingOpen] = useState(!!message.isStreaming);
  const wasStreamingRef = React.useRef(message.isStreaming);
  React.useEffect(() => {
    if (wasStreamingRef.current && !message.isStreaming) {
      setThinkingOpen(false);
      wasStreamingRef.current = false;
    }
  }, [message.isStreaming]);

  // Inline tool rendering: group by iteration using contentSegments
  const toolCalls = message.toolCalls ?? [];
  const contentSegments = message.contentSegments;
  // hasInlineTools: true when we have the segment data to render tools inline (new messages)
  const hasInlineTools = isAssistant && toolCalls.length > 0 && contentSegments !== undefined;
  // finalContent = text streamed after the last tool call batch
  const segmentsTotalLength = contentSegments
    ? contentSegments.reduce((sum, s) => sum + s.length, 0)
    : 0;
  const finalContent = hasInlineTools ? message.content.slice(segmentsTotalLength) : message.content;

  // Backwards-compat: old messages with tool calls but no contentSegments
  const hasLegacyTools = isAssistant && toolCalls.length > 0 && contentSegments === undefined;
  const hasPendingTools = toolCalls.some((tc) => tc.pending);
  // Keep legacy activity panel open while there are pending tool approvals
  const [legacyActivityOpen, setLegacyActivityOpen] = useState(hasPendingTools);
  React.useEffect(() => {
    if (hasPendingTools) setLegacyActivityOpen(true);
  }, [hasPendingTools]);

  const totalToolMs = toolCalls.reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0);

  const [branched, setBranched] = useState(false);
  const debugMode = useSettingsStore((s) => s.settings?.labs?.debugMode ?? false);
  const { branchConversation, openTab } = useConversationStore();
  const { setActiveConversation } = useUiStore();
  const getPersona = usePersonasStore((s) => s.getPersona);
  const panelPersona = message.personaId ? getPersona(message.personaId) : undefined;

  // Shared ReactMarkdown component overrides
  const mdComponents = React.useMemo(() => ({
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className ?? '');
      const codeStr = String(children).replace(/\n$/, '');
      if (match) {
        return <ArtifactBlock language={match[1]} code={codeStr} conversationId={conversationId} />;
      }
      return (
        <code className="bg-slate-700 text-pink-300 px-1.5 py-0.5 rounded text-[12px] font-mono">
          {children}
        </code>
      );
    },
    img({ src, alt }: { src?: string; alt?: string }) {
      if (!src) return null;
      const isExternal = src.startsWith('http://') || src.startsWith('https://');
      if (isExternal) {
        return (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline text-sm"
            onClick={(e) => {
              e.preventDefault();
              window.api?.updater?.openExternal(src);
            }}
          >
            🖼 {alt || 'Image'}
          </a>
        );
      }
      return <img src={src} alt={alt ?? ''} className="max-w-full rounded-lg" />;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [conversationId]);

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
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mr-2.5 mt-0.5 flex-shrink-0"
          style={{ backgroundColor: panelPersona?.color ?? '#2563eb' }}
          title={panelPersona?.name}
        >
          {panelPersona ? panelPersona.name.slice(0, 2).toUpperCase() : 'AI'}
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Persona label in panel mode */}
        {panelPersona && (
          <span
            className="text-[11px] font-semibold mb-0.5 px-1"
            style={{ color: panelPersona.color ?? '#94a3b8' }}
          >
            {panelPersona.name}
          </span>
        )}

        {/* ── Thinking section (ChatWise-style: "Thinking…" / "Thought ▼") ── */}
        {hasThinking && (
          <div className="w-full mb-1.5">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors select-none"
            >
              {message.isStreaming ? (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              ) : (
                <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
              <span>{message.isStreaming ? 'Thinking…' : 'Thought'}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${thinkingOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {thinkingOpen && (
              <div className="mt-1 pl-3 border-l border-slate-700/40">
                <div className="text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 rounded px-2.5 py-2 max-h-52 overflow-y-auto">
                  {message.thinking}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Legacy activity panel (old messages without contentSegments) ── */}
        {hasLegacyTools && (
          <div className="w-full mb-2">
            <button
              onClick={() => setLegacyActivityOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors select-none mb-1"
            >
              {message.isStreaming ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              ) : (
                <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>
                {message.isStreaming
                  ? 'Working…'
                  : totalToolMs > 0
                    ? `Worked for ${formatDuration(totalToolMs)} · ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}`
                    : `Used ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}`}
              </span>
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${legacyActivityOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {(legacyActivityOpen || hasPendingTools) && (
              <div className="pl-3 border-l border-slate-700/40 space-y-1">
                {toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} onApprove={onApprove} onDeny={onDeny} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bubble ── */}
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
          ) : hasInlineTools ? (
            // ── ChatWise-style: interleaved text segments + tool cards at the right spot ──
            <div className="prose-ai space-y-2">
              {contentSegments!.map((segment, i) => (
                <React.Fragment key={i}>
                  {segment.trim() && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {segment}
                    </ReactMarkdown>
                  )}
                  {/* Inline tool call cards for this iteration */}
                  <div className="space-y-1 my-1.5">
                    {toolCalls
                      .filter((tc) => (tc.iteration ?? 0) === i)
                      .map((tc) => (
                        <ToolCallCard key={tc.id} toolCall={tc} onApprove={onApprove} onDeny={onDeny} />
                      ))}
                  </div>
                </React.Fragment>
              ))}
              {/* Final content after last tool call batch */}
              {(finalContent.trim() || message.isStreaming) && (
                <div>
                  {finalContent.trim() && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {finalContent}
                    </ReactMarkdown>
                  )}
                  {message.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 rounded-sm align-middle" />
                  )}
                </div>
              )}
            </div>
          ) : (
            // ── Standard render: no tool calls or legacy ──
            <div className="prose-ai">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && !toolCalls.length && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 rounded-sm align-middle" />
              )}
            </div>
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
          {isUser && !message.isStreaming && (
            <button
              onClick={() => onStartEdit?.(message.id, message.content)}
              title="Edit message"
              className="ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
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

        {/* Extension-contributed message badges */}
        {badges && badges.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {badges.map((badge) => {
              const result = badge.render(message);
              if (!result) return null;
              return (
                <span
                  key={badge.id}
                  title={typeof result.count === 'number' ? String(result.count) : undefined}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]"
                >
                  {result.content}
                  {result.count > 0 && (
                    <span className="text-slate-400">{result.count}</span>
                  )}
                </span>
              );
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
