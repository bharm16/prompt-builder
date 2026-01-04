import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Pencil, X, Check, ChevronLeft, RefreshCw, Play as PlayIcon, Lock, Unlock, LayoutGrid } from 'lucide-react';
import { LoadingDots } from '@components/LoadingDots';

// External libraries
import { useToast } from '@components/Toast';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Internal absolute imports
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Relative imports - types first
import type { PromptCanvasProps } from './PromptCanvas/types';

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
import { usePromptCanvasState } from './PromptCanvas/hooks/usePromptCanvasState';
import { usePromptStatus } from './PromptCanvas/hooks/usePromptStatus';
import { useSpanSelectionEffects } from './PromptCanvas/hooks/useSpanSelectionEffects';
import { useSuggestionFeedback } from './PromptCanvas/hooks/useSuggestionFeedback';
import { useSuggestionSelection } from './PromptCanvas/hooks/useSuggestionSelection';
import { useTextSelection } from './PromptCanvas/hooks/useTextSelection';
import { useEditorContent } from './PromptCanvas/hooks/useEditorContent';
import { useKeyboardShortcuts } from './PromptCanvas/hooks/useKeyboardShortcuts';
import { usePromptExport } from './PromptCanvas/hooks/usePromptExport';
import { useLockedSpanInteractions } from './PromptCanvas/hooks/useLockedSpanInteractions';
import { formatTimestamp } from './PromptCanvas/utils/promptCanvasFormatters';
import { scrollToSpan } from './SpanBentoGrid/utils/spanFormatting';

