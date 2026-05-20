// Register all first-party built-in extensions (side-effect imports)
import './builtins/personas';
import './builtins/compare';
import './builtins/tasks';
import './builtins/files';
import './builtins/mcp';

export { extensionRegistry } from './extensionRegistry';
export { useActivityBarItems } from './useActivityBarItems';
export { loadInstalledExtensions } from './loader';
export type {
  ExtensionManifest,
  ActivityBarContribution,
} from './types';
export type {
  SandboxContributions,
  SandboxActivityBarItem,
  SandboxToHostMessage,
  HostToSandboxMessage,
  SerializableSandboxManifest,
} from './sandbox/protocol';
export { SandboxedPanel } from './sandbox/SandboxedPanel';
