import React from 'react';
import { extensionRegistry } from '../../extensionRegistry';
import { hookRegistry } from '../../../hooks/hookRegistry';
import { service } from '../../../services';
import { useGitSyncStore } from './gitSyncStore';
import { buildPayload } from './GitSyncPanel';
import { useSettingsStore } from '../../../stores/settingsStore';
import GitSyncPanel from './GitSyncPanel';
import type { SyncPayload } from '../../../types';

// ─── Icon ─────────────────────────────────────────────────────────────────────

const GIT_SYNC_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
    />
  </svg>
);

// ─── Apply a pulled payload back into the stores ──────────────────────────────

export async function applyPayload(payload: SyncPayload) {
  if (payload.conversations && typeof payload.conversations === 'object') {
    const { useConversationStore } = await import('../../../stores/conversationStore');
    const state = useConversationStore.getState();
    const conversations = state.conversations;
    const localMap = new Map(conversations.map((c) => [c.id, c]));

    for (const [id, remote] of Object.entries(payload.conversations)) {
      const local = localMap.get(id);
      const remoteUpdatedAt = (remote as { updatedAt?: number }).updatedAt ?? 0;
      const localUpdatedAt = local?.updatedAt ?? 0;
      if (!local || remoteUpdatedAt > localUpdatedAt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localMap.set(id, remote as any);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state as any).setConversations?.([...localMap.values()]);
  }

  if (payload.personas) {
    const personasMod = await import('../personas/personasStore').catch((): null => null);
    if (personasMod) {
      const state = personasMod.usePersonasStore.getState() as {
        importPersonas?: (p: unknown) => void;
      };
      state.importPersonas?.(payload.personas);
    }
  }

  if (payload.prompts && Array.isArray(payload.prompts)) {
    const { usePromptTemplatesStore } = await import('../../../stores/promptTemplatesStore');
    const state = usePromptTemplatesStore.getState() as {
      templates: Array<{ id: string }>;
      addTemplate: (t: unknown) => void;
      updateTemplate: (id: string, t: unknown) => void;
    };
    const localIds = new Set(state.templates.map((t) => t.id));

    for (const tpl of (payload.prompts as Array<{ id: string }>)) {
      if (localIds.has(tpl.id)) {
        state.updateTemplate(tpl.id, tpl);
      } else {
        state.addTemplate(tpl);
      }
    }
  }
}

// ─── Auto-sync runner ─────────────────────────────────────────────────────────

async function runAutoSync() {
  const { config, setSyncing, setSyncResult } = useGitSyncStore.getState();
  if (!config.enabled || !config.autoSync || !config.repoPath) return;

  setSyncing(true);
  try {
    const { settings } = useSettingsStore.getState();
    const payload = await buildPayload(config.syncTargets, settings);
    const result = await service.sync?.push(payload);
    setSyncResult(
      result?.success ? Date.now() : null,
      result?.success ? null : (result?.error ?? 'Push failed.'),
    );
  } catch (err) {
    setSyncResult(null, err instanceof Error ? err.message : 'Auto-sync failed.');
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

extensionRegistry.registerExtension(
  {
    id: 'openconduit.gitSync',
    name: 'Git Sync',
    version: '1.0.0',
    description:
      'Version-control your conversations, personas, prompts, and settings in a ' +
      'local git repository with optional remote push/pull.',
    author: 'OpenConduit',

    activate() {
      // Auto-sync hook: push after each completed AI response
      hookRegistry.registerOnResponse('openconduit.gitSync:auto-push', () => {
        runAutoSync().catch(console.error);
      });
    },
  },
  {
    activityBarItems: [
      {
        panelId: 'gitSync',
        label: 'Git Sync',
        icon: GIT_SYNC_ICON,
        panel: GitSyncPanel,
        order: 40,
      },
    ],

    stores: [
      {
        id: 'openconduit.gitSync.store',
        store: useGitSyncStore,
      },
    ],
  },
);

