import React, { useRef, useMemo, useCallback, useEffect } from 'react';

// External libraries
import { useToast } from '../../components/Toast';

// Internal absolute imports
import { ExportService } from '../../services/exportService';
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Relative imports - types first
import type { PromptCanvasProps } from './PromptCanvas/types';
import type { ExportFormat } from './types';

// Relative imports - implementations
import { useSpanLabeling } from '@/features/span-highlighting';
import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import { useHighlightRendering } from '@/features/span-highlighting';
import { useHighlightFingerprint } from '@/features/span-highlighting';
import { formatTextToHTML, escapeHTMLForMLHighlighting } from './utils/textFormatting';
import { useSpanDataConversion } from './PromptCanvas/hooks/useSpanDataConversion';
import { useSuggestionDetection } from './PromptCanvas/hooks/useSuggestionDetection';
import { useParseResult } from './PromptCanvas/hooks/useParseResult';
import { useTextSelection } from './PromptCanvas/hooks/useTextSelection';
import { useEditorContent } from './PromptCanvas/hooks/useEditorContent';
import { useKeyboardShortcuts } from './PromptCanvas/hooks/useKeyboardShortcuts';
import { convertExportFormat } from './PromptCanvas/utils/exportFormatConversion';

// Relative imports - components
import { CategoryLegend } from './components/CategoryLegend';
import { PromptActions } from './components/PromptActions';
import { PromptEditor } from './components/PromptEditor';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import SuggestionsPanel from '@components/SuggestionsPanel';
import { VisualPreview } from '@/features/preview/components/VisualPreview';

// Styles
import './PromptCanvas.css';

