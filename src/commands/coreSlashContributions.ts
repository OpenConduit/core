/**
 * Built-in slash command contributions.
 *
 * This file is a side-effect module — import it once (in App or a bootstrap
 * file) to register the core slash commands into `slashCommandRegistry`.
 */

import React from 'react';
import { slashCommandRegistry } from './slashCommandRegistry';
import { commandRegistry } from './commandRegistry';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
// ─── Icons (inline SVGs to avoid import overhead) ──────────────────────────

const IconNew = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M12 4v16m8-8H4',
  }),
);

const IconClear = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  }),
);

const IconSummarize = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  }),
);

const IconTrim = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z',
  }),
);

const IconFolder = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  }),
);

const IconSettings = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  }),
);

const IconSystem = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  }),
);

// ─── Registrations ─────────────────────────────────────────────────────────

slashCommandRegistry.register({
  trigger: 'new',
  description: 'Start a new conversation',
  category: 'navigation',
  icon: IconNew,
  execute: () => {
    commandRegistry.execute('core.newConversation');
  },
});

slashCommandRegistry.register({
  trigger: 'clear',
  description: 'Clear all messages in this conversation',
  category: 'chat',
  icon: IconClear,
  execute: (_args, ctx) => {
    if (ctx.chat?.clear) {
      if (window.confirm('Clear all messages in this conversation?')) {
        ctx.chat.clear();
      }
    } else if (ctx.conversationId) {
      if (window.confirm('Clear all messages in this conversation?')) {
        useConversationStore.getState().clearMessages(ctx.conversationId);
      }
    }
  },
});

slashCommandRegistry.register({
  trigger: 'summarize',
  description: 'AI summarizes the chat and replaces all messages',
  category: 'context',
  icon: IconSummarize,
  execute: (_args, ctx) => {
    ctx.chat?.compact?.();
  },
});

slashCommandRegistry.register({
  trigger: 'compact',
  description: 'AI summarizes the chat and replaces all messages (alias for /summarize)',
  category: 'context',
  icon: IconSummarize,
  execute: (_args, ctx) => {
    ctx.chat?.compact?.();
  },
});

slashCommandRegistry.register({
  trigger: 'trim',
  description: 'Remove oldest messages to free up context window space',
  category: 'context',
  icon: IconTrim,
  execute: (_args, ctx) => {
    ctx.chat?.trim?.();
  },
});

slashCommandRegistry.register({
  trigger: 'folder',
  description: 'Set a project folder for agent context',
  category: 'context',
  icon: IconFolder,
  execute: (_args, ctx) => {
    ctx.chat?.pickFolder?.();
  },
});

slashCommandRegistry.register({
  trigger: 'settings',
  description: 'Open settings',
  category: 'navigation',
  icon: IconSettings,
  execute: () => {
    useUiStore.getState().setShowSettings(true);
  },
});

slashCommandRegistry.register({
  trigger: 'system',
  description: 'Set a system prompt — type your prompt after /system',
  category: 'chat',
  icon: IconSystem,
  execute: (args) => {
    // Return the system prompt prefix so the user can type or edit it inline.
    // The text goes into the textarea and will be sent as a message whose
    // content starts with "/system ..." — consuming code (useChat) can
    // intercept this if desired, otherwise it's a plain message.
    return args ? '' : '/system ';
  },
});

// ─── Icons for feedback commands ────────────────────────────────────────────

const IconBug = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M12 8v4m0 4h.01M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  }),
);

const IconFeature = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  }),
);

slashCommandRegistry.register({
  trigger: 'reportbug',
  description: 'Report a bug — with or without this conversation as context',
  category: 'chat',
  icon: IconBug,
  execute: (_args, ctx) => {
    useUiStore.getState().openFeedbackModal({ type: 'bug', conversationId: ctx.conversationId });
  },
});

slashCommandRegistry.register({
  trigger: 'requestfeature',
  description: 'Request a new feature',
  category: 'chat',
  icon: IconFeature,
  execute: () => {
    useUiStore.getState().openFeedbackModal({ type: 'feature' });
  },
});

// ─── BTW (quick side question) ───────────────────────────────────────────────

const IconBtw = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
);

slashCommandRegistry.register({
  trigger: 'btw',
  description: 'Ask a quick side question — not saved to conversation history',
  category: 'chat',
  icon: IconBtw,
  execute: () => {
    useUiStore.getState().setBtwMode(true);
  },
});

// ─── Skills ──────────────────────────────────────────────────────────────────

const IconSkills = React.createElement(
  'svg',
  { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
  React.createElement('path', {
    strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5,
    d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  }),
);

slashCommandRegistry.register({
  trigger: 'skills',
  description: 'Open the Skills panel to browse and manage Copilot skills',
  category: 'navigation',
  icon: IconSkills,
  execute: () => {
    const ui = useUiStore.getState();
    ui.setSecondarySidebarOpen(true);
    ui.setSecondarySidebarPanel('skills');
  },
});

slashCommandRegistry.register({
  trigger: 'saveskill',
  description: 'Save this conversation as a reusable Copilot skill',
  category: 'context',
  icon: IconSkills,
  execute: () => {
    const ui = useUiStore.getState();
    ui.setSecondarySidebarOpen(true);
    ui.setSecondarySidebarPanel('skills');
    // Dispatch a custom event so SkillsPanel auto-opens the export form.
    window.dispatchEvent(new Event('oc:skills:startExport'));
  },
});

slashCommandRegistry.register({
  trigger: 'skill',
  description: 'Apply a skill as the system prompt — /skill <name>',
  category: 'context',
  icon: IconSkills,
  execute: async (args, ctx) => {
    const query = args.trim();
    if (!query) {
      // No name provided — scaffold so the user can type one
      return '/skill ';
    }
    if (!window.api?.skills?.list || !ctx.conversationId) return;
    const skills = await window.api.skills.list();
    const lower = query.toLowerCase();
    // Exact name match first, then folder-name match, then partial name match
    const match =
      skills.find((s) => s.name.toLowerCase() === lower) ??
      skills.find((s) => s.folderPath.split('/').pop()?.toLowerCase() === lower) ??
      skills.find((s) => s.name.toLowerCase().includes(lower));
    if (!match) {
      // Skill not found — fall back to opening the panel so the user can browse
      const ui = useUiStore.getState();
      ui.setSecondarySidebarOpen(true);
      ui.setSecondarySidebarPanel('skills');
      return;
    }
    useConversationStore
      .getState()
      .updateConversation(ctx.conversationId, { systemPrompt: match.content });
  },
});
