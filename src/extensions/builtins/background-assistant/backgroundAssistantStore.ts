import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerMode = 'onDemand' | 'afterEachResponse' | 'onRequest';

export interface BackgroundAssistantConfig {
  enabled: boolean;
  /** System prompt / persona for the background assistant. */
  persona: string;
  /** Provider id to use for background calls. Empty string = use app default. */
  providerId: string;
  /** Model to use for background calls. Empty string = use app default. */
  model: string;
  /** When to automatically invoke the background assistant. */
  triggerMode: TriggerMode;
  /**
   * Trigger phrase for `onRequest` mode.
   * When the outgoing user message contains this string the assistant runs
   * after the main response arrives.
   */
  triggerPhrase: string;
}

export interface BackgroundNote {
  /** Unique note id. */
  id: string;
  /** Id of the assistant message this note annotates. */
  messageId: string;
  /** The background assistant's response text. */
  text: string;
  /** Unix timestamp (ms). */
  createdAt: number;
}

interface BackgroundAssistantState {
  config: BackgroundAssistantConfig;
  /** Notes keyed by assistant message id. */
  notesByMessageId: Record<string, BackgroundNote[]>;
  /** Whether a background call is currently in-flight. */
  isRunning: boolean;

  setConfig(partial: Partial<BackgroundAssistantConfig>): void;
  addNote(messageId: string, note: Omit<BackgroundNote, 'messageId'>): void;
  clearNotes(): void;
  getNotesForMessage(messageId: string): BackgroundNote[];
  setRunning(v: boolean): void;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BackgroundAssistantConfig = {
  enabled: false,
  persona:
    'You are a critical background assistant. Your job is to review the assistant ' +
    'message above and identify any factual errors, unsupported claims, logical gaps, ' +
    'or opportunities to add useful context. Be concise and direct. If everything looks ' +
    'correct, say so briefly.',
  providerId: '',
  model: '',
  triggerMode: 'onDemand',
  triggerPhrase: '/verify',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBackgroundAssistantStore = create<BackgroundAssistantState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      notesByMessageId: {},
      isRunning: false,

      setConfig(partial) {
        set((s) => ({ config: { ...s.config, ...partial } }));
      },

      addNote(messageId, note) {
        set((s) => {
          const existing = s.notesByMessageId[messageId] ?? [];
          return {
            notesByMessageId: {
              ...s.notesByMessageId,
              [messageId]: [...existing, { ...note, messageId }],
            },
          };
        });
      },

      clearNotes() {
        set({ notesByMessageId: {} });
      },

      getNotesForMessage(messageId) {
        return get().notesByMessageId[messageId] ?? [];
      },

      setRunning(v) {
        set({ isRunning: v });
      },
    }),
    {
      name: 'openconduit-background-assistant',
      // Don't persist transient state
      partialize: (s) => ({
        config: s.config,
        notesByMessageId: s.notesByMessageId,
      }),
    },
  ),
);
