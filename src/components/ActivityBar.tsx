import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useThemesStore } from '../stores/themesStore';
import { commandRegistry } from '../commands/commandRegistry';
import { service } from '../services';
import type { ActivityPanel } from '../stores/uiStore';

interface NavItem {
  id: ActivityPanel;
  label: string;
  icon: React.ReactNode;
}

const CHATS_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const PERSONAS_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const MARKETPLACE_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const SETTINGS_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'chats', label: 'Chats', icon: CHATS_ICON },
  { id: 'personas', label: 'Personas', icon: PERSONAS_ICON },
  { id: 'marketplace', label: 'Marketplace', icon: MARKETPLACE_ICON },
];

export default function ActivityBar() {
  const { activePanel, setActivePanel, sidebarOpen, setSidebarOpen, setShowSettings, setCommandPaletteOpen } =
    useUiStore();
  const { installedThemes, activeThemeId, setActiveTheme } = useThemesStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setThemesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const closeMenu = () => { setMenuOpen(false); setThemesOpen(false); };

  const handlePanelClick = (panel: ActivityPanel) => {
    if (activePanel === panel) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setActivePanel(panel);
      setSidebarOpen(true);
    }
  };

  return (
    <div className="w-12 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col items-center pb-2 pt-2">
      {/* Primary nav items */}
      <div className="flex flex-col items-center gap-1 flex-1 w-full px-1 pt-1">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isOpen = activePanel === id && sidebarOpen;
          return (
            <button
              key={id}
              onClick={() => handlePanelClick(id)}
              title={label}
              className={`relative w-full h-10 flex items-center justify-center rounded-lg transition-colors ${
                isOpen
                  ? 'text-slate-100 bg-slate-700'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {isOpen && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-r-full" />
              )}
              {icon}
            </button>
          );
        })}
      </div>

      {/* Manage menu anchor */}
      <div className="w-full px-1 relative">
        <button
          ref={gearRef}
          onClick={() => { setMenuOpen((v) => !v); setThemesOpen(false); }}
          title="Manage"
          className={`w-full h-10 flex items-center justify-center rounded-lg transition-colors ${
            menuOpen
              ? 'text-slate-100 bg-slate-700'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          {SETTINGS_ICON}
        </button>

        {/* Floating menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute bottom-0 left-full ml-1.5 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl shadow-black/50 py-1 z-50 text-sm"
          >
            <MenuItem
              label="Command Palette..."
              shortcut="⌘K"
              onClick={() => { commandRegistry.execute('core.openCommandPalette'); closeMenu(); }}
            />

            <Separator />

            <MenuItem
              label="Settings"
              shortcut="⌘,"
              onClick={() => { setShowSettings(true); closeMenu(); }}
            />
            <MenuItem
              label="Keyboard Shortcuts"
              onClick={() => {
                // Open command palette pre-filtered to keybinding search
                setCommandPaletteOpen(true);
                closeMenu();
              }}
            />

            {/* Themes submenu */}
            <div
              className="relative"
              onMouseEnter={() => setThemesOpen(true)}
              onMouseLeave={() => setThemesOpen(false)}
            >
              <button className="w-full flex items-center justify-between px-3 py-1.5 text-slate-300 hover:bg-slate-700 transition-colors rounded">
                <span>Themes</span>
                <span className="text-slate-500">›</span>
              </button>

              {themesOpen && (
                <div className="absolute bottom-0 left-full ml-1 w-52 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl shadow-black/50 py-1 z-50">
                  {/* Reset to default */}
                  <button
                    onClick={() => { setActiveTheme(null); closeMenu(); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:bg-slate-700 transition-colors rounded text-left"
                  >
                    <span className={`w-3 text-blue-400 ${!activeThemeId ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                    <span>Default</span>
                  </button>

                  {installedThemes.length > 0 && <Separator />}

                  {installedThemes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveTheme(t.id); closeMenu(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:bg-slate-700 transition-colors rounded text-left"
                    >
                      <span className={`w-3 text-blue-400 ${activeThemeId === t.id ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                      <span className="truncate">{t.name}</span>
                      {t.verified && <span className="ml-auto text-slate-500 text-[10px]">✓</span>}
                    </button>
                  ))}

                  {installedThemes.length === 0 && (
                    <p className="px-3 py-1.5 text-slate-500 text-xs">No themes installed</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <MenuItem
              label="Check for Updates..."
              onClick={async () => {
                closeMenu();
                try {
                  await service.updater.checkForUpdates();
                } catch {
                  // updater not available in this environment
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function MenuItem({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-slate-300 hover:bg-slate-700 transition-colors rounded"
    >
      <span>{label}</span>
      {shortcut && <span className="text-slate-500 text-xs">{shortcut}</span>}
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-slate-700" />;
}
