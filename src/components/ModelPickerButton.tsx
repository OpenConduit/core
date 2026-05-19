import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import type { AppSettings, Conversation } from '../types';

interface Props {
  settings: AppSettings;
  models: Record<string, string[]>;
  loadModels: (id: string) => void;
  conversationId: string;
  conv: Conversation;
}

export default function ModelPickerButton({ settings, models, loadModels, conversationId, conv }: Props) {
  const { updateConversation } = useConversationStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  useEffect(() => {
    if (open) {
      settings.providers.forEach((p) => { if (!models[p.id]) loadModels(p.id); });
      setSearch('');
    }
  }, [open, settings.providers, models, loadModels]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeProfile = conv.routingProfileId
    ? (settings.routingProfiles ?? []).find((p) => p.id === conv.routingProfileId)
    : undefined;

  const providerName = settings.providers.find((p) => p.id === conv.providerId)?.name ?? '';
  const label = activeProfile
    ? activeProfile.name
    : (providerName && conv.model ? `${providerName} · ${conv.model}` : 'Select model…');

  const lowerSearch = search.toLowerCase();
  const profiles = (settings.routingProfiles ?? []).filter(
    (p) => !lowerSearch || p.name.toLowerCase().includes(lowerSearch),
  );

  const selectModel = useCallback((pid: string, m: string) => {
    updateConversation(conversationId, { providerId: pid, model: m, routingProfileId: undefined });
    setOpen(false);
  }, [conversationId, updateConversation]);

  const selectProfile = useCallback((profileId: string) => {
    updateConversation(conversationId, { routingProfileId: profileId });
    setOpen(false);
  }, [conversationId, updateConversation]);

  return (
    <div ref={ref} className="relative" style={noDrag}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none hover:border-blue-500 cursor-pointer max-w-[220px] transition-colors"
      >
        <span className="truncate">{label}</span>
        <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none placeholder-slate-500"
            />
          </div>

          <div className="overflow-y-auto max-h-80">
            {profiles.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Routing Profiles
                </div>
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => selectProfile(profile.id)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors text-slate-300"
                  >
                    <span className="text-blue-400">⚡</span>
                    <span className="truncate flex-1">{profile.name}</span>
                    {conv.routingProfileId === profile.id && (
                      <span className="text-blue-400 flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-slate-700 my-1" />
              </div>
            )}

            {settings.providers.map((provider) => {
              const all = [
                ...(provider.customModels ?? []),
                ...(models[provider.id] ?? []).filter((m) => !provider.customModels?.includes(m)),
              ];
              const filtered = all.filter(
                (m) => !lowerSearch || m.toLowerCase().includes(lowerSearch) || provider.name.toLowerCase().includes(lowerSearch),
              );
              if (filtered.length === 0) return null;
              return (
                <div key={provider.id}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    {provider.name}
                  </div>
                  {filtered.map((m) => {
                    const isActive = !conv.routingProfileId && conv.providerId === provider.id && conv.model === m;
                    return (
                      <button
                        key={m}
                        onClick={() => selectModel(provider.id, m)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-300'}`}
                      >
                        <span className={`w-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                        <span className="truncate">{m}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
