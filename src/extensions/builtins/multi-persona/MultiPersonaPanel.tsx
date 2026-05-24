import React from 'react';
import { useConversationStore } from '../../../stores/conversationStore';
import { useUiStore } from '../../../stores/uiStore';
import { usePersonasStore } from '../personas/personasStore';

const MODE_ID = 'multiPersona';
const MIN_PERSONAS = 2;
const MAX_PERSONAS = 4;

export default function MultiPersonaPanel() {
  const { conversations, updateConversation } = useConversationStore();
  const activeConversationId = useUiStore((s) => s.activeConversationId);
  const personas = usePersonasStore((s) => s.personas);

  const conv = conversations.find((c) => c.id === activeConversationId) ?? null;
  const panelActive = conv?.conversationModeId === MODE_ID;
  const panelPersonaIds = conv?.panelPersonaIds ?? [];

  const nonDefaultPersonas = personas.filter((p) => !p.isDefault);

  function toggleMode() {
    if (!conv) return;
    updateConversation(conv.id, {
      conversationModeId: panelActive ? undefined : MODE_ID,
    });
  }

  function togglePersona(personaId: string) {
    if (!conv) return;
    const current = conv.panelPersonaIds ?? [];
    const isSelected = current.includes(personaId);
    if (!isSelected && current.length >= MAX_PERSONAS) return;
    const next = isSelected
      ? current.filter((id) => id !== personaId)
      : [...current, personaId];
    updateConversation(conv.id, { panelPersonaIds: next });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-sm font-semibold text-slate-100">Multi-Persona Panel</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Multiple AI personas respond to each message in one conversation.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* No conversation selected */}
        {!conv && (
          <p className="text-xs text-slate-500 text-center mt-8">
            Open a conversation to configure panel mode.
          </p>
        )}

        {conv && (
          <>
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-200">Panel mode</p>
                <p className="text-[11px] text-slate-500">
                  {panelPersonaIds.length < MIN_PERSONAS
                    ? `Select at least ${MIN_PERSONAS} personas to enable`
                    : panelActive
                      ? 'Active — each message gets responses from all personas'
                      : 'Inactive'}
                </p>
              </div>
              <button
                onClick={toggleMode}
                disabled={!panelActive && panelPersonaIds.length < MIN_PERSONAS}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  panelActive ? 'bg-blue-600' : 'bg-slate-700'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                aria-pressed={panelActive}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    panelActive ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Persona list */}
            <div>
              <p className="text-[11px] text-slate-500 mb-2">
                Select 2–4 personas ({panelPersonaIds.length}/{MAX_PERSONAS} selected)
              </p>
              {nonDefaultPersonas.length === 0 && (
                <p className="text-xs text-slate-500">
                  No personas yet — create some in the Personas panel.
                </p>
              )}
              <div className="space-y-1.5">
                {nonDefaultPersonas.map((persona) => {
                  const selected = panelPersonaIds.includes(persona.id);
                  const disabled = !selected && panelPersonaIds.length >= MAX_PERSONAS;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => togglePersona(persona.id)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                        selected
                          ? 'bg-slate-700 ring-1 ring-blue-500/50'
                          : 'bg-slate-800 hover:bg-slate-700/60'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {/* Color dot */}
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: persona.color ?? '#64748b' }}
                      />
                      <span className="text-xs text-slate-200 flex-1 truncate">{persona.name}</span>
                      {selected && (
                        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active panel preview */}
            {panelPersonaIds.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 mb-2">Response order</p>
                <div className="space-y-1">
                  {panelPersonaIds.map((id, i) => {
                    const p = personas.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="text-[10px] text-slate-600 w-4 text-right">{i + 1}.</span>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color ?? '#64748b' }}
                        />
                        <span className="truncate">{p.name}</span>
                        {p.defaultModel && (
                          <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">{p.defaultModel}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