// Main PromptCanvas Component
export function PromptCanvas({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
  qualityScore,
  selectedMode,
  currentMode,
  promptUuid,
  promptContext,
  onDisplayedPromptChange,
  suggestionsData,
  onFetchSuggestions,
  onSuggestionClick,
  onCreateNew,
  initialHighlights = null,
  initialHighlightsVersion = 0,
  onHighlightsPersist,
  onUndo = () => {},
  onRedo = () => {},
  canUndo = false,
  canRedo = false,
  isDraftReady = false,
  isRefining = false,
  draftSpans = null,
  refinedSpans = null,
}: PromptCanvasProps): React.ReactElement {
  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions panel visibility state
  const isSuggestionsOpen = Boolean(suggestionsData && suggestionsData.show !== false);

  // Span data conversion hook
  const { memoizedInitialHighlights } = useSpanDataConversion({
    draftSpans,
    refinedSpans,
    initialHighlights,
    isDraftReady,
    isRefining,
    promptUuid,
    displayedPrompt,
    enableMLHighlighting,
    initialHighlightsVersion,
  });

  const handleLabelingResult = useCallback(
    (result: {
      spans: Array<{
        start: number;
        end: number;
        category: string;
        confidence: number;
      }>;
      meta: Record<string, unknown> | null;
    }): void => {
      if (!enableMLHighlighting || !result) {
        return;
      }
      if (onHighlightsPersist) {
        onHighlightsPersist(result);
      }
    },
    [enableMLHighlighting, onHighlightsPersist]
  );

  // Track if this is the first time seeing this text (skip debounce for initial optimization)
  const isInitialOptimization = isDraftReady;

  const {
    spans: labeledSpans,
    meta: labeledMeta,
    status: labelingStatus,
    error: labelingError,
    refresh: refreshLabeling,
  } = useSpanLabeling({
    text: enableMLHighlighting ? displayedPrompt ?? '' : '',
    initialData: memoizedInitialHighlights,
    initialDataVersion: initialHighlightsVersion,
    cacheKey: enableMLHighlighting && promptUuid ? String(promptUuid) : null,
    enabled: enableMLHighlighting && Boolean(displayedPrompt?.trim()),
    immediate: isInitialOptimization,
    maxSpans: PERFORMANCE_CONFIG.MAX_HIGHLIGHTS,
    minConfidence: PERFORMANCE_CONFIG.MIN_CONFIDENCE_SCORE,
    policy: labelingPolicy,
    templateVersion: TEMPLATE_VERSIONS.SPAN_LABELING_V1,
    debounceMs: PERFORMANCE_CONFIG.DEBOUNCE_DELAY_MS,
    onResult: handleLabelingResult,
  });

  // Suggestion detection hook
  useSuggestionDetection({
    displayedPrompt,
    isSuggestionsOpen,
    refreshLabeling,
  });

  // Parse result hook
  const parseResult = useParseResult({
    labeledSpans,
    labeledMeta,
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt,
  });

  // Highlight rendering using extracted hook
  const highlightFingerprint = useHighlightFingerprint(enableMLHighlighting, {
    spans: parseResult.spans,
    displayText: parseResult.displayText,
  });

  useHighlightRendering({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    parseResult: {
      spans: parseResult.spans,
      displayText: parseResult.displayText,
    },
    enabled: enableMLHighlighting,
    fingerprint: highlightFingerprint,
    text: displayedPrompt ?? '',
  });

  // Memoize formatted HTML - DO NOT format if ML highlighting is enabled
  const { html: formattedHTML } = useMemo(
    () => {
      if (enableMLHighlighting) {
        return { html: escapeHTMLForMLHighlighting(displayedPrompt || '') };
      }
      return formatTextToHTML(displayedPrompt ?? '');
    },
    enableMLHighlighting
      ? [displayedPrompt, enableMLHighlighting]
      : [displayedPrompt, enableMLHighlighting, promptContext]
  );

  // Performance timer: Track when prompt appears on screen
  useEffect(() => {
    if (displayedPrompt && displayedPrompt.trim() && enableMLHighlighting) {
      performance.mark('prompt-displayed-on-screen');
    }
  }, [displayedPrompt, enableMLHighlighting]);

  // UI state (simple boolean flags - could be moved to reducer if needed)
  const [showExportMenu, setShowExportMenu] = React.useState<boolean>(false);
  const [showModelMenu, setShowModelMenu] = React.useState<boolean>(false);
  const [showLegend, setShowLegend] = React.useState<boolean>(false);

  // Text selection hook
  const {
    handleTextSelection,
    handleHighlightClick,
    handleHighlightMouseDown,
    handleSpanClickFromBento,
  } = useTextSelection({
    selectedMode,
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt,
    labeledSpans,
    parseResult,
    onFetchSuggestions,
  });

  // Editor content hook
  useEditorContent({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt,
    formattedHTML,
  });

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    toast,
  });

  // Event handlers
  const handleCopy = useCallback((): void => {
    copy(displayedPrompt ?? '');
  }, [copy, displayedPrompt]);

  const handleShare = useCallback((): void => {
    if (promptUuid) {
      share(promptUuid);
    }
  }, [share, promptUuid]);

  const handleExport = useCallback(
    (format: ExportFormat): void => {
      const exportFormat = convertExportFormat(format);

      ExportService.export(exportFormat, {
        inputPrompt,
        displayedPrompt: displayedPrompt ?? '',
        ...(qualityScore !== null && { qualityScore }),
        selectedMode,
      });
      setShowExportMenu(false);
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    },
    [inputPrompt, displayedPrompt, qualityScore, selectedMode, toast]
  );

  const handleCopyEvent = useCallback(
    (e: React.ClipboardEvent): void => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? '';

      if (selectedText) {
        return;
      }

      e.clipboardData.setData('text/plain', displayedPrompt ?? '');
      e.preventDefault();
    },
    [displayedPrompt]
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>): void => {
      const newText = e.currentTarget.innerText || e.currentTarget.textContent || '';
      if (onDisplayedPromptChange) {
        onDisplayedPromptChange(newText);
      }
    },
    [onDisplayedPromptChange]
  );

  // Render the component
  return (
    <div className="relative flex flex-col bg-geist-background min-h-full flex-1">
      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext?.hasContext() ?? false}
        isSuggestionsOpen={isSuggestionsOpen}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex overflow-hidden prompt-canvas-grid">
        {/* Left Sidebar - Span Bento Grid */}
        <div
          className="flex flex-col h-full overflow-hidden bg-geist-accents-1 border-l border-geist-accents-2 max-md:w-full max-md:h-auto"
          style={{
            width: 'var(--layout-bento-grid-width)',
            minWidth: 'var(--layout-bento-grid-width)',
            flexShrink: 0,
          }}
        >
          <HighlightingErrorBoundary>
            <SpanBentoGrid
              spans={parseResult.spans.map((span) => ({
                id: span.id ?? `span_${span.start}_${span.end}`,
                quote: span.quote ?? span.text ?? '',
                confidence: span.confidence,
                start: span.start,
                end: span.end,
                category: span.category,
                ...span,
              }))}
              onSpanClick={handleSpanClickFromBento}
              editorRef={editorRef as React.RefObject<HTMLElement>}
            />
          </HighlightingErrorBoundary>
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex flex-col flex-1 overflow-y-auto scrollbar-auto-hide min-w-0">
          <div
            className="mx-auto pt-geist-12 pb-geist-12 prompt-canvas-content-wrapper"
            style={{
              maxWidth: 'var(--layout-content-max-width)',
              width: '100%',
            }}
          >
            {/* PromptEditor continues working even if highlighting fails */}
            <PromptEditor
              ref={editorRef as React.RefObject<HTMLDivElement>}
              onTextSelection={handleTextSelection}
              onHighlightClick={handleHighlightClick}
              onHighlightMouseDown={handleHighlightMouseDown}
              onCopyEvent={handleCopyEvent}
              onInput={handleInput}
            />

            {/* Action buttons floating below prompt content, aligned right */}
            <PromptActions
              onCopy={handleCopy}
              onExport={handleExport}
              onCreateNew={onCreateNew}
              onShare={handleShare}
              copied={copied}
              shared={shared}
              showExportMenu={showExportMenu}
              onToggleExportMenu={setShowExportMenu}
              showLegend={showLegend}
              onToggleLegend={setShowLegend}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              promptText={displayedPrompt ?? ''}
              showModelMenu={showModelMenu}
              onToggleModelMenu={setShowModelMenu}
            />
          </div>
        </div>

        {/* Image Generation Panel */}
        <div
          className="flex flex-col h-full overflow-hidden bg-geist-background border-l border-geist-accents-2"
          style={{
            width: 'var(--layout-image-gen-width)',
            minWidth: 'var(--layout-image-gen-width)',
            flexShrink: 0,
          }}
        >
          {/* Image Generation Section */}
          <div className="flex flex-col flex-1 overflow-y-auto p-geist-4 border-b border-geist-accents-2 min-h-0">
            <VisualPreview prompt={displayedPrompt || ''} isVisible={true} />
          </div>

          {/* AI Suggestions Section */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <SuggestionsPanel
              suggestionsData={
                suggestionsData
                  ? ({
                      ...suggestionsData,
                      onSuggestionClick: onSuggestionClick,
                      ...(displayedPrompt ? { currentPrompt: displayedPrompt } : {}),
                      panelTitle: 'AI Suggestions',
                      panelClassName: 'h-full flex flex-col',
                    } as Record<string, unknown>)
                  : ({
                      show: false,
                      ...(displayedPrompt ? { currentPrompt: displayedPrompt } : {}),
                      panelTitle: 'AI Suggestions',
                      panelClassName: 'h-full flex flex-col',
                    } as Record<string, unknown>)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
