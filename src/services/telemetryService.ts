/**
 * Anonymous telemetry — only sends data when the user has opted in.
 *
 * What is sent: app version, platform, provider types (IDs only), feature flags.
 * What is NEVER sent: API keys, model names, conversation content, file paths,
 * system prompts, MCP server names/URLs, or any personally-identifiable info.
 */

import type { AppSettings } from '../types';

const TELEMETRY_PRIMARY = 'https://updates.openconduit.ai';
const TELEMETRY_BACKUP  = 'https://openconduit-release-api.chumchal-account.workers.dev';

// ─── Payload types ─────────────────────────────────────────────────────────

export interface UsagePayload {
  event: 'session_start';
  appVersion: string;
  platform: string;
  arch: string;
  providerTypes: string[];
  mcpEnabled: boolean;
  routingEnabled: boolean;
  updateChannel: string;
  features: Record<string, boolean>;
}

export interface CrashPayload {
  event: 'crash';
  appVersion: string;
  platform: string;
  electronVersion?: string;
  errorType: string;
  errorMessage: string;
  stackTrace: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Remove absolute file paths from a stack trace, keeping module-level info. */
function sanitizeStack(stack: string): string {
  return stack
    .replace(/\(\/[^\s)]+\)/g, '(<path>)')   // (/absolute/path.js:1:2)
    .replace(/at \/[^\s]+/g, 'at <path>')     // at /absolute/path.js
    .replace(/file:\/\/\/[^\s)]+/g, '<path>') // file:/// URLs
    .slice(0, 3000);
}

function sanitizeMessage(message: string): string {
  return message.replace(/(?:\/[\w.-]+){2,}/g, '<path>').slice(0, 300);
}

async function postTelemetry(payload: object): Promise<void> {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  for (const base of [TELEMETRY_PRIMARY, TELEMETRY_BACKUP]) {
    try {
      const res = await fetch(`${base}/telemetry`, {
        method: 'POST', headers, body,
        redirect: 'error',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok || res.status < 500) return; // success or client error — don't retry
    } catch { /* try backup */ }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function reportSessionStart(
  settings: AppSettings,
  meta: { appVersion: string; platform: string; arch: string; electronVersion?: string },
): Promise<void> {
  if (!settings.telemetry?.usageReports) return;
  await postTelemetry({
    event: 'session_start',
    appVersion: meta.appVersion,
    platform: meta.platform,
    arch: meta.arch,
    providerTypes: settings.providers.map((p) => p.type),
    mcpEnabled: settings.mcpServers.length > 0,
    routingEnabled: !!settings.routing?.enabled,
    updateChannel: settings.updateChannel ?? 'stable',
    features: {
      aiTaskTracking: !!settings.labs?.aiTaskTracking,
      aiClarifyingQuestions: !!settings.labs?.aiClarifyingQuestions,
    },
  });
}

export async function reportCrash(
  settings: AppSettings,
  error: Error,
  meta: { appVersion: string; platform: string; electronVersion?: string },
): Promise<void> {
  if (!settings.telemetry?.crashReports) return;
  await postTelemetry({
    event: 'crash',
    appVersion: meta.appVersion,
    platform: meta.platform,
    electronVersion: meta.electronVersion,
    errorType: error.name,
    errorMessage: sanitizeMessage(error.message),
    stackTrace: sanitizeStack(error.stack ?? ''),
  });
}

