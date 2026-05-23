import React, { useState, useEffect } from 'react';
import { useSavedFilesStore, type SavedFile } from './filesStore';

// ─── Preview helpers ──────────────────────────────────────────────────────────

function isPreviewable(file: SavedFile): boolean {
  return (
    file.mimeType === 'text/html' ||
    file.mimeType === 'image/svg+xml' ||
    file.name.endsWith('.mmd')
  );
}

function MermaidPreview({ code }: { code: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvgContent(null);

    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { background: 'transparent', primaryTextColor: '#e2e8f0' } });
        const id = `mermaid-fp-${Math.random().toString(36).slice(2)}`;
        mermaid
          .render(id, code)
          .then(({ svg }) => {
            if (!cancelled) { setSvgContent(svg); setLoading(false); }
          })
          .catch((e: Error) => {
            if (!cancelled) { setError(e.message); setLoading(false); }
          });
      })
      .catch((e: Error) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 text-xs text-red-400 bg-slate-950 flex-1">
        <span className="font-medium">Diagram error:</span> {error}
      </div>
    );
  }

  if (loading || !svgContent) {
    return (
      <div className="bg-slate-950 flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
        <span className="text-[11px] text-slate-500 animate-pulse">Rendering…</span>
      </div>
    );
  }

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#0f172a', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

function FilePreview({ file }: { file: SavedFile }) {
  if (file.name.endsWith('.mmd')) return <MermaidPreview code={file.content} />;

  const srcDoc =
    file.mimeType === 'image/svg+xml'
      ? `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:16px;min-height:100vh">${file.content}</body></html>`
      : file.content;

  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title={file.name}
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function typeBadge(file: SavedFile): { label: string; className: string } {
  if (file.name.endsWith('.mmd')) return { label: 'MMD', className: 'bg-violet-900/60 text-violet-300' };
  if (file.mimeType === 'text/html') return { label: 'HTML', className: 'bg-orange-900/60 text-orange-300' };
  if (file.mimeType === 'image/svg+xml') return { label: 'SVG', className: 'bg-blue-900/60 text-blue-300' };
  if (file.mimeType.includes('javascript')) return { label: 'JS', className: 'bg-yellow-900/60 text-yellow-300' };
  if (file.mimeType === 'text/css') return { label: 'CSS', className: 'bg-cyan-900/60 text-cyan-300' };
  if (file.mimeType === 'application/json') return { label: 'JSON', className: 'bg-green-900/60 text-green-300' };
  if (file.mimeType === 'text/markdown' || file.name.endsWith('.md')) return { label: 'MD', className: 'bg-slate-700 text-slate-300' };
  const ext = file.name.split('.').pop()?.toUpperCase().slice(0, 4);
  return { label: ext ?? 'FILE', className: 'bg-slate-700 text-slate-400' };
}

function downloadFile(file: SavedFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

interface FileRowProps {
  file: SavedFile;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPreview: (file: SavedFile) => void;
}

function FileCard({ file, onDelete, onRename, onPreview }: FileRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [copied, setCopied] = useState(false);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== file.name) onRename(file.id, trimmed);
    else setDraft(file.name);
    setEditing(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const badge = typeBadge(file);

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 group transition-colors">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 tracking-wide ${badge.className}`}>
        {badge.label}
      </span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(file.name); setEditing(false); }
            }}
            className="w-full bg-slate-600 text-slate-100 text-xs rounded px-1.5 py-0.5 outline-none border border-slate-500 focus:border-blue-500"
          />
        ) : (
          <button
            onClick={() => { setDraft(file.name); setEditing(true); }}
            className="text-sm font-medium text-slate-100 hover:text-white truncate text-left w-full block"
            title="Click to rename"
          >
            {file.name}
          </button>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
          <span className="text-xs text-slate-400">{formatDate(file.savedAt)}</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isPreviewable(file) && (
          <button onClick={() => onPreview(file)} title="Preview" className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-600 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        )}
        <button onClick={handleCopy} title="Copy" className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-600 transition-colors">
          {copied
            ? <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          }
        </button>
        <button onClick={() => downloadFile(file)} title="Download" className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
        <button onClick={() => onDelete(file.id)} title="Delete" className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function FilesPanel() {
  const { files, deleteFile, renameFile } = useSavedFilesStore();
  const [previewFile, setPreviewFile] = useState<SavedFile | null>(null);

  if (previewFile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewFile(null)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
            title="Back to files"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-100 truncate">{previewFile.name}</span>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-700" style={{ height: 400 }}>
          <FilePreview file={previewFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Files</h3>
          <p className="text-xs text-slate-400 mt-0.5">Files saved from your conversations.</p>
        </div>
        {files.length > 0 && (
          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">{files.length}</span>
        )}
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <svg className="w-8 h-8 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs text-slate-400">No saved files yet</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Use the save button on any code block to store it here</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={deleteFile}
              onRename={renameFile}
              onPreview={setPreviewFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
