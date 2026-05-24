import React, { useState, useCallback } from 'react';
import {
  useBackgroundAssistantStore,
  type TriggerMode,
  type BackgroundNote,
} from './backgroundAssistantStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useConversationStore } from '../../../stores/conversationStore';
import { useUiStore } from '../../../stores/uiStore';
import { service } from '../../../services';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TRIGGER_MODE_LABELS: Record<TriggerMode, string> = {
  onDemand: 'On demand',
  afterEachResponse: 'After each response',
  onRequest: 'On trigger phrase',
};

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: BackgroundNote }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex-1 text-xs text-slate-400 font-mono truncate">
          {formatTime(note.createdAt)}
        </span>
        <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-slate-800/50 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
          {note.text}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function BackgroundAssistantPanel() {
  const { config, notesByMessageId, isRunning, setConfig, clearNotes, addNote, setRunning } =
    useBackgroundAssistantStore();
  const { settings } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(!config.enabled);
  const [runError, setRunError] = useState<string | null>(null);

  const providers = (settings?.providers ?? []) as Array<{ id: string; name: string }>;
  const defaultProviderId = settings?.defaultProviderId ?? '';
  const defaultModel = settings?.defaultModel ?? '';

  // Collect all notes across all messages, sorted newest first
  const allNotes: BackgroundNote[] = Object.values(notesByMessageId)
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleRunNow = useCallback(async () => {
    setRunError(null);

    const activeId = useUiStore.getState().activeConversationId;
    const conversation = useConversationStore.getState().conversations.find(
      (c) => c.id === activeId,
    );
    if (!conversation || conversation.messages.length === 0) {
      setRunError('No active conversation. Start a chat first.');
      return;
    }

    const lastAssistant = [...conversation.messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastAssistant) {
      setRunError('No assistant message yet. Send a message first.');
      return;
    }

    const providerId = config.providerId || defaultProviderId;
    const model = config.model || defaultModel;
    if (!providerId || !model) {
      setRunError('No provider/model configured. Set one in Settings or configure one above.');
      return;
    }

    const contextMessages = conversation.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setRunning(true);
    try {
      const result = await service.chat.complete({
        providerId,
        model,
        systemPrompt: config.persona,
        messages: contextMessages,
      });
      if (result.text.trim()) {
        addNote(lastAssistant.id, {
          id: `${lastAssistant.id}-${Date.now()}`,
          text: result.text.trim(),
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Background call failed.');
    } finally {
      setRunning(false);
    }
  }, [config, defaultProviderId, defaultModel, setRunning, addNote]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">Background Assistant</span>
          {isRunning && (
            <span className="text-xs text-blue-400 animate-pulse">Running…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Enable toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-slate-400">Enabled</span>
            <div
              role="switch"
              aria-checked={config.enabled}
              onClick={() => setConfig({ enabled: !config.enabled })}
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors focus-visible:outline ${
                config.enabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  config.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>
          <button
            className="p-1 text-slate-400 hover:text-slate-200"
            onClick={() => setShowSettings((v) => !v)}
            title="Configure"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-slate-800 px-4 py-3 space-y-3 bg-slate-800/40">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Configuration</p>

          {/* Trigger mode */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Trigger mode</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              value={config.triggerMode}
              onChange={(e) => setConfig({ triggerMode: e.target.value as TriggerMode })}
            >
              {(Object.keys(TRIGGER_MODE_LABELS) as TriggerMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {TRIGGER_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger phrase (only when onRequest) */}
          {config.triggerMode === 'onRequest' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Trigger phrase</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="/verify"
                value={config.triggerPhrase}
                onChange={(e) => setConfig({ triggerPhrase: e.target.value })}
              />
            </div>
          )}

          {/* Provider */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Provider <span className="text-slate-600">(leave empty for app default)</span>
            </label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              value={config.providerId}
              onChange={(e) => setConfig({ providerId: e.target.value, model: '' })}
            >
              <option value="">Use app default</option>
              {providers.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Model <span className="text-slate-600">(leave empty for app default)</span>
            </label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g. gpt-4o-mini"
              value={config.model}
              onChange={(e) => setConfig({ model: e.target.value })}
            />
          </div>

          {/* Persona */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Persona / system prompt</label>
            <textarea
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
              value={config.persona}
              onChange={(e) => setConfig({ persona: e.target.value })}
            />
          </div>

          <button
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={() => setShowSettings(false)}
          >
            Hide settings
          </button>
        </div>
      )}

      {/* On-demand run button */}
      {config.enabled && config.triggerMode === 'onDemand' && (
        <div className="px-4 py-3 border-b border-slate-800">
          <button
            disabled={isRunning}
            onClick={() => void handleRunNow()}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {isRunning ? 'Running…' : 'Ask background assistant'}
          </button>
          {runError && (
            <p className="mt-2 text-xs text-red-400">{runError}</p>
          )}
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {allNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-slate-600">
            <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">
              {config.enabled
                ? config.triggerMode === 'onDemand'
                  ? 'Click "Ask background assistant" to analyse the conversation.'
                  : config.triggerMode === 'afterEachResponse'
                  ? 'Notes will appear here after each assistant response.'
                  : `Include "${config.triggerPhrase}" in your message to trigger analysis.`
                : 'Enable the background assistant to start collecting notes.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                {allNotes.length} note{allNotes.length !== 1 ? 's' : ''}
              </span>
              <button
                className="text-xs text-slate-600 hover:text-slate-400"
                onClick={clearNotes}
              >
                Clear all
              </button>
            </div>
            {allNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
