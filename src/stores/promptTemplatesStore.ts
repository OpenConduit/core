import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptVariable {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  options?: string[];
  default?: string | number;
}

export interface InstalledPromptTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  verified: boolean;
  version: string;
  /** Handlebars-style template string, e.g. "Write about {{topic}}." */
  template: string;
  variables: PromptVariable[];
  /** True when installed from registry.openconduit.ai, false for user-created */
  fromRegistry: boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PromptTemplatesState {
  templates: InstalledPromptTemplate[];
  addTemplate: (t: Omit<InstalledPromptTemplate, 'id'>) => InstalledPromptTemplate;
  removeTemplate: (id: string) => void;
  isInstalled: (registryId: string) => boolean;
}

export const usePromptTemplatesStore = create<PromptTemplatesState>()(
  persist(
    (set, get) => ({
      templates: [] as InstalledPromptTemplate[],

      addTemplate: (partial) => {
        const t: InstalledPromptTemplate = { id: uuidv4(), ...partial };
        set((s) => ({ templates: [...s.templates, t] }));
        return t;
      },

      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      isInstalled: (registryId) =>
        get().templates.some((t) => t.fromRegistry && t.name === registryId),
    }),
    { name: 'oc-prompt-templates', partialize: (s) => ({ templates: s.templates }) },
  ),
);
