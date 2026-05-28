/**
 * SkillsPanel — the "Skills" tab in the secondary sidebar.
 *
 * Lets users:
 *  • Configure workspace roots (.openconduit/skills/ is written; .github/skills/ etc. are read)
 *  • Browse all skills found across those workspaces
 *  • Delete skills they no longer need
 *  • Export the current conversation as a new skill (AI-generated SKILL.md)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import type { SkillFile, SkillWorkspace } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkspaceRow({
  ws,
  onRemove,
}: {
  ws: SkillWorkspace;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group py-1">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{ws.label ?? basename(ws.path)}</p>
        <p className="text-[10px] text-slate-600 truncate font-mono">{ws.path}</p>
      </div>
      <button
        onClick={onRemove}
        title="Remove workspace"
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-600 hover:text-red-400 transition-all"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84L13.962 3.5H14.5a.5.5 0 0 0 0-1H11Zm1.468 1-.847 10.58a1 1 0 0 1-.997.92H4.885a1 1 0 0 1-.997-.92L3.041 3.5h9.926Z" />
        </svg>
      </button>
    </div>
  );
}

function SkillRow({
  skill,
  onDelete,
  onUse,
}: {
  skill: SkillFile;
  onDelete: () => void;
  onUse: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse();
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  return (
    <div className="border border-slate-700/60 rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Chevron */}
        <svg
          className={`w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{skill.name}</p>
          {skill.description && (
            <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{skill.description}</p>
          )}
          <p className="text-[10px] text-slate-700 font-mono truncate mt-0.5">
            {basename(skill.workspacePath)}
          </p>
        </div>
        {/* Use button */}
        <button
          onClick={handleUse}
          title="Apply as system prompt"
          className={`p-0.5 rounded transition-colors flex-shrink-0 ${
            applied
              ? 'text-emerald-400'
              : 'text-slate-600 hover:text-blue-400 hover:bg-blue-500/10'
          }`}
        >
          {applied ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.427 2.427a.75.75 0 0 1 1.06-.057l5.25 4.75a.75.75 0 0 1 0 1.11l-5.25 4.75a.75.75 0 1 1-1.004-1.116L10.555 8 6.483 4.136a.75.75 0 0 1-.056-1.06z" />
              <path d="M3.427 2.427a.75.75 0 0 1 1.06-.057l5.25 4.75a.75.75 0 0 1 0 1.11l-5.25 4.75a.75.75 0 1 1-1.004-1.116L7.555 8 3.483 4.136a.75.75 0 0 1-.056-1.06z" />
            </svg>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete skill"
          className="p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84L13.962 3.5H14.5a.5.5 0 0 0 0-1H11Zm1.468 1-.847 10.58a1 1 0 0 1-.997.92H4.885a1 1 0 0 1-.997-.92L3.041 3.5h9.926Z" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700/60 bg-slate-900/40">
          <pre className="text-[10px] text-slate-400 whitespace-pre-wrap mt-2 font-mono leading-relaxed overflow-x-auto">
            {skill.content}
          </pre>
          {Object.keys(skill.referenceFiles).length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reference files</p>
              {Object.keys(skill.referenceFiles).map((p) => (
                <p key={p} className="text-[10px] text-slate-600 font-mono">{p}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export-as-Skill form ─────────────────────────────────────────────────────

function ExportSkillForm({
  workspaces,
  onDone,
  onCancel,
}: {
  workspaces: SkillWorkspace[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { conversations } = useConversationStore();
  const { activeConversationId } = useUiStore();
  const { settings } = useSettingsStore();

  const [name, setName] = useState('');
  const [workspacePath, setWorkspacePath] = useState(workspaces[0]?.path ?? '');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);

  const generate = useCallback(async () => {
    if (!conversation) return;
    if (!window.api?.chat?.complete) return;

    const messages = (conversation.messages ?? [])
      .filter((m) => typeof m.content === 'string' && m.content.trim())
      .slice(-30); // last 30 messages for context

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content).slice(0, 800)}`)
      .join('\n\n');

    const prompt = `You are generating a GitHub Copilot SKILL.md file.

A skill file documents a repeatable workflow so an AI agent can follow it automatically. Skills live in \`.openconduit/skills/<name>/SKILL.md\`.

Based on the conversation below, produce a SKILL.md with:
1. A YAML frontmatter block (\`---\`) containing \`name\` (lowercase-hyphens, ≤64 chars) and \`description\` (keyword-rich, ≤200 chars, describes WHEN to use this skill).
2. A body with: purpose, when to use, step-by-step procedure, and any relevant code patterns or file paths mentioned.

Output ONLY the raw SKILL.md content — no explanation, no code fences.

Conversation:
${transcript}`;

    setGenerating(true);
    setError(null);
    try {
      const providerId = settings?.defaultProviderId ?? settings?.providers?.[0]?.id ?? '';
      const model = settings?.defaultModel ?? settings?.providers?.find((p) => p.id === providerId)?.defaultModel ?? '';
      const res = await window.api.chat.complete({
        messages: [{ role: 'user', content: prompt }],
        providerId,
        model,
      });
      setContent(res.text);
      // Try to extract the name from frontmatter
      const nameMatch = res.text.match(/^name:\s*([^\n\r'"]+)/m);
      if (nameMatch) setName(nameMatch[1].trim().replace(/[^a-z0-9-]/g, '-'));
    } catch (e) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }, [conversation, settings]);

  const save = async () => {
    if (!name.trim() || !content.trim() || !workspacePath) return;
    if (!window.api?.skills?.write) return;
    setSaving(true);
    setError(null);
    try {
      const folderName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await window.api.skills.write({ workspacePath, folderName, content });
      onDone();
    } catch (e) {
      setError(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Export conversation as skill</p>

      {/* Workspace selector */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-1">Workspace</label>
        <select
          value={workspacePath}
          onChange={(e) => setWorkspacePath(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        >
          {workspaces.map((ws) => (
            <option key={ws.path} value={ws.path}>{ws.label ?? basename(ws.path)}</option>
          ))}
        </select>
      </div>

      {/* Generate button */}
      {!content && (
        <button
          onClick={generate}
          disabled={generating || !conversation}
          className="w-full py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs hover:bg-blue-600/30 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating…' : '✨ Generate from conversation'}
        </button>
      )}

      {/* Content editor */}
      {content && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] text-slate-500">SKILL.md content</label>
            <button onClick={generate} disabled={generating} className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50">
              {generating ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-blue-500 resize-y"
          />
        </div>
      )}

      {/* Folder name */}
      {content && (
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Folder name (lowercase-hyphens)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="e.g. add-provider"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <div className="flex gap-2">
        {content && (
          <button
            onClick={save}
            disabled={saving || !name.trim() || !content.trim()}
            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save skill'}
          </button>
        )}
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SkillsPanel() {
  const { settings, saveSettings } = useSettingsStore();
  const { updateConversation } = useConversationStore();
  const { activeConversationId } = useUiStore();
  const workspaces: SkillWorkspace[] = settings?.skillWorkspaces ?? [];

  const [userPath, setUserPath] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the default user-level skills path (~/.openconduit) once on mount.
  useEffect(() => {
    window.api?.skills?.userPath?.().then(setUserPath).catch((): null => null);
  }, []);

  // Listen for the custom event dispatched by the /saveskill slash command.
  useEffect(() => {
    const handler = () => setExporting(true);
    window.addEventListener('oc:skills:startExport', handler);
    return () => window.removeEventListener('oc:skills:startExport', handler);
  }, []);

  const loadSkills = useCallback(async () => {
    if (!window.api?.skills?.list) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.skills.list();
      setSkills(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills, workspaces.length]);

  const addWorkspace = async () => {
    if (!window.api?.folder?.pick) return;
    const picked = await window.api.folder.pick();
    if (!picked) return;
    // Don't add duplicates or the user-level workspace (it's always implicit).
    if (workspaces.some((w) => w.path === picked) || picked === userPath) return;
    const updated: SkillWorkspace[] = [...workspaces, { path: picked }];
    await saveSettings({ skillWorkspaces: updated });
    void loadSkills();
  };

  const removeWorkspace = async (p: string) => {
    const updated = workspaces.filter((w) => w.path !== p);
    await saveSettings({ skillWorkspaces: updated });
    setSkills((prev) => prev.filter((s) => s.workspacePath !== p));
  };

  const deleteSkill = async (skill: SkillFile) => {
    if (!window.api?.skills?.delete) return;
    try {
      await window.api.skills.delete(skill.folderPath);
      setSkills((prev) => prev.filter((s) => s.folderPath !== skill.folderPath));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Build the full workspace list for display: user path always first, then configured.
  const defaultWs: SkillWorkspace | null = userPath
    ? { path: userPath, label: '~ (default)' }
    : null;
  const configuredWs = workspaces.filter((w) => w.path !== userPath);
  const allWorkspaces: SkillWorkspace[] = defaultWs
    ? [defaultWs, ...configuredWs]
    : configuredWs;

  // Group skills by workspace path.
  const byWorkspace = allWorkspaces.map((ws) => ({
    ws,
    skills: skills.filter((s) => s.workspacePath === ws.path),
  }));

  if (exporting) {
    return (
      <div className="p-3">
        <ExportSkillForm
          workspaces={allWorkspaces}
          onDone={() => { setExporting(false); void loadSkills(); }}
          onCancel={() => setExporting(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Workspaces */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Workspaces</span>
          <button
            onClick={addWorkspace}
            title="Add workspace folder"
            className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z" />
            </svg>
          </button>
        </div>

        <div className="space-y-0.5">
          {/* Default user workspace — always shown, non-removable */}
          {defaultWs && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-400 truncate">
                  ~ (default)
                  <span className="ml-1.5 text-[9px] text-slate-600 uppercase tracking-wider font-normal">built-in</span>
                </p>
                <p className="text-[10px] text-slate-600 truncate font-mono">{defaultWs.path}</p>
              </div>
            </div>
          )}

          {/* User-configured workspaces */}
          {configuredWs.map((ws) => (
            <WorkspaceRow key={ws.path} ws={ws} onRemove={() => void removeWorkspace(ws.path)} />
          ))}

          {/* Add prompt when only default workspace exists */}
          {configuredWs.length === 0 && (
            <button
              onClick={addWorkspace}
              className="w-full py-1.5 text-[10px] text-slate-600 border border-dashed border-slate-700/60 rounded-lg hover:text-slate-400 hover:border-slate-600 transition-colors"
            >
              + Add a project workspace
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 flex gap-2 flex-shrink-0 border-b border-slate-700/60">
        <button
          onClick={() => setExporting(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/25 text-blue-300 text-[10px] hover:bg-blue-600/25 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zM5 8a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z" />
            <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z" />
          </svg>
          Export as skill
        </button>
        <button
          onClick={loadSkills}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
          </svg>
        </button>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {error && (
          <p className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{error}</p>
        )}

        {!loading && skills.length === 0 && (
          <p className="text-[10px] text-slate-600 text-center pt-4">
            No skills found. Use "Export as skill" to create your first one.
          </p>
        )}

        {byWorkspace.map(({ ws, skills: wsSkills }) => (
          wsSkills.length > 0 && (
            <div key={ws.path} className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {ws.label ?? basename(ws.path)}
              </p>
              {wsSkills.map((skill) => (
                <SkillRow
                  key={skill.folderPath}
                  skill={skill}
                  onDelete={() => void deleteSkill(skill)}
                  onUse={() => {
                    if (activeConversationId) {
                      updateConversation(activeConversationId, { systemPrompt: skill.content });
                    }
                  }}
                />
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
