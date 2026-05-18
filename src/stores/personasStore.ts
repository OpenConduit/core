import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Persona } from '../types';

const DEFAULT_PERSONA: Persona = {
  id: 'default',
  name: 'Default',
  systemPrompt: '',
  color: '#64748b',
  isDefault: true,
};

const STARTER_PERSONAS: Persona[] = [
  {
    id: 'starter-code-reviewer',
    name: 'Code Reviewer',
    color: '#6366f1',
    systemPrompt:
      'You are a senior software engineer conducting a thorough code review. Evaluate code for correctness, security vulnerabilities, performance, readability, and adherence to best practices. Be direct and specific — point to exact lines, explain why something is a problem, and suggest a concrete fix. Prioritise issues by severity (critical, major, minor).',
    isDefault: false,
  },
  {
    id: 'starter-writing-assistant',
    name: 'Writing Assistant',
    color: '#10b981',
    systemPrompt:
      'You are a professional editor who writes and edits with clarity, precision, and a neutral tone. Cut unnecessary words, favour active voice, and keep sentences concise. When editing, explain each change briefly. When writing from scratch, match the requested format and audience. Avoid jargon unless the context calls for it.',
    isDefault: false,
  },
  {
    id: 'starter-research-analyst',
    name: 'Research Analyst',
    color: '#f59e0b',
    systemPrompt:
      'You are a rigorous research analyst. Structure your responses with clear headings, bullet-point summaries, and explicit citations or source notes where relevant. Distinguish between established fact, current consensus, and contested claims. When uncertain, say so. Favour depth over breadth — go into detail on the key points rather than skimming everything.',
    isDefault: false,
  },
  {
    id: 'starter-rubber-duck',
    name: 'Rubber Duck',
    color: '#eab308',
    systemPrompt:
      'You help people think through problems by asking focused clarifying questions rather than jumping to answers. When someone presents a problem, ask one or two targeted questions to help them articulate their assumptions, constraints, or what they have already tried. Only offer a direct answer or suggestion when explicitly asked, or when the person is clearly stuck after several exchanges.',
    isDefault: false,
  },
];

interface PersonasState {
  personas: Persona[];
  addPersona: (partial: Omit<Persona, 'id' | 'isDefault'>) => Persona;
  updatePersona: (id: string, updates: Partial<Omit<Persona, 'id' | 'isDefault'>>) => void;
  deletePersona: (id: string) => void;
  duplicatePersona: (id: string) => Persona | null;
  importPersonas: (personas: Persona[]) => void;
  getPersona: (id: string) => Persona | undefined;
}

export const usePersonasStore = create<PersonasState>()(
  persist(
    (set, get) => ({
      personas: [DEFAULT_PERSONA, ...STARTER_PERSONAS],

      addPersona: (partial) => {
        const persona: Persona = { id: uuidv4(), isDefault: false, ...partial };
        set((s) => ({ personas: [...s.personas, persona] }));
        return persona;
      },

      updatePersona: (id, updates) => {
        set((s) => ({
          personas: s.personas.map((p) =>
            p.id === id && !p.isDefault ? { ...p, ...updates } : p,
          ),
        }));
      },

      deletePersona: (id) => {
        set((s) => ({
          personas: s.personas.filter((p) => p.id !== id || p.isDefault),
        }));
      },

      duplicatePersona: (id) => {
        const source = get().personas.find((p) => p.id === id);
        if (!source) return null;
        const copy: Persona = {
          ...source,
          id: uuidv4(),
          name: `${source.name} (copy)`,
          isDefault: false,
        };
        set((s) => ({ personas: [...s.personas, copy] }));
        return copy;
      },

      importPersonas: (incoming) => {
        // Merge: keep existing Default, add/overwrite non-default by id
        set((s) => {
          const base = s.personas.filter((p) => p.isDefault);
          const existing = new Map(s.personas.filter((p) => !p.isDefault).map((p) => [p.id, p]));
          for (const p of incoming) {
            if (!p.isDefault) existing.set(p.id, { ...p, isDefault: false });
          }
          return { personas: [...base, ...existing.values()] };
        });
      },

      getPersona: (id) => get().personas.find((p) => p.id === id),
    }),
    { name: 'openconduit-personas' },
  ),
);
