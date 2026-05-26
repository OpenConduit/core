import React, { useState, useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useCollaborationStore } from '../stores/collaborationStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import type { ProviderConfig, McpServerConfig, AppSettings, ProviderType, McpTransport, McpTool, UpdateInfo, FeedbackPayload, RoutingConfig, RoutingTier, RoutingProviderRule, RoutingTaskType, RoutingProfile, SettingsProperty, SettingsStringProperty, SettingsNumberProperty, SettingsButtonProperty, SettingsContribution, ConfigBundle } from '../types';
import { service } from '../services';
import { settingsRegistry } from '../settings/settingsRegistry';
import { extensionRegistry } from '../extensions/extensionRegistry';
import type { ExtensionManifest } from '../extensions/types';
import { commandRegistry } from '../commands/commandRegistry';
import '../settings/coreContributions'; // ensure core sections are registered
import { McpMarketplace, ProviderMarketplace } from './MarketplacePanel';
import PersonasPanel from '../extensions/builtins/personas/PersonasPanel';
import PromptsPanel from '../extensions/builtins/prompts/PromptsPanel';

type Tab = 'general' | 'providers' | 'mcp' | 'features' | 'labs' | 'analytics' | 'about' | string;

export interface ExtraTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

const Icons = {
  general: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  providers: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  mcp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  personas: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  features: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  labs: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  ),
  updates: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  analytics: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  about: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  json: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  extension: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
  ),
  logging: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  telemetry: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  prompts: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  ),
  sharing: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="6" cy="12" r="2.5" strokeWidth={1.5}/><circle cx="18" cy="19" r="2.5" strokeWidth={1.5}/>
      <path strokeLinecap="round" strokeWidth={1.5} d="M8.5 11l7-4M8.5 13l7 4"/>
    </svg>
  ),
  selfHosting: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12H3m18 0h-2M12 5V3m0 18v-2m-6.364-2.636-1.414 1.414M18.778 5.808l-1.414 1.414M5.222 5.808 3.808 7.222M18.364 18.364l1.414-1.414M12 17a5 5 0 100-10 5 5 0 000 10z" />
    </svg>
  ),
} as const;

// ─── SharingTab ───────────────────────────────────────────────────────────────

interface ShareRecord { id: string; url: string; title: string; createdAt: number; }

// ─── Sharing: sub-sections ────────────────────────────────────────────────────

