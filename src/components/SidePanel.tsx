/**
 * SidePanel — a reusable right-side overlay panel.
 *
 * Renders an absolute overlay backdrop + a right-anchored slide-in panel.
 * Used for Conversation Settings, Room Settings, and any future context panels.
 *
 * Usage:
 *   <SidePanel title="Room Settings" onClose={() => setShow(false)}>
 *     <MyContent />
 *   </SidePanel>
 */

import React from 'react';

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Panel width, defaults to "w-80" */
  width?: string;
}

export function SidePanel({ title, onClose, children, width = 'w-80' }: SidePanelProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        className={`${width} flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-700"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
