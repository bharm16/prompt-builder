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
import { Button } from '../../../components/Button';
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
    <div className="flex items-center justify-end gap-geist-0 mt-geist-4 -mb-geist-2">
      <Button
        onClick={onCopy}
        svgOnly
        variant="ghost"
        prefix={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        className={copied ? 'text-green-600 bg-green-50 -mx-0.5' : '-mx-0.5'}
        aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
        title="Copy"
      />

      <Button
        onClick={onShare}
        svgOnly
        variant="ghost"
        prefix={shared ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
        className={shared ? 'text-green-600 bg-green-50 -mx-0.5' : '-mx-0.5'}
        aria-label={shared ? 'Link copied' : 'Share prompt'}
        title="Share"
      />

      <div className="relative -mx-0.5" ref={exportMenuRef}>
        <Button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          svgOnly
          variant="ghost"
          prefix={<Download className="h-3 w-3" />}
          aria-expanded={showExportMenu}
          title="Export"
        />
        {showExportMenu && (
          <div className="absolute bottom-full right-0 mb-geist-2 w-36 bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium py-geist-1 z-30">
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

      <div className="w-px h-geist-4 bg-geist-accents-2 mx-geist-0 -mx-0.5" />

      <Button
        onClick={onUndo}
        disabled={!canUndo}
        svgOnly
        variant="ghost"
        prefix={<RotateCcw className="h-3 w-3" />}
        className="-mx-0.5"
        title="Undo"
      />
      <Button
        onClick={onRedo}
        disabled={!canRedo}
        svgOnly
        variant="ghost"
        prefix={<RotateCw className="h-3 w-3" />}
        className="-mx-0.5"
        title="Redo"
      />
    </div>
  );
});

PromptActions.displayName = 'PromptActions';

