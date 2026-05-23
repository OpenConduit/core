// Register all first-party built-in extensions (side-effect imports)
import './builtins/personas';
import './builtins/compare';
import './builtins/tasks';
import './builtins/files';
import './builtins/mcp';
import './builtins/web-fetch';
import './builtins/web-search';
import './builtins/pipelines';

export { extensionRegistry } from './extensionRegistry';
export { useActivityBarItems } from './useActivityBarItems';
export { loadInstalledExtensions } from './loader';
export { createExtensionAPI } from './extensionHost';
export { messageDecoratorRegistry } from './messageDecoratorRegistry';
export { toolContributionRegistry, EXTENSION_SERVER_ID } from './toolContributionRegistry';
export type { ToolHandler } from './toolContributionRegistry';
export type {
  ExtensionManifest,
  ActivityBarContribution,
  ExtensionAPI,
  Unsubscribe,
  MessageDecorator,
} from './types';
export type {
  SandboxContributions,
  SandboxActivityBarItem,
  SandboxToHostMessage,
  HostToSandboxMessage,
  SerializableSandboxManifest,
} from './sandbox/protocol';
export { SandboxedPanel } from './sandbox/SandboxedPanel';
