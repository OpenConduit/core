import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  usePipelinesStore,
  type Pipeline,
  type PipelineStep,
  type PipelineRun,
} from './pipelinesStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { service } from '../../../services';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{user_input\}\}/g, vars['user_input'] ?? '')
    .replace(/\{\{previous_output\}\}/g, vars['previous_output'] ?? '');
}

function elapsedLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Step editor ─────────────────────────────────────────────────────────────

interface StepEditorProps {
  step: PipelineStep;
  index: number;
  total: number;
  providers: { id: string; name: string }[];
  onChange(updated: PipelineStep): void;
  onRemove(): void;
  onMoveUp(): void;
  onMoveDown(): void;
}

function StepEditor({ step, index, total, providers, onChange, onRemove, onMoveUp, onMoveDown }: StepEditorProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <span className="text-slate-500 text-xs font-mono w-5 text-center">{index + 1}</span>
        <span className="flex-1 text-sm text-slate-200 truncate">{step.name || `Step ${index + 1}`}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={index === 0} onClick={onMoveUp} className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30">↑</button>
          <button disabled={index === total - 1} onClick={onMoveDown} className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30">↓</button>
          <button onClick={onRemove} className="p-1 text-slate-500 hover:text-red-400">✕</button>
        </div>
        <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 bg-slate-800/50">
          {/* Name */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Step Name</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder={`Step ${index + 1}`}
              value={step.name}
              onChange={(e) => onChange({ ...step, name: e.target.value })}
            />
          </div>

          {/* Prompt template */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Prompt Template
              <span className="ml-2 text-slate-600 font-normal">
                variables: <code className="text-blue-400">{'{{user_input}}'}</code>
                {index > 0 && <> · <code className="text-purple-400">{'{{previous_output}}'}</code></>}
              </span>
            </label>
            <textarea
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
              placeholder={index === 0 ? 'Summarise the following text:\n\n{{user_input}}' : 'Given this context:\n{{previous_output}}\n\nNow do…'}
              value={step.promptTemplate}
              onChange={(e) => onChange({ ...step, promptTemplate: e.target.value })}
            />
          </div>

          {/* System prompt (optional) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">System Prompt <span className="text-slate-600">(optional)</span></label>
            <textarea
              rows={2}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
              placeholder="Leave blank to use the app default"
              value={step.systemPrompt ?? ''}
              onChange={(e) => onChange({ ...step, systemPrompt: e.target.value || undefined })}
            />
          </div>

          {/* Provider / model (optional) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Provider <span className="text-slate-600">(optional)</span></label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                value={step.providerId ?? ''}
                onChange={(e) => onChange({ ...step, providerId: e.target.value || undefined, model: undefined })}
              >
                <option value="">— app default —</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model <span className="text-slate-600">(optional)</span></label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder={step.providerId ? 'e.g. gpt-4o' : ''}
                disabled={!step.providerId}
                value={step.model ?? ''}
                onChange={(e) => onChange({ ...step, model: e.target.value || undefined })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline editor ──────────────────────────────────────────────────────────

interface PipelineEditorProps {
  initial?: Pipeline;
  onSave(p: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): void;
  onCancel(): void;
}

function PipelineEditor({ initial, onSave, onCancel }: PipelineEditorProps) {
  const { settings } = useSettingsStore();
  const providers = settings?.providers ?? [];

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps, setSteps] = useState<PipelineStep[]>(
    initial?.steps ?? [{ id: uuidv4(), name: '', promptTemplate: '' }],
  );

  const updateStep = useCallback((index: number, updated: PipelineStep) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, { id: uuidv4(), name: '', promptTemplate: '' }]);
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    if (steps.length === 0) return;
    onSave({ name: name.trim(), description: description.trim() || undefined, steps });
  };

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every((s) => s.promptTemplate.trim());

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-slate-200">{initial ? 'Edit Pipeline' : 'New Pipeline'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name & description */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Pipeline Name <span className="text-red-400">*</span></label>
          <input
            autoFocus
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="e.g. Research → Summary → Email"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Description <span className="text-slate-600">(optional)</span></label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="What does this pipeline do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Steps ({steps.length})</span>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <StepEditor
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                providers={providers}
                onChange={(u) => updateStep(i, u)}
                onRemove={() => removeStep(i)}
                onMoveUp={() => moveStep(i, -1)}
                onMoveDown={() => moveStep(i, 1)}
              />
            ))}
          </div>
          <button
            onClick={addStep}
            className="mt-2 w-full border border-dashed border-slate-600 rounded-lg py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700 flex-shrink-0">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {initial ? 'Save Changes' : 'Create Pipeline'}
        </button>
      </div>
    </div>
  );
}

