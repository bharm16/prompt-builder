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
import { Button } from '@promptstudio/system/components/ui/button';
import type { FloatingToolbarProps } from '../types';
import { usePromptState } from '../context/PromptStateContext';
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
  primaryVisible = true,
}): React.ReactElement => {
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { selectedModel } = usePromptState();
  const selectedModelId = AI_MODEL_IDS.find((modelId) => modelId === selectedModel) ?? null;

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
    return undefined;
  }, [showExportMenu, onToggleExportMenu]);

  const handleGenerateWithSelectedModel = (): void => {
    if (!selectedModelId) {
      return;
    }

    onCopy();
    window.open(AI_MODEL_URLS[selectedModelId], '_blank', 'noopener,noreferrer');
    onToggleExportMenu(false);
  };

  const generateButtonLabel = selectedModelId
    ? `Generate with ${AI_MODEL_LABELS[selectedModelId]}`
    : 'Generate with model';
  const generateButtonTitle = selectedModelId
    ? `Generate with ${AI_MODEL_LABELS[selectedModelId]}`
    : 'Select a model to generate';

  return (
    <div className="flex flex-nowrap items-center justify-end overflow-x-auto max-w-full gap-2">
      {/* Primary action(s) - only when hovering editor or when there is an active selection */}
      {primaryVisible && (
        <>
          <Button
            onClick={onCopy}
            variant="ghost"
            className={copied ? 'bg-[#E6F0FF] text-[#245BDB]' : 'bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]'}
            aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
            title="Copy"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="text-[13px] font-medium">{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button
            onClick={handleGenerateWithSelectedModel}
            variant="ghost"
            className="bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]"
            aria-label={generateButtonLabel}
            title={generateButtonTitle}
            disabled={!selectedModelId}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="text-[13px] font-medium">{generateButtonLabel}</span>
          </Button>
        </>
      )}

      <Button
        onClick={onShare}
        size="icon"
        variant="ghost"
        className={shared ? 'bg-[#E6F0FF] text-[#245BDB]' : 'bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]'}
        aria-label={shared ? 'Link copied' : 'Share prompt'}
        title="Share"
      >
        {shared ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
      </Button>

      <div className="relative" ref={exportMenuRef}>
        <Button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          size="icon"
          variant="ghost"
          className="bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]"
          aria-expanded={showExportMenu}
          title="Export"
        >
          <Download className="h-3 w-3" />
        </Button>
        {showExportMenu && (
          <div className="absolute bottom-full right-0 mb-2 w-36 bg-app border border-border rounded-lg shadow-md py-1 z-30">
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

      <div className="w-px h-5 bg-black/10 mx-1" />

      <Button
        onClick={onUndo}
        disabled={!canUndo}
        size="icon"
        variant="ghost"
        className="bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]"
        title="Undo"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
      <Button
        onClick={onRedo}
        disabled={!canRedo}
        size="icon"
        variant="ghost"
        className="bg-[#EEF0F3] text-[#5F6368] hover:bg-[#E8EAED]"
        title="Redo"
      >
        <RotateCw className="h-3 w-3" />
      </Button>
    </div>
  );
});

PromptActions.displayName = 'PromptActions';
