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
      personas: [DEFAULT_PERSONA],

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
