import { settingsRegistry } from './settingsRegistry';

/**
 * Registers all built-in OpenConduit settings sections.
 *
 * This file is imported as a side-effect in index.ts so contributions are
 * always registered when the package is consumed.
 *
 * Complex sections (Providers, MCP, Routing, Analytics, Personas) use
 * hand-crafted React components and are not schema-driven; they are omitted
 * here and continue to render via the existing tab components in Phase 3.
 */

// ─── General ─────────────────────────────────────────────────────────────────

settingsRegistry.register({
  id: 'openconduit.general',
  label: 'General',
  order: 10,
  sections: [
    {
      title: 'Appearance',
      properties: [
        {
          type: 'string',
          key: 'theme',
          title: 'Theme',
          description: 'Controls the application colour scheme.',
          default: 'system',
          enum: ['system', 'dark', 'light'],
          enumDescriptions: ['Follow system preference', 'Always dark', 'Always light'],
          order: 1,
        },
      ],
    },
    {
      title: 'Defaults',
      properties: [
        {
          type: 'string',
          key: 'defaultProviderId',
          title: 'Default Provider',
          description: 'Provider used when opening a new conversation.',
          placeholder: 'Select a provider',
          order: 1,
        },
        {
          type: 'string',
          key: 'defaultModel',
          title: 'Default Model',
          description: 'Model used when opening a new conversation.',
          placeholder: 'e.g. gpt-4o',
          order: 2,
        },
      ],
    },
    {
      title: 'Safety',
      properties: [
        {
          type: 'boolean',
          key: 'requireToolApproval',
          title: 'Require Tool Approval',
          description: 'When enabled, each MCP tool call must be approved before execution.',
          default: true,
          order: 1,
        },
      ],
    },
    {
      title: 'Default Parameters',
      properties: [
        {
          type: 'number',
          key: 'defaultParameters.temperature',
          title: 'Temperature',
          description: 'Controls randomness. Lower values are more deterministic.',
          default: 0.7,
          minimum: 0,
          maximum: 2,
          step: 0.1,
          order: 1,
        },
        {
          type: 'number',
          key: 'defaultParameters.maxTokens',
          title: 'Max Tokens',
          description: 'Maximum number of tokens in the model response.',
          default: 4096,
          minimum: 1,
          maximum: 200000,
          order: 2,
        },
      ],
    },
  ],
});

// ─── Labs ─────────────────────────────────────────────────────────────────────

settingsRegistry.register({
  id: 'openconduit.labs',
  label: 'Labs',
  order: 60,
  sections: [
    {
      title: 'Experimental Features',
      description: 'These features are in active development. Behaviour may change between releases.',
      properties: [
        {
          type: 'boolean',
          key: 'labs.aiTaskTracking',
          title: 'AI Task Tracking',
          description: 'AI maintains a live task list in responses. Uses <ai-tasks> XML blocks.',
          default: false,
          order: 1,
        },
        {
          type: 'boolean',
          key: 'labs.aiClarifyingQuestions',
          title: 'AI Clarifying Questions',
          description: 'AI asks structured questions for ambiguous requests before responding.',
          default: false,
          order: 2,
        },
        {
          type: 'boolean',
          key: 'labs.debugMode',
          title: 'Debug Mode',
          description: 'Enables verbose logging and raw stream inspector.',
          default: false,
          order: 3,
        },
      ],
    },
  ],
});

// ─── Updates ─────────────────────────────────────────────────────────────────

settingsRegistry.register({
  id: 'openconduit.updates',
  label: 'Updates',
  order: 70,
  sections: [
    {
      title: 'Update Channel',
      properties: [
        {
          type: 'string',
          key: 'updateChannel',
          title: 'Release Channel',
          description: 'Which release track to check for updates.',
          default: 'stable',
          enum: ['stable', 'beta', 'alpha'],
          enumDescriptions: [
            'Production releases only',
            'Beta pre-releases (no alpha)',
            'Bleeding edge — alpha and beta pre-releases',
          ],
          order: 1,
        },
      ],
    },
  ],
});
