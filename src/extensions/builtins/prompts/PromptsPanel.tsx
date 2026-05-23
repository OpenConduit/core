import React, { useState } from 'react';
import { usePromptTemplatesStore } from '../../../stores/promptTemplatesStore';
import type { InstalledPromptTemplate } from '../../../stores/promptTemplatesStore';

// ─── PromptEditor ──────────────────────────────────────────────────────────────

interface EditorProps {
  initial?: Partial<InstalledPromptTemplate>;
  onSave: (data: Omit<InstalledPromptTemplate, 'id'>) => void;
  onCancel: () => void;
}

function PromptEditor({ initial, onSave, onCancel }: EditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [template, setTemplate] = useState(initial?.template ?? '');

  const handleSave = () => {
    if (!name.trim() || !template.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      template: template.trim(),
      variables: initial?.variables ?? [],
      author: initial?.author ?? 'You',
      verified: initial?.verified ?? false,
      version: initial?.version ?? '1.0.0',
      fromRegistry: initial?.fromRegistry ?? false,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 rounded-lg transition-colors flex-shrink-0"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-100">
          {initial?.name ? 'Edit Prompt' : 'New Prompt'}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Name</label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="e.g. Summarize in bullet points"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Description <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="Short description shown in the prompt library…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Template
            <span className="text-slate-500 font-normal ml-1">
              — use <code className="text-amber-400/80 bg-slate-700/60 px-1 rounded text-[11px]">{'{{variable}}'}</code> for fill-in placeholders
            </span>
          </label>
          <textarea
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none font-mono leading-relaxed"
            placeholder={'Summarize the following text in bullet points:\n\n{{text}}'}
            rows={10}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
          <p className="text-[11px] text-slate-600 mt-1">
            Variables defined with {'{{name}}'} will prompt for values before inserting.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          onClick={handleSave}
          disabled={!name.trim() || !template.trim()}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── PromptsPanel ──────────────────────────────────────────────────────────────

export default function PromptsPanel() {
  const { templates, addTemplate, updateTemplate, removeTemplate } = usePromptTemplatesStore();
  const [mode, setMode] = useState<'list' | 'new' | { edit: InstalledPromptTemplate }>('list');

  const userTemplates = templates.filter((t) => !t.fromRegistry);
  const registryTemplates = templates.filter((t) => t.fromRegistry);

  if (mode === 'new') {
    return (
      <PromptEditor
        onSave={(data) => { addTemplate(data); setMode('list'); }}
        onCancel={() => setMode('list')}
      />
    );
  }

  if (typeof mode === 'object' && 'edit' in mode) {
    return (
      <PromptEditor
        initial={mode.edit}
        onSave={(data) => { updateTemplate(mode.edit.id, data); setMode('list'); }}
        onCancel={() => setMode('list')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Prompt Library</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Saved prompts are available in the toolbar for quick insertion into any chat.
          </p>
        </div>
        <button
          onClick={() => setMode('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Prompt
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="text-center py-10 border border-slate-700/40 rounded-xl bg-slate-800/30">
          <p className="text-sm text-slate-500 mb-1">No prompts yet.</p>
          <p className="text-xs text-slate-600">
            Create your own above, or install prompts from the Marketplace.
          </p>
        </div>
      )}

      {/* User-created prompts */}
      {userTemplates.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2.5">My Prompts</h4>
          <div className="space-y-2">
            {userTemplates.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl"
              >
                <span className="text-lg mt-0.5 flex-shrink-0">📝</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                  <p className="text-[11px] text-slate-600 mt-1.5 font-mono line-clamp-2 leading-relaxed">
                    {t.template}
                  </p>
                  {t.variables.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {t.variables.map((v) => (
                        <span key={v.name} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400/80 border border-amber-700/30 font-mono">
                          {`{{${v.name}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setMode({ edit: t })}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${t.name}"?`)) removeTemplate(t.id); }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-700 text-slate-500 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marketplace-installed prompts */}
      {registryTemplates.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">From Marketplace</h4>
          <p className="text-[11px] text-slate-600 mb-2.5">
            Installed via the Marketplace. To remove them, use the Marketplace panel.
          </p>
          <div className="space-y-2">
            {registryTemplates.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl"
              >
                <span className="text-lg mt-0.5 flex-shrink-0">📝</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-medium text-slate-100 truncate">{t.name}</p>
                    {t.verified && (
                      <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/40">
                      Registry
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">{t.description}</p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    by {t.author} · v{t.version}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
