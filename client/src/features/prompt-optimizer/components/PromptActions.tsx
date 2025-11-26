import { memo, useRef, useEffect } from 'react';
import {
  Copy,
  Download,
  FileText,
  Check,
  Share2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import type { FloatingToolbarProps } from '../types';

/**
 * Prompt Actions Component
 * Displays action buttons below the prompt content, aligned to the right
 * Similar to Claude and other chat apps
 */
export const PromptActions = memo<FloatingToolbarProps>(({
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
    <div className="flex items-center justify-end gap-geist-1 mt-geist-4 -mb-geist-2">
      <button
        onClick={onCopy}
        className={`inline-flex items-center justify-center p-geist-2 rounded-geist transition-colors ${
          copied
            ? 'text-green-600 bg-green-50'
            : 'text-geist-accents-5 hover:text-geist-accents-7 hover:bg-geist-accents-2'
        }`}
        aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
        title="Copy"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>

      <button
        onClick={onShare}
        className={`inline-flex items-center justify-center p-geist-2 rounded-geist transition-colors ${
          shared
            ? 'text-green-600 bg-green-50'
            : 'text-geist-accents-5 hover:text-geist-accents-7 hover:bg-geist-accents-2'
        }`}
        aria-label={shared ? 'Link copied' : 'Share prompt'}
        title="Share"
      >
        {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </button>

      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          className="inline-flex items-center justify-center p-geist-2 rounded-geist text-geist-accents-5 hover:text-geist-accents-7 hover:bg-geist-accents-2 transition-colors"
          aria-expanded={showExportMenu}
          title="Export"
        >
          <Download className="h-4 w-4" />
        </button>
        {showExportMenu && (
          <div className="absolute bottom-full right-0 mb-geist-2 w-36 bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium py-geist-1 z-30">
            <button
              onClick={() => onExport('text')}
              className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-xs text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Text (.txt)
            </button>
            <button
              onClick={() => onExport('markdown')}
              className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-xs text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Markdown (.md)
            </button>
            <button
              onClick={() => onExport('json')}
              className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-xs text-geist-accents-7 hover:bg-geist-accents-1 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              JSON (.json)
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-geist-4 bg-geist-accents-2 mx-geist-1" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`inline-flex items-center justify-center p-geist-2 rounded-geist transition ${
          canUndo ? 'hover:bg-geist-accents-2 text-geist-accents-5 hover:text-geist-accents-7' : 'text-geist-accents-3 cursor-not-allowed'
        }`}
        title="Undo"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`inline-flex items-center justify-center p-geist-2 rounded-geist transition ${
          canRedo ? 'hover:bg-geist-accents-2 text-geist-accents-5 hover:text-geist-accents-7' : 'text-geist-accents-3 cursor-not-allowed'
        }`}
        title="Redo"
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </div>
  );
});

PromptActions.displayName = 'PromptActions';

