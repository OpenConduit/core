import type {
  AppSettings,
  ChatRequest,
  FeedbackPayload,
  McpServerConfig,
  McpTool,
  RoutingConfig,
  RoutingDecision,
  StreamChunk,
  StreamEnd,
  StreamError,
  ToolApprovalRequest,
  ToolCall,
  UpdateInfo,
} from '../types';

type UnsubFn = () => void;

/**
 * AppService is the transport-agnostic interface that the renderer uses to
 * communicate with the backend (AI providers, MCP servers, settings, etc.).
 *
 * In the desktop app the Electron IPC bridge (`window.api`) implements this.
 * A future web/enterprise build will provide an HTTP/WebSocket implementation.
 */
export interface AppService {
  chat: {
    send(request: ChatRequest): Promise<{ messageId: string }>;
    abort(conversationId: string): void;
    onChunk(cb: (data: StreamChunk) => void): UnsubFn;
    onEnd(cb: (data: StreamEnd) => void): UnsubFn;
    onError(cb: (data: StreamError) => void): UnsubFn;
    onToolPending(cb: (data: { conversationId: string; messageId: string; toolCalls: ToolCall[] }) => void): UnsubFn;
    onThinkingChunk(cb: (data: { conversationId: string; messageId: string; delta: string }) => void): UnsubFn;
  };
  tools: {
    onApprovalRequest(cb: (data: ToolApprovalRequest) => void): UnsubFn;
    sendApproval(data: { toolId: string; approved: boolean }): void;
  };
  settings: {
    get(): Promise<AppSettings>;
    set(partial: Partial<AppSettings>): Promise<AppSettings>;
  };
  mcp: {
    connect(config: McpServerConfig): Promise<void>;
    disconnect(id: string): Promise<void>;
    listTools(serverIds: string[]): Promise<McpTool[]>;
    getStatus(): Promise<Record<string, boolean>>;
  };
  models: {
    list(providerId: string): Promise<string[]>;
  };
  updater: {
    checkForUpdates(): Promise<UpdateInfo>;
    submitFeedback(payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>): Promise<void>;
    openExternal(url: string): Promise<void>;
    /** Quit the app and apply a downloaded update immediately. */
    restartAndInstall?(): Promise<void>;
    /** Subscribe to be notified when an update has been downloaded. Returns an unsubscribe fn. */
    onUpdateDownloaded?(cb: () => void): () => void;
  };
  config: {
    exportSettings(redact: boolean): Promise<boolean>;
    importSettings(): Promise<AppSettings | null>;
    /** Opens settings.json in the system default editor (desktop only). */
    openSettingsFile(): Promise<void>;
  };
  routing: {
    evaluate(params: {
      message: string;
      routerProviderId: string;
      routerModel: string;
      config: RoutingConfig;
      originalProviderId: string;
      originalModel: string;
    }): Promise<RoutingDecision>;
  };
  webtools?: {
    /** Run a smoke-test of web_fetch or web_search with the current settings. */
    test(type: 'fetch' | 'search'): Promise<{ ok: boolean; message: string }>;
  };
  extensionTools?: {
    /**
     * Listen for the main process asking the renderer to execute an extension
     * tool handler. The callback receives the tool name, input, and a callId
     * that must be passed back to `sendResult` when execution is complete.
     */
    onCall(cb: (data: { callId: string; toolName: string; input: Record<string, unknown> }) => void): () => void;
    /** Send the result of an extension tool call back to the main process. */
    sendResult(data: { callId: string; result: string; isError: boolean }): void;
  };
}
