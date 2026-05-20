import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, ConversationFolder, FolderFile, Message, ToolCall } from '../types';

interface ConversationState {
  conversations: Conversation[];
  openTabs: string[];
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  reorderTabs: (ids: string[]) => void;
  addConversation: (conv?: Partial<Conversation>) => Conversation;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  addMessage: (convId: string, msg: Message) => void;
  updateMessage: (convId: string, msgId: string, updates: Partial<Message>) => void;
  appendToMessage: (convId: string, msgId: string, delta: string) => void;
  appendThinkingToMessage: (convId: string, msgId: string, delta: string) => void;
  finalizeMessage: (convId: string, msgId: string, toolCalls: ToolCall[]) => void;
  clearMessages: (convId: string) => void;
  replaceMessages: (convId: string, messages: Message[]) => void;
  /** Bulk-replace the conversation list. Used by server-backed implementations
   * (e.g. cloud) to seed the store from an API response. Messages default to []. */
  setConversations: (conversations: Array<Omit<Conversation, 'messages'> & { messages?: Message[] }>) => void;

  branchConversation: (convId: string, messageIndex: number) => Conversation;
  detachBranch: (convId: string) => void;

  // ── Folders ────────────────────────────────────────────────────────────────
  folders: ConversationFolder[];
  createFolder: (name: string, parentId?: string | null) => ConversationFolder;
  updateFolder: (id: string, updates: Partial<Omit<ConversationFolder, 'id'>>) => void;
  deleteFolder: (id: string) => void;
  toggleFolderCollapsed: (id: string) => void;
  moveConversation: (convId: string, folderId: string | null) => void;

