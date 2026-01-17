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
import { Button } from '@promptstudio/system/components/ui/button';
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
    <div className="w-full flex items-center justify-between px-4 py-2 ps-glass-card rounded-lg">
      <div className="flex items-center gap-1">
        <Button
          onClick={onCopy}
          variant="ghost"
          className={`gap-2 px-3 py-1 text-button-12 rounded-md transition-colors ${
            copied
              ? 'text-green-700 bg-green-50'
              : 'text-foreground hover:bg-surface-1'
          }`}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied && <span className="text-label-12">Copied</span>}
        </Button>

        <Button
          onClick={onShare}
          variant="ghost"
          className={`gap-2 px-3 py-1 text-button-12 rounded-md transition-colors ${
            shared
              ? 'text-green-700 bg-green-50'
              : 'text-foreground hover:bg-surface-1'
          }`}
          aria-label={shared ? 'Link copied' : 'Share prompt'}
          title="Share"
        >
          {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {shared && <span className="text-label-12">Shared!</span>}
        </Button>

        <Button
          onClick={() => onToggleLegend(!showLegend)}
          variant="ghost"
          className={`gap-2 px-3 py-1 text-button-12 rounded-md transition-colors ${
            showLegend
              ? 'text-blue-700 bg-blue-50'
              : 'text-foreground hover:bg-surface-1'
          }`}
          aria-label="Toggle highlight legend"
          title="Highlight Legend"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>

        <div className="relative" ref={exportMenuRef}>
          <Button
            onClick={() => onToggleExportMenu(!showExportMenu)}
            variant="ghost"
            className="gap-2 px-3 py-1 text-button-12 text-foreground rounded-md transition-colors hover:bg-surface-1"
            aria-expanded={showExportMenu}
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-2 w-36 ps-glass-card rounded-lg py-1 z-30">
              <Button
                onClick={() => onExport('text')}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-label-12 text-foreground transition-colors hover:bg-surface-1"
              >
                <FileText className="h-3.5 w-3.5" />
                Text (.txt)
              </Button>
              <Button
                onClick={() => onExport('markdown')}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-label-12 text-foreground transition-colors hover:bg-surface-1"
              >
                <FileText className="h-3.5 w-3.5" />
                Markdown (.md)
              </Button>
              <Button
                onClick={() => onExport('json')}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-label-12 text-foreground transition-colors hover:bg-surface-1"
              >
                <FileText className="h-3.5 w-3.5" />
                JSON (.json)
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          onClick={onUndo}
          disabled={!canUndo}
          variant="ghost"
          size="icon"
          className={`border border-border p-1 rounded-md transition ${
            canUndo ? 'hover:bg-surface-1 text-foreground' : 'text-faint cursor-not-allowed'
          }`}
          title="Undo"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          onClick={onRedo}
          disabled={!canRedo}
          variant="ghost"
          size="icon"
          className={`border border-border p-1 rounded-md transition ${
            canRedo ? 'hover:bg-surface-1 text-foreground' : 'text-faint cursor-not-allowed'
          }`}
          title="Redo"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          onClick={onCreateNew}
          variant="ghost"
          className="gap-2 px-3 py-1 text-button-12 text-foreground border border-border bg-transparent rounded-md transition-colors hover:bg-surface-1"
          title="New prompt"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-label-12">New</span>
        </Button>
      </div>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';
