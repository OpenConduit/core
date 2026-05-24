import type {
  AppSettings,
  ChatRequest,
  ConfigBundle,
  FeedbackPayload,
  FolderEntry,
  McpServerConfig,
  McpTool,
  RoutingConfig,
  RoutingDecision,
  SimpleCompletionRequest,
  StreamChunk,
  StreamEnd,
  StreamError,
  SyncPayload,
  SyncStatusResult,
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
    /**
     * Headless LLM call. Returns the full response text without creating
     * conversation messages or triggering any streaming IPC events.
     * Use this for pipeline steps and background processing.
     */
    complete(request: SimpleCompletionRequest): Promise<{ text: string }>;
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
    /** Ping each local provider (LM Studio, Ollama) — returns running status + currently-loaded models keyed by provider ID. */
    probe?(): Promise<Record<string, { running: boolean; loadedModels: string[] }>>;
  };
  updater: {
    checkForUpdates(): Promise<UpdateInfo>;
    submitFeedback(payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>): Promise<void>;
    openExternal(url: string): Promise<void>;
    /** Quit the app and apply a downloaded update immediately. */
    restartAndInstall?(): Promise<void>;
    /** Trigger an on-demand Squirrel download; fires onUpdateDownloaded when ready. */
    triggerDownload?(): Promise<void>;
    /** Subscribe to be notified when an update has started downloading. Returns an unsubscribe fn. */
    onUpdateDownloading?(cb: () => void): () => void;
    /** Subscribe to be notified when an update has been downloaded. Returns an unsubscribe fn. */
    onUpdateDownloaded?(cb: () => void): () => void;
    /** Subscribe to be notified when a download error occurs. Returns an unsubscribe fn. */
    onUpdateError?(cb: (message: string) => void): () => void;
  };
  config: {
    exportSettings(redact: boolean): Promise<boolean>;
    importSettings(): Promise<AppSettings | null>;
    /** Opens settings.json in the system default editor (desktop only). */
    openSettingsFile(): Promise<void>;
    /** Export providers + MCP servers (no secrets) to a shareable .ocbundle file. */
    exportBundle?(meta: { name?: string; description?: string }): Promise<boolean>;
    /** Open a .ocbundle file and return its parsed contents for merging. */
    importBundle?(): Promise<ConfigBundle | null>;
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
  copilot?: {
    /** Start GitHub device-flow OAuth; returns codes + verification URL to show the user. */
    startAuth(): Promise<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }>;
    /** Poll for OAuth completion. Call every `interval` seconds until status !== 'pending'. */
    pollAuth(deviceCode: string): Promise<{
      status: 'pending' | 'complete' | 'expired' | 'error';
      token?: string;
      error?: string;
    }>;
    /** Fetch Copilot premium-request quota for the authenticated GitHub token. */
    getUsage(githubToken: string): Promise<{
      premiumRequestsUsed: number;
      premiumRequestsIncluded: number;
      premiumRequestsPurchased: number;
    } | null>;
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
  crash?: {
    /** Returns true if a crash report has been stored and is available to send. */
    hasStored(): Promise<boolean>;
    /** Sends the stored crash report to telemetry and clears it. */
    sendStored(): Promise<void>;
  };
  folder?: {
    /** Opens a native directory picker; returns the selected path or null if cancelled. */
    pick(): Promise<string | null>;
    /** Reads all text files under folderPath recursively; returns FolderEntry[]. */
    readFiles(folderPath: string): Promise<FolderEntry[]>;
    /** Creates or overwrites relativePath inside folderPath. */
    writeFile(folderPath: string, relativePath: string, content: string): Promise<void>;
    /** Deletes a file or directory (recursively) at relativePath inside folderPath. */
    deleteEntry(folderPath: string, relativePath: string): Promise<void>;
  };
  /** Git-backed sync — conversations, personas, prompts and settings versioned in a local git repo. */
  sync?: {
    /** Initialise (or re-initialise) the git repo at the path stored in settings. */
    configure(): Promise<{ success: boolean; error?: string }>;
    /** Serialise payload to files, commit, and push to remote if configured. */
    push(payload: SyncPayload): Promise<{ success: boolean; error?: string }>;
    /**
     * Pull latest commits from remote then return the data files as a payload.
     * If no remote is configured, reads the current repo state.
     */
    pull(): Promise<{ success: boolean; payload?: SyncPayload; error?: string }>;
    /** Returns current repo status. */
    status(): Promise<SyncStatusResult>;
  };
}
