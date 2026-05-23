import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatRequest, Message, StreamChunk, StreamEnd, StreamError, ToolApprovalRequest, Attachment, AiTask, AiQuestion, AppSettings, ConversationFolder, FolderEntry, RoutingDecision, ReasoningLevel } from '../types';
import { hookRegistry } from './hookRegistry';
import { debugConsole } from '../utils/debugConsole';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePersonasStore } from '../stores/personasStore';
import { useUiStore } from '../stores/uiStore';
import { useTasksStore } from '../stores/tasksStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { getContextLimit, estimateTokens } from '../utils/context';
import { service } from '../services';
import { toolContributionRegistry } from '../extensions/toolContributionRegistry';

// ─── Task + Question parsing ──────────────────────────────────────────────────

const AI_TASKS_RE = /<ai-tasks>([/\S\s]*?)<\/ai-tasks>/;
const AI_QUESTIONS_RE = /<ai-questions>([/\S\s]*?)<\/ai-questions>/;

const TASK_TRACKING_PROMPT = `
When working on multi-step tasks, maintain a running task list by including the following block at the end of your response whenever your task list changes:

<ai-tasks>[{"id":"1","text":"task description","status":"pending"},{"id":"2","text":"another task","status":"in-progress"},{"id":"3","text":"finished task","status":"done"}]</ai-tasks>

Valid status values: "pending", "in-progress", "done", "cancelled". Always include ALL tasks in every update (not just changed ones). Omit this block entirely if no multi-step task tracking is relevant for the current response.`.trim();

const CLARIFYING_QUESTIONS_PROMPT = `
When you receive a complex or ambiguous request where clarifying information would meaningfully change your response, you MUST ask your questions using the structured block below — never as plain conversational text.

RULES:
- Output ONLY the <ai-questions> block when asking questions. Do not write any other text.
- NEVER ask questions as regular prose. The ONLY valid way is the <ai-questions> block.
- Only use this when genuinely necessary. For simple requests, make assumptions and proceed.
- Maximum 3 questions per response.

QUESTION TYPES (use the right type for each question):

1. Free text (no options field):
   {"id":"1","question":"What should the function be named?"}

2. Single-select (options array, no multiSelect):
   {"id":"2","question":"Which language?","options":["TypeScript","Python","Rust"]}

3. Single-select with fallback (allowOther lets user type a custom answer):
   {"id":"3","question":"Which framework?","options":["React","Vue","Svelte"],"allowOther":true}

4. Multi-select (user can pick several):
   {"id":"4","question":"Which features do you need?","options":["Auth","Database","File upload"],"multiSelect":true}

5. Multi-select with fallback:
   {"id":"5","question":"Target platforms?","options":["Web","iOS","Android"],"multiSelect":true,"allowOther":true}

FORMAT (emit exactly this, as your entire response):
<ai-questions>[...your questions here...]</ai-questions>

The user will see a structured form. Their answers will be sent back to you so you can proceed.`.trim();

function parseAndStripTasks(content: string): { content: string; tasks: AiTask[] | null } {
  const match = content.match(AI_TASKS_RE);
  if (!match) return { content, tasks: null };
  try {
    const tasks = JSON.parse(match[1].trim()) as AiTask[];
    const stripped = content.replace(match[0], '').trim();
    return { content: stripped, tasks };
  } catch {
    return { content, tasks: null };
  }
}

function parseAndStripQuestions(content: string): { content: string; questions: AiQuestion[] | null } {
  const match = content.match(AI_QUESTIONS_RE);
  if (!match) return { content, questions: null };
  try {
    const questions = JSON.parse(match[1].trim()) as AiQuestion[];
    const stripped = content.replace(match[0], '').trim();
    return { content: stripped, questions };
  } catch {
    return { content, questions: null };
  }
}

/** Compose the final system prompt from persona + conversation overrides + all enabled augmentations */
/** Walk ancestor folders and return the systemPrompt of the nearest one that has one. */
function getFolderSystemPrompt(folderId: string | null | undefined, folders: ConversationFolder[]): string | undefined {
  if (!folderId) return undefined;
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return undefined;
  if (folder.systemPrompt?.trim()) return folder.systemPrompt.trim();
  return getFolderSystemPrompt(folder.parentId, folders);
}

