import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface PipelineStep {
  id: string;
  name: string;
  /**
   * The prompt sent to the model for this step.
   * Supports two template variables:
   *   {{user_input}}      — replaced with the value the user typed in the run form
   *   {{previous_output}} — replaced with the full text output of the preceding step
   *                         (empty string for the first step)
   */
  promptTemplate: string;
  systemPrompt?: string;
  /** Falls back to the app-level default provider when omitted. */
  providerId?: string;
  /** Falls back to the app-level default model when omitted. */
  model?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  createdAt: number;
  updatedAt: number;
}

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineStepResult {
  stepId: string;
  input: string;
  output: string;
  status: PipelineStepStatus;
  error?: string;
}

export type PipelineRunStatus = 'running' | 'done' | 'error';

export interface PipelineRun {
  id: string;
  pipelineId: string;
  startedAt: number;
  finishedAt?: number;
  status: PipelineRunStatus;
  stepResults: PipelineStepResult[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_RUN_HISTORY = 20;

interface PipelinesState {
  pipelines: Pipeline[];
  runs: PipelineRun[];

  addPipeline(partial: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): Pipeline;
  updatePipeline(id: string, updates: Partial<Omit<Pipeline, 'id' | 'createdAt'>>): void;
  deletePipeline(id: string): void;
  duplicatePipeline(id: string): Pipeline | null;

  /** Start tracking a new run; returns the run object. */
  startRun(pipelineId: string, stepIds: string[]): PipelineRun;
  updateStepResult(runId: string, stepId: string, result: Partial<PipelineStepResult>): void;
  finishRun(runId: string, status: PipelineRunStatus): void;
  getRunsForPipeline(pipelineId: string): PipelineRun[];
}

export const usePipelinesStore = create<PipelinesState>()(
  persist(
    (set, get) => ({
      pipelines: [] as Pipeline[],
      runs: [] as PipelineRun[],

      addPipeline(partial) {
        const now = Date.now();
        const pipeline: Pipeline = {
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
          ...partial,
        };
        set((s) => ({ pipelines: [...s.pipelines, pipeline] }));
        return pipeline;
      },

      updatePipeline(id, updates) {
        set((s) => ({
          pipelines: s.pipelines.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p,
          ),
        }));
      },

      deletePipeline(id) {
        set((s) => ({
          pipelines: s.pipelines.filter((p) => p.id !== id),
          runs: s.runs.filter((r) => r.pipelineId !== id),
        }));
      },

      duplicatePipeline(id) {
        const src = get().pipelines.find((p) => p.id === id);
        if (!src) return null;
        const now = Date.now();
        const copy: Pipeline = {
          ...src,
          id: uuidv4(),
          name: `${src.name} (copy)`,
          steps: src.steps.map((s) => ({ ...s, id: uuidv4() })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ pipelines: [...s.pipelines, copy] }));
        return copy;
      },

      startRun(pipelineId, stepIds) {
        const run: PipelineRun = {
          id: uuidv4(),
          pipelineId,
          startedAt: Date.now(),
          status: 'running',
          stepResults: stepIds.map((sid) => ({
            stepId: sid,
            input: '',
            output: '',
            status: 'pending',
          })),
        };
        set((s) => ({
          runs: [run, ...s.runs].slice(0, MAX_RUN_HISTORY),
        }));
        return run;
      },

      updateStepResult(runId, stepId, result) {
        set((s) => ({
          runs: s.runs.map((r) =>
            r.id !== runId
              ? r
              : {
                  ...r,
                  stepResults: r.stepResults.map((sr) =>
                    sr.stepId === stepId ? { ...sr, ...result } : sr,
                  ),
                },
          ),
        }));
      },

      finishRun(runId, status) {
        set((s) => ({
          runs: s.runs.map((r) =>
            r.id === runId ? { ...r, status, finishedAt: Date.now() } : r,
          ),
        }));
      },

      getRunsForPipeline(pipelineId) {
        return get().runs.filter((r) => r.pipelineId === pipelineId);
      },
    }),
    { name: 'openconduit-pipelines' },
  ),
);
