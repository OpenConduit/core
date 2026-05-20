// Register all first-party built-in extensions (side-effect imports)
import './builtins/personas';

export { extensionRegistry } from './extensionRegistry';
export { useActivityBarItems } from './useActivityBarItems';
export { loadInstalledExtensions } from './loader';
export type { ExtensionManifest, ActivityBarContribution } from './types';