// ─── Pipeline runner ──────────────────────────────────────────────────────────

interface PipelineRunnerProps {
  pipeline: Pipeline;
  onBack(): void;
}

function PipelineRunner({ pipeline, onBack }: PipelineRunnerProps) {
  const { settings } = useSettingsStore();
  const { startRun, updateStepResult, finishRun, getRunsForPipeline } = usePipelinesStore();

  const [userInput, setUserInput] = useState('');
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});
  const [runError, setRunError] = useState<string | null>(null);
  const isRunning = useRef(false);

  const defaultProviderId = settings?.defaultProviderId ?? '';
  const defaultModel = settings?.defaultModel ?? '';
  const defaultParameters = settings?.defaultParameters;

  const startPipeline = useCallback(async () => {
    if (isRunning.current || !pipeline.steps.length) return;
    isRunning.current = true;
    setRunError(null);
    setStepOutputs({});
    setStepStatuses({});

    const run = startRun(pipeline.id, pipeline.steps.map((s) => s.id));
    setActiveRun(run);

    let previousOutput = '';

    try {
      for (const step of pipeline.steps) {
        const input = applyTemplate(step.promptTemplate, {
          user_input: userInput,
          previous_output: previousOutput,
        });

        // Mark as running
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'running' }));
        updateStepResult(run.id, step.id, { input, status: 'running' });

        const providerId = step.providerId || defaultProviderId;
        const model = step.model || defaultModel;

        if (!providerId || !model) {
          throw new Error(`Step "${step.name || step.id}": no provider/model configured. Set defaults in Settings.`);
        }

        const result = await service.chat.complete({
          providerId,
          model,
          messages: [{ role: 'user', content: input }],
          systemPrompt: step.systemPrompt,
          parameters: defaultParameters,
        });

        previousOutput = result.text;

        setStepOutputs((prev) => ({ ...prev, [step.id]: result.text }));
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'done' }));
        updateStepResult(run.id, step.id, { output: result.text, status: 'done' });
      }

      finishRun(run.id, 'done');
      setActiveRun((r) => r ? { ...r, status: 'done', finishedAt: Date.now() } : r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(msg);
      finishRun(run.id, 'error');
      setActiveRun((r) => r ? { ...r, status: 'error' } : r);
    } finally {
      isRunning.current = false;
    }
  }, [pipeline, userInput, defaultProviderId, defaultModel, defaultParameters, startRun, updateStepResult, finishRun]);

  const recentRuns = getRunsForPipeline(pipeline.id).slice(0, 3);
  const running = activeRun?.status === 'running';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-200 truncate">{pipeline.name}</h2>
          <p className="text-xs text-slate-500">{pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* User input */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Input <code className="text-blue-400 ml-1">{'{{user_input}}'}</code>
          </label>
          <textarea
            rows={3}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
            placeholder="Enter the input text for this pipeline run…"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={running}
          />
        </div>

        {/* Run button */}
        <button
          onClick={startPipeline}
          disabled={running}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Pipeline
            </>
          )}
        </button>

        {/* Error */}
        {runError && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
            {runError}
          </div>
        )}

        {/* Step results */}
        {activeRun && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-medium">Steps</p>
            {pipeline.steps.map((step, i) => {
              const status = stepStatuses[step.id] ?? 'pending';
              const output = stepOutputs[step.id];
              return (
                <div key={step.id} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className={`flex items-center gap-2 px-3 py-2 text-xs ${
                    status === 'done' ? 'bg-green-900/20 border-b border-green-800/40' :
                    status === 'running' ? 'bg-blue-900/20 border-b border-blue-800/40' :
                    status === 'error' ? 'bg-red-900/20 border-b border-red-800/40' :
                    'bg-slate-800'
                  }`}>
                    <span className="text-slate-500 font-mono">{i + 1}</span>
                    <span className="flex-1 text-slate-200">{step.name || `Step ${i + 1}`}</span>
                    <span className={`font-medium ${
                      status === 'done' ? 'text-green-400' :
                      status === 'running' ? 'text-blue-400' :
                      status === 'error' ? 'text-red-400' :
                      'text-slate-600'
                    }`}>
                      {status === 'running' ? '…' : status === 'done' ? '✓' : status === 'error' ? '✕' : '○'}
                    </span>
                  </div>
                  {output && (
                    <div className="p-3 bg-slate-800/50">
                      <p className="text-xs text-slate-500 mb-1">Output</p>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{output}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent runs */}
        {recentRuns.length > 0 && !activeRun && (
          <div>
            <p className="text-xs text-slate-500 font-medium mb-2">Recent Runs</p>
            <div className="space-y-1">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between text-xs text-slate-500 px-2 py-1.5 rounded bg-slate-800">
                  <span className={run.status === 'done' ? 'text-green-500' : 'text-red-500'}>
                    {run.status === 'done' ? '✓' : '✕'}
                  </span>
                  <span>{new Date(run.startedAt).toLocaleString()}</span>
                  {run.finishedAt && <span>{elapsedLabel(run.finishedAt - run.startedAt)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type View =
  | { type: 'list' }
  | { type: 'editor'; pipeline?: Pipeline }
  | { type: 'runner'; pipeline: Pipeline };

export default function PipelinesPanel() {
  const { pipelines, addPipeline, updatePipeline, deletePipeline, duplicatePipeline } =
    usePipelinesStore();
  const [view, setView] = useState<View>({ type: 'list' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── List view ──────────────────────────────────────────────────────────────
  if (view.type === 'list') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200">Pipelines</h2>
          <button
            onClick={() => setView({ type: 'editor' })}
            className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            + New
          </button>
        </div>

        {/* Pipeline list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pipelines.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm text-center gap-2">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h8m-8 4h5" />
              </svg>
              <p>No pipelines yet</p>
              <p className="text-xs">Create a pipeline to chain AI steps together</p>
            </div>
          )}

          {pipelines.map((p) => (
            <div key={p.id} className="bg-slate-800 rounded-lg p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">
                    {p.steps.length} step{p.steps.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 pt-1">
                <button
                  onClick={() => setView({ type: 'runner', pipeline: p })}
                  className="flex-1 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-md transition-colors flex items-center justify-center gap-1"
                >
                  ▶ Run
                </button>
                <button
                  onClick={() => setView({ type: 'editor', pipeline: p })}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => duplicatePipeline(p.id)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
                  title="Duplicate"
                >
                  ⧉
                </button>
                {confirmDelete === p.id ? (
                  <>
                    <button
                      onClick={() => { deletePipeline(p.id); setConfirmDelete(null); }}
                      className="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-md"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors"
                    title="Delete"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600 flex-shrink-0">
          Chain AI steps — pass output from one step to the next
        </div>
      </div>
    );
  }

  // ── Editor view ────────────────────────────────────────────────────────────
  if (view.type === 'editor') {
    const editing = view.pipeline;
    return (
      <PipelineEditor
        initial={editing}
        onSave={(data) => {
          if (editing) {
            updatePipeline(editing.id, data);
          } else {
            addPipeline(data);
          }
          setView({ type: 'list' });
        }}
        onCancel={() => setView({ type: 'list' })}
      />
    );
  }

  // ── Runner view ────────────────────────────────────────────────────────────
  return (
    <PipelineRunner
      pipeline={view.pipeline}
      onBack={() => setView({ type: 'list' })}
    />
  );
}
