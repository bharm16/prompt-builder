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
    <div className="w-full flex items-center justify-between px-4 py-2 glass-card rounded-lg">
      <div className="flex items-center gap-0.5">
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            copied
              ? 'text-green-700 bg-green-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied && <span className="text-[10px]">Copied</span>}
        </button>

        <button
          onClick={onShare}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            shared
              ? 'text-green-700 bg-green-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label={shared ? 'Link copied' : 'Share prompt'}
          title="Share"
        >
          {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {shared && <span className="text-[10px]">Shared!</span>}
        </button>

        <button
          onClick={() => onToggleLegend(!showLegend)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            showLegend
              ? 'text-blue-700 bg-blue-50'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
          aria-label="Toggle highlight legend"
          title="Highlight Legend"
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => onToggleExportMenu(!showExportMenu)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
            aria-expanded={showExportMenu}
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-36 glass-card rounded-lg py-0.5 z-30">
              <button
                onClick={() => onExport('text')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Text (.txt)
              </button>
              <button
                onClick={() => onExport('markdown')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Markdown (.md)
              </button>
              <button
                onClick={() => onExport('json')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                JSON (.json)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`inline-flex items-center justify-center p-1 rounded-md border border-neutral-200 transition ${
            canUndo ? 'hover:bg-neutral-100 text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`inline-flex items-center justify-center p-1 rounded-md border border-neutral-200 transition ${
            canRedo ? 'hover:bg-neutral-100 text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="Redo"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors"
          title="New prompt"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';

