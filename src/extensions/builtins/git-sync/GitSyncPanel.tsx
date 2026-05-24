import React, { useState, useCallback } from 'react';
import { useGitSyncStore } from './gitSyncStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { service } from '../../../services';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number | null): string {
  if (!ms) return 'Never';
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5 ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
      {title}
    </p>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function GitSyncPanel() {
  const { config, isSyncing, setConfig, setSyncTargets } =
    useGitSyncStore();
  const { settings } = useSettingsStore();

  // Local state for token input (never persisted to Zustand)
  const [tokenDraft, setTokenDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Browse for repo path ───────────────────────────────────────────────────
  const handleBrowse = useCallback(async () => {
    const picked = await service.folder?.pick();
    if (picked) setConfig({ repoPath: picked });
  }, [setConfig]);

  // ── Save & initialize ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!config.repoPath.trim()) {
      setStatusMsg({ type: 'err', text: 'Repo path is required.' });
      return;
    }
    setStatusMsg(null);

    // Persist remote URL and token (sensitive) to electron-store settings
    const settingsUpdate: Record<string, string> = {
      syncRepoPath: config.repoPath,
      syncRemoteUrl: config.remoteUrl,
    };
    if (tokenDraft) {
      (settingsUpdate as Record<string, string>).syncRemoteToken = tokenDraft;
    }
    await service.settings.set(settingsUpdate as Parameters<typeof service.settings.set>[0]);

    const result = await service.sync?.configure();
    if (result?.success) {
      setStatusMsg({ type: 'ok', text: 'Repo initialised.' });
      setTokenDraft('');
    } else {
      setStatusMsg({ type: 'err', text: result?.error ?? 'Init failed.' });
    }
  }, [config.repoPath, config.remoteUrl, tokenDraft]);

  // ── Sync now ──────────────────────────────────────────────────────────────
  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setStatusMsg(null);

    const store = useGitSyncStore.getState();
    store.setSyncing(true);

    try {
      // 1. Pull remote data and merge into stores
      const pullResult = await service.sync?.pull();
      if (pullResult && !pullResult.success) {
        store.setSyncResult(null, pullResult.error ?? 'Pull failed.');
        setStatusMsg({ type: 'err', text: pullResult.error ?? 'Pull failed.' });
        return;
      }

      // 2. Build push payload from current store state
      const payload = await buildPayload(config.syncTargets, settings);

      // 3. Push
      const pushResult = await service.sync?.push(payload);
      if (pushResult && !pushResult.success) {
        store.setSyncResult(null, pushResult.error ?? 'Push failed.');
        setStatusMsg({ type: 'err', text: pushResult.error ?? 'Push failed.' });
        return;
      }

      store.setSyncResult(Date.now(), null);
      setStatusMsg({ type: 'ok', text: 'Sync complete.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      store.setSyncResult(null, msg);
      setStatusMsg({ type: 'err', text: msg });
    }
  }, [isSyncing, config.syncTargets, settings]);

  const lastSyncAt = useGitSyncStore((s) => s.lastSyncAt);
  const lastError = useGitSyncStore((s) => s.lastError);

  const hasRepoPath = config.repoPath.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 text-sm overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="font-semibold text-slate-100">Git Sync</span>
        </div>
        <button
          role="switch"
          aria-checked={config.enabled}
          onClick={() => setConfig({ enabled: !config.enabled })}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.enabled ? 'bg-blue-600' : 'bg-slate-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">

        {/* Repository */}
        <div>
          <SectionHeader title="Repository" />
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Repo path</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={config.repoPath}
                  onChange={(e) => setConfig({ repoPath: e.target.value })}
                  placeholder="/path/to/my-sync-repo"
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleBrowse}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition-colors flex-shrink-0"
                >
                  Browse
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Remote URL <span className="text-slate-600">(optional)</span></label>
              <input
                type="text"
                value={config.remoteUrl}
                onChange={(e) => setConfig({ remoteUrl: e.target.value })}
                placeholder="https://github.com/you/sync-repo.git"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Personal access token <span className="text-slate-600">(stored securely, never synced)</span>
              </label>
              <input
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder={settings?.syncRemoteToken ? '••••••••••••' : 'github_pat_…'}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoComplete="off"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!hasRepoPath}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors"
            >
              Save &amp; Initialise Repo
            </button>

            {statusMsg && (
              <p className={`text-xs ${statusMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {statusMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* What to sync */}
        <div>
          <SectionHeader title="What to sync" />
          <div className="space-y-3">
            <ToggleRow
              label="Conversations"
              description="All messages and conversation history"
              checked={config.syncTargets.conversations}
              onChange={(v) => setSyncTargets({ conversations: v })}
            />
            <ToggleRow
              label="Personas"
              description="Custom AI personas and system prompts"
              checked={config.syncTargets.personas}
              onChange={(v) => setSyncTargets({ personas: v })}
            />
            <ToggleRow
              label="Prompt templates"
              description="Installed and custom prompt templates"
              checked={config.syncTargets.prompts}
              onChange={(v) => setSyncTargets({ prompts: v })}
            />
            <ToggleRow
              label="Settings"
              description="Non-sensitive settings (no API keys)"
              checked={config.syncTargets.settings}
              onChange={(v) => setSyncTargets({ settings: v })}
            />
          </div>
        </div>

        {/* Options */}
        <div>
          <SectionHeader title="Options" />
          <ToggleRow
            label="Auto-sync after each response"
            description="Commit and push after every AI response"
            checked={config.autoSync}
            onChange={(v) => setConfig({ autoSync: v })}
          />
        </div>

        {/* Status + Sync Now */}
        <div>
          <SectionHeader title="Status" />
          <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Last synced</span>
              <span className="text-slate-200">{formatTime(lastSyncAt)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Enabled</span>
              <span className={config.enabled ? 'text-green-400' : 'text-slate-500'}>
                {config.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Auto-sync</span>
              <span className={config.autoSync ? 'text-green-400' : 'text-slate-500'}>
                {config.autoSync ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          {lastError && (
            <p className="mt-2 text-xs text-red-400 break-all">{lastError}</p>
          )}

          <button
            onClick={handleSyncNow}
            disabled={isSyncing || !hasRepoPath || !config.enabled}
            className="mt-3 w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              'Sync Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payload builder (used by panel + auto-sync hook) ─────────────────────────

export async function buildPayload(
  targets: ReturnType<typeof useGitSyncStore.getState>['config']['syncTargets'],
  settings: ReturnType<typeof useSettingsStore.getState>['settings'],
): Promise<import('../../../types').SyncPayload> {
  const payload: import('../../../types').SyncPayload = {};

  if (targets.conversations) {
    const { useConversationStore } = await import('../../../stores/conversationStore');
    const { conversations } = useConversationStore.getState();
    payload.conversations = Object.fromEntries(conversations.map((c) => [c.id, c]));
  }

  if (targets.personas) {
    const { usePersonasStore } = await import('../personas/personasStore');
    const { personas } = usePersonasStore.getState();
    payload.personas = personas;
  }

  if (targets.prompts) {
    const { usePromptTemplatesStore } = await import('../../../stores/promptTemplatesStore');
    const { templates } = usePromptTemplatesStore.getState();
    payload.prompts = templates;
  }

  if (targets.settings && settings) {
    // Exclude all sensitive fields: providers (API keys), syncRemoteToken
    const { providers: _p, syncRemoteToken: _t, ...nonSensitive } = settings;
    payload.settings = nonSensitive;
  }

  return payload;
}
