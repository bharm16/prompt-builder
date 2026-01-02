import { memo, useRef, useEffect } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Check,
  Share2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { Button } from '@components/Button';
import type { FloatingToolbarProps } from '../types';
import { usePromptState } from '../context/PromptStateContext';
import { ModelMenu } from './ModelMenu';
import { AI_MODEL_IDS, AI_MODEL_LABELS, AI_MODEL_URLS } from './constants';

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
  promptText = '',
  showModelMenu,
  onToggleModelMenu,
}): React.ReactElement => {
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const { selectedModel } = usePromptState();
  const selectedModelId = AI_MODEL_IDS.find((modelId) => modelId === selectedModel) ?? null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        onToggleExportMenu(false);
      }
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        onToggleModelMenu(false);
      }
    };

    if (showExportMenu || showModelMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showExportMenu, showModelMenu, onToggleExportMenu, onToggleModelMenu]);

  const handleCopyClick = (): void => {
    if (showModelMenu) {
      // If menu is open, just copy directly
      onCopy();
      onToggleModelMenu(false);
    } else {
      // Toggle menu
      onToggleModelMenu(true);
    }
  };

  const handleOpenInSelectedModel = (): void => {
    if (!selectedModelId) {
      onToggleExportMenu(false);
      onToggleModelMenu(true);
      return;
    }

    onCopy();
    window.open(AI_MODEL_URLS[selectedModelId], '_blank', 'noopener,noreferrer');
    onToggleModelMenu(false);
    onToggleExportMenu(false);
  };

  const openButtonLabel = selectedModelId
    ? `Open in ${AI_MODEL_LABELS[selectedModelId]}`
    : 'Open in model';
  const openButtonTitle = selectedModelId
    ? `Open in ${AI_MODEL_LABELS[selectedModelId]}`
    : 'Select a model to open';

  return (
    <div className="flex items-center justify-end gap-geist-0 mt-geist-4 -mb-geist-2">
      {/* Primary action - Copy */}
      <div className="relative" ref={copyMenuRef}>
        <Button
          onClick={handleCopyClick}
          svgOnly={false}
          variant="ghost"
          prefix={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          className={copied ? 'text-green-600 bg-green-50' : 'prompt-actions__primary'}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          aria-expanded={showModelMenu}
          title="Copy"
        >
          <span className="text-button-14 font-medium">{copied ? 'Copied!' : 'Copy'}</span>
        </Button>
        {showModelMenu && (
          <ModelMenu
            promptText={promptText}
            onCopy={onCopy}
            onClose={() => onToggleModelMenu(false)}
          />
        )}
      </div>

      <Button
        onClick={handleOpenInSelectedModel}
        svgOnly={false}
        variant="ghost"
        prefix={<ExternalLink className="h-3.5 w-3.5" />}
        className="prompt-actions__primary"
        aria-label={openButtonLabel}
        title={openButtonTitle}
      >
        <span className="text-button-14 font-medium">{openButtonLabel}</span>
      </Button>

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

      <div className="w-px h-geist-4 bg-geist-accents-2 -mx-0.5" />

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
