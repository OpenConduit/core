import React from 'react';

const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toUpperCase().includes('MAC');

interface ChromeBarProps {
  onSearchClick?: () => void;
}

export default function ChromeBar({ onSearchClick }: ChromeBarProps) {
  return (
    <div
      className="flex items-center h-[38px] bg-slate-900 border-b border-slate-700/60 flex-shrink-0 select-none"
      style={{
        WebkitAppRegion: 'drag',
        paddingLeft: isMac ? '80px' : '12px',
        paddingRight: '12px',
      } as React.CSSProperties}
    >
      {/* Centered search / command palette trigger */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 h-[22px] rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors text-[11px] w-[280px] max-w-full"
        >
          {/* Search icon */}
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <span className="flex-1 text-left truncate">Search conversations…</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-mono">
            <span>⌘</span><span>K</span>
          </kbd>
        </button>
      </div>
    </div>
  );
}
