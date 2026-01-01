import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Pencil, X, Check } from 'lucide-react';
import { LoadingDots } from '@components/LoadingDots';

// External libraries
import { useToast } from '@components/Toast';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Internal absolute imports
import { ExportService } from '@services/exportService';
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Relative imports - types first
import type { PromptCanvasProps } from './PromptCanvas/types';
import type { ExportFormat } from './types';

// Relative imports - implementations
import { useSpanLabeling, sanitizeText } from '@/features/span-highlighting';
import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import { useHighlightRendering } from '@/features/span-highlighting';
import { useHighlightFingerprint } from '@/features/span-highlighting';
import type { SpanLabelingResult } from '@/features/span-highlighting/hooks/types';
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
import { TabbedPreview } from '@/features/preview';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { usePromptState } from './context/PromptStateContext';

// Styles
import './PromptCanvas.css';

// Main PromptCanvas Component
export function PromptCanvas({
  inputPrompt,
  onInputPromptChange,
  onReoptimize,
  displayedPrompt,
  previewPrompt = null,
  previewAspectRatio = null,
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
  isProcessing = false,
  draftSpans = null,
  refinedSpans = null,
}: PromptCanvasProps): React.ReactElement {
  // Debug logging
  const debug = useDebugLogger('PromptCanvas', {
    mode: selectedMode,
    hasPrompt: !!displayedPrompt,
    hasHighlights: !!initialHighlights,
  });

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  // Get model state from context
  const { selectedModel, setSelectedModel } = usePromptState();

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  // Normalize to NFC so span offsets and rendered text stay aligned.
  const normalizedDisplayedPrompt = useMemo(
    () => (displayedPrompt == null ? null : sanitizeText(displayedPrompt)),
    [displayedPrompt]
  );

  const previewSource = previewPrompt ?? normalizedDisplayedPrompt ?? '';

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
    displayedPrompt: normalizedDisplayedPrompt,
    enableMLHighlighting,
    initialHighlightsVersion,
  });

  const handleLabelingResult = useCallback(
    (result: SpanLabelingResult): void => {
      if (!enableMLHighlighting || !result) {
        return;
      }
      debug.logAction('labelingComplete', {
        spanCount: result.spans.length,
        hasMeta: !!result.meta,
      });
      if (onHighlightsPersist) {
        onHighlightsPersist(result);
      }
    },
    [enableMLHighlighting, onHighlightsPersist, debug]
  );

  // Track if this is the first time seeing this text (skip debounce for initial optimization)
  const isInitialOptimization = isDraftReady;

  const {
    spans: labeledSpans,
    meta: labeledMeta,
    status: labelingStatus,
    error: labelingError,
    signature: labelingSignature,
  } = useSpanLabeling({
    text: enableMLHighlighting ? normalizedDisplayedPrompt ?? '' : '',
    initialData: memoizedInitialHighlights,
    initialDataVersion: initialHighlightsVersion,
    cacheKey: enableMLHighlighting && promptUuid ? String(promptUuid) : null,
    enabled: enableMLHighlighting && Boolean(normalizedDisplayedPrompt?.trim()),
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
    displayedPrompt: normalizedDisplayedPrompt,
    isSuggestionsOpen,
  });

  // Parse result hook
  const parseResult = useParseResult({
    labeledSpans,
    labeledMeta,
    labelingSignature,
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt: normalizedDisplayedPrompt,
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
    text: normalizedDisplayedPrompt ?? '',
  });

  // Memoize formatted HTML - DO NOT format if ML highlighting is enabled
  const { html: formattedHTML } = useMemo(
    () => {
      if (enableMLHighlighting) {
        return { html: escapeHTMLForMLHighlighting(normalizedDisplayedPrompt || '') };
      }
      return formatTextToHTML(normalizedDisplayedPrompt ?? '');
    },
    enableMLHighlighting
      ? [normalizedDisplayedPrompt, enableMLHighlighting]
      : [normalizedDisplayedPrompt, enableMLHighlighting, promptContext]
  );

  // Performance timer: Track when prompt appears on screen
  useEffect(() => {
    if (normalizedDisplayedPrompt && normalizedDisplayedPrompt.trim() && enableMLHighlighting) {
      performance.mark('prompt-displayed-on-screen');
      debug.logEffect('Prompt displayed on screen', {
        promptLength: normalizedDisplayedPrompt.length,
        mlHighlighting: enableMLHighlighting,
      });
    }
  }, [normalizedDisplayedPrompt, enableMLHighlighting, debug]);

  // UI state (simple boolean flags - could be moved to reducer if needed)
  const [showExportMenu, setShowExportMenu] = React.useState<boolean>(false);
  const [showModelMenu, setShowModelMenu] = React.useState<boolean>(false);
  const [showLegend, setShowLegend] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [originalInputPrompt, setOriginalInputPrompt] = React.useState<string>('');
  const [originalSelectedModel, setOriginalSelectedModel] = React.useState<string | undefined>(undefined);
  const isOptimizing = Boolean(isProcessing || isRefining);
  const isOutputLoading = Boolean(isProcessing && !isDraftReady);
  const isInputLocked = !isEditing || isOptimizing;

  // Text selection hook
  const {
    handleTextSelection,
    handleHighlightClick,
    handleHighlightMouseDown,
    handleSpanClickFromBento,
  } = useTextSelection({
    selectedMode,
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt: normalizedDisplayedPrompt,
    parseResult,
    onFetchSuggestions,
  });

  // Editor content hook
  useEditorContent({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt: normalizedDisplayedPrompt,
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
    debug.logAction('copy', { promptLength: normalizedDisplayedPrompt?.length ?? 0 });
    copy(normalizedDisplayedPrompt ?? '');
  }, [copy, normalizedDisplayedPrompt, debug]);

  const handleShare = useCallback((): void => {
    if (promptUuid) {
      debug.logAction('share', { promptUuid });
      share(promptUuid);
    }
  }, [share, promptUuid, debug]);

  const handleExport = useCallback(
    (format: ExportFormat): void => {
      debug.logAction('export', { format, mode: selectedMode });
      debug.startTimer('export');
      
      const exportFormat = convertExportFormat(format);

      try {
        ExportService.export(exportFormat, {
          inputPrompt,
          displayedPrompt: normalizedDisplayedPrompt ?? '',
          ...(qualityScore !== null && { qualityScore }),
          selectedMode,
        });
        setShowExportMenu(false);
        debug.endTimer('export', `Export as ${exportFormat} successful`);
        toast.success(`Exported as ${exportFormat.toUpperCase()}`);
      } catch (error) {
        debug.endTimer('export');
        debug.logError('Export failed', error as Error);
        toast.error('Export failed');
      }
    },
    [inputPrompt, normalizedDisplayedPrompt, qualityScore, selectedMode, toast, debug]
  );

  const handleCopyEvent = useCallback(
    (e: React.ClipboardEvent): void => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? '';

      if (selectedText) {
        return;
      }

      e.clipboardData.setData('text/plain', normalizedDisplayedPrompt ?? '');
      e.preventDefault();
    },
    [normalizedDisplayedPrompt]
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>): void => {
      const newText = e.currentTarget.innerText || e.currentTarget.textContent || '';
      const normalizedText = sanitizeText(newText);
      debug.logAction('textEdit', { 
        newLength: normalizedText.length,
        oldLength: normalizedDisplayedPrompt?.length ?? 0,
      });
      if (onDisplayedPromptChange) {
        onDisplayedPromptChange(normalizedText);
      }
    },
    [onDisplayedPromptChange, normalizedDisplayedPrompt, debug]
  );

  const handleInputPromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const updatedPrompt = sanitizeText(e.target.value);
      debug.logAction('inputPromptEdit', { promptLength: updatedPrompt.length });
      onInputPromptChange(updatedPrompt);
    },
    [onInputPromptChange, debug]
  );

  const handleReoptimize = useCallback((): void => {
    if (isProcessing || isRefining) {
      return;
    }
    debug.logAction('reoptimize', { promptLength: inputPrompt.length });
    void onReoptimize(inputPrompt);
  }, [inputPrompt, isProcessing, isRefining, onReoptimize, debug]);

  const handleEditClick = useCallback((): void => {
    if (isOptimizing) {
      return;
    }
    setOriginalInputPrompt(inputPrompt);
    setOriginalSelectedModel(selectedModel);
    setIsEditing(true);
    // Focus the textarea after state update
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [inputPrompt, isOptimizing, selectedModel]);

  const handleModelChange = useCallback((modelId: string): void => {
    if (isOptimizing) {
      return;
    }
    // Only enter edit mode if model actually changed
    const modelChanged = modelId !== selectedModel;
    setSelectedModel(modelId);
    // Automatically enter edit mode when model changes
    if (modelChanged && !isEditing) {
      setOriginalInputPrompt(inputPrompt);
      setOriginalSelectedModel(selectedModel);
      setIsEditing(true);
      // Focus the textarea after state update
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [inputPrompt, isEditing, isOptimizing, selectedModel, setSelectedModel]);

  const handleCancel = useCallback((): void => {
    // Restore original prompt and model
    onInputPromptChange(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      setSelectedModel(originalSelectedModel);
    }
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [originalInputPrompt, originalSelectedModel, onInputPromptChange, setSelectedModel]);

  const handleUpdate = useCallback((): void => {
    if (isProcessing || isRefining) {
      return;
    }
    // Changes are already saved via onInputPromptChange as user types
    // Run reoptimize with the current input prompt
    debug.logAction('reoptimize', { promptLength: inputPrompt.length });
    void onReoptimize(inputPrompt);
    // Exit edit mode
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [inputPrompt, isProcessing, isRefining, onReoptimize, debug]);

  const handleInputPromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (isProcessing || isRefining) {
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isEditing) {
          handleUpdate();
        } else {
          handleReoptimize();
        }
      }
    },
    [handleReoptimize, handleUpdate, isEditing, isProcessing, isRefining]
  );

  const hasInputPrompt = Boolean(inputPrompt.trim());
  const isReoptimizeDisabled = !hasInputPrompt || isProcessing || isRefining;

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
              spans={parseResult.spans.map((span) => {
                const { confidence, category, ...rest } = span;
                return {
                  ...rest,
                  id: span.id ?? `span_${span.start}_${span.end}`,
                  quote: span.quote ?? span.text ?? '',
                  ...(typeof confidence === 'number' ? { confidence } : {}),
                  ...(category !== undefined ? { category } : {}),
                };
              })}
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
            <div className="mb-geist-8">
              <div className="flex items-center justify-between gap-geist-4 mb-geist-2">
                <span className="text-label-12 text-geist-accents-6 uppercase tracking-wide">
                  Original prompt
                </span>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    disabled={isOptimizing}
                    className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-1.5 text-button-14 text-geist-accents-7 rounded-geist hover:bg-geist-accents-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Edit prompt"
                    title="Edit prompt"
                  >
                    <Pencil className="h-3.5 w-3.5 text-geist-accents-5" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-geist-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isOptimizing}
                      className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-1.5 text-button-14 text-geist-accents-7 rounded-geist hover:bg-geist-accents-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Cancel editing"
                      title="Cancel editing"
                    >
                      <X className="h-3.5 w-3.5 text-geist-accents-5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdate}
                      disabled={isReoptimizeDisabled}
                      className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-1.5 text-button-14 text-white bg-geist-foreground rounded-geist hover:bg-geist-accents-8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Update prompt"
                      title="Update and re-optimize (Cmd/Ctrl+Enter)"
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span>Update</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="relative bg-geist-background border border-geist-accents-2 rounded-geist-lg transition-all duration-200 focus-within:border-geist-accents-4 focus-within:shadow-geist-small">
                <label htmlFor="original-prompt-input" className="sr-only">
                  Original prompt
                </label>
                <textarea
                  ref={textareaRef}
                  id="original-prompt-input"
                  value={inputPrompt}
                  onChange={handleInputPromptChange}
                  onKeyDown={handleInputPromptKeyDown}
                  placeholder="Edit your original prompt..."
                  rows={3}
                  readOnly={isInputLocked}
                  className="w-full resize-none bg-transparent text-[15px] text-geist-foreground placeholder-geist-accents-4 outline-none leading-relaxed px-geist-5 py-geist-4 rounded-geist-lg font-sans"
                  style={{
                    border: 'none',
                    boxShadow: 'none',
                    outline: 'none',
                    paddingRight: '14rem',
                    paddingBottom: '3.25rem',
                  }}
                  aria-label="Original prompt input"
                  aria-readonly={isInputLocked}
                  aria-busy={isOptimizing}
                />
                <div className="absolute bottom-4 left-4 flex items-center gap-geist-2">
                  <ModelSelectorDropdown
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    disabled={isOptimizing}
                  />
                </div>
              </div>
            </div>
            <div 
              className="relative" 
              aria-busy={isOutputLoading}
              style={{
                contain: 'layout style',
              }}
            >
              <PromptEditor
                ref={editorRef as React.RefObject<HTMLDivElement>}
                onTextSelection={handleTextSelection}
                onHighlightClick={handleHighlightClick}
                onHighlightMouseDown={handleHighlightMouseDown}
                onCopyEvent={handleCopyEvent}
                onInput={handleInput}
              />
              {isOutputLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-start backdrop-blur-sm"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)' }}
                  role="status"
                  aria-live="polite"
                  aria-label="Optimizing prompt"
                >
                  <div className="pl-geist-5 pt-geist-4">
                    <LoadingDots size={3} color="rgb(163, 163, 163)" />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons floating below prompt content, aligned right */}
            {normalizedDisplayedPrompt && (
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
                promptText={normalizedDisplayedPrompt ?? ''}
                showModelMenu={showModelMenu}
                onToggleModelMenu={setShowModelMenu}
              />
            )}
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
            <TabbedPreview
              visualPrompt={previewSource}
              visualPreviewPrompt={previewPrompt}
              videoPrompt={normalizedDisplayedPrompt ?? ''}
              aspectRatio={previewAspectRatio}
              isVisible={true}
              selectedMode={selectedMode}
            />
          </div>

          {/* AI Suggestions Section */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <SuggestionsPanel
              suggestionsData={
                suggestionsData
                  ? ({
                      ...suggestionsData,
                      onSuggestionClick: onSuggestionClick,
                      ...(normalizedDisplayedPrompt
                        ? { currentPrompt: normalizedDisplayedPrompt }
                        : {}),
                      panelTitle: 'AI Suggestions',
                      panelClassName: 'h-full flex flex-col',
                    } as Record<string, unknown>)
                  : ({
                      show: false,
                      ...(normalizedDisplayedPrompt
                        ? { currentPrompt: normalizedDisplayedPrompt }
                        : {}),
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
