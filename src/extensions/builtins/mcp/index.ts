import { extensionRegistry } from '../../extensionRegistry';

// The MCP settings UI lives in SettingsPanel.tsx (McpTab component) and is
// rendered as a hardcoded built-in tab. This registration entry records the
// extension in the registry so it appears in getAllManifests(). A future phase
// will migrate McpTab to a custom settings component contribution type.
extensionRegistry.registerExtension({
  id: 'openconduit.mcp',
  name: 'MCP',
  version: '1.0.0',
  description: 'Model Context Protocol server management.',
  author: 'OpenConduit',
});
