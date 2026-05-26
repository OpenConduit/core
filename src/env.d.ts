/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

// Minimal surface of window.api that core components need.
// The full declaration lives in the desktop package's renderer/env.d.ts.
declare interface Window {
  api?: {
    collab?: {
      create: (seed?: unknown) => Promise<{ roomId: string; wsUrl: string; inviteUrl: string }>;
      join: (roomId: string, name: string, color: string) => Promise<void>;
      leave: () => Promise<void>;
      send: (event: unknown) => Promise<void>;
      lockRequest: () => Promise<void>;
      lockRelease: () => Promise<void>;
      onEvent: (cb: (event: unknown) => void) => () => void;
      onInvite?: (cb: (roomId: string) => void) => () => void;
    };
    conversation?: {
      share: (conversation: unknown) => Promise<{ id: string; url: string }>;
      exportHtml: (conversation: unknown) => Promise<boolean>;
      listShares: () => Promise<Array<{ id: string; url: string; title: string; createdAt: number }>>;
      deleteShare: (id: string) => Promise<void>;
    };
    machine?: {
      getId: () => Promise<string>;
    };
    [key: string]: unknown;
  };
  /** Exposed by the renderer for HTML export triggered from the main process. */
  __exportConversationHtml?: (conversationJson: string) => string;
}