function buildSystemPrompt(basePrompt: string | undefined, settings: AppSettings, personaPrompt?: string): string | undefined {
  const parts: string[] = [];

  // Persona prompt is the base layer; conversation systemPrompt overrides/appends on top
  if (personaPrompt?.trim()) parts.push(personaPrompt.trim());
  if (basePrompt?.trim()) parts.push(basePrompt.trim());

  // Labs: AI task tracking
  if (settings.labs?.aiTaskTracking) {
    parts.push(TASK_TRACKING_PROMPT);
  }

  // Labs: AI clarifying questions
  if (settings.labs?.aiClarifyingQuestions) {
    parts.push(CLARIFYING_QUESTIONS_PROMPT);
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

let listenersRegistered = false;

// messageIds of in-flight compact/summarize requests — handled differently in onEnd
const compactingRequests = new Set<string>();

/** Register global IPC streaming listeners. Safe to call multiple times — the
 *  preload uses removeAllListeners before re-registering each channel, so HMR
 *  re-runs won't accumulate duplicate handlers. */
function ensureListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  service.chat.onChunk((chunk: StreamChunk) => {
    useConversationStore.getState().appendToMessage(chunk.conversationId, chunk.messageId, chunk.delta);
    hookRegistry.runOnStreamChunk(chunk);
  });

  service.chat.onEnd((end: StreamEnd) => {
    debugConsole.debug('Stream ended', { messageId: end.messageId, conversationId: end.conversationId, usage: end.usage }, 'provider');
    const { finalizeMessage, updateMessage, replaceMessages } = useConversationStore.getState();

    // ── Compact request: replace all messages with the summary ──────────────
    if (compactingRequests.has(end.messageId)) {
      compactingRequests.delete(end.messageId);
      finalizeMessage(end.conversationId, end.messageId, []);
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const summaryMsg = conv?.messages.find((m) => m.id === end.messageId);
      const summaryContent = summaryMsg?.content ?? '';
      replaceMessages(end.conversationId, [{
        id: uuidv4(),
        role: 'assistant',
        content: `📋 **Conversation Summary**\n\n${summaryContent}`,
        timestamp: Date.now(),
        model: summaryMsg?.model,
        providerId: summaryMsg?.providerId,
      }]);
      useUiStore.getState().setIsCompacting(false);
      useUiStore.getState().setIsStreaming(false);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────
    finalizeMessage(end.conversationId, end.messageId, end.toolCalls ?? []);

    // Notify on tool call failures
    for (const tc of (end.toolCalls ?? [])) {
      if (tc.isError) {
        useUiStore.getState().addNotification({
          title: 'Tool call failed',
          message: `${tc.name}: ${String(tc.result ?? 'Unknown error')}`,
          variant: 'warning',
          source: 'app',
        });
      }
    }

    // Record token usage for analytics
    if (end.usage) {
      const settings = useSettingsStore.getState().settings;
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      if (conv) {
        // Store usage on the message itself for per-message display
        updateMessage(end.conversationId, end.messageId, { usage: end.usage });
        useAnalyticsStore.getState().addRecord(
          {
            conversationId: end.conversationId,
            providerId: conv.providerId ?? '',
            model: conv.model ?? '',
            usage: end.usage,
          },
          settings?.modelPricing,
        );
      }
    }

    // Parse & strip <ai-tasks> if labs feature is on
    const taskTrackingEnabled = useSettingsStore.getState().settings?.labs?.aiTaskTracking;
    if (taskTrackingEnabled) {
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const msg = conv?.messages.find((m) => m.id === end.messageId);
      if (msg) {
        const { content, tasks } = parseAndStripTasks(msg.content);
        if (tasks) {
          updateMessage(end.conversationId, end.messageId, { content });
          useTasksStore.getState().setTasks(tasks, end.conversationId);
        }
      }
    }

    // Parse & strip <ai-questions> if labs feature is on
    const clarifyEnabled = useSettingsStore.getState().settings?.labs?.aiClarifyingQuestions;
    if (clarifyEnabled) {
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const msg = conv?.messages.find((m) => m.id === end.messageId);
      if (msg) {
        const { content, questions } = parseAndStripQuestions(msg.content);
        if (questions?.length) {
          updateMessage(end.conversationId, end.messageId, { content, aiQuestions: questions });
        }
      }
    }

    // Run onResponse hooks with the finalized message
    const conv2 = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
    const msg2 = conv2?.messages.find((m) => m.id === end.messageId);
    if (msg2) hookRegistry.runOnResponse(msg2);
    useUiStore.getState().setIsStreaming(false);
  });

  // Pending tool calls: sent BEFORE approval is requested so the Approve/Deny
  // buttons are visible. Update the message in-place so user can respond.
  service.chat.onToolPending((data) => {
    debugConsole.info('Tool calls pending approval', { messageId: data.messageId, tools: data.toolCalls.map((t) => t.name) }, 'mcp');
    useConversationStore.getState().updateMessage(data.conversationId, data.messageId, {
      isStreaming: false,
      toolCalls: data.toolCalls,
    });
    useUiStore.getState().setIsStreaming(false);
  });

  service.chat.onThinkingChunk((data) => {
    useConversationStore.getState().appendThinkingToMessage(data.conversationId, data.messageId, data.delta);
  });

  service.chat.onError((err: StreamError) => {
    debugConsole.error('Stream error', { messageId: err.messageId, conversationId: err.conversationId, error: err.error }, 'provider');
    // Clean up compact state if the errored request was a summarize call
    if (compactingRequests.has(err.messageId)) {
      compactingRequests.delete(err.messageId);
      useUiStore.getState().setIsCompacting(false);
    }
    useConversationStore.getState().updateMessage(err.conversationId, err.messageId, {
      content: `⚠️ ${err.error}`,
      isStreaming: false,
    });
    useUiStore.getState().setIsStreaming(false);
    useUiStore.getState().addNotification({ title: 'Request failed', message: err.error, variant: 'error', source: 'app' });
  });

  service.tools.onApprovalRequest((req: ToolApprovalRequest) => {
    debugConsole.info('Tool approval requested', { messageId: req.messageId, toolName: req.toolCall.name, toolId: req.toolCall.id }, 'mcp');
    useUiStore.getState().addPendingApproval(req);
  });

  // ── Extension tool execution ────────────────────────────────────────────
  // The main process sends a call here when the AI invokes a tool whose
  // serverId is '__extension__'. We run the registered handler in the renderer
  // and return the result over IPC so the main process can continue the turn.
  if (service.extensionTools) {
    service.extensionTools.onCall(async ({ callId, toolName, input }) => {
      try {
        const result = await toolContributionRegistry.call(toolName, input);
        service.extensionTools!.sendResult({ callId, result, isError: false });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        service.extensionTools!.sendResult({ callId, result: msg, isError: true });
      }
    });
  }
}

export function useChat(conversationId?: string | null) {
  const { conversations, addMessage, updateConversation, replaceMessages, folders: _folders } = useConversationStore();
  const { settings } = useSettingsStore();
  const {
    activeConversationId,
    isStreaming,
    setIsStreaming,
    isCompacting,
    pendingApprovals,
    removePendingApproval,
    injectedMessage,
    clearInjectedMessage,
  } = useUiStore();

  const effectiveId = conversationId ?? activeConversationId;

  useEffect(() => {
    ensureListeners();
  }, []);

  const activeConversation = conversations.find((c) => c.id === effectiveId) ?? null;

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[], folderContext?: { rootName: string; rootPath?: string; files: FolderEntry[] }, reasoning?: ReasoningLevel) => {
      if (!effectiveId || !settings || isStreaming) return;

      const conv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === effectiveId);
      if (!conv) return;

      const persona = conv.personaId
        ? usePersonasStore.getState().getPersona(conv.personaId)
        : undefined;

      const providerId = conv.providerId ?? persona?.defaultProviderId ?? settings.defaultProviderId;
      const model = conv.model ?? persona?.defaultModel ?? settings.defaultModel;
      if (!providerId || !model) {
        alert('Please select a provider and model in the top bar before chatting.');
        return;
      }

      // Add user message
      const userMsg: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        attachments,
        timestamp: Date.now(),
      };
      addMessage(effectiveId, userMsg);

      // Auto-title from first user message
      if (conv.messages.length === 0) {
        const title = content.slice(0, 60) + (content.length > 60 ? '…' : '');
        updateConversation(effectiveId, { title });
      }

      // Build request from latest state
      const freshConv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === effectiveId)!;

      let request: ChatRequest = {
        conversationId: effectiveId,
        // Strip any empty assistant placeholders left over from prior failed turns
        // so they don't get forwarded to the provider as `content: null`.
        messages: freshConv.messages.filter(
          (m) => m.role !== 'assistant' || !!(m.content || m.toolCalls?.length),
        ),
        providerId,
        model,
        parameters: conv.parameters ?? persona?.parameters ?? settings.defaultParameters,
        systemPrompt: buildSystemPrompt(
          getFolderSystemPrompt(conv.folderId, useConversationStore.getState().folders) ?? conv.systemPrompt,
          settings,
          persona?.systemPrompt,
        ),
        enabledMcpServerIds:
          freshConv.activeMcpServerIds ??
          persona?.defaultMcpServerIds ??
          settings.mcpServers.filter((s) => s.enabled).map((s) => s.id),
        ...(folderContext ? { folderContext } : {}),
        ...(reasoning ? { reasoning } : {}),
      };

      // Run beforeSend hooks
      request = await hookRegistry.runBeforeSend(request);

      // ── Intelligent routing ──────────────────────────────────────────────
      let routingDecision: RoutingDecision | undefined;
      // Per-conversation profile takes precedence over global routing config
      const routingCfg = conv.routingProfileId
        ? settings.routingProfiles?.find((p) => p.id === conv.routingProfileId)?.config
        : settings.routing;
      if (
        routingCfg?.enabled &&
        routingCfg.routerProviderId &&
        routingCfg.routerModel &&
        (routingCfg.tierRouting?.enabled || routingCfg.providerRouting?.enabled)
      ) {
        try {
          routingDecision = await service.routing.evaluate({
            message: content,
            routerProviderId: routingCfg.routerProviderId,
            routerModel: routingCfg.routerModel,
            config: routingCfg,
            originalProviderId: providerId,
            originalModel: model,
          });
          if (routingDecision.finalProviderId !== providerId || routingDecision.finalModel !== model) {
            request = {
              ...request,
              providerId: routingDecision.finalProviderId,
              model: routingDecision.finalModel,
            };
          }
          debugConsole.info('Routing decision', { original: `${providerId}/${model}`, final: `${routingDecision.finalProviderId}/${routingDecision.finalModel}`, reason: routingDecision.reason }, 'routing');
        } catch (e) {
          debugConsole.warn('Routing failed, using original model', { error: String(e) }, 'routing');
          // Routing failure is non-fatal — proceed with original model
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setIsStreaming(true);

      // Pre-generate messageId and add the placeholder BEFORE calling send.
      // This eliminates the race condition where a STREAM_ERROR (e.g. provider
      // not found after routing redirect) arrives before the invoke resolves,
      // causing updateMessage to silently drop the error because the message
      // doesn't exist in the store yet.
      const messageId = uuidv4();
      addMessage(effectiveId, {
        id: messageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
        model: routingDecision?.finalModel ?? model,
        providerId: routingDecision?.finalProviderId ?? providerId,
        routingDecision,
      });

      const finalProviderId = routingDecision?.finalProviderId ?? providerId;
      const providerName = settings.providers.find((p) => p.id === finalProviderId)?.name ?? finalProviderId;
      debugConsole.info('Stream started', {
        messageId,
        provider: providerName,
        model: routingDecision?.finalModel ?? model,
        messageCount: request.messages.length,
        tools: request.enabledMcpServerIds?.length ?? 0,
      }, 'provider');

      await service.chat.send({ ...request, messageId });
    },
    [effectiveId, settings, isStreaming, addMessage, updateConversation, setIsStreaming],
  );

  // ── Extension message injection (#55) ──────────────────────────────────────
  // When an extension calls api.conversations.sendMessage(), it sets
  // injectedMessage in uiStore. Pick it up here and send it through the normal
  // chat pipeline, then clear the queue.
  // Placed after sendMessage declaration to avoid a forward-reference lint error.
  useEffect(() => {
    if (!injectedMessage) return;
    const text = injectedMessage;
    clearInjectedMessage();
    void sendMessage(text);
  }, [injectedMessage, sendMessage, clearInjectedMessage]);

  const abortStream = useCallback(() => {
    if (effectiveId) {
      service.chat.abort(effectiveId);
      useUiStore.getState().setIsStreaming(false);
    }
  }, [effectiveId]);

  /** Summarize the conversation and replace all messages with the summary. */
  const compactContext = useCallback(async () => {
    if (!effectiveId || !settings || isStreaming || isCompacting) return;
    const conv = useConversationStore.getState().conversations.find((c) => c.id === effectiveId);
    if (!conv || conv.messages.length < 2) return;

    const providerId = conv.providerId ?? settings.defaultProviderId;
    const model = conv.model ?? settings.defaultModel;
    if (!providerId || !model) return;

    useUiStore.getState().setIsCompacting(true);
    setIsStreaming(true);

    // Sanitize messages: drop tool_result rows and any message with empty/null
    // content — OpenAI rejects null content values.
    const safeMessages = conv.messages
      .filter((m) => m.role !== 'tool_result' && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({ ...m, content: m.content ?? '' }));

    if (safeMessages.length === 0) {
      useUiStore.getState().setIsCompacting(false);
      setIsStreaming(false);
      return;
    }

    const request: ChatRequest = {
      conversationId: effectiveId,
      messages: [
        ...safeMessages,
        {
          id: uuidv4(),
          role: 'user',
          content: 'Please write a concise but complete summary of our conversation above. Capture all key context, decisions, code snippets, and details needed to continue this work seamlessly.',
          timestamp: Date.now(),
        },
      ],
      providerId,
      model,
      parameters: { temperature: 0.3, topP: 1, maxTokens: Math.min(8000, Math.max(2000, safeMessages.length * 150)) },
      systemPrompt: 'You are summarizing a conversation to preserve context. Be concise but complete.',
      enabledMcpServerIds: [],
    };

    try {
      const messageId = uuidv4();
      compactingRequests.add(messageId);
      addMessage(effectiveId, {
        id: messageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
        model,
        providerId,
      });
      await service.chat.send({ ...request, messageId });
    } catch {
      useUiStore.getState().setIsCompacting(false);
      setIsStreaming(false);
    }
  }, [effectiveId, settings, isStreaming, isCompacting, addMessage, setIsStreaming]);

  /** Drop the oldest messages until context usage falls below 50% (or remove oldest 4 if no limit known). */
  const trimOldMessages = useCallback(() => {
    if (!effectiveId) return;
    const conv = useConversationStore.getState().conversations.find((c) => c.id === effectiveId);
    if (!conv || conv.messages.length <= 2) return;

    const providerId = conv.providerId ?? settings?.defaultProviderId ?? '';
    const model = conv.model ?? settings?.defaultModel ?? '';
    const providerCtx = settings?.providers?.find((p) => p.id === providerId)?.modelContextWindows?.[model] ?? null;
    const contextLimit = providerCtx ?? getContextLimit(model);

    // Work only with user/assistant messages — strip tool_results, thinking, etc.
    let messages = conv.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    // Ensure history starts on a user message so we never send orphaned assistant turns
    while (messages.length > 0 && messages[0].role !== 'user') messages = messages.slice(1);
    if (messages.length <= 2) return;

    if (contextLimit) {
      const target = contextLimit * 0.5;
      const totalEst = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
      if (totalEst <= target) return; // nothing to do
      // Drop to the next user-message boundary each iteration, keeping ≥2 messages
      while (messages.reduce((s, m) => s + estimateTokens(m.content), 0) > target && messages.length > 2) {
        const nextUserIdx = messages.findIndex((m, i) => i > 0 && m.role === 'user');
        if (nextUserIdx <= 0) break; // only one turn remaining
        messages = messages.slice(nextUserIdx);
      }
    } else {
      // No known limit: drop up to 4 messages worth, stopping at user-message boundaries
      let dropped = 0;
      while (dropped < 4 && messages.length > 2) {
        const nextUserIdx = messages.findIndex((m, i) => i > 0 && m.role === 'user');
        if (nextUserIdx <= 0) break;
        dropped += nextUserIdx;
        messages = messages.slice(nextUserIdx);
      }
    }

    replaceMessages(effectiveId, messages);
  }, [effectiveId, settings, replaceMessages]);

  const approveToolCall = useCallback(
    (toolId: string, approved: boolean) => {
      debugConsole.info('Tool approval response', { toolId, approved }, 'mcp');
      service.tools.sendApproval({ toolId, approved });
      removePendingApproval(toolId);
    },
    [removePendingApproval],
  );

  /** Send answers to the AI's clarifying questions as a formatted user message */
  const sendAnswers = useCallback(
    (questions: AiQuestion[], answers: Record<string, string>) => {
      const formatted = questions
        .map((q, i) => `${i + 1}. ${q.question}\n   ${answers[q.id] ?? ''}`)
        .join('\n\n');
      sendMessage(`Here are my answers to your questions:\n\n${formatted}`);
    },
    [sendMessage],
  );

  return {
    conversation: activeConversation,
    isStreaming,
    isCompacting,
    pendingApprovals,
    sendMessage,
    abortStream,
    compactContext,
    trimOldMessages,
    approveToolCall,
    sendAnswers,
  };
}
