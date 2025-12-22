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
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        onToggleExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showExportMenu, onToggleExportMenu]);

  return (
    <div className="w-full flex items-center justify-between px-geist-4 py-geist-2 glass-card rounded-geist-lg">
      <div className="flex items-center gap-geist-1">
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-geist-2 px-geist-3 py-geist-1 text-button-12 rounded-geist transition-colors ${
            copied
              ? 'text-green-700 bg-green-50'
              : 'text-geist-accents-7 hover:bg-geist-accents-1'
          }`}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied && <span className="text-label-12">Copied</span>}
        </button>

        <button
          onClick={onShare}
          className={`inline-flex items-center gap-geist-2 px-geist-3 py-geist-1 text-button-12 rounded-geist transition-colors ${
            shared
              ? 'text-green-700 bg-green-50'
              : 'text-geist-accents-7 hover:bg-geist-accents-1'
          }`}
          aria-label={shared ? 'Link copied' : 'Share prompt'}
          title="Share"
        >
          {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {shared && <span className="text-label-12">Shared!</span>}
        </button>

        <button
          onClick={() => onToggleLegend(!showLegend)}
          className={`inline-flex items-center gap-geist-2 px-geist-3 py-geist-1 text-button-12 rounded-geist transition-colors ${
            showLegend
              ? 'text-blue-700 bg-blue-50'
              : 'text-geist-accents-7 hover:bg-geist-accents-1'
          }`}
          aria-label="Toggle highlight legend"
          title="Highlight Legend"
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => onToggleExportMenu(!showExportMenu)}
            className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-1 text-button-12 text-geist-accents-7 rounded-geist hover:bg-geist-accents-1 transition-colors"
            aria-expanded={showExportMenu}
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-geist-2 w-36 glass-card rounded-geist-lg py-geist-1 z-30">
              <button
                onClick={() => onExport('text')}
                className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-label-12 text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Text (.txt)
              </button>
              <button
                onClick={() => onExport('markdown')}
                className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-label-12 text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Markdown (.md)
              </button>
              <button
                onClick={() => onExport('json')}
                className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-label-12 text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                JSON (.json)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-geist-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`inline-flex items-center justify-center p-geist-1 rounded-geist border border-geist-accents-2 transition ${
            canUndo ? 'hover:bg-geist-accents-1 text-geist-accents-7' : 'text-geist-accents-3 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`inline-flex items-center justify-center p-geist-1 rounded-geist border border-geist-accents-2 transition ${
            canRedo ? 'hover:bg-geist-accents-1 text-geist-accents-7' : 'text-geist-accents-3 cursor-not-allowed'
          }`}
          title="Redo"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-1 text-button-12 text-white bg-geist-foreground rounded-geist hover:bg-geist-accents-8 transition-colors"
          title="New prompt"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';