function SharedLinksSection() {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const available = typeof window !== 'undefined' && !!window.api?.conversation?.listShares;

  useEffect(() => {
    if (!available) { setLoading(false); return; }
    window.api!.conversation!.listShares().then(async (raw) => {
      const list = raw as ShareRecord[];
      const now = Date.now();
      const TTL = 30 * 24 * 60 * 60 * 1000;

      // Instantly remove anything past the 30-day TTL without a network call.
      const maybeAlive: ShareRecord[] = [];
      const definitelyExpired: ShareRecord[] = [];
      for (const s of list) {
        if (s.createdAt + TTL <= now) {
          definitelyExpired.push(s);
        } else {
          maybeAlive.push(s);
        }
      }
      for (const s of definitelyExpired) {
        window.api!.conversation!.deleteShare(s.id).catch((): void => undefined);
      }

      setShares(maybeAlive);
      setLoading(false);

      // Probe the remaining shares in parallel to catch server-side deletions.
      if (maybeAlive.length > 0) {
        setChecking(true);
        const gone: string[] = [];
        await Promise.all(
          maybeAlive.map(async (s) => {
            try {
              const res = await fetch(s.url, {
                method: 'GET',
                redirect: 'error',
                signal: AbortSignal.timeout(6000),
              });
              if (res.status === 404) gone.push(s.id);
            } catch {
              // Network error — leave the record intact; it may be transient.
            }
          })
        );
        if (gone.length > 0) {
          for (const id of gone) {
            window.api!.conversation!.deleteShare(id).catch((): void => undefined);
          }
          setShares((prev) => prev.filter((s) => !gone.includes(s.id)));
        }
        setChecking(false);
      }
    });
  }, [available]);

  const handleDelete = async (id: string) => {
    if (!available) return;
    setDeleting(id);
    await window.api!.conversation!.deleteShare(id);
    setShares((s) => s.filter((r) => r.id !== id));
    setDeleting(null);
  };

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!available) {
    return (
      <div className="text-sm text-slate-500 py-8 text-center">
        Sharing is only available in the desktop app.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-0.5">Shared conversations</h3>
        <p className="text-xs text-slate-500">
          Snapshots you've shared from this machine. Links expire 30 days after creation.
          Deleting removes the link from the server so it's no longer accessible.
        </p>
      </div>

      {(loading || checking) && (
        <div className="text-xs text-slate-500 py-6 text-center">
          {loading ? 'Loading…' : 'Checking for expired links…'}
        </div>
      )}

      {!loading && !checking && shares.length === 0 && (
        <div className="text-xs text-slate-600 py-8 text-center border border-dashed border-slate-800 rounded-xl">
          No shared conversations yet. Click <strong className="text-slate-400">Share</strong> in the status bar to create one.
        </div>
      )}

      {!loading && !checking && shares.length > 0 && (
        <div className="flex flex-col gap-2">
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{share.title || 'Untitled'}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {new Date(share.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  expires {new Date(share.createdAt + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleCopy(share.url, share.id)}
                title="Copy link"
                className="flex-shrink-0 text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {copied === share.id ? '✓ Copied' : 'Copy link'}
              </button>
              <button
                onClick={() => handleDelete(share.id)}
                disabled={deleting === share.id}
                title="Delete share"
                className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40 p-1"
              >
                {deleting === share.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2"><path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5"/></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5L11 4"/></svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveSection() {
  const roomId = useCollaborationStore((s) => s.roomId);
  const participants = useCollaborationStore((s) => s.participants);
  const conversationId = useCollaborationStore((s) => s.conversationId);
  const { setActiveConversation, setShowSettings } = useUiStore();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-0.5">Live Collaboration</h3>
        <p className="text-xs text-slate-500">
          Start a live session to collaborate on a conversation in real time.
          Participants connect via a WebSocket room — turns are locked so only one person
          sends at a time. The host can optionally relay AI responses to guests who have
          no API keys configured.
        </p>
      </div>

      {roomId ? (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-400">Room active</span>
            </div>
            <p className="text-xs text-slate-500">
              {participants.length} {participants.length === 1 ? 'participant' : 'participants'} connected
            </p>
            <button
              onClick={() => {
                if (conversationId) setActiveConversation(conversationId);
                setShowSettings(false);
              }}
              className="self-start text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
            >
              Go to live conversation →
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-600 py-8 text-center border border-dashed border-slate-800 rounded-xl">
          No active room. Click <strong className="text-slate-400">Live</strong> in the status bar to start one.
        </div>
      )}
    </div>
  );
}

function SelfHostingSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [url, setUrl] = useState(settings.selfHosting?.shareServerUrl ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const trimmed = url.trim();
    await onSave({ selfHosting: { ...settings.selfHosting, shareServerUrl: trimmed || undefined } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setUrl('');
    await onSave({ selfHosting: { ...settings.selfHosting, shareServerUrl: undefined } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-0.5">Self-Hosting</h3>
        <p className="text-xs text-slate-500">
          Override the default OpenConduit cloud endpoints with your own server.
          Leave blank to use the hosted service at <code className="text-slate-400">share.openconduit.ai</code>.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">
            Room &amp; Share Server URL
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Base URL of your self-hosted server (e.g. <code className="text-slate-400">https://my-server.example.com</code>).
            The app derives the WebSocket URL automatically.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
              placeholder="https://share.openconduit.ai"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
            />
            <button
              onClick={handleSave}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
            {url && (
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-3 text-[11px] text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Deploying your own server</p>
          <p>The room server is a stateful WebSocket server that manages turn-based locks and broadcasts messages between participants. A Node.js reference implementation is available in the <code className="text-slate-400">server/</code> directory of the OpenConduit repository.</p>
          <p className="mt-1">Your server must implement the same HTTP + WebSocket endpoints as the Cloudflare Worker (<code className="text-slate-400">POST /rooms</code>, <code className="text-slate-400">WS /rooms/:id</code>, <code className="text-slate-400">POST /rooms/:id/seed</code>).</p>
        </div>
      </div>
    </div>
  );
}

type SharingSection = 'links' | 'live' | 'self-hosting';

function SharingTab({
  settings,
  onSave,
  section,
  onSection,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  section: SharingSection;
  onSection: (s: SharingSection) => void;
}) {
  const sections: { id: SharingSection; label: string }[] = [
    { id: 'links',        label: 'Shared Links' },
    { id: 'live',         label: 'Live' },
    { id: 'self-hosting', label: 'Self-Hosting' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 pb-3 border-b border-slate-700/60">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              section === s.id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'links'        && <SharedLinksSection />}
      {section === 'live'         && <LiveSection />}
      {section === 'self-hosting' && <SelfHostingSection settings={settings} onSave={onSave} />}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

export default function SettingsPanel({
  extraTabs,
  hideTabs,
}: {
  extraTabs?: ExtraTab[];
  hideTabs?: string[];
}) {
  const { showSettings, setShowSettings, settingsInitialTab, setSettingsInitialTab } = useUiStore();
  const { settings, saveSettings, refreshMcpStatus, mcpStatus } = useSettingsStore();
  const [tab, setTab] = useState<Tab>('general');
  const [search, setSearch] = useState('');
  const [aiSection, setAiSection] = useState<'providers' | 'mcp' | 'personas' | 'prompts' | 'analytics'>('providers');
  const [featuresSection, setFeaturesSection] = useState<'features' | 'labs'>('features');
  const [extensionsSection, setExtensionsSection] = useState<'installed' | 'settings'>('installed');
  const [sharingSection, setSharingSection] = useState<'links' | 'live' | 'self-hosting'>('links');

  // If something opened settings and requested a specific tab (e.g. MCP gear icon),
  // jump to that tab and clear the request so it doesn't repeat on re-open.
  useEffect(() => {
    if (showSettings && settingsInitialTab) {
      if (settingsInitialTab.startsWith('ai:')) {
        setTab('ai');
        setAiSection(settingsInitialTab.slice(3) as 'providers' | 'mcp' | 'personas' | 'prompts');
      } else {
        setTab(settingsInitialTab as Tab);
      }
      setSettingsInitialTab(null);
    }
  }, [showSettings, settingsInitialTab, setSettingsInitialTab]);
  const [extContributions, setExtContributions] = useState<SettingsContribution[]>(() =>
    settingsRegistry.getAll().filter((c) => !c.id.startsWith('openconduit.'))
  );
  useEffect(() => {
    return settingsRegistry.subscribe(() => {
      setExtContributions(settingsRegistry.getAll().filter((c) => !c.id.startsWith('openconduit.')));
    });
  }, []);

  const [installedExtensions, setInstalledExtensions] = useState<ExtensionManifest[]>(() =>
    extensionRegistry.getAllManifests()
  );
  useEffect(() => {
    return extensionRegistry.subscribe(() => {
      setInstalledExtensions(extensionRegistry.getAllManifests());
    });
  }, []);

  if (!showSettings || !settings) return null;

  const builtInTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',   label: 'General',   icon: Icons.general },
    { id: 'ai',        label: 'AI',         icon: Icons.ai },
    { id: 'features',  label: 'Features',  icon: Icons.features },
    { id: 'sharing',      label: 'Sharing',      icon: Icons.sharing },
    { id: 'updates',      label: 'Updates',       icon: Icons.updates },
    { id: 'logging',   label: 'Logging',   icon: Icons.logging },
    { id: 'telemetry', label: 'Telemetry',       icon: Icons.telemetry },
    { id: 'about',     label: 'About',     icon: Icons.about },
    { id: 'extensions', label: 'Extensions', icon: Icons.extension },
    { id: 'json',      label: 'JSON',       icon: Icons.json },
  ].filter((t) => !hideTabs?.includes(t.id));

  const allTabs = [
    ...builtInTabs,
    ...(extraTabs?.map((t) => ({ id: t.id, label: t.label, icon: t.icon ?? Icons.general })) ?? []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowSettings(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[920px] h-[88vh] bg-slate-950 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60 flex-shrink-0 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-400">{Icons.general}</span>
            <h2 className="text-sm font-semibold text-slate-100 tracking-wide">Settings</h2>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <div className="w-[192px] flex-shrink-0 bg-slate-900/50 border-r border-slate-700/40 flex flex-col overflow-y-auto">
            {/* Search */}
            <div className="px-2.5 pt-2.5 pb-1.5">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search settings…"
                  className="w-full pl-7 pr-6 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* Nav */}
            <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
            {allTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch(''); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  tab === t.id && !search
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className={tab === t.id && !search ? 'text-blue-400' : 'text-slate-500'}>{t.icon}</span>
                {t.label}
              </button>
            ))}
            </div>
          </div>

          {/* Content */}
          <div className={`flex-1 ${
            tab === 'json' && !search.trim()
              ? 'overflow-hidden p-4 flex flex-col'
              : 'overflow-y-auto px-6 py-5'
          }`}>
            {search.trim() ? (
              <SchemaSearchResults search={search} settings={settings} onSave={saveSettings} />
            ) : (
              <>
                {tab === 'general' && <GeneralTab settings={settings} onSave={saveSettings} />}
                {tab === 'ai' && (
                  <AiTab
                    settings={settings}
                    onSave={saveSettings}
                    mcpStatus={mcpStatus}
                    onRefreshStatus={refreshMcpStatus}
                    section={aiSection}
                    onSection={setAiSection}
                  />
                )}
                {tab === 'features' && (
                  <FeaturesLabTab
                    settings={settings}
                    onSave={saveSettings}
                    section={featuresSection}
                    onSection={setFeaturesSection}
                  />
                )}
                {tab === 'sharing' && <SharingTab settings={settings} onSave={saveSettings} section={sharingSection} onSection={setSharingSection} />}
                {tab === 'updates' && <UpdatesTab settings={settings} onSave={saveSettings} />}
                {tab === 'logging' && <LoggingTab settings={settings} onSave={saveSettings} />}
                {tab === 'telemetry' && <TelemetryTab settings={settings} onSave={saveSettings} />}
                {tab === 'about' && <AboutTab settings={settings} onSave={saveSettings} />}
                {tab === 'json' && <JsonSettingsEditor settings={settings} onSave={saveSettings} />}
                {extraTabs?.map((t) => (
                  <React.Fragment key={t.id}>
                    {tab === t.id && t.content}
                  </React.Fragment>
                ))}
                {tab === 'extensions' && (
                  <ExtensionsTab
                    settings={settings}
                    onSave={saveSettings}
                    section={extensionsSection}
                    onSection={setExtensionsSection}
                    installedExtensions={installedExtensions}
                    extContributions={extContributions}
                  />
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

type AiSection = 'providers' | 'mcp' | 'personas' | 'prompts' | 'analytics';

function AiTab({
  settings,
  onSave,
  mcpStatus,
  onRefreshStatus,
  section,
  onSection,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  mcpStatus: Record<string, boolean>;
  onRefreshStatus: () => Promise<void>;
  section: AiSection;
  onSection: (s: AiSection) => void;
}) {
  const sections: { id: AiSection; label: string }[] = [
    { id: 'providers', label: 'Providers' },
    { id: 'mcp',       label: 'MCP' },
    { id: 'personas',  label: 'Personas' },
    { id: 'prompts',   label: 'Prompts' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 pb-3 border-b border-slate-700/60">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              section === s.id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'providers' && <ProvidersTab settings={settings} onSave={onSave} />}
      {section === 'mcp' && (
        <McpTab
          settings={settings}
          onSave={onSave}
          mcpStatus={mcpStatus}
          onRefreshStatus={onRefreshStatus}
        />
      )}
      {section === 'personas' && <PersonasPanel />}
      {section === 'prompts' && <PromptsPanel />}
      {section === 'analytics' && <AnalyticsTab settings={settings} onSave={onSave} />}
    </div>
  );
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <SchemaFormRenderer
        contribution={settingsRegistry.get('openconduit.general')}
        settings={settings}
        onSave={onSave}
        renderOverrides={{
          defaultProviderId: (
            <select
              value={settings.defaultProviderId ?? ''}
              onChange={(e) => void onSave({ defaultProviderId: e.target.value || undefined })}
              className="select-field"
            >
              <option value="">None</option>
              {settings.providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ),
        }}
      />
      <Section title="Configuration">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Export your settings for backup or sharing. The clean export omits API keys — safe to share.
          The full export includes API keys — keep it private.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => service.config.exportSettings(true)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Export (clean)
          </button>
          <button
            onClick={() => service.config.exportSettings(false)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Export (with API keys)
          </button>
          <button
            onClick={async () => {
              const imported = await service.config.importSettings();
              if (imported) onSave(imported);
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Import Config
          </button>
          {'openSettingsFile' in service.config && (
            <button
              onClick={() => (service.config as typeof service.config & { openSettingsFile(): Promise<void> }).openSettingsFile()}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open settings.json
            </button>
          )}
        </div>
      </Section>
      <BundleSection settings={settings} onSave={onSave} />
    </div>
  );
}

// ─── Bundle Section ───────────────────────────────────────────────────────────
// Package your provider + MCP server setup (no secrets) into a shareable file
// that others can import to get everything pre-wired.

function BundleSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; mcpAdded: number; mcpSkipped: number } | null>(null);
  const [importError, setImportError] = useState('');

  if (!service.config.exportBundle) return null;

  async function handleExport() {
    await service.config.exportBundle!({ name: bundleName || undefined, description: bundleDesc || undefined });
  }

  async function handleImport() {
    setImportResult(null);
    setImportError('');
    try {
      const bundle: ConfigBundle | null = await service.config.importBundle!();
      if (!bundle) return;

      const existingProviderIds = new Set(settings.providers.map((p) => p.id));
      const newProviders = bundle.providers.filter((p) => !existingProviderIds.has(p.id));
      const skippedProviders = bundle.providers.length - newProviders.length;

      const existingMcpIds = new Set(settings.mcpServers.map((s) => s.id));
      const newMcpServers = bundle.mcpServers.filter((s) => !existingMcpIds.has(s.id));
      const skippedMcp = bundle.mcpServers.length - newMcpServers.length;

      await onSave({
        providers: [...settings.providers, ...newProviders],
        mcpServers: [...settings.mcpServers, ...newMcpServers],
      });

      setImportResult({ added: newProviders.length, skipped: skippedProviders, mcpAdded: newMcpServers.length, mcpSkipped: skippedMcp });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Section title="Config Bundle">
      <p className="text-xs text-slate-500 -mt-1 mb-3">
        Package your provider and MCP server setup — without API keys or tokens — into a
        shareable <code className="text-slate-400">.ocbundle</code> file. Recipients import it and
        only need to add their own credentials.
      </p>

      {/* Export */}
      <div className="space-y-2 mb-4">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Export</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Bundle name (optional)"
            value={bundleName}
            onChange={(e) => setBundleName(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={bundleDesc}
            onChange={(e) => setBundleDesc(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button onClick={handleExport} className="btn-secondary text-xs px-3 py-1.5">
          Export Bundle
        </button>
      </div>

      {/* Import */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Import</p>
        <button onClick={handleImport} className="btn-secondary text-xs px-3 py-1.5">
          Import Bundle
        </button>
        {importResult && (
          <p className="text-xs text-green-400">
            Added {importResult.added} provider{importResult.added !== 1 ? 's' : ''}
            {importResult.skipped > 0 ? ` (${importResult.skipped} already existed)` : ''}
            {' and '}{importResult.mcpAdded} MCP server{importResult.mcpAdded !== 1 ? 's' : ''}
            {importResult.mcpSkipped > 0 ? ` (${importResult.mcpSkipped} already existed)` : ''}.
            {(importResult.added > 0 || importResult.mcpAdded > 0) && ' Fill in your API keys to get started.'}
          </p>
        )}
        {importError && <p className="text-xs text-red-400">{importError}</p>}
      </div>
    </Section>
  );
}

// ─── Providers Tab ────────────────────────────────────────────────────────────

function ProvidersTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [view, setView] = useState<'list' | 'marketplace'>('list');
  const [localStatus, setLocalStatus] = useState<Record<string, { running: boolean; loadedModels: string[] }>>({});

  useEffect(() => {
    if (view !== 'list') return;
    const hasLocal = settings.providers.some((p) => p.type === 'lmstudio' || p.type === 'ollama');
    if (!hasLocal) return;
    service.models.probe?.().then(setLocalStatus).catch((): void => undefined);
  }, [view, settings.providers]);

  const handleSaveProvider = (provider: ProviderConfig) => {
    const providers = isNew
      ? [...settings.providers, provider]
      : settings.providers.map((p) => (p.id === provider.id ? provider : p));
    onSave({ providers });
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this provider?')) return;
    onSave({ providers: settings.providers.filter((p) => p.id !== id) });
  };

  if (editing) {
    return (
      <ProviderForm
        provider={editing}
        onSave={handleSaveProvider}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (view === 'marketplace') {
    // Track which registry IDs the user has already added (by matching name)
    const addedNames = new Set(settings.providers.map((p) => p.name));
    return (
      <ProviderMarketplace
        installedTypes={addedNames}
        onInstall={(partial) => {
          setView('list');
          setIsNew(true);
          setEditing({ id: uuidv4(), ...partial });
        }}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          {settings.providers.length} provider{settings.providers.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setView('marketplace')}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Browse Marketplace
          </button>
          <button
            onClick={() => {
              setIsNew(true);
              setEditing({ id: uuidv4(), name: '', type: 'openai' });
            }}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Add Provider
          </button>
        </div>
      </div>

      {settings.providers.map((p) => (
        <div
          key={p.id}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3"
        >
          <ProviderBadge type={p.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">{p.name}</p>
            <p className="text-xs text-slate-500">
              {p.type}
              {p.baseUrl ? ` · ${p.baseUrl}` : ''}
              {p.defaultModel ? ` · ${p.defaultModel}` : ''}
            </p>
          </div>
          {(p.type === 'lmstudio' || p.type === 'ollama') && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                localStatus[p.id]?.running
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-slate-700 text-slate-500'
              }`}
              title={
                localStatus[p.id]?.running && localStatus[p.id].loadedModels.length > 0
                  ? localStatus[p.id].loadedModels.join(', ')
                  : undefined
              }
            >
              {localStatus[p.id]?.running
                ? localStatus[p.id].loadedModels.length > 0
                  ? `${localStatus[p.id].loadedModels.length} loaded`
                  : 'Running'
                : 'Not detected'}
            </span>
          )}
          <button
            onClick={() => {
              setIsNew(false);
              setEditing({ ...p });
            }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(p.id)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Delete
          </button>
        </div>
      ))}

      {settings.providers.length === 0 && (
        <EmptyState
          icon="🔑"
          title="No providers"
          subtitle="Add an OpenAI, Anthropic, LM Studio, or Ollama provider to get started"
        />
      )}
    </div>
  );
}

// ── GitHub Copilot OAuth (device flow) + PAT ─────────────────────────────────

type CopilotAuthState =
  | { phase: 'idle' }
  | { phase: 'pat' }
  | { phase: 'connecting'; deviceCode: string; userCode: string; verificationUri: string; interval: number }
  | { phase: 'connected' }
  | { phase: 'error'; message: string };

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••';
  return token.slice(0, 4) + '••••••••' + token.slice(-4);
}

type CopilotUsageData = {
  premiumRequestsUsed: number;
  premiumRequestsIncluded: number;
  premiumRequestsPurchased: number;
};
type UsageState = { kind: 'loading' } | { kind: 'data'; d: CopilotUsageData } | { kind: 'unavailable' };

function CopilotAuthSection({
  githubToken,
  onToken,
}: {
  githubToken: string;
  onToken: (token: string) => void;
}) {
  const [state, setState] = useState<CopilotAuthState>(
    githubToken ? { phase: 'connected' } : { phase: 'idle' },
  );
  const [revealed, setRevealed] = useState(false);
  const [patValue, setPatValue] = useState('');
  const [usage, setUsage] = useState<UsageState>({ kind: 'loading' });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch usage whenever the connected state is shown
  useEffect(() => {
    if (state.phase !== 'connected' || !githubToken) return;
    setUsage({ kind: 'loading' });
    service.copilot?.getUsage(githubToken)
      .then((d) => setUsage(d ? { kind: 'data', d } : { kind: 'unavailable' }))
      .catch(() => setUsage({ kind: 'unavailable' }));
  }, [state.phase, githubToken]);

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  async function startAuth() {
    setState({ phase: 'idle' });
    try {
      const flow = await service.copilot?.startAuth();
      if (!flow) { setState({ phase: 'error', message: 'Copilot auth not available' }); return; }
      setState({ phase: 'connecting', deviceCode: flow.device_code, userCode: flow.user_code, verificationUri: flow.verification_uri, interval: flow.interval });
      poll(flow.device_code, flow.interval * 1000, flow.expires_in * 1000);
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function poll(deviceCode: string, intervalMs: number, remainingMs: number) {
    pollRef.current = setTimeout(async () => {
      if (remainingMs <= 0) { setState({ phase: 'error', message: 'Code expired. Please try again.' }); return; }
      try {
        const result = await service.copilot?.pollAuth(deviceCode);
        if (!result || result.status === 'error') {
          setState({ phase: 'error', message: result?.error ?? 'Auth failed' });
        } else if (result.status === 'complete' && result.token) {
          onToken(result.token);
          setState({ phase: 'connected' });
        } else if (result.status === 'expired') {
          setState({ phase: 'error', message: 'Code expired. Please try again.' });
        } else {
          poll(deviceCode, intervalMs, remainingMs - intervalMs);
        }
      } catch (err) {
        setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }, intervalMs);
  }

  if (state.phase === 'connected') {
    const d = usage.kind === 'data' ? usage.d : null;
    const total = d ? d.premiumRequestsIncluded + d.premiumRequestsPurchased : 0;
    const pct = total > 0 ? Math.min(100, (d!.premiumRequestsUsed / total) * 100) : 0;
    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
      <div className="rounded-lg bg-green-950/40 border border-green-800/50 px-3 py-2.5 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-sm">✓ Connected to GitHub</span>
          <button
            onClick={() => { onToken(''); setRevealed(false); setState({ phase: 'idle' }); }}
            className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Token row */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400 select-all flex-1 truncate">
            {revealed ? githubToken : maskToken(githubToken)}
          </span>
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(githubToken)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            Copy
          </button>
        </div>

        {/* Usage */}
        {usage.kind === 'loading' && (
          <p className="text-[11px] text-slate-500">Loading usage…</p>
        )}
        {usage.kind === 'data' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">Premium requests</span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {d!.premiumRequestsUsed.toLocaleString()} / {total.toLocaleString()}
                <span className="ml-1.5 text-slate-500">{pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {d!.premiumRequestsPurchased > 0 && (
              <p className="text-[10px] text-slate-500">Includes {d!.premiumRequestsPurchased.toLocaleString()} purchased</p>
            )}
          </div>
        )}
        {usage.kind === 'unavailable' && (
          <button
            onClick={() => service.updater?.openExternal('https://github.com/settings/copilot')}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            View usage on GitHub →
          </button>
        )}
      </div>
    );
  }

  if (state.phase === 'pat') {
    return (
      <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3 space-y-2.5">
        <p className="text-xs text-slate-400">
          Paste a GitHub personal access token (classic or fine-grained) with Copilot access.
        </p>
        <input
          type="password"
          value={patValue}
          onChange={(e) => setPatValue(e.target.value)}
          placeholder="ghp_… or github_pat_…"
          className="w-full rounded bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            disabled={!patValue.trim()}
            onClick={() => { if (patValue.trim()) { onToken(patValue.trim()); setState({ phase: 'connected' }); setPatValue(''); } }}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
          >
            Save token
          </button>
          <button
            onClick={() => { setPatValue(''); setState({ phase: 'idle' }); }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'connecting') {
    return (
      <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3 space-y-2.5">
        <p className="text-xs text-slate-300">
          Visit <a href="#" onClick={(e) => { e.preventDefault(); service.updater?.openExternal(state.verificationUri); }} className="text-blue-400 underline">{state.verificationUri}</a> and enter the code:
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-white bg-slate-700 px-3 py-1 rounded">
            {state.userCode}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(state.userCode)}
            className="text-xs text-slate-400 hover:text-slate-200"
            title="Copy code"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Waiting for authorization…
        </p>
        <button onClick={() => { if (pollRef.current) clearTimeout(pollRef.current); setState({ phase: 'idle' }); }} className="text-xs text-slate-500 hover:text-slate-300">
          Cancel
        </button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{state.message}</p>
        <div className="flex gap-2">
          <button onClick={startAuth} className="btn-secondary text-xs px-3 py-1.5">
            Try Again
          </button>
          <button onClick={() => setState({ phase: 'pat' })} className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5">
            Use a token instead
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className="space-y-2">
      <button
        onClick={startAuth}
        className="flex items-center gap-2 w-full justify-center rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 px-4 py-2.5 transition-colors"
      >
        <span>🐙</span>
        Connect with GitHub
      </button>
      <button
        onClick={() => setState({ phase: 'pat' })}
        className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-0.5"
      >
        Use a personal access token instead
      </button>
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ProviderConfig;
  onSave: (p: ProviderConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ProviderConfig>({ ...provider });

  const set = (key: keyof ProviderConfig, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {provider.name ? `Edit ${provider.name}` : 'New Provider'}
        </h3>
      </div>

      {/* ── Section: Connection ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Connection</p>

        <Field label="Display Name">
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="My OpenAI"
            className="input-field"
          />
        </Field>

        <Field label="Type">
          <select
            value={draft.type}
            onChange={(e) => set('type', e.target.value as ProviderType)}
            className="select-field"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="lmstudio">LM Studio</option>
            <option value="ollama">Ollama</option>
            <option value="gemini">Google Gemini</option>
            <option value="bedrock">Amazon Bedrock</option>
            <option value="copilot">GitHub Copilot</option>
          </select>
        </Field>

        {/* API Key / Access Key ID — hidden for Copilot (uses OAuth) and for local providers */}
        {draft.type !== 'lmstudio' && draft.type !== 'ollama' && draft.type !== 'copilot' && (
          <Field label={draft.type === 'bedrock' ? 'Access Key ID' : 'API Key'}>
            <input
              type="password"
              value={draft.apiKey ?? ''}
              onChange={(e) => set('apiKey', e.target.value)}
              placeholder={
                draft.type === 'gemini' ? 'AIza...' :
                draft.type === 'bedrock' ? 'AKIA...' :
                'sk-...'
              }
              className="input-field"
              autoComplete="off"
            />
          </Field>
        )}

        {/* Bedrock: Secret Access Key */}
        {draft.type === 'bedrock' && (
          <Field label="Secret Access Key">
            <input
              type="password"
              value={(draft as ProviderConfig & { apiSecret?: string }).apiSecret ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, apiSecret: e.target.value }))}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="input-field"
              autoComplete="off"
            />
          </Field>
        )}

        {/* Copilot: OAuth connect button */}
        {draft.type === 'copilot' && (
          <CopilotAuthSection
            githubToken={draft.apiKey ?? ''}
            onToken={(token) => set('apiKey', token)}
          />
        )}

        {/* Base URL / AWS Region — hidden for Copilot (endpoint is fixed) */}
        {draft.type !== 'copilot' && (
          <Field label={draft.type === 'bedrock' ? 'AWS Region' : 'Base URL'}>
            <input
              type={draft.type === 'bedrock' ? 'text' : 'url'}
              value={draft.baseUrl ?? ''}
              onChange={(e) => set('baseUrl', e.target.value)}
              placeholder={
                draft.type === 'lmstudio'
                  ? 'http://localhost:1234/v1'
                  : draft.type === 'ollama'
                    ? 'http://localhost:11434/v1'
                  : draft.type === 'anthropic'
                    ? 'https://…services.ai.azure.com/anthropic'
                    : draft.type === 'gemini'
                      ? 'https://generativelanguage.googleapis.com (optional)'
                      : draft.type === 'bedrock'
                        ? 'us-east-1'
                        : 'https://api.openai.com/v1'
              }
              className="input-field"
            />
            {draft.type === 'anthropic' && draft.baseUrl?.includes('azure.com') && (
              <p className="text-xs text-amber-400 mt-1">
                Azure detected — do <strong>not</strong> include <code>/v1/messages</code> in the URL.
              </p>
            )}
            {draft.type === 'bedrock' && (
              <p className="text-xs text-slate-400 mt-1">
                e.g. <code className="font-mono">us-east-1</code>, <code className="font-mono">eu-west-1</code>. Request model access in the AWS console first.
              </p>
            )}
          </Field>
        )}

        {draft.type === 'anthropic' && (
          <Field label="API Version">
            <input
              type="text"
              value={draft.apiVersion ?? ''}
              onChange={(e) => set('apiVersion', e.target.value)}
              placeholder="e.g. 2025-04-15  (required for Azure AI Foundry)"
              className="input-field font-mono text-xs"
            />
          </Field>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-slate-700/60" />

      {/* ── Section: Models ── */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Models</p>

        <Field label="Default Model">
          <input
            type="text"
            value={draft.defaultModel ?? ''}
            onChange={(e) => set('defaultModel', e.target.value)}
            placeholder={
              draft.type === 'anthropic'
                ? 'claude-sonnet-4-5'
                : draft.type === 'lmstudio'
                  ? 'local-model'
                  : draft.type === 'ollama'
                    ? 'llama3.2'
                  : draft.type === 'gemini'
                    ? 'gemini-2.0-flash'
                    : 'gpt-4o'
            }
            className="input-field"
          />
        </Field>

        <ModelsField
          models={draft.customModels ?? []}
          contextWindows={draft.modelContextWindows ?? {}}
          onChange={(customModels, modelContextWindows) =>
            setDraft((d) => ({ ...d, customModels, modelContextWindows }))
          }
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-1 border-t border-slate-700/60">
        <button
          onClick={() => onSave(draft)}
          disabled={!draft.name.trim()}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          Save Provider
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── MCP Tab ──────────────────────────────────────────────────────────────────

function McpTab({
  settings,
  onSave,
  mcpStatus,
  onRefreshStatus,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  mcpStatus: Record<string, boolean>;
  onRefreshStatus: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<McpServerConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [view, setView] = useState<'list' | 'marketplace'>('list');

  const handleSaveServer = (server: McpServerConfig) => {
    const mcpServers = isNew
      ? [...settings.mcpServers, server]
      : settings.mcpServers.map((s) => (s.id === server.id ? server : s));
    onSave({ mcpServers });
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this MCP server?')) return;
    service.mcp.disconnect(id).catch(() => { /* intentional */ });
    onSave({ mcpServers: settings.mcpServers.filter((s) => s.id !== id) });
  };

  if (editing) {
    return (
      <McpServerForm
        server={editing}
        onSave={handleSaveServer}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (view === 'marketplace') {
    const installedIds = new Set(
      settings.mcpServers.map((s) => s.name)
    );
    return (
      <McpMarketplace
        installedIds={installedIds}
        onInstall={(partial) => {
          setView('list');
          setIsNew(true);
          setEditing({ id: uuidv4(), ...partial });
        }}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          {settings.mcpServers.length} server{settings.mcpServers.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex gap-2">
          <button onClick={onRefreshStatus} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors">
            Refresh
          </button>
          <button
            onClick={() => setView('marketplace')}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Browse Marketplace
          </button>
          <button
            onClick={() => {
              setIsNew(true);
              setEditing({
                id: uuidv4(),
                name: '',
                transport: 'http-sse',
                enabled: false,
              });
            }}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Add Server
          </button>
        </div>
      </div>

      {settings.mcpServers.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700 hover:border-slate-600 transition-colors group"
        >
          {/* Connection status dot */}
          <span
            title={mcpStatus[s.id] ? 'Connected' : 'Not connected'}
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              mcpStatus[s.id] ? 'bg-green-400' : 'bg-slate-600'
            }`}
          />

          {/* Name + subtitle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">{s.name}</p>
            <p className="text-xs text-slate-500 truncate font-mono">
              {s.transport === 'stdio'
                ? [s.command, ...(s.args ?? [])].filter(Boolean).join(' ')
                : (s.url ?? '')}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {s.transport} · {s.id.slice(0, 8)}
            </p>
          </div>

          {/* Actions */}
          <button
            onClick={() => { setIsNew(false); setEditing({ ...s }); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(s.id)}
            className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            Delete
          </button>
        </div>
      ))}

      {settings.mcpServers.length === 0 && (
        <EmptyState
          icon="🔌"
          title="No MCP servers"
          subtitle="Add HTTP-SSE or stdio MCP servers to give the AI access to tools"
        />
      )}
    </div>
  );
}

function McpServerForm({
  server,
  onSave,
  onCancel,
}: {
  server: McpServerConfig;
  onSave: (s: McpServerConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<McpServerConfig>({ ...server });
  // HTTP headers as editable rows
  const [headerRows, setHeaderRows] = useState<[string, string][]>(
    Object.entries(draft.headers ?? {})
  );
  // Combined command line for stdio: "npx -y @scope/package" splits into command + args on save
  const [commandLine, setCommandLine] = useState(
    [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')
  );
  // Verify (View Tools) state
  const [verifying, setVerifying] = useState(false);
  const [verifiedTools, setVerifiedTools] = useState<McpTool[] | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const set = <K extends keyof McpServerConfig>(key: K, value: McpServerConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addHeaderRow = () => setHeaderRows((r) => [...r, ['', '']]);
  const setHeaderRow = (i: number, k: string, v: string) =>
    setHeaderRows((r) => {
      const next = [...r] as [string, string][];
      next[i] = [k, v];
      return next;
    });
  const removeHeaderRow = (i: number) =>
    setHeaderRows((r) => r.filter((_, idx) => idx !== i));

  const buildFinalDraft = (): McpServerConfig => {
    const headers = Object.fromEntries(headerRows.filter(([k]) => k.trim()));
    if (draft.transport === 'stdio') {
      const parts = commandLine.trim().split(/\s+/).filter(Boolean);
      return {
        ...draft,
        command: parts[0] ?? '',
        args: parts.slice(1),
        headers: undefined,
      };
    }
    return { ...draft, headers: Object.keys(headers).length ? headers : undefined };
  };

  const handleSave = () => onSave(buildFinalDraft());

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError('');
    setVerifiedTools(null);
    try {
      const config = buildFinalDraft();
      await service.mcp.connect(config);
      const tools = await service.mcp.listTools([config.id]);
      setVerifiedTools(tools);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: back + title */}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200 flex-1">
          {server.name ? `Edit ${server.name}` : 'New MCP Server'}
        </h3>
      </div>

      {/* Type */}
      <Field label="Type">
        <select
          value={draft.transport}
          onChange={(e) => {
            set('transport', e.target.value as McpTransport);
            setVerifiedTools(null);
            setVerifyError('');
          }}
          className="select-field"
        >
          <option value="http-streamable">HTTP Server — Streamable HTTP (modern)</option>
          <option value="http-sse">HTTP Server — SSE (legacy)</option>
          <option value="stdio">Command-line (stdio)</option>
        </select>
      </Field>

      {/* Name + ID side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
          <p className="text-xs text-slate-600 mb-1">Help you identify the tool</p>
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="My MCP Server"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">ID</label>
          <p className="text-xs text-slate-600 mb-1">A unique identifier used by the model</p>
          <input
            type="text"
            value={draft.id}
            onChange={(e) => set('id', e.target.value)}
            className="input-field font-mono text-xs"
          />
        </div>
      </div>

      {/* HTTP fields */}
      {(draft.transport === 'http-sse' || draft.transport === 'http-streamable') ? (
        <>
          <Field label="URL">
            <input
              type="url"
              value={draft.url ?? ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://..."
              className="input-field"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.autoApprove ?? false}
              onChange={(e) => set('autoApprove', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-slate-300">Run tools automatically</span>
          </label>

          {/* Key-value HTTP headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">HTTP headers</label>
              <button type="button" onClick={addHeaderRow} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Add header
              </button>
            </div>
            <div className="space-y-2">
              {headerRows.map(([k, v], i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={k} onChange={(e) => setHeaderRow(i, e.target.value, v)} placeholder="Header name" className="input-field flex-1 text-xs font-mono" />
                  <input type="text" value={v} onChange={(e) => setHeaderRow(i, k, e.target.value)} placeholder="Value" className="input-field flex-1 text-xs font-mono" />
                  <button type="button" onClick={() => removeHeaderRow(i)} className="text-slate-500 hover:text-red-400 transition-colors text-sm leading-none px-1">✕</button>
                </div>
              ))}
              {headerRows.length === 0 && <p className="text-xs text-slate-600 italic">No headers added</p>}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Combined command field — splits on save */}
          <Field label="Command">
            <input
              type="text"
              value={commandLine}
              onChange={(e) => setCommandLine(e.target.value)}
              placeholder="npx -y @modelcontextprotocol/server-memory"
              className="input-field font-mono text-xs"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.autoApprove ?? false}
              onChange={(e) => set('autoApprove', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-slate-300">Run tools automatically</span>
          </label>

          {/* Environment variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">Environment variables</label>
              <button
                type="button"
                onClick={() => set('env', { ...(draft.env ?? {}), '': '' })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add
              </button>
            </div>
            {Object.entries(draft.env ?? {}).map(([k, v], i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <input
                  type="text"
                  defaultValue={k}
                  onBlur={(e) => {
                    const env = Object.fromEntries(
                      Object.entries(draft.env ?? {}).map(([ek, ev], idx) =>
                        idx === i ? [e.target.value, ev] : [ek, ev]
                      )
                    );
                    set('env', env);
                  }}
                  placeholder="KEY"
                  className="input-field flex-1 text-xs font-mono"
                />
                <input
                  type="text"
                  value={v}
                  onChange={(e) => set('env', { ...draft.env, [k]: e.target.value })}
                  placeholder="value"
                  className="input-field flex-1 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const env = Object.fromEntries(
                      Object.entries(draft.env ?? {}).filter((_, idx) => idx !== i)
                    );
                    set('env', env);
                  }}
                  className="text-slate-500 hover:text-red-400 transition-colors text-sm px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            {Object.keys(draft.env ?? {}).length === 0 && (
              <p className="text-xs text-slate-600 italic">No variables added</p>
            )}
          </div>
        </>
      )}

      {/* Verify (View Tools) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || !draft.name.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? 'Connecting…' : 'Verify (View Tools)'}
        </button>
        {verifyError && (
          <p className="text-xs text-red-400 mt-2">{verifyError}</p>
        )}
        {verifiedTools && (
          <div className="mt-3 space-y-2">
            {verifiedTools.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Connected — no tools exposed by this server.</p>
            ) : (
              <>
                <p className="text-xs text-slate-400">{verifiedTools.length} tool{verifiedTools.length !== 1 ? 's' : ''} available</p>
                <div className="grid grid-cols-2 gap-2">
                  {verifiedTools.map((t) => (
                    <div key={t.name} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
                      <code className="text-xs text-cyan-300 font-mono block">{t.name}</code>
                      {t.description && (
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={!draft.name.trim()}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          Save Server
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Unified Models Field ─────────────────────────────────────────────────────
// One entry per model: name + optional context window size.


function ModelsField({
  models,
  contextWindows,
  onChange,
}: {
  models: string[];
  contextWindows: Record<string, number>;
  onChange: (models: string[], contextWindows: Record<string, number>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCtx, setFormCtx] = useState('');
  const nameRef = React.useRef<HTMLInputElement>(null);

  // Build unified list: start from customModels, merge in any contextWindow keys
  const allNames = Array.from(new Set([...models, ...Object.keys(contextWindows)]));

  const openForm = () => {
    setFormName('');
    setFormCtx('');
    setShowForm(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const commit = () => {
    const name = formName.trim();
    if (!name) return;
    const newModels = models.includes(name) ? models : [...models, name];
    const newCtx = { ...contextWindows };
    const tok = parseInt(formCtx);
    if (!isNaN(tok) && tok > 0) newCtx[name] = tok;
    onChange(newModels, newCtx);
    setShowForm(false);
  };

  const remove = (name: string) => {
    const newModels = models.filter((m) => m !== name);
    const newCtx = { ...contextWindows };
    delete newCtx[name];
    onChange(newModels, newCtx);
  };

  const updateCtx = (name: string, raw: string) => {
    const newCtx = { ...contextWindows };
    const tok = parseInt(raw);
    if (!raw || isNaN(tok) || tok < 1) {
      delete newCtx[name];
    } else {
      newCtx[name] = tok;
    }
    onChange(models, newCtx);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-400">Models</label>
        <button
          type="button"
          onClick={openForm}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Add model
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="mb-3 p-3 rounded-lg border border-slate-600 bg-slate-800/80 space-y-2">
          <div>
            <p className="text-[11px] text-slate-400 mb-1">Model name</p>
            <input
              ref={nameRef}
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setShowForm(false); }}
              placeholder="e.g. gpt-5.1"
              className="input-field w-full text-sm font-mono"
            />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-1">Context window <span className="text-slate-600">(tokens — optional)</span></p>
            <input
              type="number"
              min={1024}
              step={1024}
              value={formCtx}
              onChange={(e) => setFormCtx(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setShowForm(false); }}
              placeholder="e.g. 128000"
              className="input-field w-full text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={commit} disabled={!formName.trim()} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {/* Model list */}
      {allNames.length > 0 ? (
        <div className="space-y-1.5">
          {allNames.map((name) => (
            <div key={name} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
              <span className="flex-1 text-sm text-slate-200 font-mono truncate">{name}</span>
              <input
                type="number"
                min={1024}
                step={1024}
                value={contextWindows[name] ?? ''}
                onChange={(e) => updateCtx(name, e.target.value)}
                placeholder="ctx tokens"
                className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-400 text-right placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => remove(name)}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs leading-none pl-1"
              >✕</button>
            </div>
          ))}
        </div>
      ) : (
        !showForm && <p className="text-xs text-slate-600 italic">No models added — leave empty to use the API's model list</p>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

// ─── Features Tab ─────────────────────────────────────────────────────────────

// ─── Extensions Tab ──────────────────────────────────────────────────────────

function ExtensionsTab({
  settings,
  onSave,
  section,
  onSection,
  installedExtensions,
  extContributions,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  section: 'installed' | 'settings';
  onSection: (s: 'installed' | 'settings') => void;
  installedExtensions: ExtensionManifest[];
  extContributions: SettingsContribution[];
}) {
  const sections = [
    { id: 'installed' as const, label: 'Installed' },
    ...(extContributions.length > 0 ? [{ id: 'settings' as const, label: 'Settings' }] : []),
  ];

  const handleToggle = async (id: string, currentlyDisabled: boolean) => {
    if (currentlyDisabled) {
      extensionRegistry.enable(id);
    } else {
      extensionRegistry.disable(id);
    }
    const next = extensionRegistry.getDisabledIds();
    await onSave({ disabledExtensionIds: next });
  };

  return (
    <div className="space-y-4">
      {sections.length > 1 && (
        <div className="flex gap-1 pb-3 border-b border-slate-700/60">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                section === s.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {section === 'installed' && (
        <div className="space-y-2">
          {installedExtensions.length === 0 ? (
            <EmptyState icon="🧩" title="No extensions" subtitle="Extensions you install will appear here" />
          ) : (
            installedExtensions.map((ext) => {
              const isDisabled = extensionRegistry.isDisabled(ext.id);
              const isBuiltIn = ext.id.startsWith('openconduit.');
              return (
                <div
                  key={ext.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    isDisabled
                      ? 'bg-slate-900/40 border-slate-700/30 opacity-60'
                      : 'bg-slate-900/60 border-slate-700/50'
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(ext.id, isDisabled)}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isDisabled ? 'bg-slate-700' : 'bg-blue-600'
                    }`}
                    aria-checked={!isDisabled}
                    role="switch"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        isDisabled ? 'translate-x-0' : 'translate-x-4'
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-200 truncate">{ext.name}</span>
                      {isBuiltIn && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/80 text-slate-400 border border-slate-600/50 flex-shrink-0">
                          Built-in
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 flex-shrink-0">v{ext.version}</span>
                    </div>
                    {ext.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{ext.description}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {section === 'settings' && (
        <div className="space-y-8">
          {extContributions.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <div className="border-t border-slate-700/40 mb-8" />}
              <p className="text-xs font-semibold text-slate-300 mb-4">{c.label}</p>
              <SchemaFormRenderer
                contribution={c}
                settings={settings}
                onSave={onSave}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Features + Labs Tab ─────────────────────────────────────────────────────

function FeaturesLabTab({
  settings,
  onSave,
  section,
  onSection,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  section: 'features' | 'labs';
  onSection: (s: 'features' | 'labs') => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 pb-3 border-b border-slate-700/60">
        {([{ id: 'features', label: 'Features' }, { id: 'labs', label: 'Labs' }] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => onSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              section === s.id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'features' && <FeaturesTab settings={settings} onSave={onSave} />}
      {section === 'labs' && <LabsTab settings={settings} onSave={onSave} />}
    </div>
  );
}

// ─── Features Tab ─────────────────────────────────────────────────────────────

function FeaturesTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const routing = settings.routing;
  const [showRoutingConfig, setShowRoutingConfig] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl bg-blue-950/30 border border-blue-800/40 px-4 py-3">
        <span className="text-lg mt-0.5">✨</span>
        <div>
          <p className="text-sm font-medium text-blue-300">Shipped Features</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Stable features you can enable or disable.
          </p>
        </div>
      </div>

      <Section title="AI Capabilities">
        <FeatureRow
          title="Intelligent Model Routing"
          description="Automatically routes each prompt to the best model based on complexity or task type."
          value={routing?.enabled ?? false}
          onChange={(v) =>
            onSave({
              routing: {
                enabled: v,
                routerProviderId: routing?.routerProviderId,
                routerModel: routing?.routerModel,
                tierRouting: routing?.tierRouting ?? { enabled: false, tiers: [] },
                providerRouting: routing?.providerRouting ?? { enabled: false, rules: [] },
              },
            })
          }
          onConfigure={() => setShowRoutingConfig((o) => !o)}
          configOpen={showRoutingConfig}
        />
        {showRoutingConfig && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 -mt-1">
            <RoutingConfig settings={settings} onSave={onSave} />
          </div>
        )}
      </Section>
    </div>
  );
}

function FeatureRow({
  title,
  description,
  value,
  onChange,
  onConfigure,
  configOpen,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onConfigure?: () => void;
  configOpen?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-slate-800/40 border px-4 py-3 ${
      configOpen ? 'border-blue-700/60 rounded-b-none' : 'border-slate-700/50'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-0.5 rounded border border-blue-700/50 hover:border-blue-500/70"
            >
              {configOpen ? 'Close' : 'Configure'}
            </button>
          )}
          <Toggle value={value} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Routing Config (inline panel) ────────────────────────────────────────────

const TASK_TYPES: RoutingTaskType[] = ['writing', 'code', 'tools', 'reasoning', 'general'];

const DEFAULT_ROUTING: RoutingConfig = {
  enabled: false,
  routerProviderId: undefined,
  routerModel: undefined,
  tierRouting: { enabled: false, tiers: [] },
  providerRouting: { enabled: false, rules: [] },
};

function RoutingConfig({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const routing: RoutingConfig = settings.routing ?? DEFAULT_ROUTING;
  const { models, loadModels } = useSettingsStore();

  const saveRouting = (partial: Partial<RoutingConfig>) => {
    onSave({ routing: { ...routing, ...partial } });
  };

  const routerProvider = settings.providers.find((p) => p.id === routing.routerProviderId);

  const handleRouterProviderChange = (id: string) => {
    saveRouting({ routerProviderId: id, routerModel: undefined });
    if (id) loadModels(id);
  };

  React.useEffect(() => {
    if (routing.routerProviderId) loadModels(routing.routerProviderId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routing.routerProviderId]);

  const routerModels = routing.routerProviderId ? (models[routing.routerProviderId] ?? []) : [];

  // ── Tier helpers ──────────────────────────────────────────────────────────
  const addTier = () => {
    const used = routing.tierRouting.tiers.map((t) => t.minComplexity);
    const next = ([1, 2, 3] as const).find((n) => !used.includes(n));
    if (!next) return;
    saveRouting({
      tierRouting: {
        ...routing.tierRouting,
        tiers: [...routing.tierRouting.tiers, { minComplexity: next, providerId: '', model: '', label: '' }],
      },
    });
  };

  const updateTier = (idx: number, patch: Partial<RoutingTier>) => {
    const tiers = routing.tierRouting.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    if (patch.providerId) loadModels(patch.providerId);
    saveRouting({ tierRouting: { ...routing.tierRouting, tiers } });
  };

  const removeTier = (idx: number) => {
    saveRouting({ tierRouting: { ...routing.tierRouting, tiers: routing.tierRouting.tiers.filter((_, i) => i !== idx) } });
  };

  // ── Provider rule helpers ─────────────────────────────────────────────────
  const addProviderRule = () => {
    const used = routing.providerRouting.rules.map((r) => r.taskType);
    const nextType = TASK_TYPES.find((t) => !used.includes(t)) ?? 'general';
    saveRouting({
      providerRouting: {
        ...routing.providerRouting,
        rules: [...routing.providerRouting.rules, { taskType: nextType, providerId: '', model: '' }],
      },
    });
  };

  const updateRule = (idx: number, patch: Partial<RoutingProviderRule>) => {
    const rules = routing.providerRouting.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    if (patch.providerId) loadModels(patch.providerId);
    saveRouting({ providerRouting: { ...routing.providerRouting, rules } });
  };

  const removeRule = (idx: number) => {
    saveRouting({ providerRouting: { ...routing.providerRouting, rules: routing.providerRouting.rules.filter((_, i) => i !== idx) } });
  };

  // ── Profile helpers ───────────────────────────────────────────────────────
  const profiles: RoutingProfile[] = settings.routingProfiles ?? [];
  const [newProfileName, setNewProfileName] = React.useState('');
  const [addingProfile, setAddingProfile] = React.useState(false);

  const confirmSaveProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const newProfile: RoutingProfile = {
      id: crypto.randomUUID(),
      name,
      config: { ...routing, enabled: true }, // profiles are always active by definition
    };
    onSave({ routingProfiles: [...profiles, newProfile] });
    setNewProfileName('');
    setAddingProfile(false);
  };

  const deleteProfile = (id: string) => {
    onSave({ routingProfiles: profiles.filter((p) => p.id !== id) });
  };

  const loadProfile = (profile: RoutingProfile) => {
    onSave({ routing: { ...profile.config } });
  };

  const sel = 'bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const selFull = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const btnSm = 'text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors';
  const removeBtn = 'text-slate-500 hover:text-red-400 transition-colors flex-shrink-0';

  return (
    <div className="space-y-6">
      {/* Saved Profiles */}
      <Section title="Saved Profiles">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Save the current config as a named profile. Profiles can be selected per-conversation from the model picker in the top bar.
        </p>
        {profiles.length > 0 && (
          <div className="space-y-1 mb-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2">
                <span className="text-blue-400 text-sm">🔀</span>
                <span className="text-sm text-slate-200 flex-1 truncate">{profile.name}</span>
                <button
                  onClick={() => loadProfile(profile)}
                  className={`${btnSm} text-[11px]`}
                  title="Load this profile into the config editor below"
                >
                  Load
                </button>
                <button
                  onClick={() => deleteProfile(profile.id)}
                  className={removeBtn}
                  title="Delete profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {addingProfile ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSaveProfile();
                if (e.key === 'Escape') { setAddingProfile(false); setNewProfileName(''); }
              }}
              placeholder="Profile name…"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
            />
            <button onClick={confirmSaveProfile} disabled={!newProfileName.trim()} className={`${btnSm} border-blue-600 text-blue-300 hover:bg-blue-900/30 disabled:opacity-40`}>Save</button>
            <button onClick={() => { setAddingProfile(false); setNewProfileName(''); }} className={btnSm}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingProfile(true)} className={btnSm}>
            + Save current config as profile…
          </button>
        )}
      </Section>

      {/* Classifier model */}
      <Section title="Classifier Model">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          A fast, cheap model that classifies each prompt before routing. Adds ~100 ms.
          Recommended: <span className="text-slate-400">claude-haiku-3-5</span> or <span className="text-slate-400">gpt-4o-mini</span>.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Provider</label>
            <select
              className={selFull}
              value={routing.routerProviderId ?? ''}
              onChange={(e) => handleRouterProviderChange(e.target.value)}
            >
              <option value="">Select provider…</option>
              {settings.providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Model</label>
            <select
              className={selFull}
              value={routing.routerModel ?? ''}
              onChange={(e) => saveRouting({ routerModel: e.target.value })}
              disabled={!routing.routerProviderId}
            >
              <option value="">Select model…</option>
              {routerProvider?.customModels?.map((m) => <option key={m} value={m}>{m}</option>)}
              {routerModels.filter((m) => !routerProvider?.customModels?.includes(m)).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Complexity tiers */}
      <Section title="Complexity Tiers">
        <div className="flex items-start justify-between gap-4 mb-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            The classifier scores each prompt 1 (simple) → 3 (complex).
            Map each score threshold to a provider and model. The highest matching tier wins.
          </p>
          <Toggle
            size="sm"
            value={routing.tierRouting.enabled}
            onChange={(v) => saveRouting({ tierRouting: { ...routing.tierRouting, enabled: v } })}
          />
        </div>

        {routing.tierRouting.enabled && (
          <>
            <div className="space-y-2">
              {routing.tierRouting.tiers.length === 0 && (
                <p className="text-xs text-slate-600 italic py-1">No tiers configured yet.</p>
              )}
              {routing.tierRouting.tiers.map((tier, idx) => {
                const tierModels = tier.providerId ? (models[tier.providerId] ?? []) : [];
                const tierProv = settings.providers.find((p) => p.id === tier.providerId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2">
                    <select
                      className={`${sel} w-28`}
                      value={tier.minComplexity}
                      onChange={(e) => updateTier(idx, { minComplexity: Number(e.target.value) as 1 | 2 | 3 })}
                    >
                      <option value={1}>Score ≥ 1</option>
                      <option value={2}>Score ≥ 2</option>
                      <option value={3}>Score ≥ 3</option>
                    </select>
                    <input
                      className={`${sel} w-24`}
                      placeholder="Label…"
                      value={tier.label ?? ''}
                      onChange={(e) => updateTier(idx, { label: e.target.value })}
                    />
                    <select
                      className={`${sel} flex-1`}
                      value={tier.providerId}
                      onChange={(e) => updateTier(idx, { providerId: e.target.value, model: '' })}
                    >
                      <option value="">Provider…</option>
                      {settings.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      className={`${sel} flex-1`}
                      value={tier.model}
                      onChange={(e) => updateTier(idx, { model: e.target.value })}
                      disabled={!tier.providerId}
                    >
                      <option value="">Model…</option>
                      {tierProv?.customModels?.map((m) => <option key={m} value={m}>{m}</option>)}
                      {tierModels.filter((m) => !tierProv?.customModels?.includes(m)).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <button onClick={() => removeTier(idx)} className={removeBtn} title="Remove">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            {routing.tierRouting.tiers.length < 3 && (
              <button onClick={addTier} className={`${btnSm} mt-2`}>+ Add tier</button>
            )}
          </>
        )}
      </Section>

      {/* Task-type rules */}
      <Section title="Task-Type Rules">
        <div className="flex items-start justify-between gap-4 mb-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Route by intent: writing, code, tools, reasoning, or general.
            Tier routing takes precedence over task-type rules when both are active.
          </p>
          <Toggle
            size="sm"
            value={routing.providerRouting.enabled}
            onChange={(v) => saveRouting({ providerRouting: { ...routing.providerRouting, enabled: v } })}
          />
        </div>

        {routing.providerRouting.enabled && (
          <>
            <div className="space-y-2">
              {routing.providerRouting.rules.length === 0 && (
                <p className="text-xs text-slate-600 italic py-1">No rules configured yet.</p>
              )}
              {routing.providerRouting.rules.map((rule, idx) => {
                const ruleModels = rule.providerId ? (models[rule.providerId] ?? []) : [];
                const ruleProv = settings.providers.find((p) => p.id === rule.providerId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2">
                    <select
                      className={`${sel} w-28`}
                      value={rule.taskType}
                      onChange={(e) => updateRule(idx, { taskType: e.target.value as RoutingTaskType })}
                    >
                      {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                      className={`${sel} flex-1`}
                      value={rule.providerId}
                      onChange={(e) => updateRule(idx, { providerId: e.target.value, model: '' })}
                    >
                      <option value="">Provider…</option>
                      {settings.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      className={`${sel} flex-1`}
                      value={rule.model}
                      onChange={(e) => updateRule(idx, { model: e.target.value })}
                      disabled={!rule.providerId}
                    >
                      <option value="">Model…</option>
                      {ruleProv?.customModels?.map((m) => <option key={m} value={m}>{m}</option>)}
                      {ruleModels.filter((m) => !ruleProv?.customModels?.includes(m)).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <button onClick={() => removeRule(idx)} className={removeBtn} title="Remove">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            {routing.providerRouting.rules.length < TASK_TYPES.length && (
              <button onClick={addProviderRule} className={`${btnSm} mt-2`}>+ Add rule</button>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

// ─── Labs Tab ─────────────────────────────────────────────────────────────────

function LabsTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-xl bg-purple-950/40 border border-purple-700/40 px-4 py-3">
        <span className="text-lg mt-0.5">⚗️</span>
        <div>
          <p className="text-sm font-medium text-purple-300">Experimental Features</p>
          <p className="text-xs text-slate-400 mt-0.5">
            These are in active development. Features that graduate will move to the ✨ Features tab.
          </p>
        </div>
      </div>
      <SchemaFormRenderer
        contribution={settingsRegistry.get('openconduit.labs')}
        settings={settings}
        onSave={onSave}
      />
    </div>
  );
}

// ─── Logging Tab ──────────────────────────────────────────────────────────────

function LoggingTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <SchemaFormRenderer
        contribution={settingsRegistry.get('openconduit.logging')}
        settings={settings}
        onSave={onSave}
      />
      {/* Open logs folder */}
      <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Log files</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily <code className="text-slate-300">debug-YYYY-MM-DD.log</code> files in <code className="text-slate-300">userData/logs/</code>. Kept for 7 days.
          </p>
        </div>
        <button
          onClick={() => (window as any)?.api?.log?.open?.()}
          className="shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          Open folder
        </button>
      </div>
    </div>
  );
}

// ─── JSON Settings Editor (#37 Phase 4) ───────────────────────────────────────

const jsonEditorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px' },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, SFMono-Regular, monospace',
    overflow: 'auto',
  },
  '.cm-content': { padding: '12px 0', caretColor: '#60a5fa' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#60a5fa' },
  '.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.25) !important',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
  '.cm-gutters': {
    backgroundColor: '#0a0f1a',
    borderRight: '1px solid rgba(71,85,105,0.4)',
    color: '#475569',
  },
});

function JsonSettingsEditor({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Mount editor once
  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: JSON.stringify(settings, null, 2),
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          oneDark,
          jsonEditorTheme,
          lineNumbers(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) { setIsDirty(true); setError(null); }
          }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes into the editor when it hasn't been modified
  useEffect(() => {
    const view = viewRef.current;
    if (!view || isDirty) return;
    const fresh = JSON.stringify(settings, null, 2);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fresh } });
  }, [settings, isDirty]);

  const handleSave = () => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const parsed = JSON.parse(view.state.doc.toString()) as AppSettings;
      void onSave(parsed);
      setIsDirty(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReset = () => {
    const view = viewRef.current;
    if (!view) return;
    const fresh = JSON.stringify(settings, null, 2);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fresh } });
    setIsDirty(false);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="min-w-0 flex-1">
          {error ? (
            <p className="text-xs text-red-400 font-mono truncate" title={error}>{error}</p>
          ) : isDirty ? (
            <p className="text-xs text-amber-400">Unsaved changes</p>
          ) : (
            <p className="text-xs text-slate-600">Full settings as JSON — edit and Save to apply.</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty && (
            <button onClick={handleReset} className="btn-secondary text-xs px-3 py-1.5">
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
      {/* Editor */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-700/60"
      />
    </div>
  );
}

// ─── Schema-Driven Renderer (#37) ─────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    return (acc as Record<string, unknown>)?.[key];
  }, obj);
}

function buildUpdate(settings: AppSettings, path: string, value: unknown): Partial<AppSettings> {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { [parts[0]]: value } as Partial<AppSettings>;
  }
  const [top, ...rest] = parts;
  const existing = (settings as unknown as Record<string, unknown>)[top] ?? {};
  if (rest.length === 1) {
    return { [top]: { ...(existing as object), [rest[0]]: value } } as Partial<AppSettings>;
  }
  const nestedUpdate = buildUpdate(existing as AppSettings, rest.join('.'), value);
  return { [top]: { ...(existing as object), ...nestedUpdate } } as Partial<AppSettings>;
}

function PropertyField({
  property,
  settings,
  onSave,
  renderOverride,
}: {
  property: SettingsProperty;
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  renderOverride?: React.ReactNode;
}) {
  const currentValue = getNestedValue(settings, property.key);
  const isDirty = property.default !== undefined && currentValue !== property.default;

  const handleChange = (value: unknown) => { void onSave(buildUpdate(settings, property.key, value)); };
  const handleReset = () => { if (property.default !== undefined) void onSave(buildUpdate(settings, property.key, property.default)); };

  let control: React.ReactNode;
  if (renderOverride !== undefined) {
    control = renderOverride;
  } else if (property.type === 'boolean') {
    control = <Toggle value={currentValue !== undefined ? !!currentValue : !!(property.default ?? false)} onChange={handleChange} />;
  } else if (property.type === 'string') {
    const sp = property as SettingsStringProperty;
    if (sp.enum) {
      control = (
        <select value={(currentValue as string) ?? (property.default as string | undefined) ?? ''} onChange={(e) => handleChange(e.target.value)} className="select-field">
          {sp.enum.map((v, i) => (
            <option key={v} value={v}>{sp.enumDescriptions?.[i] ?? v}</option>
          ))}
        </select>
      );
    } else if (sp.multiline) {
      control = (
        <textarea
          value={(currentValue as string) ?? (property.default as string | undefined) ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={sp.placeholder}
          className="input-field resize-none"
          rows={3}
        />
      );
    } else {
      control = (
        <input
          type={sp.sensitive ? 'password' : 'text'}
          value={(currentValue as string) ?? (property.default as string | undefined) ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={sp.placeholder}
          className="input-field"
        />
      );
    }
  } else if (property.type === 'number') {
    const np = property as SettingsNumberProperty;
    control = (
      <input
        type="number"
        value={(currentValue as number) ?? (property.default as number | undefined) ?? ''}
        onChange={(e) => handleChange(e.target.value === '' ? np.default : parseFloat(e.target.value))}
        min={np.minimum}
        max={np.maximum}
        step={np.step ?? 1}
        className="input-field w-28"
      />
    );
  } else if (property.type === 'button') {
    const bp = property as SettingsButtonProperty;
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="shrink-0 max-w-[55%]">
          <p className="text-sm text-slate-300">{property.title}</p>
          {property.description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{property.description}</p>
          )}
        </div>
        <button
          onClick={() => commandRegistry.execute(bp.command)}
          className={bp.variant === 'primary' ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}
        >
          {bp.buttonLabel}
        </button>
      </div>
    );
  }

  const resetBtn = isDirty ? (
    <button
      onClick={handleReset}
      title="Reset to default"
      className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-900/40 transition-colors"
    >
      Reset
    </button>
  ) : null;

  if (property.type === 'boolean') {
    return (
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">{property.title}</p>
            {property.description && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{property.description}</p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2 pt-0.5">
            {resetBtn}
            {control}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="shrink-0 max-w-[55%]">
        <label className="text-sm text-slate-300">{property.title}</label>
        {property.description && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{property.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {resetBtn}
        {control}
      </div>
    </div>
  );
}

function SchemaFormRenderer({
  contribution,
  settings,
  onSave,
  renderOverrides = {},
}: {
  contribution: SettingsContribution | undefined;
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  renderOverrides?: Record<string, React.ReactNode>;
}) {
  if (!contribution) return null;
  return (
    <div className="space-y-6">
      {contribution.sections.map((section) => (
        <Section key={section.title} title={section.title} description={section.description}>
          {[...section.properties]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((property) => (
              <PropertyField
                key={property.key}
                property={property}
                settings={settings}
                onSave={onSave}
                renderOverride={renderOverrides[property.key]}
              />
            ))}
        </Section>
      ))}
    </div>
  );
}

function SchemaSearchResults({
  search,
  settings,
  onSave,
}: {
  search: string;
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  type Hit = { contributionId: string; contributionLabel: string; sectionTitle: string; property: SettingsProperty };
  const query = search.toLowerCase();
  const results: Hit[] = settingsRegistry.getAll().flatMap((c) =>
    c.sections.flatMap((s) =>
      s.properties
        .filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            (p.description ?? '').toLowerCase().includes(query) ||
            p.key.toLowerCase().includes(query),
        )
        .map((p) => ({ contributionId: c.id, contributionLabel: c.label, sectionTitle: s.title, property: p })),
    ),
  );

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-slate-400">No settings match</p>
        <p className="text-xs text-slate-600 mt-1">&ldquo;{search}&rdquo;</p>
      </div>
    );
  }

  const groups = results.reduce<Record<string, { label: string; items: Hit[] }>>((acc, r) => {
    if (!acc[r.contributionId]) acc[r.contributionId] = { label: r.contributionLabel, items: [] };
    acc[r.contributionId].items.push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([id, group]) => (
        <Section key={id} title={group.label}>
          {group.items.map((item, idx) => (
            <div key={item.property.key}>
              {(idx === 0 || group.items[idx - 1].sectionTitle !== item.sectionTitle) && (
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">{item.sectionTitle}</p>
              )}
              <PropertyField property={item.property} settings={settings} onSave={onSave} />
            </div>
          ))}
        </Section>
      ))}
    </div>
  );
}

// ─── Shared Helpers ────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {title}
      </h3>
      {description && <p className="text-xs text-slate-500 mb-3 leading-relaxed">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-slate-300 flex-shrink-0">{label}</label>
      <div className="flex-1 min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  size = 'md',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative ${w} rounded-full transition-colors ${
        value ? 'bg-blue-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${dot} rounded-full bg-white transition-transform ${
          value ? translate : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ProviderBadge({ type }: { type: ProviderType }) {
  const colors: Record<ProviderType, string> = {
    openai: 'bg-emerald-800 text-emerald-200',
    anthropic: 'bg-orange-800 text-orange-200',
    lmstudio: 'bg-purple-800 text-purple-200',
    ollama: 'bg-teal-800 text-teal-200',
    gemini: 'bg-blue-800 text-blue-200',
    bedrock: 'bg-yellow-800 text-yellow-200',
    copilot: 'bg-slate-700 text-slate-200',
    perplexity: 'bg-cyan-800 text-cyan-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${colors[type]}`}>
      {type === 'lmstudio' ? 'LMS' : type === 'anthropic' ? 'ANT' : type === 'ollama' ? 'OLL' : type === 'gemini' ? 'GEM' : type === 'bedrock' ? 'AWS' : type === 'copilot' ? 'GH' : type === 'perplexity' ? 'PPX' : 'OAI'}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-10">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const { records, clearRecords } = useAnalyticsStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalIn = records.reduce((s, r) => s + r.usage.inputTokens, 0);
  const totalOut = records.reduce((s, r) => s + r.usage.outputTokens, 0);
  const totalCost = records.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const hasCost = records.some((r) => r.costUsd !== null);

  // Per-model breakdown
  const byModel = records.reduce<Record<string, { in: number; out: number; cost: number; hasCost: boolean; count: number }>>((acc, r) => {
    const key = `${r.providerId} / ${r.model}`;
    const entry = acc[key] ?? { in: 0, out: 0, cost: 0, hasCost: false, count: 0 };
    entry.in += r.usage.inputTokens;
    entry.out += r.usage.outputTokens;
    entry.cost += r.costUsd ?? 0;
    entry.hasCost = entry.hasCost || r.costUsd !== null;
    entry.count += 1;
    acc[key] = entry;
    return acc;
  }, {});

  // ── Pricing config ───────────────────────────────────────────────────────
  const pricing = settings.modelPricing ?? {};
  // Collect unique provider/model combos seen in records + existing pricing keys
  const modelKeys = Array.from(new Set([
    ...Object.keys(byModel),
    ...Object.keys(pricing),
  ])).sort();

  function setPricing(key: string, field: 'inputPer1M' | 'outputPer1M', val: string) {
    const existing = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
    onSave({ modelPricing: { ...pricing, [key]: { ...existing, [field]: parseFloat(val) || 0 } } });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Section title="Usage Summary">
        {records.length === 0 ? (
          <p className="text-xs text-slate-500">No usage recorded yet. Data appears here after your first chat.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total input', value: totalIn.toLocaleString() + ' tok' },
                { label: 'Total output', value: totalOut.toLocaleString() + ' tok' },
                { label: 'Est. cost', value: hasCost ? `$${totalCost.toFixed(4)}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg px-3 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-model table */}
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-500">
                    <th className="text-left px-3 py-2 font-medium">Provider / Model</th>
                    <th className="text-right px-3 py-2 font-medium">Turns</th>
                    <th className="text-right px-3 py-2 font-medium">Input tok</th>
                    <th className="text-right px-3 py-2 font-medium">Output tok</th>
                    <th className="text-right px-3 py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byModel).map(([key, m], i) => (
                    <tr key={key} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'}>
                      <td className="px-3 py-2 text-slate-300 font-mono text-[11px]">{key}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.count}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.in.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.out.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.hasCost ? `$${m.cost.toFixed(4)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              {showClearConfirm ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Clear all records?</span>
                  <button onClick={() => { clearRecords(); setShowClearConfirm(false); }}
                    className="px-2 py-1 rounded bg-red-700/70 text-red-200 hover:bg-red-600/70">Yes, clear</button>
                  <button onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Clear history
                </button>
              )}
            </div>
          </>
        )}
      </Section>

      {/* Pricing */}
      <Section title="Model Pricing">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Enter cost per 1M tokens to see estimated charges. Format: <span className="font-mono text-slate-400">providerId/model-name</span>.
          Provider IDs come from your Providers settings.
        </p>
        {modelKeys.length === 0 && (
          <p className="text-xs text-slate-600">No models seen yet — pricing rows appear automatically after first use.</p>
        )}
        <div className="space-y-2">
          {modelKeys.map((key) => {
            const p = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono flex-1 truncate" title={key}>{key}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-600">in $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.inputPer1M}
                    onChange={(e) => setPricing(key, 'inputPer1M', e.target.value)}
                    className="input-field w-20 text-xs py-1"
                    placeholder="0.00"
                  />
                  <span className="text-[10px] text-slate-600">out $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.outputPer1M}
                    onChange={(e) => setPricing(key, 'outputPer1M', e.target.value)}
                    className="input-field w-20 text-xs py-1"
                    placeholder="0.00"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-add a new model key */}
        <AddModelPricingRow
          existingKeys={modelKeys}
          onAdd={(key) => onSave({ modelPricing: { ...pricing, [key]: { inputPer1M: 0, outputPer1M: 0 } } })}
        />
      </Section>
    </div>
  );
}

function AddModelPricingRow({ existingKeys, onAdd }: { existingKeys: string[]; onAdd: (key: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="providerId/model-name"
        className="input-field flex-1 text-xs py-1"
      />
      <button
        onClick={() => {
          if (val.trim() && !existingKeys.includes(val.trim())) {
            onAdd(val.trim());
            setVal('');
          }
        }}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        Add
      </button>
    </div>
  );
}

// ─── Updates Tab ──────────────────────────────────────────────────────────────

function UpdatesTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const channel = settings.updateChannel ?? 'stable';
  const mode = settings.updateMode ?? 'automatic';

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkState, setCheckState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [checkError, setCheckError] = useState('');
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (service.updater.onUpdateDownloading) {
      const unsub = service.updater.onUpdateDownloading(() => { setDownloading(true); setDownloadError(''); });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (!service.updater.onUpdateDownloaded) return;
    const unsub = service.updater.onUpdateDownloaded(() => { setUpdateDownloaded(true); setDownloading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!service.updater.onUpdateError) return;
    const unsub = service.updater.onUpdateError((msg) => { setDownloadError(msg); setDownloading(false); });
    return unsub;
  }, []);

  async function checkUpdates() {
    setCheckState('loading');
    setUpdateInfo(null);
    setCheckError('');
    try {
      const info = await service.updater.checkForUpdates();
      setUpdateInfo(info);
      setCheckState('idle');
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
      setCheckState('error');
    }
  }

  async function restartAndInstall() {
    if (!service.updater.restartAndInstall) return;
    setRestarting(true);
    try { await service.updater.restartAndInstall(); } catch { setRestarting(false); }
  }

  const modeOptions: { value: AppSettings['updateMode']; label: string; description: string }[] = [
    { value: 'automatic',     label: 'Automatic',     description: 'Download in background and prompt to restart when ready.' },
    { value: 'download-only', label: 'Download Only', description: 'Download silently — restart to apply whenever you\'re ready.' },
    { value: 'manual',        label: 'Manual',        description: 'No automatic checks — click "Check for Updates" yourself.' },
  ];

  return (
    <div className="space-y-6">
      {/* Release channel */}
      <Section title="Release Channel">
        <select
          value={channel}
          onChange={(e) => { onSave({ updateChannel: e.target.value as 'stable' | 'beta' | 'alpha' }); setUpdateInfo(null); }}
          className="w-48 bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600"
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="alpha">Alpha</option>
        </select>
        <p className="mt-1.5 text-[11px] text-slate-600">
          {channel === 'stable' && 'Production releases only.'}
          {channel === 'beta' && 'Beta pre-releases — no alpha builds.'}
          {channel === 'alpha' && 'Bleeding edge — alpha and beta pre-releases.'}
        </p>
      </Section>

      {/* Update mode */}
      <Section title="Update Mode">
        <div className="space-y-2">
          {modeOptions.map(({ value, label, description }) => (
            <label
              key={value}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                mode === value
                  ? 'border-blue-500/60 bg-blue-950/30'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="updateMode"
                value={value}
                checked={mode === value}
                onChange={() => onSave({ updateMode: value })}
                className="mt-0.5 accent-blue-500 shrink-0"
              />
              <div>
                <p className="text-xs font-medium text-slate-200">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* Restart banner — shows whenever a download has completed */}
      {updateDownloaded && (
        <div className="rounded-lg border border-green-700/50 bg-green-950/30 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-green-300">Update downloaded and ready to install</p>
            <p className="text-[11px] text-green-500/70 mt-0.5">The app will update the next time it launches, or restart now.</p>
          </div>
          <button
            onClick={restartAndInstall}
            disabled={restarting}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
          >
            {restarting ? 'Restarting…' : 'Restart & Install'}
          </button>
        </div>
      )}

      {/* Manual check */}
      <Section title="Check for Updates">
        <div className="flex items-center gap-3">
          <button
            onClick={checkUpdates}
            disabled={checkState === 'loading'}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              checkState === 'loading'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {checkState === 'loading' ? 'Checking…' : 'Check for Updates'}
          </button>
          <span className="text-xs text-slate-600">Current: v{__APP_VERSION__}</span>
        </div>

        {checkState === 'error' && (
          <p className="mt-2 text-xs text-red-400">{checkError}</p>
        )}

        {updateInfo && (
          <div className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${
            updateInfo.hasUpdate && updateInfo.isDowngrade
              ? 'bg-amber-950/40 border-amber-700/40 text-amber-300'
              : updateInfo.hasUpdate
              ? 'bg-green-950/40 border-green-700/40 text-green-300'
              : 'bg-slate-800/40 border-slate-700 text-slate-400'
          }`}>
            {updateInfo.hasUpdate && updateInfo.isDowngrade ? (
              <>
                <p className="font-medium">⬇ Switch to stable v{updateInfo.latestVersion}</p>
                <p className="mt-0.5 text-amber-400/70">You&apos;re running a pre-release build. Install the stable release to switch back.</p>
                {updateInfo.releaseNotes && (
                  <p className="mt-1 text-amber-400/70 line-clamp-3">{updateInfo.releaseNotes}</p>
                )}
                {updateInfo.downloadUrl && (
                  <button
                    onClick={() => service.updater.openExternal(updateInfo.downloadUrl!)}
                    className="inline-block mt-2 underline text-amber-400 hover:text-amber-200 text-left"
                  >
                    Download stable v{updateInfo.latestVersion} →
                  </button>
                )}
              </>
            ) : updateInfo.hasUpdate ? (
              <>
                <p className="font-medium">🎉 Update available — v{updateInfo.latestVersion}</p>
                {updateInfo.releaseNotes && (
                  <p className="mt-1 text-green-400/70 line-clamp-3">{updateInfo.releaseNotes}</p>
                )}
                <div className="mt-2">
                  {updateDownloaded ? null : downloading ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-green-400/80">Downloading update…</p>
                      <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-600 via-green-400 to-green-600 animate-pulse" style={{ width: '100%' }} />
                      </div>
                    </div>
                  ) : downloadError ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-red-400">Download failed: {downloadError}</p>
                      <button
                        onClick={async () => {
                          setDownloading(true);
                          setDownloadError('');
                          try { await service.updater.triggerDownload?.(); } catch { /* ignore */ }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition-colors"
                      >
                        Retry Download
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        setDownloading(true);
                        try { await service.updater.triggerDownload?.(); } catch { /* ignore */ }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition-colors"
                    >
                      Download &amp; Install
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>✓ You&apos;re on the latest version (v{updateInfo.currentVersion})</p>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Telemetry Tab ────────────────────────────────────────────────────────────

function TelemetryTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const telemetry = settings.telemetry ?? { usageReports: true, crashReports: true };
  function setTelemetry(patch: Partial<NonNullable<AppSettings['telemetry']>>) {
    onSave({ telemetry: { ...telemetry, ...patch } });
  }

  const [hasCrash, setHasCrash] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    service.crash?.hasStored().then(setHasCrash).catch((_e) => { /* non-fatal */ });
  }, []);

  async function sendStoredCrash() {
    setSendState('sending');
    try {
      await service.crash?.sendStored();
      setHasCrash(false);
      setSendState('sent');
    } catch {
      setSendState('error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl bg-slate-800/40 border border-slate-700/40 px-4 py-3">
        <span className="text-base mt-0.5">🔒</span>
        <p className="text-xs text-slate-400">
          All reporting is <span className="text-slate-300 font-medium">anonymous and on by default</span>.
          No conversation content, API keys, model names, or personal data are ever collected.
        </p>
      </div>
      <Section title="Usage Reports">
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg hover:bg-slate-800/40 px-3 py-2.5 -mx-3 transition-colors">
          <input
            type="checkbox"
            checked={telemetry.usageReports}
            onChange={(e) => setTelemetry({ usageReports: e.target.checked })}
            className="mt-0.5 w-4 h-4 rounded accent-blue-500 shrink-0"
          />
          <div>
            <p className="text-sm text-slate-200 font-medium">Send anonymous usage reports</p>
            <p className="text-xs text-slate-500 mt-0.5">
              App version, platform, which provider types are configured, and which features are active.
              No content, no keys, no model names.
            </p>
          </div>
        </label>
      </Section>
      <Section title="Crash Reports">
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg hover:bg-slate-800/40 px-3 py-2.5 -mx-3 transition-colors">
          <input
            type="checkbox"
            checked={telemetry.crashReports}
            onChange={(e) => setTelemetry({ crashReports: e.target.checked })}
            className="mt-0.5 w-4 h-4 rounded accent-blue-500 shrink-0"
          />
          <div>
            <p className="text-sm text-slate-200 font-medium">Send crash reports automatically</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Error type, sanitized stack trace (absolute file paths removed), app version, and platform.
              Helps us fix crashes faster.
            </p>
          </div>
        </label>
        {hasCrash && (
          <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-800/30 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-300 font-medium">Unsent crash report available</p>
              <p className="text-xs text-slate-500 mt-0.5">
                A crash was recorded while automatic reporting was off. You can send it now.
              </p>
            </div>
            <button
              onClick={sendStoredCrash}
              disabled={sendState === 'sending' || sendState === 'sent'}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {sendState === 'sending' ? 'Sending…' : sendState === 'sent' ? 'Sent ✓' : sendState === 'error' ? 'Retry' : 'Send Report'}
            </button>
          </div>
        )}
        {sendState === 'error' && (
          <p className="text-xs text-red-400 mt-1">Failed to send. Check your connection and try again.</p>
        )}
      </Section>
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

// localStorage keys used by Zustand persist stores.
// electron-store settings (API keys, providers, MCP) live in the main process
// and are NOT affected by clearing these.
const ZUSTAND_STORE_KEYS = [
  'openconduit-conversations',
  'openconduit-files',
  'openconduit-analytics',
  'openconduit-personas',
  'oc-registry',
  'oc-prompt-templates',
  'oc-routing-profiles',
  'oc-keybindings',
  'oc-themes',
] as const;

function AboutTab({
  settings: _settings,
  onSave: _onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [feedbackType, setFeedbackType] = useState<FeedbackPayload['type']>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'working' | 'done'>('idle');
  const [resetError, setResetError] = useState('');

  const [machineId, setMachineId] = useState<string>('');
  const [machineIdCopied, setMachineIdCopied] = useState(false);
  useEffect(() => {
    window.api?.machine?.getId().then(setMachineId).catch((_e: unknown) => { /* non-fatal */ });
  }, []);

  async function resetAppData() {
    setResetState('working');
    setResetError('');
    try {
      // Export a settings backup (providers, API keys, MCP) before wiping.
      await service.config.exportSettings(false);
      // Clear all Zustand-persisted localStorage keys.
      for (const key of ZUSTAND_STORE_KEYS) {
        localStorage.removeItem(key);
      }
      setResetState('done');
      // Give the user a moment to see the success state, then reload.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e));
      setResetState('idle');
    }
  }

  async function submitFeedback() {
    if (!feedbackTitle.trim() || !feedbackDesc.trim()) return;
    setSubmitState('loading');
    setSubmitError('');
    try {
      await service.updater.submitFeedback({ type: feedbackType, title: feedbackTitle.trim(), description: feedbackDesc.trim() });
      setSubmitState('success');
      setFeedbackTitle('');
      setFeedbackDesc('');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
      setSubmitState('error');
    }
  }

  return (
    <div className="space-y-6">
      {/* App info */}
      <div className="flex items-center gap-4 rounded-xl bg-slate-800/40 border border-slate-700 px-4 py-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
          <img src="/app-icon.png" alt="OpenConduit" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">OpenConduit</p>
          <p className="text-xs text-slate-400 mt-0.5">v{__APP_VERSION__}</p>
          <p className="text-xs text-slate-600 mt-0.5">Built with Electron + React + Tailwind</p>
        </div>
      </div>

      {/* Machine ID */}
      {machineId && (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Device ID</p>
            <p className="text-xs font-mono text-slate-500 truncate">{machineId}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(machineId).then(() => {
                setMachineIdCopied(true);
                setTimeout(() => setMachineIdCopied(false), 2000);
              });
            }}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            {machineIdCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Feedback */}
      <Section title="Send Feedback">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Report a bug or request a feature. Opens a pre-filled GitHub issue in your browser.
        </p>

        {submitState === 'success' ? (
          <div className="rounded-lg bg-green-950/40 border border-green-700/40 px-3 py-3 text-sm text-green-300 flex items-center gap-2">
            <span>✓</span>
            <span>Opening GitHub… finish submitting in your browser.</span>
            <button
              onClick={() => setSubmitState('idle')}
              className="ml-auto text-xs text-green-500 hover:text-green-300"
            >
              Send another
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Type picker */}
            <div className="flex gap-2">
              {(['bug', 'feature'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFeedbackType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    feedbackType === t
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
                  }`}
                >
                  {t === 'bug' ? '🐛 Bug Report' : '✨ Feature Request'}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={feedbackTitle}
              onChange={(e) => setFeedbackTitle(e.target.value)}
              placeholder="Title — short summary"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />

            <textarea
              rows={4}
              value={feedbackDesc}
              onChange={(e) => setFeedbackDesc(e.target.value)}
              placeholder={
                feedbackType === 'bug'
                  ? 'Describe what happened and how to reproduce it…'
                  : 'Describe the feature and why it would be useful…'
              }
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />

            {submitState === 'error' && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}

            <button
              onClick={submitFeedback}
              disabled={
                submitState === 'loading' ||
                !feedbackTitle.trim() ||
                !feedbackDesc.trim()
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                submitState === 'loading' || !feedbackTitle.trim() || !feedbackDesc.trim()
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {submitState === 'loading' ? 'Opening…' : 'Open GitHub Issue →'}
            </button>
          </div>
        )}
      </Section>

      {/* Reset App Data */}
      <Section title="Reset App Data">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Clears conversations, themes, personas, and cached UI state. Your settings — API keys,
          providers, MCP servers — are stored separately and are not affected.
          A settings backup will be saved to your Downloads folder first.
        </p>

        {resetState === 'done' ? (
          <div className="rounded-lg bg-green-950/40 border border-green-700/40 px-3 py-3 text-sm text-green-300 flex items-center gap-2">
            <span>✓</span>
            <span>Backup saved. Reloading…</span>
          </div>
        ) : resetState === 'confirm' || resetState === 'working' ? (
          <div className="rounded-lg bg-red-950/40 border border-red-700/40 px-4 py-3 space-y-3">
            <p className="text-xs text-red-300 font-medium">
              This will permanently delete all conversations and UI data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={resetAppData}
                disabled={resetState === 'working'}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetState === 'working' ? 'Saving backup…' : 'Yes, backup & reset'}
              </button>
              <button
                onClick={() => { setResetState('idle'); setResetError(''); }}
                disabled={resetState === 'working'}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {resetError && <p className="text-xs text-red-400">{resetError}</p>}
          </div>
        ) : (
          <button
            onClick={() => setResetState('confirm')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 border border-red-800/50 text-red-400 hover:bg-red-950/30 hover:border-red-700 transition-colors"
          >
            Backup &amp; Reset…
          </button>
        )}
      </Section>
    </div>
  );
}
