import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { useDrawerState } from '@components/CollapsibleDrawer';
import { useToast } from '@components/Toast';
import { useDebugLogger } from '@hooks/useDebugLogger';
import {
  PERFORMANCE_CONFIG,
  DEFAULT_LABELING_POLICY,
  TEMPLATE_VERSIONS,
} from '@config/performance.config';
import { sanitizeText, useSpanLabeling } from '@/features/span-highlighting';
import { useHighlightRendering } from '@/features/span-highlighting';
import { useHighlightFingerprint } from '@/features/span-highlighting';
import type { SpanLabelingResult } from '@/features/span-highlighting/hooks/types';
import { useTriggerAutocomplete } from '@features/assets/hooks/useTriggerAutocomplete';
import { useOutlineOverlay } from './hooks/useOutlineOverlay';
import { useEditorInput } from './hooks/useEditorInput';

import type {
  PromptCanvasProps,
  HighlightSnapshot,
} from './types';

import {
  escapeHTMLForMLHighlighting,
  formatTextToHTML,
} from '../utils/textFormatting';
import { useSpanDataConversion } from './hooks/useSpanDataConversion';
import { useSuggestionDetection } from './hooks/useSuggestionDetection';
import { useParseResult } from './hooks/useParseResult';
import { usePromptCanvasState } from './hooks/usePromptCanvasState';
import { usePromptStatus } from './hooks/usePromptStatus';
import { useSpanSelectionEffects } from './hooks/useSpanSelectionEffects';
import { useCoherenceSpanMarkers } from './hooks/useCoherenceSpanMarkers';
import { useSuggestionSelection } from './hooks/useSuggestionSelection';
import { useTextSelection } from './hooks/useTextSelection';
import { useEditorContent } from './hooks/useEditorContent';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePromptExport } from './hooks/usePromptExport';
import { useLockedSpanInteractions } from './hooks/useLockedSpanInteractions';
import { useTriggerValidation } from './hooks/useTriggerValidation';
import { useInlineSuggestionState } from './hooks/useInlineSuggestionState';
import { useCanvasEditorState } from './hooks/useCanvasEditorState';
import { useCanvasGenerations } from './hooks/useCanvasGenerations';
import { useCanvasI2V } from './hooks/useCanvasI2V';
import { useCanvasCoherence } from './hooks/useCanvasCoherence';
import { scrollToSpan } from '../SpanBentoGrid/utils/spanFormatting';
import { PromptCanvasView } from './components/PromptCanvasView';
import { useGenerationControlsStoreState } from '../context/GenerationControlsStore';
import { useWorkspaceSession } from '../context/WorkspaceSessionContext';
import { usePromptInsertionBus } from '../context/PromptInsertionBusContext';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptServices,
  usePromptSession,
} from '../context/PromptStateContext';
import { serializeKeyframes } from '../utils/keyframeTransforms';

