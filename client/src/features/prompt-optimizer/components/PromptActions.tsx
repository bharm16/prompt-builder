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
    <div className="flex items-center justify-end gap-0.5 mt-4 -mb-2">
      <button
        onClick={onCopy}
        className={`inline-flex items-center justify-center p-1.5 rounded-md transition-colors ${
          copied
            ? 'text-green-600 bg-green-50'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
        title="Copy"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>

      <button
        onClick={onShare}
        className={`inline-flex items-center justify-center p-1.5 rounded-md transition-colors ${
          shared
            ? 'text-green-600 bg-green-50'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label={shared ? 'Link copied' : 'Share prompt'}
        title="Share"
      >
        {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </button>

      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          className="inline-flex items-center justify-center p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-expanded={showExportMenu}
          title="Export"
        >
          <Download className="h-4 w-4" />
        </button>
        {showExportMenu && (
          <div className="absolute bottom-full right-0 mb-2 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-30">
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

      <div className="w-px h-4 bg-neutral-200 mx-1" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`inline-flex items-center justify-center p-1.5 rounded-md transition ${
          canUndo ? 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
        }`}
        title="Undo"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`inline-flex items-center justify-center p-1.5 rounded-md transition ${
          canRedo ? 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700' : 'text-neutral-300 cursor-not-allowed'
        }`}
        title="Redo"
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </div>
  );
});

PromptActions.displayName = 'PromptActions';