  // ── Folder Files ───────────────────────────────────────────────────────────
  folderFiles: FolderFile[];
  addFolderFile: (file: Omit<FolderFile, 'id' | 'createdAt'>) => FolderFile;
  deleteFolderFile: (id: string) => void;
  renameFolderFile: (id: string, name: string) => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, _get) => ({
      conversations: [] as Conversation[],
      openTabs: [] as string[],
      openTab: (id) => set((s) => s.openTabs.includes(id) ? s : { openTabs: [...s.openTabs, id] }),
      closeTab: (id) => set((s) => ({ openTabs: s.openTabs.filter((t) => t !== id) })),
      reorderTabs: (ids) => set({ openTabs: ids }),

      addConversation: (partial = {}) => {
        const conv: Conversation = {
          id: uuidv4(),
          title: 'New Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...partial,
        };
        set((s) => ({ conversations: [conv, ...s.conversations] }));
        return conv;
      },

      updateConversation: (id, updates) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c,
          ),
        }));
      },

      branchConversation: (convId, messageIndex) => {
        const source = _get().conversations.find((c) => c.id === convId);
        const branch: Conversation = {
          id: uuidv4(),
          title: `Branch: ${source?.title ?? 'Conversation'}`,
          messages: source ? source.messages.slice(0, messageIndex + 1) : [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          providerId: source?.providerId,
          model: source?.model,
          systemPrompt: source?.systemPrompt,
          personaId: source?.personaId,
          folderId: source?.folderId,
          routingProfileId: source?.routingProfileId,
          branchOf: convId,
          branchAtMessageIndex: messageIndex,
        };
        set((s) => ({ conversations: [branch, ...s.conversations] }));
        return branch;
      },

      detachBranch: (convId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId && c.branchOf
              ? { ...c, branchOf: undefined, detachedFrom: { convId: c.branchOf, messageIndex: c.branchAtMessageIndex ?? 0 }, branchAtMessageIndex: undefined }
              : c
          ),
        }));
      },

      deleteConversation: (id) => {
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          openTabs: s.openTabs.filter((t) => t !== id),
        }));
      },

      addMessage: (convId, msg) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
              : c,
          ),
        }));
      },

      updateMessage: (convId, msgId, updates) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, ...updates } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        }));
      },

      appendToMessage: (convId, msgId, delta) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + delta } : m,
                  ),
                }
              : c,
          ),
        }));
      },

      appendThinkingToMessage: (convId, msgId, delta) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, thinking: (m.thinking ?? '') + delta } : m,
                  ),
                }
              : c,
          ),
        }));
      },

      finalizeMessage: (convId, msgId, toolCalls) => {
        set((s) => {
          const finalCalls = toolCalls.length ? toolCalls : (
            s.conversations.find((c) => c.id === convId)
              ?.messages.find((m) => m.id === msgId)?.toolCalls ?? []
          );

          const updatedConversations = s.conversations.map((c) => {
            if (c.id !== convId) return c;

            let messages = c.messages.map((m) =>
              m.id === msgId
                ? { ...m, isStreaming: false, toolCalls: finalCalls.length ? finalCalls : m.toolCalls }
                : m,
            );

            // If there are tool calls, append a tool_result message so the history
            // is valid when sent back to Anthropic on the next user turn.
            if (finalCalls.length > 0) {
              // Only add if not already present (avoid duplicates on re-render)
              const alreadyHasResult = messages.some(
                (m) => m.role === 'tool_result' && m.toolCalls?.some((tc) => tc.id === finalCalls[0].id),
              );
              if (!alreadyHasResult) {
                messages = [
                  ...messages,
                  {
                    id: uuidv4(),
                    role: 'tool_result' as const,
                    content: '',
                    toolCalls: finalCalls,
                    timestamp: Date.now(),
                  },
                ];
              }
            }

            return { ...c, messages, updatedAt: Date.now() };
          });

          return { conversations: updatedConversations };
        });
      },

      clearMessages: (convId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, messages: [], updatedAt: Date.now() } : c,
          ),
        }));
      },

      replaceMessages: (convId, messages) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, messages, updatedAt: Date.now() } : c,
          ),
        }));
      },

      setConversations: (convs) => {
        set({
          conversations: convs.map((c) => ({ ...c, messages: c.messages ?? [] })),
        });
      },

      // ── Folders ────────────────────────────────────────────────────────────
      folders: [] as ConversationFolder[],

      createFolder: (name, parentId = null) => {
        const siblings = _get().folders.filter((f) => f.parentId === parentId);
        const order = siblings.length > 0 ? Math.max(...siblings.map((f) => f.order)) + 1 : 0;
        const folder: ConversationFolder = {
          id: uuidv4(),
          name,
          parentId: parentId ?? null,
          order,
          collapsed: false,
        };
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder;
      },

      updateFolder: (id, updates) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        }));
      },

      deleteFolder: (id) => {
        const state = _get();
        // Collect all descendant folder ids recursively
        const collectDescendants = (folderId: string): string[] => {
          const children = state.folders.filter((f) => f.parentId === folderId);
          return [folderId, ...children.flatMap((c) => collectDescendants(c.id))];
        };
        const toDelete = new Set(collectDescendants(id));
        // Move conversations in deleted folders to root
        set((s) => ({
          folders: s.folders.filter((f) => !toDelete.has(f.id)),
          conversations: s.conversations.map((c) =>
            c.folderId && toDelete.has(c.folderId) ? { ...c, folderId: null } : c,
          ),
          folderFiles: s.folderFiles.filter((ff) => !toDelete.has(ff.folderId)),
        }));
      },

      toggleFolderCollapsed: (id) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)),
        }));
      },

      moveConversation: (convId, folderId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, folderId: folderId ?? null } : c,
          ),
        }));
      },

      // ── Folder Files ───────────────────────────────────────────────────────
      folderFiles: [] as FolderFile[],

      addFolderFile: (file) => {
        const newFile: FolderFile = { ...file, id: uuidv4(), createdAt: Date.now() };
        set((s) => ({ folderFiles: [...s.folderFiles, newFile] }));
        return newFile;
      },

      deleteFolderFile: (id) => {
        set((s) => ({ folderFiles: s.folderFiles.filter((f) => f.id !== id) }));
      },

      renameFolderFile: (id, name) => {
        set((s) => ({
          folderFiles: s.folderFiles.map((f) => (f.id === id ? { ...f, name } : f)),
        }));
      },
    }),
    {
      name: 'openconduit-conversations',
      partialize: (state) => ({
        conversations: state.conversations,
        openTabs: state.openTabs,
        folders: state.folders,
        folderFiles: state.folderFiles,
      }),
    },
  ),
);
