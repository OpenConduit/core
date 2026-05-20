// ─── Sandbox ↔ Host message protocol ─────────────────────────────────────────
//
// Sandboxed extensions communicate with the host window exclusively via
// postMessage using this typed protocol. The `oc:` prefix namespaces messages
// so unrelated third-party iframes don't accidentally interfer.

/** Messages sent from the sandboxed extension iframe TO the host window. */
export type SandboxToHostMessage =
  /** Sent once the runtime shim has initialised (before extension code runs). */
  | { type: 'oc:ready' }
  /**
   * Sent by the extension's entry point to declare its manifest and
   * contributions. React component references are silently stripped by the
   * runtime shim — sandboxed extensions own their entire iframe UI.
   */
  | { type: 'oc:register'; manifest: SerializableSandboxManifest; contributions: SandboxContributions }
  /**
   * Sent when the extension calls a method on the proxied ExtensionAPI.
   * The host processes the call and replies with `oc:api-response`.
   * (Full implementation tracked in issue #55.)
   */
  | { type: 'oc:api'; id: string; path: string; args: unknown[] };

/** Messages sent FROM the host window to the sandboxed extension iframe. */
export type HostToSandboxMessage =
  /** Response to an `oc:api` call. */
  | { type: 'oc:api-response'; id: string; result?: unknown; error?: string }
  /**
   * Sent by the host whenever the application theme changes (and once on
   * initial load). The runtime shim applies the value as
   * `document.documentElement.dataset.theme` so extension CSS variables
   * respond automatically.
   */
  | { type: 'oc:theme'; theme: 'light' | 'dark' };

// ─── Serialisable contribution shapes ────────────────────────────────────────
//
// These mirror the in-process contribution types in `../types.ts` but strip
// every field that cannot safely cross an iframe boundary (React nodes,
// function refs, etc.).

/** Serialisable subset of `ActivityBarContribution`. */
export interface SandboxActivityBarItem {
  /** Stable panel id — must be unique across all extensions. */
  panelId: string;
  /** Tooltip / aria-label shown on the activity bar icon button. */
  label: string;
  /**
   * Optional SVG markup string for the icon.
   * React elements cannot cross the boundary; use raw SVG instead.
   */
  iconSvg?: string;
  /** Render order in the activity bar (lower = higher). @default 50 */
  order?: number;
}

/** A single extension setting declared in the manifest. */
export interface SandboxSettingDefinition {
  /** Dot-namespaced key, e.g. `my-ext.theme`. Should be prefixed with the extension id. */
  key: string;
  /** Display label rendered in the Settings panel. Falls back to a title-cased last key segment if omitted. */
  title?: string;
  type: 'string' | 'boolean' | 'number';
  default: string | boolean | number;
  description?: string;
}

/** All contribution types a sandboxed extension can declare. */
export interface SandboxContributions {
  activityBarItems?: SandboxActivityBarItem[];
  /** Declares the settings keys this extension owns. Used by the host settings UI. */
  settings?: SandboxSettingDefinition[];
}

/**
 * Manifest fields that can safely cross the iframe postMessage boundary.
 * Excludes React-specific and function-typed fields.
 */
export interface SerializableSandboxManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}
