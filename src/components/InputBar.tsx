import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Attachment, FolderEntry, McpTool, ConversationFolder, ReasoningLevel } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { getContextLimit, fmtTok, computeTrimCount } from '../utils/context';
import { service } from '../services';
import PromptLibraryPanel from './PromptLibraryPanel';
import { slashCommandRegistry } from '../commands/slashCommandRegistry';
import type { SlashCommand, SlashCommandContext } from '../commands/slashCommandRegistry';

interface Props {
  onSend: (content: string, attachments?: Attachment[], folderContext?: { rootName: string; files: FolderEntry[] }, reasoning?: ReasoningLevel) => void;
  onAbort: () => void;
  onClear?: () => void;
  onCompact?: () => void;
  onTrim?: () => void;
  isStreaming: boolean;
  isCompacting?: boolean;
  disabled?: boolean;
  conversationId?: string | null;
  /** When set, the bar is in edit mode: the textarea is pre-filled and an indicator strip is shown. */
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  /** Preview text of a queued message waiting for the stream to end. */
  queuedPreview?: string | null;
  onCancelQueue?: () => void;
  /** Abort the current stream and immediately dispatch the queued message. */
  onSendQueueNow?: () => void;
  /** When true, the input bar is in BTW mode — submission goes to the BTW panel. */
  btwMode?: boolean;
  onCancelBtw?: () => void;
  onBtw?: (content: string) => void;
}

const ACCEPTED_TYPES = 'image/*,text/*,.pdf,.csv,.json,.md,.ts,.tsx,.js,.jsx,.py';

const REASONING_CYCLE: ReasoningLevel[] = ['off', 'low', 'medium', 'high'];
const REASONING_LABEL: Record<ReasoningLevel, string> = { off: 'off', low: 'L', medium: 'M', high: 'H' };
const REASONING_COLOR: Record<ReasoningLevel, string> = {
  off: 'text-slate-500',
  low: 'text-yellow-400',
  medium: 'text-orange-400',
  high: 'text-red-400',
};

