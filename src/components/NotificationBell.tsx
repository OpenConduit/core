import React, { useRef, useState, useEffect } from 'react';
import { useUiStore } from '../stores/uiStore';

const VARIANT_STYLES = {
  info:    { dot: 'bg-blue-400',   icon: 'text-blue-400'   },
  success: { dot: 'bg-emerald-400', icon: 'text-emerald-400' },
  warning: { dot: 'bg-amber-400',  icon: 'text-amber-400'  },
  error:   { dot: 'bg-red-400',    icon: 'text-red-400'    },
} as const;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { notifications, markRead, markAllRead, clearNotifications } = useUiStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = () => {
    setOpen((prev) => {
      // Mark all read when opening
      if (!prev && unread > 0) markAllRead();
      return !prev;
    });
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={toggle}
        className={`relative flex items-center justify-center p-1 transition-colors ${
          open ? 'text-slate-300' : 'text-slate-600 hover:text-slate-400'
        }`}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 bottom-full mb-1.5 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[9999] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
            <span className="text-xs font-semibold text-slate-300">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-600">
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const styles = VARIANT_STYLES[n.variant];
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 flex gap-3"
                  >
                    {/* Variant dot */}
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${n.read ? 'text-slate-400' : 'text-slate-100'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
