import React, { useState } from 'react';
import { usePersonasStore } from './personasStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Persona } from '../../../types';

// ─── Colour palette ────────────────────────────────────────────────────────

const PALETTE = [
  '#64748b', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7',
];

// ─── PersonaEditor ─────────────────────────────────────────────────────────

interface EditorProps {
  initial?: Partial<Persona>;
  onSave: (data: Omit<Persona, 'id' | 'isDefault'>) => void;
  onCancel: () => void;
}

function PersonaEditor({ initial, onSave, onCancel }: EditorProps) {
  const { settings } = useSettingsStore();
  const [name, setName] = useState(initial?.name ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[1]);
  const [defaultProviderId, setDefaultProviderId] = useState(initial?.defaultProviderId ?? '');
  const [defaultModel, setDefaultModel] = useState(initial?.defaultModel ?? '');

  const providers = settings?.providers ?? [];

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      systemPrompt,
      color,
      defaultProviderId: defaultProviderId || undefined,
      defaultModel: defaultModel || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Name + colour */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <input
          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          placeholder="Persona name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      {/* Colour picker */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Colour</label>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-slate-100 ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      {/* System prompt */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">System Prompt</label>
        <textarea
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="You are a helpful assistant…"
          rows={6}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      {/* Provider + model override */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Default Provider <span className="text-slate-500">(optional)</span></label>
          <select
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            value={defaultProviderId}
            onChange={(e) => { setDefaultProviderId(e.target.value); setDefaultModel(''); }}
          >
            <option value="">— use conversation default —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Default Model <span className="text-slate-500">(optional)</span></label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder={defaultProviderId ? 'e.g. claude-sonnet-4-5' : ''}
            disabled={!defaultProviderId}
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40"
          disabled={!name.trim()}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── PersonaRow ────────────────────────────────────────────────────────────

interface RowProps {
  persona: Persona;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function PersonaRow({ persona, onEdit, onDuplicate, onDelete }: RowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 group transition-colors">
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: persona.color ?? '#64748b' }}
      >
        {persona.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100 truncate">{persona.name}</span>
          {persona.isDefault && (
            <span className="text-xs text-slate-400 bg-slate-600 px-1.5 py-0.5 rounded">default</span>
          )}
        </div>
        {persona.systemPrompt && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{persona.systemPrompt}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 text-slate-400 hover:text-slate-100 rounded transition-colors"
          title="Duplicate"
          onClick={onDuplicate}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {!persona.isDefault && (
          <>
            <button
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded transition-colors"
              title="Edit"
              onClick={onEdit}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-colors"
              title="Delete"
              onClick={onDelete}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PersonasPanel ─────────────────────────────────────────────────────────

type Mode = 'list' | 'create' | { edit: Persona };

export default function PersonasPanel() {
  const { personas, addPersona, updatePersona, deletePersona, duplicatePersona, importPersonas } = usePersonasStore();
  const [mode, setMode] = useState<Mode>('list');

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const arr: Persona[] = Array.isArray(data) ? data : [data];
          importPersonas(arr);
        } catch {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    const exportable = personas.filter((p) => !p.isDefault);
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openconduit-personas.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button className="text-slate-400 hover:text-slate-100" onClick={() => setMode('list')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-slate-100">New Persona</h3>
        </div>
        <PersonaEditor
          onSave={(data) => { addPersona(data); setMode('list'); }}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  if (typeof mode === 'object' && 'edit' in mode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button className="text-slate-400 hover:text-slate-100" onClick={() => setMode('list')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-slate-100">Edit Persona</h3>
        </div>
        <PersonaEditor
          initial={mode.edit}
          onSave={(data) => { updatePersona(mode.edit.id, data); setMode('list'); }}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Personas</h3>
          <p className="text-xs text-slate-400 mt-0.5">Reusable system prompt + model bundles for your conversations.</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          onClick={() => setMode('create')}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      <div className="space-y-1.5">
        {personas.map((p) => (
          <PersonaRow
            key={p.id}
            persona={p}
            onEdit={() => setMode({ edit: p })}
            onDuplicate={() => duplicatePersona(p.id)}
            onDelete={() => {
              if (confirm(`Delete "${p.name}"?`)) deletePersona(p.id);
            }}
          />
        ))}
      </div>

      {/* Import / Export */}
      <div className="flex gap-2 pt-2 border-t border-slate-700">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          onClick={handleImport}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import JSON
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          onClick={handleExport}
          disabled={personas.filter((p) => !p.isDefault).length === 0}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export JSON
        </button>
      </div>
    </div>
  );
}