export default function InputBar({ onSend, onAbort, onClear, onCompact, onTrim, isStreaming, isCompacting, disabled, conversationId, editingMessage, onCancelEdit, queuedPreview, onCancelQueue, onSendQueueNow, btwMode, onCancelBtw, onBtw }: Props) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningLevel>('off');
  const [mcpOpen, setMcpOpen] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toolsMap, setToolsMap] = useState<Record<string, McpTool[]>>({});
  const [loadingTools, setLoadingTools] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FolderEntry[] | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [trimConfirm, setTrimConfirm] = useState(false);
  const [slashMatches, setSlashMatches] = useState<SlashCommand[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPrefix, setSlashPrefix] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mcpRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<HTMLDivElement>(null);

  const { settings, mcpStatus, refreshMcpStatus, saveSettings } = useSettingsStore();
  const { setShowSettings, setSettingsInitialTab } = useUiStore();
  const updateConversation = useConversationStore((s) => s.updateConversation);

  // ── Context window usage ──────────────────────────────────────────────────
  const analyticsRecords = useAnalyticsStore((s) => s.records);
  const conversations = useConversationStore((s) => s.conversations);
  const activeConv = conversationId ? conversations.find((c) => c.id === conversationId) : null;
  const convModel = activeConv?.model ?? '';
  const convProviderId = activeConv?.providerId ?? '';
  // Provider-configured context window takes priority over built-in table
  const providerContextWindow = convProviderId
    ? settings?.providers?.find((p) => p.id === convProviderId)?.modelContextWindows?.[convModel] ?? null
    : null;
  const contextLimit = providerContextWindow ?? getContextLimit(convModel);
  // Use the most recent record's inputTokens as the context fill estimate.
  // Each record's inputTokens already includes the full conversation history sent
  // to the model, so summing all turns would wildly overstate usage.
  const convAnalyticsRecords = conversationId
    ? analyticsRecords.filter((r) => r.conversationId === conversationId)
    : [];
  const lastAnalyticsRecord = convAnalyticsRecords[convAnalyticsRecords.length - 1] ?? null;
  const usedTokens = lastAnalyticsRecord
    ? lastAnalyticsRecord.usage.inputTokens + lastAnalyticsRecord.usage.outputTokens
    : 0;
  const ctxPct = contextLimit && usedTokens > 0 ? Math.min((usedTokens / contextLimit) * 100, 100) : null;
  const showCtx = usedTokens > 0;

  // How many messages would be removed by "Trim oldest" — used for the confirm preview.
  const trimCount = useMemo(
    () => computeTrimCount(activeConv?.messages ?? [], contextLimit),
    [activeConv?.messages, contextLimit],
  );

  // folderPath is "inherited" when it comes from a chat-folder's agentFolderPath, not set on this conversation directly
  const folderIsInherited = !!folderPath && !activeConv?.folderPath;

  // Close MCP popover on outside click
  React.useEffect(() => {
    if (!mcpOpen) return;
    const handler = (e: MouseEvent) => {
      if (mcpRef.current && !mcpRef.current.contains(e.target as Node)) setMcpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mcpOpen]);

  // Close context popover on outside click; also reset trim confirm state on close
  React.useEffect(() => {
    if (!ctxOpen) { setTrimConfirm(false); return; }
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxOpen]);

  // Close command/prompt panel on outside click
  React.useEffect(() => {
    if (!cmdOpen) return;
    const handler = (e: MouseEvent) => {
      if (cmdRef.current && !cmdRef.current.contains(e.target as Node)) setCmdOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cmdOpen]);

  // Sync folderPath state with the active conversation's persisted path when switching conversations.
  // Falls back to the nearest ancestor ConversationFolder's agentFolderPath if none is set on the conversation.
  useEffect(() => {
    const { conversations, folders } = useConversationStore.getState();
    const conv = conversationId ? conversations.find((c) => c.id === conversationId) : null;

    // Resolve effective path: per-conversation → nearest folder ancestor with agentFolderPath
    let resolved: string | null = conv?.folderPath ?? null;
    if (!resolved && conv?.folderId) {
      let fid: string | null = conv.folderId;
      while (fid) {
        const f: ConversationFolder | undefined = folders.find((x) => x.id === fid);
        if (!f) break;
        if (f.agentFolderPath) { resolved = f.agentFolderPath; break; }
        fid = f.parentId;
      }
    }

    setFolderPath(resolved);
    setFolderFiles(null);
    if (resolved) {
      setFolderLoading(true);
      (service.folder?.readFiles(resolved) ?? Promise.resolve([]))
        .then((files) => setFolderFiles(files))
        .catch(() => setFolderFiles([]))
        .finally(() => setFolderLoading(false));
    }
  }, [conversationId, activeConv?.folderId]); // re-run when conversation switches or is moved to a different folder

  const handleToggleTools = async (serverId: string) => {
    const next = new Set(expandedTools);
    if (next.has(serverId)) {
      next.delete(serverId);
      setExpandedTools(next);
      return;
    }
    next.add(serverId);
    setExpandedTools(next);
    if (!toolsMap[serverId]) {
      setLoadingTools(serverId);
      try {
        const tools = await service.mcp.listTools([serverId]);
        setToolsMap((m) => ({ ...m, [serverId]: tools }));
      } catch {
        setToolsMap((m) => ({ ...m, [serverId]: [] }));
      } finally {
        setLoadingTools(null);
      }
    }
  };

  /** Re-connect all servers that are currently active for this conversation. */
  const handleRefreshEnabled = async () => {
    const activeIds = mcpServers
      .filter((s) => isServerActiveForConv(s.id))
      .map((s) => s.id);
    // Invalidate cached tools for all refreshed servers
    setToolsMap((m) => {
      const next = { ...m };
      for (const id of activeIds) delete next[id];
      return next;
    });
    setExpandedTools(new Set());
    await refreshMcpStatus();
  };

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    // BTW mode: route to the side-question handler without affecting the conversation
    if (btwMode && onBtw) {
      onBtw(trimmed);
      setContent('');
      textareaRef.current?.focus();
      return;
    }
    const fc = folderPath && folderFiles ? { rootName: folderPath.split('/').pop() ?? folderPath, rootPath: folderPath, files: folderFiles } : undefined;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined, fc, reasoning !== 'off' ? reasoning : undefined);
    setContent('');
    setAttachments([]);
    textareaRef.current?.focus();
  }, [content, attachments, folderPath, folderFiles, onSend, reasoning, btwMode, onBtw]);

  const handlePickFolder = useCallback(async () => {
    const picked = await service.folder?.pick();
    if (!picked) return;
    setFolderPath(picked);
    setFolderFiles(null);
    setFolderLoading(true);
    if (conversationId) updateConversation(conversationId, { folderPath: picked });
    try {
      const files = await service.folder?.readFiles(picked) ?? [];
      setFolderFiles(files);
    } finally {
      setFolderLoading(false);
    }
  }, [conversationId, updateConversation]);

  const executeSlashCommand = useCallback(async (cmd: SlashCommand) => {
    // Remove the /trigger text from the textarea content
    const withoutSlash = content.replace(/(?:^|\n)(\s*\/\w*)$/, (_, s) =>
      s.replace(/\/\w*$/, '').trimEnd(),
    );
    const ctx: SlashCommandContext = {
      conversationId: conversationId ?? null,
      setContent: (text) => {
        setContent(text);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height =
              Math.min(textareaRef.current.scrollHeight, 200) + 'px';
          }
        });
      },
      chat: { clear: onClear, compact: onCompact, trim: onTrim, pickFolder: handlePickFolder },
    };
    setSlashMatches([]);
    const result = await cmd.execute(slashPrefix, ctx);
    if (typeof result === 'string') {
      setContent(withoutSlash + result);
    } else {
      setContent(withoutSlash.trim());
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, conversationId, handlePickFolder, onClear, onCompact, onTrim, slashPrefix]);

  // Pre-fill the textarea and focus when entering edit mode
  useEffect(() => {
    if (!editingMessage) return;
    setContent(editingMessage.content);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      textareaRef.current.focus();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage?.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command dropdown navigation
    if (slashMatches.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        void executeSlashCommand(slashMatches[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMatches([]);
        return;
      }
    }
    if (e.key === 'Escape' && btwMode) {
      e.preventDefault();
      onCancelBtw?.();
      setContent('');
      return;
    }
    if (e.key === 'Escape' && editingMessage) {
      e.preventDefault();
      onCancelEdit?.();
      setContent('');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    // Detect /trigger at start of the input (leading whitespace ok), or after newline
    const slashMatch = val.match(/(?:^|\n)\s*(\/(\w*))$/);
    if (slashMatch) {
      const prefix = slashMatch[2];
      const matches = slashCommandRegistry.getMatching(prefix);
      setSlashMatches(matches);
      setSlashIndex(0);
      setSlashPrefix(prefix);
    } else {
      setSlashMatches([]);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64,
            size: file.size,
          },
        ]);
      };
      // Images and PDFs stored as base64; text files stored as plain text.
      // Providers handle PDFs natively (Anthropic/Gemini) or extract text themselves (OpenAI).
      if (file.type.startsWith('image/') || file.type === 'application/pdf') reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const handlePaste = (e: React.ClipboardEvent) => { if (e.clipboardData.files.length > 0) handleFiles(e.clipboardData.files); };
  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));
  const cycleReasoning = () => setReasoning((r) => REASONING_CYCLE[(REASONING_CYCLE.indexOf(r) + 1) % REASONING_CYCLE.length]);

  const mcpServers = settings?.mcpServers ?? [];
  // Per-conversation active servers: when activeMcpServerIds is set on the conversation,
  // use that set; otherwise fall back to globally-enabled servers.
  const convActiveMcpIds: Set<string> | null = activeConv?.activeMcpServerIds
    ? new Set(activeConv.activeMcpServerIds)
    : null;
  const isServerActiveForConv = (id: string) =>
    convActiveMcpIds
      ? convActiveMcpIds.has(id)
      : mcpServers.find((s) => s.id === id)?.enabled ?? false;
  const enabledCount = mcpServers.filter((s) => isServerActiveForConv(s.id)).length;
  const canSend = (content.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled;

  return (
    <div
      className="px-4 pb-3 pt-1 flex-shrink-0"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300">
              {att.mimeType.startsWith('image/') ? (
                <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="w-8 h-8 object-cover rounded" />
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(att.id)} className="text-slate-500 hover:text-slate-200 ml-0.5">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Folder context badge */}
      {folderPath && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 bg-slate-700/60 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 max-w-full">
            <AgentIcon />
            <span className="truncate max-w-[200px]" title={folderPath}>
              {folderPath.split('/').pop() ?? folderPath}
            </span>
            {folderIsInherited && (
              <span className="text-slate-500 text-[10px] ml-1 flex-shrink-0" title="Set by chat folder — change in folder settings">chat folder</span>
            )}
            {folderLoading ? (
              <span className="text-slate-500 text-[10px] ml-1">reading…</span>
            ) : folderFiles !== null ? (
              <span className="text-slate-500 text-[10px] ml-1">{folderFiles.length} files</span>
            ) : null}
            {!folderIsInherited && (
              <button
                onClick={() => { setFolderPath(null); setFolderFiles(null); if (conversationId) updateConversation(conversationId, { folderPath: undefined }); }}
                className="text-slate-500 hover:text-slate-200 ml-0.5 flex-shrink-0"
                title="Remove folder context"
              >×</button>
            )}
          </div>
        </div>
      )}

      {/* Slash command autocomplete */}
      {slashMatches.length > 0 && (
        <div className="mb-1.5 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50">
          <p className="px-3 pt-2 pb-1 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Commands</p>
          {slashMatches.map((cmd, idx) => (
            <button
              key={cmd.trigger}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); void executeSlashCommand(cmd); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                idx === slashIndex ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
            >
              {cmd.icon && (
                <span className="w-4 h-4 flex-shrink-0 text-slate-400">{cmd.icon}</span>
              )}
              <code className="text-sm text-blue-300 font-mono flex-shrink-0">/{cmd.trigger}</code>
              <span className="text-xs text-slate-400 truncate">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Queued message indicator */}
      {queuedPreview && (
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 min-w-0">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-shrink-0">Queued · sends when AI finishes</span>
            <span className="text-slate-500 truncate">&ldquo;{queuedPreview.slice(0, 35)}{queuedPreview.length > 35 ? '…' : ''}&rdquo;</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {onSendQueueNow && (
              <button
                onClick={onSendQueueNow}
                className="text-xs px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                title="Abort current response and send now"
              >
                Send now
              </button>
            )}
            <button
              onClick={onCancelQueue}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded flex-shrink-0"
              title="Cancel queued message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* BTW mode indicator */}
      {btwMode && (
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs text-purple-400">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>BTW</span>
            <span className="text-slate-500">· reply won’t be saved · Esc to cancel</span>
          </div>
          <button
            onClick={() => { onCancelBtw?.(); setContent(''); }}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
            title="Cancel BTW mode (Esc)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Editing message indicator */}
      {editingMessage && (
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Editing message</span>
            <span className="text-slate-500">· Esc to cancel</span>
          </div>
          <button
            onClick={() => { onCancelEdit?.(); setContent(''); }}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
            title="Cancel editing (Esc)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input box */}
      <div className="flex items-end gap-2 bg-slate-800 border border-slate-600 focus-within:border-blue-500 rounded-2xl px-3 py-2 transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={btwMode ? 'Ask a quick side question…' : disabled ? 'Select a conversation to chat…' : 'Enter a message here, press ↵ to send'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none max-h-48 overflow-y-auto leading-relaxed disabled:opacity-50"
          style={{ minHeight: '24px' }}
        />
        {isStreaming ? (
          <button onClick={onAbort} className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex-shrink-0 self-end mb-0.5" title="Stop generating">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
          </button>
        ) : (
          <button onClick={handleSend} disabled={!canSend} className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex-shrink-0 self-end mb-0.5" title="Send (Enter)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mt-1.5 px-1">
        {/* Attach */}
        <ToolbarButton
          icon={<AttachIcon />}
          label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
        />
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

        {/* Command center / prompt library */}
        <div className="relative" ref={cmdRef}>
          <ToolbarButton
            icon={<CommandIcon />}
            label="Prompt library"
            onClick={() => setCmdOpen((o) => !o)}
            active={cmdOpen}
          />
          {cmdOpen && (
            <div className="absolute bottom-full mb-2 left-0">
              <PromptLibraryPanel
                onInsert={(text) => {
                  setContent((prev) => (prev.trim() ? prev + '\n\n' + text : text));
                  textareaRef.current?.focus();
                }}
                onClose={() => setCmdOpen(false)}
                onManage={() => {
                  setSettingsInitialTab('ai:prompts');
                  setShowSettings(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Reasoning */}
        <ToolbarButton
          icon={<ReasoningIcon level={reasoning} />}
          label={reasoning === 'off' ? 'Reasoning: off' : `Reasoning: ${reasoning}`}
          onClick={cycleReasoning}
          active={reasoning !== 'off'}
          activeClass={REASONING_COLOR[reasoning]}
        />

        {/* Web search toggle */}
        <ToolbarButton
          icon={<WebIcon />}
          label={`Web search: ${(settings as any)?.webSearch?.enabled ? 'on' : 'off'}`}
          active={!!(settings as any)?.webSearch?.enabled}
          onClick={() => {
            const current = (settings as any)?.webSearch ?? {};
            saveSettings({ webSearch: { ...current, enabled: !current.enabled } } as any);
          }}
        />

        {/* MCP servers */}
        {mcpServers.length === 0 ? (
          <ToolbarButton
            icon={<McpIcon />}
            label="Add MCP servers"
            onClick={() => { setSettingsInitialTab('ai:mcp'); setShowSettings(true); }}
          />
        ) : (
          <div className="relative group/mcp" ref={mcpRef}>
            <button
              onClick={() => { setMcpOpen((o) => !o); if (!mcpOpen) refreshMcpStatus(); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                mcpOpen || enabledCount > 0
                  ? 'text-blue-400 hover:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              }`}
            >
              <McpIcon />
              <span className="font-medium">{enabledCount}/{mcpServers.length}</span>
            </button>
            {!mcpOpen && (
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-700 border border-slate-600 text-slate-200 text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover/mcp:opacity-100 transition-opacity z-50 shadow-lg">
                MCP servers
              </div>
            )}
            {mcpOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-80 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 py-1.5">
                {/* Header */}
                <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">MCP Servers</p>
                  {convActiveMcpIds && convActiveMcpIds.size > 0 && (
                    <button
                      className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                      title="Turn off all MCP servers for this chat"
                      onClick={() => conversationId && updateConversation(conversationId, { activeMcpServerIds: undefined })}
                    >
                      turn all off
                    </button>
                  )}
                </div>

                {/* Server rows */}
                {mcpServers.map((s) => {
                  const connected = !!mcpStatus[s.id];
                  const isConnecting = connecting === s.id;
                  const active = isServerActiveForConv(s.id);
                  const tools = toolsMap[s.id];
                  const toolCount = tools?.length ?? null;
                  const expanded = expandedTools.has(s.id);

                  return (
                    <div key={s.id}>
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/40 transition-colors">
                        {/* Connection status dot */}
                        <span
                          title={isConnecting ? 'Connecting…' : connected ? 'Connected' : 'Not connected'}
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isConnecting ? 'bg-amber-400 animate-pulse' : connected ? 'bg-green-400' : 'bg-slate-600'
                          }`}
                        />

                        {/* Server name */}
                        <span className="text-xs text-slate-200 flex-1 truncate">{s.name}</span>

                        {/* Settings gear — opens MCP tab in settings */}
                        <button
                          title="Open in settings"
                          onClick={() => {
                            setMcpOpen(false);
                            setSettingsInitialTab('ai:mcp');
                            setShowSettings(true);
                          }}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* Tools expand — shown when active (connecting or connected) */}
                        {active && (
                          <button
                            onClick={() => handleToggleTools(s.id)}
                            title="Show tools"
                            disabled={isConnecting}
                            className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
                          >
                            {isConnecting || loadingTools === s.id ? (
                              <span className="text-slate-500">…</span>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                                </svg>
                                {toolCount !== null ? (
                                  <span className="text-slate-300 font-medium">{toolCount}</span>
                                ) : (
                                  <span className="text-slate-600">tools</span>
                                )}
                                <span className="text-slate-600">{expanded ? '▴' : '▾'}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* On / Off toggle — per-conversation only */}
                        <button
                          onClick={async () => {
                            if (!conversationId) return;
                            const current = convActiveMcpIds ? [...convActiveMcpIds] : [];
                            const next = active
                              ? current.filter((id) => id !== s.id)
                              : [...current, s.id];
                            updateConversation(conversationId, {
                              activeMcpServerIds: next.length > 0 ? next : undefined,
                            });
                            // When turning On: connect + pre-fetch tools
                            if (!active && !connected) {
                              setConnecting(s.id);
                              try {
                                await service.mcp.connect(s);
                                await refreshMcpStatus();
                                const fetched = await service.mcp.listTools([s.id]);
                                setToolsMap((m) => ({ ...m, [s.id]: fetched }));
                              } catch {
                                // connection failed — dot stays grey
                              } finally {
                                setConnecting(null);
                              }
                            }
                          }}
                          disabled={!conversationId}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                            active
                              ? 'border-blue-500 text-blue-300 bg-blue-900/30'
                              : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={active ? 'Exclude from this chat' : 'Include in this chat'}
                        >
                          {active ? 'On' : 'Off'}
                        </button>
                      </div>

                      {/* Expanded tools list */}
                      {expanded && tools && (
                        <div className="px-4 pb-2 space-y-1 border-t border-slate-700/50 pt-1.5 mt-0.5">
                          {tools.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic">No tools exposed.</p>
                          ) : (
                            tools.map((t) => (
                              <div key={t.name} className="flex gap-2 items-start">
                                <code className="text-[10px] bg-slate-700 text-cyan-300 px-1.5 py-0.5 rounded font-mono flex-shrink-0 leading-4">
                                  {t.name}
                                </code>
                                {t.description && (
                                  <span className="text-[10px] text-slate-400 leading-4 line-clamp-2">{t.description}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Footer: refresh enabled only */}
                <div className="border-t border-slate-700/50 mt-1 px-3 pt-2 pb-1">
                  <button
                    onClick={handleRefreshEnabled}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                    title="Reconnect all active servers and refresh tool lists"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh active servers
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent / folder context */}
        <ToolbarButton
          icon={<AgentIcon />}
          label={folderPath ? `Folder: ${folderPath.split('/').pop()}` : 'Add folder context'}
          onClick={handlePickFolder}
          disabled={isStreaming || folderLoading}
          active={!!folderPath}
        />

        {/* Clear chat */}
        {onClear && (
          <ToolbarButton
            icon={<ClearIcon />}
            label="Clear chat"
            onClick={() => { if (confirm('Clear all messages in this conversation?')) onClear(); }}
            disabled={isStreaming}
            hoverClass="hover:text-red-400"
          />
        )}

        {/* More */}
        <ToolbarButton icon={<MoreIcon />} label="More options (coming soon)" comingSoon />

        <div className="flex-1" />

        {/* Context usage — clickable to open manage popover */}
        {showCtx && (
          <div ref={ctxRef} className="relative">
            <button
              type="button"
              onClick={() => setCtxOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2 rounded hover:bg-slate-800 transition-colors ${
                ctxPct !== null && ctxPct >= 90 ? 'text-red-400' :
                ctxPct !== null && ctxPct >= 70 ? 'text-amber-400' :
                'text-slate-500 hover:text-slate-300'
              }`}
              title={contextLimit
                ? `${usedTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens (${ctxPct!.toFixed(0)}%) — click to manage`
                : `${usedTokens.toLocaleString()} tokens used — click to manage`}
            >
              <div className="w-16 h-1 rounded-full bg-slate-700 overflow-hidden">
                {contextLimit ? (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      ctxPct! >= 90 ? 'bg-red-500' : ctxPct! >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${ctxPct}%` }}
                  />
                ) : (
                  <div className="h-full w-1/4 rounded-full bg-slate-500 opacity-60" />
                )}
              </div>
              <span className="text-[10px]">
                {contextLimit ? `${fmtTok(usedTokens)}/${fmtTok(contextLimit)}` : `${fmtTok(usedTokens)} tok`}
              </span>
            </button>

            {/* Manage context popover */}
            {ctxOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 space-y-2 z-20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Manage Context</p>

                <div className="text-xs text-slate-400 pb-1">
                  {usedTokens.toLocaleString()} tokens used
                  {contextLimit ? ` of ${contextLimit.toLocaleString()} (${ctxPct!.toFixed(0)}%)` : ''}
                </div>

                {isCompacting ? (
                  <p className="text-xs text-slate-400 italic">Summarizing…</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setCtxOpen(false); onCompact?.(); }}
                      disabled={isStreaming}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 transition-colors"
                    >
                      <span className="font-medium">📋 Summarize</span>
                      <p className="text-slate-500 mt-0.5">AI summarizes the chat, then replaces all messages with the summary</p>
                    </button>
                    {trimConfirm ? (
                      <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-2.5 space-y-2">
                        <p className="text-xs text-amber-300">
                          Remove <span className="font-semibold">{trimCount}</span> message{trimCount !== 1 ? 's' : ''} from the oldest turns?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setTrimConfirm(false); setCtxOpen(false); onTrim?.(); }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrimConfirm(false)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { if (trimCount > 0) setTrimConfirm(true); }}
                        disabled={isStreaming || trimCount === 0}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 transition-colors"
                      >
                        <span className="font-medium">✂️ Trim oldest</span>
                        <p className="text-slate-500 mt-0.5">
                          {trimCount > 0
                            ? `Will remove ${trimCount} message${trimCount !== 1 ? 's' : ''} from oldest turns`
                            : 'Nothing to trim — context usage is low'}
                        </p>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toolbar button helper ─────────────────────────────────────────────────

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  comingSoon,
  active,
  activeClass,
  hoverClass,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
  active?: boolean;
  activeClass?: string;
  hoverClass?: string;
}) {
  return (
    <div className="relative group/tb">
      <button
        onClick={onClick}
        disabled={disabled || comingSoon}
        className={`p-1.5 rounded-lg transition-colors text-sm
          ${comingSoon ? 'opacity-40 cursor-not-allowed text-slate-500' : ''}
          ${!comingSoon && !disabled ? `${hoverClass ?? 'hover:text-slate-200'} hover:bg-slate-700` : ''}
          ${active ? activeClass ?? 'text-blue-400' : comingSoon ? '' : 'text-slate-500'}
          disabled:opacity-40`}
      >
        {icon}
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-700 border border-slate-600 text-slate-200 text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover/tb:opacity-100 transition-opacity z-50 shadow-lg">
        {label}
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────

const AttachIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

const CommandIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

const ReasoningIcon = ({ level }: { level: ReasoningLevel }) => (
  <span className={`text-[11px] font-bold leading-none w-4 text-center inline-block ${REASONING_COLOR[level]}`}>
    {level === 'off' ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ) : REASONING_LABEL[level]}
  </span>
);

const WebIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const McpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const AgentIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
  </svg>
);