// Main PromptCanvas Component
export function PromptCanvas({
  user = null,
  showResults = false,
  inputPrompt,
  onInputPromptChange,
  onReoptimize,
  onResetResultsForEditing,
  displayedPrompt,
  previewAspectRatio = null,
  qualityScore,
  selectedMode,
  promptUuid,
  promptContext,
  onDisplayedPromptChange: _onDisplayedPromptChange,
  suggestionsData,
  onFetchSuggestions,
  onSuggestionClick,
  initialHighlights = null,
  initialHighlightsVersion = 0,
  onHighlightsPersist,
  onUndo = () => { },
  onRedo = () => { },
  canUndo = false,
  canRedo = false,
  isDraftReady = false,
  isRefining = false,
  isProcessing = false,
  draftSpans = null,
  refinedSpans = null,
  coherenceAffectedSpanIds,
  coherenceSpanIssueMap,
  coherenceIssues,
  isCoherenceChecking,
  isCoherencePanelExpanded,
  onToggleCoherencePanelExpanded,
  onDismissCoherenceIssue,
  onDismissAllCoherenceIssues,
  onApplyCoherenceFix,
  onScrollToCoherenceSpan,
  i2vContext,
}: PromptCanvasProps): React.ReactElement {
  // Debug logging
  const debug = useDebugLogger('PromptCanvas', {
    mode: selectedMode,
    hasPrompt: !!displayedPrompt,
    hasHighlights: !!initialHighlights,
  });

  // Refs
  const outlineOverlayRef = useRef<HTMLDivElement>(null!);
  const { registerInsertHandler } = usePromptInsertionBus();
  const toast = useToast();
  const versionsDrawer = useDrawerState({
    defaultOpen: true,
    storageKey: 'prompt-optimizer:versions-drawer',
    position: 'bottom',
    desktopMode: 'push',
  });

  // Get model + layout state from context
  const {
    selectedModel,
    generationParams,
    setSelectedModel,
    setGenerationParams,
    setVideoTier,
  } = usePromptConfig();
  const { promptOptimizer, promptHistory } = usePromptServices();
  const { domain } = useGenerationControlsStoreState();
  const keyframes = domain.keyframes;
  const { hasActiveContinuityShot, currentShot, updateShot } = useWorkspaceSession();
  const hasShotContext = Boolean(hasActiveContinuityShot && currentShot);
  const {
    currentPromptUuid,
    currentPromptDocId,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,
  } = usePromptSession();
  const {
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setDisplayedPromptSilently,
    resetVersionEdits,
  } = usePromptActions();
  const {
    latestHighlightRef,
    versionEditCountRef,
    versionEditsRef,
  } = usePromptHighlights();
  const { lockedSpans, addLockedSpan, removeLockedSpan } = promptOptimizer;
  const serializedKeyframes = useMemo(() => serializeKeyframes(keyframes), [keyframes]);

  const effectiveAspectRatio = useMemo(() => {
    const fromParams = generationParams?.aspect_ratio;
    if (typeof fromParams === 'string' && fromParams.trim()) {
      return fromParams.trim();
    }
    return previewAspectRatio;
  }, [generationParams, previewAspectRatio]);

  const durationSeconds = useMemo(() => {
    const durationValue = generationParams?.duration_s;
    if (typeof durationValue === 'number') {
      return Number.isFinite(durationValue) ? durationValue : null;
    }
    if (typeof durationValue === 'string') {
      const parsed = Number.parseFloat(durationValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [generationParams?.duration_s]);

  const fpsNumber = useMemo(() => {
    const fpsValue = generationParams?.fps;
    return typeof fpsValue === 'number' && Number.isFinite(fpsValue)
      ? fpsValue
      : null;
  }, [generationParams?.fps]);

  const enableMLHighlighting = selectedMode === 'video' && showResults;

  const { state, setState } = usePromptCanvasState();
  const {
    showLegend,
    selectedSpanId,
    lastAppliedSpanId,
    hasInteracted,
    hoveredSpanId,
    showHighlights,
    generatedTimestamp,
  } = state;

  // Normalize to NFC so span offsets and rendered text stay aligned.
  const normalizedDisplayedPrompt = useMemo(
    () => (displayedPrompt == null ? null : sanitizeText(displayedPrompt)),
    [displayedPrompt]
  );
  const normalizedInputPrompt = useMemo(() => sanitizeText(inputPrompt ?? ''), [inputPrompt]);
  const editorDisplayText = showResults
    ? normalizedDisplayedPrompt ?? ''
    : normalizedInputPrompt;
  const isOptimizing = Boolean(isProcessing || isRefining);

  const {
    editorRef,
    editorWrapperRef,
    editorColumnRef,
    outputLocklineRef,
    lockButtonRef,
    exportMenuRef,
    generationsSheetOpen,
    setGenerationsSheetOpen,
    showDiff,
    setShowDiff,
    copied,
    handleCopy,
    handleCopyEvent,
    handleShare,
    showExportMenu,
    setShowExportMenu,
    modelFormatOptions,
    modelFormatValue,
    modelFormatLabel,
    handleModelFormatChange,
  } = useCanvasEditorState({
    showResults,
    displayedPrompt: editorDisplayText,
    inputPrompt,
    promptUuid,
    isOptimizing,
    genericOptimizedPrompt: promptOptimizer.genericOptimizedPrompt,
    onReoptimize,
    logAction: debug.logAction,
  });
  const {
    isOpen: autocompleteOpen,
    suggestions: autocompleteSuggestions,
    selectedIndex: autocompleteSelectedIndex,
    position: autocompletePosition,
    isLoading: autocompleteLoading,
    handleInputChange: handleAutocomplete,
    handleKeyDown: handleAutocompleteKeyDown,
    setSelectedIndex: setAutocompleteSelectedIndex,
    close: closeAutocomplete,
  } = useTriggerAutocomplete();

  const validateTriggers = useTriggerValidation(500);
  const hasCanvasContent = true;

  useEffect(() => {
    if (!hasCanvasContent) {
      setGenerationsSheetOpen(false);
      setShowDiff(false);
    }
  }, [hasCanvasContent, setGenerationsSheetOpen, setShowDiff]);

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions visibility state for contextual UI
  const isSuggestionsOpen = Boolean(
    selectedSpanId || (suggestionsData && suggestionsData.show !== false)
  );
  const {
    currentVersions,
    orderedVersions,
    selectedVersionId,
    promptVersionId,
    handleSelectVersion,
    handleCreateVersion,
    createVersionIfNeeded,
    handleGenerationsChange,
    syncVersionHighlights,
    versioningPromptUuid,
    versionsPanelProps,
    generationsPanelProps,
    handleReuseGeneration,
    handleToggleGenerationFavorite,
  } = useCanvasGenerations({
    hasShotContext,
    currentShot,
    updateShot,
    promptHistory,
    currentPromptUuid,
    currentPromptDocId,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,
    inputPrompt,
    normalizedDisplayedPrompt,
    selectedMode,
    selectedModel,
    generationParams,
    serializedKeyframes,
    promptOptimizer,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setDisplayedPromptSilently,
    latestHighlightRef,
    versionEditCountRef,
    versionEditsRef,
    resetVersionEdits,
    effectiveAspectRatio,
    showResults,
    normalizedInputPrompt,
    promptVersionId: activeVersionId,
    durationSeconds,
    fpsNumber,
    onInputPromptChange,
    onResetResultsForEditing,
    setSelectedModel,
    setVideoTier,
    setGenerationParams,
  });

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
  const handleSpanSelect = useCallback(
    (spanId: string | null): void => {
      if (!spanId) {
        setSelectedSpanId(null);
        return;
      }
      if (selectedSpanId && spanId === selectedSpanId) {
        setSelectedSpanId(null);
        return;
      }
      setSelectedSpanId(spanId);
    },
    [selectedSpanId, setSelectedSpanId]
  );
  const setHoveredSpanId = useCallback(
    (value: string | null) => setState({ hoveredSpanId: value }),
    [setState]
  );

  // Span bento overlay (state machine, dismissal, hover brightness)
  const {
    outlineOverlayState,
    outlineOverlayActive,
    openOutlineOverlay,
  } = useOutlineOverlay({
    outlineOverlayRef,
    editorRef: editorRef as React.RefObject<HTMLElement>,
    enableMLHighlighting,
    showHighlights,
    hoveredSpanId,
    setHoveredSpanId,
  });

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

      if (Array.isArray(result.spans) && result.signature) {
        const snapshot: HighlightSnapshot = {
          spans: result.spans,
          meta: result.meta ?? null,
          signature: result.signature,
          cacheId:
            result.cacheId ??
            (versioningPromptUuid ? String(versioningPromptUuid) : null),
          updatedAt: new Date().toISOString(),
        };
        syncVersionHighlights(snapshot, normalizedDisplayedPrompt ?? '');
      }
    },
    [
      enableMLHighlighting,
      onHighlightsPersist,
      debug,
      versioningPromptUuid,
      normalizedDisplayedPrompt,
      syncVersionHighlights,
    ]
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
    text: enableMLHighlighting ? (normalizedDisplayedPrompt ?? '') : '',
    initialData: memoizedInitialHighlights,
    initialDataVersion: initialHighlightsVersion,
    cacheKey: enableMLHighlighting && promptUuid ? String(promptUuid) : null,
    enabled: enableMLHighlighting && Boolean(normalizedDisplayedPrompt?.trim()),
    immediate: isInitialOptimization,
    maxSpans: PERFORMANCE_CONFIG.MAX_HIGHLIGHTS,
    minConfidence: PERFORMANCE_CONFIG.MIN_CONFIDENCE_SCORE,
    policy: labelingPolicy,
    templateVersion: i2vContext?.isI2VMode
      ? TEMPLATE_VERSIONS.SPAN_LABELING_I2V
      : TEMPLATE_VERSIONS.SPAN_LABELING_V1,
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

  const bentoSpans = useMemo(
    () =>
      parseResult.spans.map((span) => {
        const { confidence, category, ...rest } = span;
        return {
          ...rest,
          id: span.id ?? `span_${span.start}_${span.end}`,
          quote: span.quote ?? span.text ?? '',
          ...(typeof confidence === 'number' ? { confidence } : {}),
          ...(category !== undefined ? { category } : {}),
        };
      }),
    [parseResult.spans]
  );

  // Highlight rendering using extracted hook
  const highlightFingerprint = useHighlightFingerprint(enableMLHighlighting, {
    spans: parseResult.spans,
    displayText: parseResult.displayText,
  });

  // Memoize formatted HTML - DO NOT format if ML highlighting is enabled
  const { html: formattedHTML } = useMemo(() => {
    if (enableMLHighlighting) {
      return {
        html: escapeHTMLForMLHighlighting(normalizedDisplayedPrompt || ''),
      };
    }
    return formatTextToHTML(normalizedDisplayedPrompt ?? '');
  }, [normalizedDisplayedPrompt, enableMLHighlighting]);

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

  // Performance timer: Track when prompt appears on screen
  useEffect(() => {
    if (
      normalizedDisplayedPrompt &&
      normalizedDisplayedPrompt.trim() &&
      enableMLHighlighting
    ) {
      performance.mark('prompt-displayed-on-screen');
      debug.logEffect('Prompt displayed on screen', {
        promptLength: normalizedDisplayedPrompt.length,
        mlHighlighting: enableMLHighlighting,
      });
    }
  }, [normalizedDisplayedPrompt, enableMLHighlighting, debug]);

  const isOutputLoading = Boolean(isProcessing || isRefining);



  // Ambient motion: every ~6s, momentarily fade a random token
  useEffect(() => {
    if (!showHighlights) return;
    const root = editorRef.current;
    if (!root) return;
    const interval = window.setInterval(() => {
      const nodes = root.querySelectorAll('span.value-word[data-span-id]');
      if (!nodes.length) return;
      const node = nodes[
        Math.floor(Math.random() * nodes.length)
      ] as HTMLElement;
      node.classList.add('opacity-80');
      window.setTimeout(() => node.classList.remove('opacity-80'), 200);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [editorRef, showHighlights, normalizedDisplayedPrompt]);

  // Text selection hook
  const {
    handleTextSelection,
    handleHighlightClick,
    handleHighlightMouseDown,
  } = useTextSelection({
    selectedMode,
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt: normalizedDisplayedPrompt,
    parseResult,
    selectedSpanId,
    onFetchSuggestions,
    onSpanSelect: handleSpanSelect,
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
    editorText: editorDisplayText,
    formattedHTML,
    renderHtml: showResults,
  });

  useSpanSelectionEffects({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    enableMLHighlighting,
    selectedSpanId,
    displayedPrompt: normalizedDisplayedPrompt,
    setState,
  });

  useCoherenceSpanMarkers({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    enableMLHighlighting,
    showHighlights,
    affectedSpanIds: coherenceAffectedSpanIds ?? null,
    spanIssueMap: coherenceSpanIssueMap ?? null,
    highlightFingerprint,
  });

  useSuggestionSelection({
    selectedSpanId,
    hasInteracted,
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const isMod = isMac ? event.metaKey : event.ctrlKey;

      if (!isMod || !['1', '2', '3'].includes(event.key)) return;

      const index = Number.parseInt(event.key, 10) - 1;
      const version = orderedVersions[index];
      if (version?.versionId) {
        event.preventDefault();
        handleSelectVersion(version.versionId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectVersion, orderedVersions]);

  const handleExport = usePromptExport({
    inputPrompt,
    displayedPrompt: normalizedDisplayedPrompt,
    qualityScore,
    selectedMode,
    setShowExportMenu,
    toast,
    debug,
  });

  const {
    handleInput,
    handleEditorKeyDown,
    insertTrigger,
  } = useEditorInput({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    editorDisplayText,
    showResults,
    onInputPromptChange,
    onResetResultsForEditing,
    handleAutocomplete,
    handleAutocompleteKeyDown,
    closeAutocomplete,
    validateTriggers,
    registerInsertHandler,
    logAction: debug.logAction,
  });

  const {
    suggestionCount,
    inlineSuggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    suggestionsListRef,
    interactionSourceRef,
    handleSuggestionClickWithFeedback,
    closeInlinePopover,
    selectionLabel,
    customRequest,
    setCustomRequest,
    customRequestError,
    setCustomRequestError,
    handleCustomRequestSubmit,
    isCustomRequestDisabled,
    isCustomLoading,
    isInlineLoading,
    isInlineError,
    inlineErrorMessage,
    isInlineEmpty,
    showI2VLockIndicator,
    resolvedI2VReason,
    i2vMotionAlternatives,
    handleLockedAlternativeClick,
    handleApplyActiveSuggestion,
  } = useInlineSuggestionState({
    suggestionsData,
    selectedSpanId,
    setSelectedSpanId,
    parseResultSpans: parseResult.spans,
    normalizedDisplayedPrompt,
    ...(i2vContext !== undefined ? { i2vContext } : {}),
    ...(onSuggestionClick ? { onSuggestionClick } : {}),
    setState,
  });

  const i2v = useCanvasI2V({
    i2vContext,
    showI2VLockIndicator,
    resolvedI2VReason,
    i2vMotionAlternatives,
    handleLockedAlternativeClick,
  });

  const coherence = useCanvasCoherence({
    coherenceIssues,
    isCoherenceChecking,
    isCoherencePanelExpanded,
    onToggleCoherencePanelExpanded,
    onDismissCoherenceIssue,
    onDismissAllCoherenceIssues,
    onApplyCoherenceFix,
    onScrollToCoherenceSpan,
  });

  const focusSpan = useCallback(
    (spanId: string | null): void => {
      if (!spanId) return;

      setSelectedSpanId(spanId);

      const span = Array.isArray(parseResult?.spans)
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
    [
      onFetchSuggestions,
      normalizedDisplayedPrompt,
      parseResult.spans,
      editorRef,
      setSelectedSpanId,
    ]
  );

  // Render the component


  return (
    <PromptCanvasView
      selectedMode={selectedMode}
      outlineOverlayActive={outlineOverlayActive}
      outlineOverlayState={outlineOverlayState}
      outlineOverlayRef={outlineOverlayRef}
      bentoSpans={bentoSpans}
      editorRef={editorRef}
      onBentoSpanHoverChange={setHoveredSpanId}
      showLegend={showLegend}
      onCloseLegend={() => setShowLegend(false)}
      promptContext={promptContext}
      isSuggestionsOpen={isSuggestionsOpen}
      hasCanvasContent={hasCanvasContent}
      editorColumnRef={editorColumnRef}
      editorWrapperRef={editorWrapperRef}
      outputLocklineRef={outputLocklineRef}
      lockButtonRef={lockButtonRef}
      onTextSelection={handleTextSelection}
      onHighlightClick={handleHighlightClick}
      onHighlightMouseDown={handleHighlightMouseDown}
      onHighlightMouseEnter={handleHighlightMouseEnter}
      onHighlightMouseLeave={handleHighlightMouseLeave}
      onCopyEvent={handleCopyEvent}
      onInput={handleInput}
      onEditorKeyDown={handleEditorKeyDown}
      onEditorBlur={closeAutocomplete}
      autocompleteOpen={autocompleteOpen}
      autocompleteSuggestions={autocompleteSuggestions}
      autocompleteSelectedIndex={autocompleteSelectedIndex}
      autocompletePosition={autocompletePosition}
      autocompleteLoading={autocompleteLoading}
      onAutocompleteSelect={insertTrigger}
      onAutocompleteClose={closeAutocomplete}
      onAutocompleteIndexChange={setAutocompleteSelectedIndex}
      enableMLHighlighting={enableMLHighlighting}
      hoveredSpanId={hoveredSpanId}
      lockButtonPosition={lockButtonPosition}
      isHoveredLocked={isHoveredLocked}
      onToggleLock={handleToggleLock}
      onCancelHideLockButton={cancelHideLockButton}
      onLockButtonMouseLeave={handleLockButtonMouseLeave}
      isOutputLoading={isOutputLoading}
      selectedSpanId={selectedSpanId}
      suggestionCount={suggestionCount}
      suggestionsListRef={suggestionsListRef}
      inlineSuggestions={inlineSuggestions}
      activeSuggestionIndex={activeSuggestionIndex}
      onActiveSuggestionChange={setActiveSuggestionIndex}
      interactionSourceRef={interactionSourceRef}
      onSuggestionClick={handleSuggestionClickWithFeedback}
      onCloseInlinePopover={closeInlinePopover}
      selectionLabel={selectionLabel}
      onApplyActiveSuggestion={handleApplyActiveSuggestion}
      customRequest={customRequest}
      onCustomRequestChange={setCustomRequest}
      customRequestError={customRequestError}
      onCustomRequestErrorChange={setCustomRequestError}
      onCustomRequestSubmit={handleCustomRequestSubmit}
      isCustomRequestDisabled={isCustomRequestDisabled}
      isCustomLoading={isCustomLoading}
      isInlineLoading={isInlineLoading}
      isInlineError={isInlineError}
      inlineErrorMessage={inlineErrorMessage}
      isInlineEmpty={isInlineEmpty}
      showI2VLockIndicator={i2v.lockedSpanIndicators.showI2VLockIndicator}
      resolvedI2VReason={i2v.lockedSpanIndicators.reason}
      i2vMotionAlternatives={i2v.motionAlternatives}
      onLockedAlternativeClick={i2v.handleLockedAlternativeClick}
      i2vContext={i2v.i2vContext}
      coherenceIssues={coherence.coherenceIssues}
      isCoherenceChecking={coherence.isCoherenceChecking}
      isCoherencePanelExpanded={coherence.isCoherencePanelExpanded}
      onToggleCoherencePanelExpanded={coherence.onToggleCoherencePanelExpanded}
      onDismissCoherenceIssue={coherence.onDismissCoherenceIssue}
      onDismissAllCoherenceIssues={coherence.onDismissAllCoherenceIssues}
      onApplyCoherenceFix={coherence.onApplyCoherenceFix}
      onScrollToCoherenceSpan={coherence.onScrollToCoherenceSpan}
      versionsDrawer={versionsDrawer}
      versionsPanelProps={versionsPanelProps}
      generationsPanelProps={generationsPanelProps}
      onReuseGeneration={handleReuseGeneration}
      onToggleGenerationFavorite={handleToggleGenerationFavorite}
      generationsSheetOpen={generationsSheetOpen}
      onGenerationsSheetOpenChange={setGenerationsSheetOpen}
      showDiff={showDiff}
      onShowDiffChange={setShowDiff}
      inputPrompt={inputPrompt}
      normalizedDisplayedPrompt={normalizedDisplayedPrompt}
      openOutlineOverlay={openOutlineOverlay}
      copied={copied}
      onCopy={handleCopy}
      modelFormatValue={modelFormatValue}
      modelFormatLabel={modelFormatLabel}
      modelFormatOptions={modelFormatOptions}
      modelFormatDisabled={isOptimizing || modelFormatOptions.length === 0}
      onModelFormatChange={handleModelFormatChange}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      exportMenuRef={exportMenuRef}
      showExportMenu={showExportMenu}
      onToggleExportMenu={setShowExportMenu}
      onExport={handleExport}
      onShare={handleShare}
    />
  );
}
