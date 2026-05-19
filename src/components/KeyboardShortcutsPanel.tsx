import React, { useEffect, useMemo, useRef, useState } from 'react';
import { commandRegistry } from '../commands/commandRegistry';
import type { CommandContribution } from '../commands/commandRegistry';
import {
  useKeybindingsStore,
  getEffectiveBinding,
} from '../stores/keybindingsStore';
import type { Binding } from '../stores/keybindingsStore';
import { useUiStore } from '../stores/uiStore';
import '../commands/coreCommandContributions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Macintosh'));

function formatBinding(b: Binding): string {
  const parts: string[] = [];
  if (b.mod) parts.push(isMac ? '⌘' : 'Ctrl+');
  if (b.shift) parts.push('⇧');
  if (b.alt) parts.push(isMac ? '⌥' : 'Alt+');

  const key =
    b.key === 'ArrowUp'    ? '↑' :
    b.key === 'ArrowDown'  ? '↓' :
    b.key === 'ArrowLeft'  ? '←' :
    b.key === 'ArrowRight' ? '→' :
    b.key === 'Escape'     ? 'Esc' :
    b.key === 'Enter'      ? '↵' :
    b.key === 'Backspace'  ? '⌫' :
    b.key === 'Delete'     ? '⌦' :
    b.key === 'Tab'        ? '⇥' :
    b.key === ' '          ? 'Space' :
    b.key.length === 1     ? b.key.toUpperCase() : b.key;

  parts.push(key);
  return parts.join('');
}

// Commands that are pure internal aliases — never show in the editor
const ALIAS_IDS = new Set(['core.newConversationAlt']);

// ─── KeyRow ───────────────────────────────────────────────────────────────────

interface KeyRowProps {
  cmd: CommandContribution;
  overrides: Record<string, Binding | null>;
  isRecording: boolean;
  onStartRecord: () => void;
  onCancelRecord: () => void;
  onSave: (b: Binding | null) => void;
  onReset: () => void;
}

function KeyRow({
  cmd,
  overrides,
  isRecording,
  onStartRecord,
  onCancelRecord,
  onSave,
  onReset,
}: KeyRowProps) {
  const effectiveBinding = getEffectiveBinding(cmd, overrides);
  const hasOverride = cmd.id in overrides;

  // Capture key combos while this row is recording
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { onCancelRecord(); return; }
      // Ignore standalone modifier keypresses
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;
      onSave({
        key: e.key,
        mod:   (e.metaKey || e.ctrlKey) || undefined,
        shift: e.shiftKey || undefined,
        alt:   e.altKey   || undefined,
      });
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [isRecording, onCancelRecord, onSave]);

  return (
    <div
      className={`grid grid-cols-[1fr_220px_72px] gap-4 items-center px-6 py-2.5 border-b border-slate-700/30 group transition-colors ${
        isRecording ? 'bg-slate-800' : 'hover:bg-slate-800/50'
      }`}
    >
      {/* Command label */}
      <span className="text-sm text-slate-300 truncate">
        {cmd.label}
        {hasOverride && (
          <span className="ml-2 text-[10px] text-blue-400 font-medium uppercase tracking-wide">
            Modified
          </span>
        )}
      </span>

      {/* Keybinding / recording state */}
      {isRecording ? (
        <span className="text-xs text-blue-400 animate-pulse font-mono">
          Press a key combination…
        </span>
      ) : (
        <button
          onClick={onStartRecord}
          title="Click to change keybinding"
          className="text-left flex items-center gap-1.5 group/kb w-fit"
        >
          {effectiveBinding ? (
            <kbd className="px-2 py-0.5 bg-slate-700 border border-slate-600 group-hover/kb:border-slate-500 rounded text-xs font-mono text-slate-200 transition-colors select-none">
              {formatBinding(effectiveBinding)}
            </kbd>
          ) : (
            <span className="text-slate-600 text-xs italic">Unbound</span>
          )}
          {/* Pencil icon on hover */}
          <svg
            className="w-3 h-3 text-slate-500 opacity-0 group-hover/kb:opacity-100 transition-opacity flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}

      {/* Actions column */}
      <div
        className={`flex items-center gap-0.5 justify-end ${
          isRecording ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}
      >
        {isRecording ? (
          <button
            onClick={onCancelRecord}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
          >
            Cancel
          </button>
        ) : (
          <>
            {/* Remove binding */}
            {effectiveBinding && (
              <button
                onClick={() => onSave(null)}
                title="Remove binding"
                className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Reset to default */}
            {hasOverride && (
              <button
                onClick={onReset}
                title="Reset to default"
                className="text-slate-500 hover:text-blue-400 transition-colors p-1.5 rounded"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function KeyboardShortcutsPanel() {
  const { keyboardShortcutsOpen, setKeyboardShortcutsOpen } = useUiStore();
  const { overrides, setOverride, resetOverride, resetAll } = useKeybindingsStore();

  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (keyboardShortcutsOpen) {
      setQuery('');
      setRecording(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [keyboardShortcutsOpen]);

  // Escape to close the panel (KeyRow's capture handler intercepts while recording)
  useEffect(() => {
    if (!keyboardShortcutsOpen || recording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKeyboardShortcutsOpen(false);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [keyboardShortcutsOpen, recording, setKeyboardShortcutsOpen]);

  const allCommands = useMemo(
    () => commandRegistry.getAll().filter((c) => c.label && !ALIAS_IDS.has(c.id)),
    [],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true;
      const eff = getEffectiveBinding(c, overrides);
      if (eff && formatBinding(eff).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [allCommands, query, overrides]);

  const overrideCount = Object.keys(overrides).length;

  if (!keyboardShortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setKeyboardShortcutsOpen(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[920px] h-[88vh] bg-slate-950 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700/60 flex-shrink-0 bg-slate-900/80">
        <h1 className="text-sm font-semibold text-slate-100 tracking-wide mr-auto">Keyboard Shortcuts</h1>

        {overrideCount > 0 && (
          <button
            onClick={() => {
              if (window.confirm(`Reset all ${overrideCount} modified keybinding${overrideCount > 1 ? 's' : ''} to defaults?`)) {
                resetAll();
              }
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reset all ({overrideCount})
          </button>
        )}

        <button
          onClick={() => setKeyboardShortcutsOpen(false)}
          title="Close (Esc)"
          className="text-slate-400 hover:text-slate-100 transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-700/60 flex-shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search by command name or keybinding (e.g. ⌘T)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_220px_72px] gap-4 px-5 py-2 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700/50 flex-shrink-0">
        <span>Command</span>
        <span>Keybinding</span>
        <span />
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-slate-500 text-sm text-center">
            No commands match &ldquo;{query}&rdquo;
          </p>
        ) : (
          filtered.map((cmd) => (
            <KeyRow
              key={cmd.id}
              cmd={cmd}
              overrides={overrides}
              isRecording={recording === cmd.id}
              onStartRecord={() => setRecording(cmd.id)}
              onCancelRecord={() => setRecording(null)}
              onSave={(b) => { setOverride(cmd.id, b); setRecording(null); }}
              onReset={() => resetOverride(cmd.id)}
            />
          ))
        )}
      </div>
    </div>
    </div>
  );
}
