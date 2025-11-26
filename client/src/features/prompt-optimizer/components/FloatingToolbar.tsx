import { memo, useRef, useEffect } from 'react';
import {
  Copy,
  Download,
  Plus,
  FileText,
  Check,
  Info,
  Share2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import type { FloatingToolbarProps } from '../types';

/**
 * Toolbar Component (Fixed Header)
 * Provides actions for copy, export, share, undo/redo, and create new
 * Now displayed as a fixed header at the top of the canvas
 */
export const FloatingToolbar = memo<FloatingToolbarProps>(({
  onCopy,
  onExport,
  onCreateNew,
  onShare,
  copied,
  shared,
  showExportMenu,
  onToggleExportMenu,
  showLegend,
  onToggleLegend,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}): React.ReactElement => {
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        onToggleExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu, onToggleExportMenu]);

  return (
    <div className="w-full flex items-center justify-between px-6 py-3 glass-card rounded-lg">
      <div className="flex items-center gap-1">
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            copied
              ? 'text-green-700 bg-green-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title="Copy"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied && <span className="text-xs">Copied</span>}
        </button>

        <button
          onClick={onShare}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            shared
              ? 'text-green-700 bg-green-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label={shared ? 'Link copied' : 'Share prompt'}
          title="Share"
        >
          {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {shared && <span className="text-xs">Shared!</span>}
        </button>

        <button
          onClick={() => onToggleLegend(!showLegend)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            showLegend
              ? 'text-blue-700 bg-blue-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label="Toggle highlight legend"
          title="Highlight Legend"
        >
          <Info className="h-4 w-4" />
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => onToggleExportMenu(!showExportMenu)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
            aria-expanded={showExportMenu}
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-2 w-40 glass-card rounded-lg py-1 z-30">
              <button
                onClick={() => onExport('text')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Text (.txt)
              </button>
              <button
                onClick={() => onExport('markdown')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Markdown (.md)
              </button>
              <button
                onClick={() => onExport('json')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                JSON (.json)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`inline-flex items-center justify-center p-1.5 rounded-md border border-neutral-200 transition ${
            canUndo ? 'hover:bg-neutral-100 text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`inline-flex items-center justify-center p-1.5 rounded-md border border-neutral-200 transition ${
            canRedo ? 'hover:bg-neutral-100 text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="Redo"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors"
          title="New prompt"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';