// Relative imports - components
import { CategoryLegend } from './components/CategoryLegend';
import { PromptActions } from './components/PromptActions';
import { PromptEditor } from './components/PromptEditor';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import SuggestionsPanel from '@components/SuggestionsPanel';
import { VisualPreview, VideoPreview } from '@/features/preview';
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
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  // Get model state from context
  const { selectedModel, setSelectedModel, promptOptimizer } = usePromptState();
  const { lockedSpans, addLockedSpan, removeLockedSpan } = promptOptimizer;

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  // Left outline rail (collapsed by default on desktop)
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);

  // On small screens, avoid a skinny rail and show the outline content by default.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    if (mql.matches) setIsOutlineOpen(true);
  }, []);

  const { state, setState, incrementVisualRequestId, incrementVideoRequestId } =
    usePromptCanvasState();
  const {
    showExportMenu,
    showLegend,
    rightPaneMode,
    visualLastGeneratedAt,
    videoLastGeneratedAt,
    visualGenerateRequestId,
    videoGenerateRequestId,
    isEditing,
    originalInputPrompt,
    originalSelectedModel,
    selectedSpanId,
    lastAppliedSpanId,
    hasInteracted,
    hoveredSpanId,
    showHighlights,
    lastSwapTime,
    promptState,
    generatedTimestamp,
    justReplaced,
  } = state;

  // Normalize to NFC so span offsets and rendered text stay aligned.
  const normalizedDisplayedPrompt = useMemo(
    () => (displayedPrompt == null ? null : sanitizeText(displayedPrompt)),
    [displayedPrompt]
  );

  const previewSource = previewPrompt ?? normalizedDisplayedPrompt ?? '';

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions panel visibility state
  const isSuggestionsOpen = Boolean(suggestionsData && suggestionsData.show !== false);

  const setShowExportMenu = useCallback(
    (value: boolean) => setState({ showExportMenu: value }),
    [setState]
  );
  const setShowLegend = useCallback(
    (value: boolean) => setState({ showLegend: value }),
    [setState]
  );
  const setRightPaneMode = useCallback(
    (value: 'refine' | 'preview') => setState({ rightPaneMode: value }),
    [setState]
  );
  const setSelectedSpanId = useCallback(
    (value: string | null) => setState({ selectedSpanId: value }),
    [setState]
  );
  const setHoveredSpanId = useCallback(
    (value: string | null) => setState({ hoveredSpanId: value }),
    [setState]
  );
  const setShowHighlights = useCallback(
    (value: boolean) => setState({ showHighlights: value }),
    [setState]
  );
  const setIsEditing = useCallback(
    (value: boolean) => setState({ isEditing: value }),
    [setState]
  );
  const setOriginalInputPrompt = useCallback(
    (value: string) => setState({ originalInputPrompt: value }),
    [setState]
  );
  const setOriginalSelectedModel = useCallback(
    (value: string | undefined) => setState({ originalSelectedModel: value }),
    [setState]
  );
  const setVisualLastGeneratedAt = useCallback(
    (value: number | null) => setState({ visualLastGeneratedAt: value }),
    [setState]
  );
  const setVideoLastGeneratedAt = useCallback(
    (value: number | null) => setState({ videoLastGeneratedAt: value }),
    [setState]
  );

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
    enabled: enableMLHighlighting && showHighlights,
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
    onSpanSelect: setSelectedSpanId,
    onIntentRefine: () => setRightPaneMode('refine'),
  });

  const {
    lockButtonPosition,
    isHoveredLocked,
    handleHighlightMouseEnter,
    handleHighlightMouseLeave,
    handleLockButtonMouseLeave,
    handleToggleLock,
    cancelHideLockButton,
  } = useLockedSpanInteractions({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    editorWrapperRef,
    lockButtonRef,
    enableMLHighlighting,
    showHighlights,
    hoveredSpanId,
    setHoveredSpanId,
    parseResultSpans: parseResult.spans,
    lockedSpans,
    addLockedSpan,
    removeLockedSpan,
    highlightFingerprint,
    displayedPrompt: normalizedDisplayedPrompt,
  });

  usePromptStatus({
    displayedPrompt: normalizedDisplayedPrompt,
    inputPrompt,
    isDraftReady,
    isRefining,
    isProcessing,
    generatedTimestamp,
    setState,
  });

  // Editor content hook
  useEditorContent({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt: normalizedDisplayedPrompt,
    formattedHTML,
  });

  useSpanSelectionEffects({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    enableMLHighlighting,
    selectedSpanId,
    displayedPrompt: normalizedDisplayedPrompt,
    setState,
  });

  useSuggestionSelection({
    selectedSpanId,
    hasInteracted,
    isSuggestionsOpen,
    setState,
  });

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    toast,
  });

  const handleExport = usePromptExport({
    inputPrompt,
    displayedPrompt: normalizedDisplayedPrompt,
    qualityScore,
    selectedMode,
    setShowExportMenu,
    toast,
    debug,
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

  const handleRedoOptimize = useCallback((): void => {
    if (isProcessing || isRefining) {
      return;
    }
    debug.logAction('reoptimize', { promptLength: inputPrompt.length, skipCache: true });
    void onReoptimize(inputPrompt, { skipCache: true });
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
  }, [inputPrompt, isOptimizing, selectedModel, setOriginalInputPrompt, setOriginalSelectedModel, setIsEditing]);

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
  }, [
    inputPrompt,
    isEditing,
    isOptimizing,
    selectedModel,
    setSelectedModel,
    setOriginalInputPrompt,
    setOriginalSelectedModel,
    setIsEditing,
  ]);

  const handleCancel = useCallback((): void => {
    // Restore original prompt and model
    onInputPromptChange(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      setSelectedModel(originalSelectedModel);
    }
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [
    originalInputPrompt,
    originalSelectedModel,
    onInputPromptChange,
    setSelectedModel,
    setIsEditing,
    setOriginalInputPrompt,
    setOriginalSelectedModel,
  ]);

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
  }, [
    inputPrompt,
    isProcessing,
    isRefining,
    onReoptimize,
    debug,
    setIsEditing,
    setOriginalInputPrompt,
    setOriginalSelectedModel,
  ]);

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

  const { handleSuggestionClickWithFeedback } = useSuggestionFeedback({
    suggestionsData,
    selectedSpanId,
    ...(onSuggestionClick ? { onSuggestionClick } : {}),
    setState,
  });

  const showVideoPreview = selectedMode === 'video';

  const videoPreviewPrompt = normalizedDisplayedPrompt ?? '';

  const handleVisualPreviewGenerated = useCallback(
    ({ generatedAt }: { prompt: string; generatedAt: number }) => {
      setVisualLastGeneratedAt(generatedAt);
    },
    [setVisualLastGeneratedAt]
  );

  const handleVideoPreviewGenerated = useCallback(
    ({ generatedAt }: { prompt: string; generatedAt: number }) => {
      setVideoLastGeneratedAt(generatedAt);
    },
    [setVideoLastGeneratedAt]
  );

  const focusSpan = useCallback(
    (spanId: string | null): void => {
      if (!spanId) return;

      setSelectedSpanId(spanId);

      const span =
        Array.isArray(parseResult?.spans)
          ? parseResult.spans.find((candidate) => {
              const candidateId =
                typeof candidate?.id === 'string' && candidate.id.length > 0
                  ? candidate.id
                  : `span_${candidate.start}_${candidate.end}`;
              return candidateId === spanId;
            })
          : null;

      if (span) {
        scrollToSpan(editorRef as React.RefObject<HTMLElement>, { id: spanId });
      }

      if (!span || !onFetchSuggestions) {
        return;
      }

      const quote =
        typeof span.quote === 'string' && span.quote.trim().length > 0
          ? span.quote
          : typeof span.text === 'string'
            ? span.text
            : '';

      onFetchSuggestions({
        highlightedText: quote,
        originalText: quote,
        displayedPrompt: normalizedDisplayedPrompt ?? '',
        range: null,
        offsets: { start: span.start, end: span.end },
        metadata: {
          category: span.category,
          source: span.source,
          spanId,
          start: span.start,
          end: span.end,
          startGrapheme: span.startGrapheme,
          endGrapheme: span.endGrapheme,
          validatorPass: span.validatorPass,
          confidence: span.confidence,
          quote,
          leftCtx: span.leftCtx,
          rightCtx: span.rightCtx,
          idempotencyKey: span.idempotencyKey,
          span: span,
        },
        trigger: 'bento-grid',
        allLabeledSpans: parseResult.spans,
      });
    },
    [onFetchSuggestions, normalizedDisplayedPrompt, parseResult.spans, editorRef, setSelectedSpanId]
  );

  const handleKeepRefiningFromPreview = useCallback((): void => {
    setRightPaneMode('refine');
  }, [setRightPaneMode]);

  const handleSomethingOffFromPreview = useCallback((): void => {
    setRightPaneMode('refine');
    focusSpan(lastAppliedSpanId ?? selectedSpanId);
  }, [focusSpan, lastAppliedSpanId, selectedSpanId, setRightPaneMode]);

  const handleGenerateVisualPreview = useCallback((): void => {
    incrementVisualRequestId();
  }, [incrementVisualRequestId]);

  const handleGenerateVideoPreview = useCallback((): void => {
    incrementVideoRequestId();
  }, [incrementVideoRequestId]);

  // Render the component
  return (
    <div className="relative flex flex-col bg-geist-accents-1 min-h-full flex-1">
      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext?.hasContext() ?? false}
        isSuggestionsOpen={isSuggestionsOpen}
      />

      {/* Main Content Container */}
      <div
        className="flex-1 overflow-hidden prompt-canvas-grid"
        style={
          {
            // Controls the outline rail width without fighting the grid layout.
            '--prompt-outline-width': isOutlineOpen
              ? 'var(--layout-bento-grid-width)'
              : 'var(--layout-bento-rail-width)',
          } as React.CSSProperties
        }
      >
        {/* Left Sidebar - Outline Rail / Span Bento Grid */}
        <div
          className={`prompt-canvas-outline flex flex-col h-full overflow-hidden bg-geist-accents-1 border-r border-geist-accents-2 max-md:w-full max-md:h-auto transition-opacity duration-300 ${
            selectedSpanId ? 'opacity-60' : 'opacity-100'
          }`}
          data-outline-open={isOutlineOpen ? 'true' : 'false'}
        >
          {/* Collapsed rail */}
          {!isOutlineOpen && (
            <div className="prompt-outline-rail">
              <button
                type="button"
                onClick={() => setIsOutlineOpen(true)}
                className="prompt-outline-rail__button"
                aria-label="Open outline"
                title="Open outline"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Expanded outline panel */}
          {isOutlineOpen && (
            <>
              <div className="flex items-center justify-between gap-2 px-geist-3 py-geist-2 border-b border-geist-accents-2 bg-geist-accents-1">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsOutlineOpen(false)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors"
                    aria-label="Collapse outline"
                    title="Collapse outline"
                  >
                    <ChevronLeft className="h-4 w-4 text-geist-accents-6" aria-hidden="true" />
                  </button>
                  <div className="text-label-12 font-medium text-geist-accents-6 truncate">
                    Outline
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0">
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
                    onSpanClick={(span) => {
                      handleSpanClickFromBento(span);
                      // Optional: keep the user in writing flow after choosing an item.
                      if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 768px)').matches) {
                        setIsOutlineOpen(false);
                      }
                    }}
                    editorRef={editorRef as React.RefObject<HTMLElement>}
                    selectedSpanId={selectedSpanId}
                  />
                </HighlightingErrorBoundary>
              </div>
            </>
          )}
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="prompt-canvas-editor flex flex-col overflow-y-auto scrollbar-auto-hide min-w-0">
          {/* Original Prompt Band */}
          <div className="prompt-band prompt-band--original" data-optimizing={isOptimizing}>
            <div
              className="prompt-band__content prompt-canvas-content-wrapper"
              style={{
                maxWidth: 'var(--layout-content-max-width)',
                width: '100%',
              }}
            >
              <div className="prompt-card prompt-card--original">
                <div className="prompt-card__header">
                  <span className="prompt-card__label">
                    Input
                  </span>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={handleEditClick}
                      disabled={isOptimizing}
                      className="prompt-card__action-button"
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
                        className="prompt-card__action-button"
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
                <div className="prompt-card__body">
                  <label htmlFor="original-prompt-input" className="sr-only">
                    Input prompt
                  </label>
                  <textarea
                    ref={textareaRef}
                    id="original-prompt-input"
                    value={inputPrompt}
                    onChange={handleInputPromptChange}
                    onKeyDown={handleInputPromptKeyDown}
                    placeholder="Enter your prompt..."
                    rows={3}
                    readOnly={isInputLocked}
                    className="prompt-input prompt-input--original"
                    style={{
                      paddingRight: '14rem',
                      paddingBottom: '1rem',
                    }}
                    aria-label="Original prompt input"
                    aria-readonly={isInputLocked}
                    aria-busy={isOptimizing}
                  />
                  <div className="prompt-card__footer">
                    <ModelSelectorDropdown
                      selectedModel={selectedModel}
                      onModelChange={handleModelChange}
                      disabled={isOptimizing}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optimized Prompt Band */}
          <div 
            className="prompt-band prompt-band--optimized"
            data-loading={isOutputLoading}
            data-has-content={!!normalizedDisplayedPrompt}
          >
            <div
              className="prompt-band__content prompt-canvas-content-wrapper"
              style={{
                maxWidth: 'var(--layout-content-max-width)',
                width: '100%',
              }}
            >
              <div className="prompt-card prompt-card--optimized">
                <div className="prompt-card__header">
                  <div className="flex items-center gap-geist-2 flex-1">
                    <span className="prompt-card__label">
                      Optimized Output
                    </span>
                    {promptState === 'generated' && generatedTimestamp && (
                      <span className="prompt-card__state-badge prompt-card__state-badge--generated">
                        Generated {formatTimestamp(generatedTimestamp)}
                      </span>
                    )}
                    {promptState === 'generated' && !generatedTimestamp && (
                      <span className="prompt-card__state-badge prompt-card__state-badge--generated">
                        Generated just now
                      </span>
                    )}
                    {promptState === 'edited' && (
                      <span className="prompt-card__state-badge prompt-card__state-badge--edited">
                        Edited
                      </span>
                    )}
                    {promptState === 'synced' && normalizedDisplayedPrompt !== inputPrompt && (
                      <span className="prompt-card__state-badge prompt-card__state-badge--out-of-sync">
                        Out of sync with original
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-geist-2 flex-nowrap overflow-x-auto">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={handleRedoOptimize}
                        disabled={isReoptimizeDisabled}
                        className="prompt-card__action-button"
                        aria-label="Redo optimization"
                        title="Redo optimization"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-geist-accents-5" />
                        <span>Redo</span>
                      </button>
                    )}
                    {enableMLHighlighting && (
                      <button
                        type="button"
                        onClick={() => setShowHighlights(!showHighlights)}
                        className="prompt-card__action-button"
                        aria-label={showHighlights ? 'Hide highlights' : 'Show highlights'}
                        title={showHighlights ? 'Hide highlights' : 'Show highlights'}
                      >
                        <span className="text-label-12">{showHighlights ? 'Hide' : 'Show'} highlights</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="prompt-card__body prompt-card__body--editor">
                  {normalizedDisplayedPrompt && !hasInteracted && (
                    <div className="prompt-card__instruction">
                      <span className="prompt-card__instruction-text">
                        Click highlighted text to see and swap suggestions
                      </span>
                    </div>
                  )}
                  {normalizedDisplayedPrompt && lastSwapTime && canUndo && (
                    <div className="prompt-card__undo-hint">
                      <span className="prompt-card__undo-hint-text">
                        Swapped • Press Cmd+Z to undo
                      </span>
                    </div>
                  )}
                  <div 
                    className="prompt-editor-wrapper" 
                    aria-busy={isOutputLoading}
                    ref={editorWrapperRef}
                  >
                    <PromptEditor
                      ref={editorRef as React.RefObject<HTMLDivElement>}
                      onTextSelection={handleTextSelection}
                      onHighlightClick={handleHighlightClick}
                      onHighlightMouseDown={handleHighlightMouseDown}
                      onHighlightMouseEnter={handleHighlightMouseEnter}
                      onHighlightMouseLeave={handleHighlightMouseLeave}
                      onCopyEvent={handleCopyEvent}
                      onInput={handleInput}
                    />
                    {enableMLHighlighting && hoveredSpanId && lockButtonPosition && !isOutputLoading && (
                      <button
                        ref={lockButtonRef}
                        type="button"
                        onClick={handleToggleLock}
                        onMouseEnter={cancelHideLockButton}
                        onMouseLeave={handleLockButtonMouseLeave}
                        onMouseDown={(e) => e.preventDefault()}
                        className="prompt-lock-button"
                        style={{
                          top: `${lockButtonPosition.top}px`,
                          left: `${lockButtonPosition.left}px`,
                        }}
                        data-locked={isHoveredLocked ? 'true' : 'false'}
                        aria-label={isHoveredLocked ? 'Unlock span' : 'Lock span'}
                        title={isHoveredLocked ? 'Unlock span' : 'Lock span'}
                        aria-pressed={isHoveredLocked}
                      >
                        {isHoveredLocked ? (
                          <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                    {isOutputLoading && (
                      <div
                        className="prompt-editor-loading"
                        role="status"
                        aria-live="polite"
                        aria-label="Optimizing prompt"
                      >
                        <LoadingDots size={3} color="rgb(163, 163, 163)" />
                      </div>
                    )}
                  </div>
                </div>
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
                />
              )}
            </div>
          </div>

          {/* NEW: Video Generation Band (Moved to bottom of Main Column) */}
          {normalizedDisplayedPrompt && showVideoPreview && (
            <div className="prompt-band prompt-band--video mt-4">
              <div
                className="prompt-band__content prompt-canvas-content-wrapper"
                style={{
                  maxWidth: 'var(--layout-content-max-width)',
                  width: '100%',
                }}
              >
                <div className="prompt-card prompt-card--video border-geist-accents-2 bg-geist-background">
                  <div className="prompt-card__header">
                    <span className="prompt-card__label">Video Generation</span>
                  </div>
                  <div className="prompt-card__body">
                    <div className="flex flex-col gap-4">
                      <div className="text-sm text-geist-accents-5">
                        Generate a video preview from your optimized prompt.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateVideoPreview}
                          disabled={!videoPreviewPrompt.trim()}
                          className="inline-flex items-center justify-center gap-2 px-geist-3 py-geist-2 text-button-14 font-medium text-geist-background bg-geist-foreground rounded-geist hover:bg-geist-accents-8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Generate motion preview"
                        >
                          <PlayIcon className="h-4 w-4" aria-hidden="true" />
                          <span>Generate Motion</span>
                        </button>
                      </div>
                      <div className="pt-4 border-t border-geist-accents-2">
                        <VideoPreview
                          prompt={videoPreviewPrompt}
                          aspectRatio={previewAspectRatio}
                          isVisible={true}
                          generateRequestId={videoGenerateRequestId}
                          lastGeneratedAt={videoLastGeneratedAt}
                          onPreviewGenerated={handleVideoPreviewGenerated}
                          onKeepRefining={handleKeepRefiningFromPreview}
                          onRefinePrompt={handleSomethingOffFromPreview}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Rail - Drafting & Refinement */}
        <div
          className="prompt-canvas-right-rail flex flex-col overflow-hidden bg-geist-background border border-geist-accents-2"
        >
          {/* Header - Simplified, no tabs */}
          <div className="sticky top-0 z-20 bg-geist-background border-b border-geist-accents-2">
            <div className="px-geist-4 py-geist-3 flex items-center justify-between gap-geist-3">
              <h2 className="text-sm font-semibold text-geist-foreground truncate">
                Preview & Refine
              </h2>
              {/* Optional: Clear selection button if needed */}
               {suggestionsData?.selectedText && suggestionsData?.onClose && (
                  <button
                    type="button"
                    onClick={() => {
                      suggestionsData.onClose?.();
                      setSelectedSpanId(null);
                      setHoveredSpanId(null);
                    }}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-geist-accents-2 transition-colors"
                    aria-label="Clear selection"
                  >
                    <X className="h-3 w-3 text-geist-accents-6" aria-hidden="true" />
                  </button>
                )}
            </div>
          </div>

          {/* Right-pane body - Stacked Layout */}
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            
            {/* 1. Image Preview (Always visible at top for iterative loop) */}
            <div className="p-geist-4 border-b border-geist-accents-2">
               <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">Visual Draft</span>
                    <button
                      type="button"
                      onClick={handleGenerateVisualPreview}
                      disabled={!previewSource.trim()}
                      className="text-xs font-medium text-geist-foreground hover:text-geist-accents-5 transition-colors disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>
                  
                  <VisualPreview
                    prompt={previewSource}
                    aspectRatio={previewAspectRatio}
                    isVisible={true}
                    generateRequestId={visualGenerateRequestId}
                    lastGeneratedAt={visualLastGeneratedAt}
                    onPreviewGenerated={handleVisualPreviewGenerated}
                    onKeepRefining={handleKeepRefiningFromPreview}
                    onRefinePrompt={handleSomethingOffFromPreview}
                  />
               </div>
            </div>

            {/* 2. Suggestions Panel (Takes remaining space) */}
            <div className="flex-1 flex flex-col min-h-0">
               {/* Inline replacement feedback */}
               {justReplaced && (
                  <div className="px-geist-4 pt-geist-3 pb-2">
                    <div className="flex items-center justify-between gap-geist-3 bg-geist-accents-1 border border-geist-accents-2 rounded-geist px-geist-3 py-geist-2">
                      <div className="text-label-12 text-geist-foreground truncate">
                        ✓ Replaced “{justReplaced.from}”
                      </div>
                        <button
                          type="button"
                          onClick={() => {
                            onUndo?.();
                            setState({ justReplaced: null });
                          }}
                          className="text-label-12 font-medium text-geist-accents-6 hover:text-geist-foreground"
                        >
                        Undo
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-hidden relative">
                  <SuggestionsPanel
                    suggestionsData={
                      suggestionsData
                        ? ({
                            ...suggestionsData,
                            onSuggestionClick: handleSuggestionClickWithFeedback,
                            ...(normalizedDisplayedPrompt
                              ? { currentPrompt: normalizedDisplayedPrompt }
                              : {}),
                            variant: 'tokenEditor',
                            panelClassName: 'h-full flex flex-col', // Ensure it fits the container
                            contextValue: suggestionsData.selectedText || '',
                            showCategoryTabs: false,
                            showCopyAction: false,
                            customRequestPlaceholder: 'e.g. more cinematic, more intense...',
                            customRequestCtaLabel: 'Generate',
                            hoverPreview: hoveredSpanId !== null && !selectedSpanId,
                          } as Record<string, unknown>)
                        : ({
                            show: false,
                            ...(normalizedDisplayedPrompt
                              ? { currentPrompt: normalizedDisplayedPrompt }
                              : {}),
                            variant: 'tokenEditor',
                            panelClassName: 'h-full flex flex-col',
                            showCategoryTabs: false,
                            showCopyAction: false,
                            hoverPreview: hoveredSpanId !== null && !selectedSpanId,
                          } as Record<string, unknown>)
                    }
                  />
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
