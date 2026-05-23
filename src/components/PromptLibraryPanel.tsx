import React, { useState, useRef, useMemo } from 'react';
import { usePromptTemplatesStore } from '../stores/promptTemplatesStore';
import type { InstalledPromptTemplate } from '../stores/promptTemplatesStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Replaces {{varName}} placeholders with supplied values. */
function resolveTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? `{{${name}}}`);
}

// ─── Variable fill-in form ─────────────────────────────────────────────────────

interface VarFormProps {
  template: InstalledPromptTemplate;
  onInsert: (text: string) => void;
  onBack: () => void;
}

function VarForm({ template, onInsert, onBack }: VarFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((v) => [v.name, String(v.default ?? '')])),
  );

  const set = (name: string, val: string) => setValues((prev) => ({ ...prev, [name]: val }));

  return (
    <div className="p-3 space-y-3">
      {/* Back + title */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          title="Back"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-medium text-slate-200 truncate">{template.name}</span>
      </div>

      {/* Variable fields */}
      <div className="space-y-2.5">
        {template.variables.map((v) => (
          <div key={v.name}>
            <label className="block text-[11px] text-slate-400 mb-1">{v.label}</label>
            {v.type === 'select' && v.options ? (
              <select
                value={values[v.name] ?? ''}
                onChange={(e) => set(v.name, e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {v.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : v.type === 'textarea' ? (
              <textarea
                value={values[v.name] ?? ''}
                onChange={(e) => set(v.name, e.target.value)}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            ) : (
              <input
                type={v.type === 'number' ? 'number' : 'text'}
                value={values[v.name] ?? ''}
                onChange={(e) => set(v.name, e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onInsert(resolveTemplate(template.template, values))}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
        >
          Insert
        </button>
        <button
          onClick={onBack}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  /** Called with the resolved template text when user confirms insertion. */
  onInsert: (text: string) => void;
  onClose: () => void;
  /** Called when user clicks "Manage" or "New prompt" — should open Settings → prompts. */
  onManage: () => void;
}

export default function PromptLibraryPanel({ onInsert, onClose, onManage }: Props) {
  const { templates } = usePromptTemplatesStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<InstalledPromptTemplate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const handleSelect = (t: InstalledPromptTemplate) => {
    if (t.variables.length > 0) {
      setSelected(t);
    } else {
      onInsert(t.template);
      onClose();
    }
  };

  // Variable fill-in view
  if (selected) {
    return (
      <div className="w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50">
        <VarForm
          template={selected}
          onInsert={(text) => { onInsert(text); onClose(); }}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 flex flex-col" style={{ maxHeight: '360px' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-slate-700/50 flex-shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Prompt Library</p>
        <button
          onClick={() => { onManage(); onClose(); }}
          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          Manage
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts…"
            autoFocus
            className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg pl-6 pr-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      {/* Template list */}
      <div className="overflow-y-auto flex-1">
        {templates.length === 0 ? (
          <div className="px-4 py-6 text-center space-y-2">
            <p className="text-xs text-slate-500">No prompts installed yet.</p>
            <button
              onClick={() => { onManage(); onClose(); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Browse Marketplace →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500 text-center">No prompts match "{query}"</p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-700/40 transition-colors group"
            >
              <span className="text-base leading-none flex-shrink-0 mt-0.5">📝</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-slate-200 truncate">{t.name}</span>
                  {t.variables.length > 0 && (
                    <span className="text-[9px] px-1 py-px rounded bg-slate-700 text-slate-400 flex-shrink-0">
                      {t.variables.length} var{t.variables.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                )}
              </div>
              <svg
                className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))
        )}
      </div>

      {/* Footer — new prompt shortcut */}
      <div className="border-t border-slate-700/50 px-3 py-2 flex-shrink-0">
        <button
          onClick={() => { onManage(); onClose(); }}
          className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New prompt
        </button>
      </div>
    </div>
  );
}
