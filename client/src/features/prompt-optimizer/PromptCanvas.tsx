import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
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
import { getSelectionOffsets, restoreSelectionFromOffsets } from '@features/prompt-optimizer/utils/textSelection';

import type {
  PromptCanvasProps,
  HighlightSnapshot,
} from './PromptCanvas/types';
import type { GenerationsPanelProps } from './GenerationsPanel/types';

import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import {
  escapeHTMLForMLHighlighting,
  formatTextToHTML,
} from './utils/textFormatting';
import { useSpanDataConversion } from './PromptCanvas/hooks/useSpanDataConversion';
import { useSuggestionDetection } from './PromptCanvas/hooks/useSuggestionDetection';
import { useParseResult } from './PromptCanvas/hooks/useParseResult';
import { usePromptCanvasState } from './PromptCanvas/hooks/usePromptCanvasState';
import { usePromptStatus } from './PromptCanvas/hooks/usePromptStatus';
import { useSpanSelectionEffects } from './PromptCanvas/hooks/useSpanSelectionEffects';
import { useCoherenceSpanMarkers } from './PromptCanvas/hooks/useCoherenceSpanMarkers';
import { useSuggestionSelection } from './PromptCanvas/hooks/useSuggestionSelection';
import { useTextSelection } from './PromptCanvas/hooks/useTextSelection';
import { useEditorContent } from './PromptCanvas/hooks/useEditorContent';
import { useKeyboardShortcuts } from './PromptCanvas/hooks/useKeyboardShortcuts';
import { usePromptExport } from './PromptCanvas/hooks/usePromptExport';
import { useLockedSpanInteractions } from './PromptCanvas/hooks/useLockedSpanInteractions';
import { useShotGenerations } from './PromptCanvas/hooks/useShotGenerations';
import { useTriggerValidation } from './PromptCanvas/hooks/useTriggerValidation';
import { useInlineSuggestionState } from './PromptCanvas/hooks/useInlineSuggestionState';
import { useVersionManagement } from './PromptCanvas/hooks/useVersionManagement';
import { scrollToSpan } from './SpanBentoGrid/utils/spanFormatting';
import { PromptCanvasView } from './PromptCanvas/components/PromptCanvasView';
import { useGenerationControlsStoreState } from './context/GenerationControlsStore';
import { useWorkspaceSession } from './context/WorkspaceSessionContext';
import { AI_MODEL_IDS, AI_MODEL_LABELS } from './components/constants';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptServices,
  usePromptSession,
} from './context/PromptStateContext';
import { serializeKeyframes } from './utils/keyframeTransforms';

// Main PromptCanvas Component
export function PromptCanvas({
  user = null,
  showResults = false,
  inputPrompt,
  onReoptimize,
  displayedPrompt,
  previewAspectRatio = null,
  qualityScore,
  selectedMode,
  promptUuid,
  promptContext,
  onDisplayedPromptChange,
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
  const editorRef = useRef<HTMLDivElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const editorColumnRef = useRef<HTMLDivElement>(null);
  const outputLocklineRef = useRef<HTMLDivElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const outlineOverlayRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [generationsSheetOpen, setGenerationsSheetOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const versionsDrawer = useDrawerState({
    defaultOpen: true,
    storageKey: 'prompt-optimizer:versions-drawer',
    position: 'bottom',
    desktopMode: 'push',
  });

  // Get model + layout state from context
  const { selectedModel, generationParams } = usePromptConfig();
  const { promptOptimizer, promptHistory } = usePromptServices();
  const { domain } = useGenerationControlsStoreState();
  const keyframes = domain.keyframes;
  const { isSequenceMode, currentShot, updateShot } = useWorkspaceSession();
  const hasShotContext = Boolean(isSequenceMode && currentShot);
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

  const modelFormatOptions = useMemo(
    () =>
      [...AI_MODEL_IDS]
        .map((id) => ({ id, label: AI_MODEL_LABELS[id] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const [modelFormatValue, setModelFormatValue] = useState<string>('auto');

  const modelFormatLabel = useMemo(() => {
    if (modelFormatValue === 'auto') {
      return 'Auto';
    }
    return (
      modelFormatOptions.find((option) => option.id === modelFormatValue)?.label ??
      modelFormatValue
    );
  }, [modelFormatOptions, modelFormatValue]);

  const { shotId, shotPromptEntry, updateShotVersions } = useShotGenerations({
    currentShot,
    updateShot,
  });

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  // Span bento overlay (collapsed by default on desktop)
  const [outlineOverlayState, setOutlineOverlayState] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const outlineOverlayActive = outlineOverlayState !== 'closed';

  const { state, setState } = usePromptCanvasState();
  const {
    showExportMenu,
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
  const hasCanvasContent = showResults || Boolean(normalizedDisplayedPrompt);

  useEffect(() => {
    if (!hasCanvasContent) {
      setGenerationsSheetOpen(false);
      setShowDiff(false);
    }
  }, [hasCanvasContent]);

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions visibility state for contextual UI
  const isSuggestionsOpen = Boolean(
    selectedSpanId || (suggestionsData && suggestionsData.show !== false)
  );
  const {
    currentVersions,
    orderedVersions,
    versionsForPanel,
    selectedVersionId,
    activeVersion,
    promptVersionId,
    handleSelectVersion,
    handleCreateVersion,
    createVersionIfNeeded,
    handleGenerationsChange,
    syncVersionHighlights,
    versioningPromptUuid,
  } = useVersionManagement({
    hasShotContext,
    shotId,
    shotPromptEntry,
    updateShotVersions,
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
  });

  const setShowExportMenu = useCallback(
    (value: boolean) => setState({ showExportMenu: value }),
    [setState]
  );

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu, setShowExportMenu]);

  useEffect(() => {
    if (!showDiff) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setShowDiff(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDiff]);
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

  const closeOutlineOverlay = useCallback((): void => {
    setHoveredSpanId(null);
    setOutlineOverlayState('closing');
    window.setTimeout(() => {
      setOutlineOverlayState('closed');
    }, 160);
  }, [setHoveredSpanId]);

  const openOutlineOverlay = useCallback((): void => {
    setOutlineOverlayState('opening');
    requestAnimationFrame(() => setOutlineOverlayState('open'));
  }, []);

  // On small screens, avoid a skinny rail and show the outline content by default.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    if (mql.matches) openOutlineOverlay();
  }, [openOutlineOverlay]);

  useEffect(() => {
    if (!outlineOverlayActive) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeOutlineOverlay();
      }
    };
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!outlineOverlayRef.current) return;
      if (outlineOverlayRef.current.contains(target)) return;
      closeOutlineOverlay();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [closeOutlineOverlay, outlineOverlayActive]);

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

  const isOptimizing = Boolean(isProcessing || isRefining);
  const isOutputLoading = Boolean(isProcessing || isRefining);

  const escapeAttr = (value: string): string => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
  };

  const inspectedSpanElementRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = editorRef.current;
    if (
      !root ||
      !enableMLHighlighting ||
      !showHighlights ||
      !outlineOverlayActive
    ) {
      if (inspectedSpanElementRef.current) {
        inspectedSpanElementRef.current.classList.remove('brightness-90');
        inspectedSpanElementRef.current = null;
      }
      return;
    }

    if (inspectedSpanElementRef.current) {
      inspectedSpanElementRef.current.classList.remove('brightness-90');
      inspectedSpanElementRef.current = null;
    }

    if (!hoveredSpanId) {
      return;
    }

    const el = root.querySelector(
      `[data-span-id="${escapeAttr(hoveredSpanId)}"]`
    ) as HTMLElement | null;
    if (!el) return;
    el.classList.add('brightness-90');
    inspectedSpanElementRef.current = el;
    return () => {
      el.classList.remove('brightness-90');
      if (inspectedSpanElementRef.current === el) {
        inspectedSpanElementRef.current = null;
      }
    };
  }, [
    enableMLHighlighting,
    hoveredSpanId,
    showHighlights,
    outlineOverlayActive,
  ]);



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
  }, [showHighlights, normalizedDisplayedPrompt]);

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

  // Event handlers
  const handleCopy = useCallback((): void => {
    debug.logAction('copy', {
      promptLength: normalizedDisplayedPrompt?.length ?? 0,
    });
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

  const handleModelFormatChange = useCallback(
    (nextValue: string): void => {
      if (isOptimizing) {
        return;
      }

      const nextModel = nextValue === 'auto' ? '' : nextValue.trim();
      const previousModel = modelFormatValue === 'auto' ? '' : modelFormatValue.trim();
      if (nextModel === previousModel) {
        return;
      }

      setModelFormatValue(nextValue === 'auto' ? 'auto' : nextModel);

      const genericPrompt =
        typeof promptOptimizer.genericOptimizedPrompt === 'string' &&
        promptOptimizer.genericOptimizedPrompt.trim()
          ? promptOptimizer.genericOptimizedPrompt
          : null;
      const hasGenericPrompt = Boolean(genericPrompt && genericPrompt.trim());

      debug.logAction('compileForModel', {
        targetModel: nextModel || 'generic-auto',
        source: nextValue === 'auto' ? 'auto' : 'manual',
        genericPromptAvailable: hasGenericPrompt,
      });

      if (!nextModel) {
        if (!hasGenericPrompt) {
          // Re-run optimization in model-agnostic mode so Auto remains truly generic.
          void onReoptimize(inputPrompt, { forceGenericTarget: true });
          return;
        }

        void onReoptimize(inputPrompt, {
          compileOnly: true,
          compilePrompt: genericPrompt,
          createVersion: true,
        });
        return;
      }

      if (hasGenericPrompt && genericPrompt) {
        void onReoptimize(inputPrompt, {
          compileOnly: true,
          compilePrompt: genericPrompt,
          createVersion: true,
          targetModel: nextModel,
        });
        return;
      }

      // Older sessions may not have a generic baseline yet; regenerate directly for this model.
      void onReoptimize(inputPrompt, {
        createVersion: true,
        targetModel: nextModel,
      });
    },
    [
      debug,
      inputPrompt,
      isOptimizing,
      onReoptimize,
      modelFormatValue,
      promptOptimizer.genericOptimizedPrompt,
      setModelFormatValue,
    ]
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>): void => {
      const newText =
        e.currentTarget.innerText || e.currentTarget.textContent || '';
      const normalizedText = sanitizeText(newText);
      debug.logAction('textEdit', {
        newLength: normalizedText.length,
        oldLength: normalizedDisplayedPrompt?.length ?? 0,
      });
      if (onDisplayedPromptChange) {
        onDisplayedPromptChange(normalizedText);
      }

      const selection = window.getSelection();
      let cursorPosition = normalizedText.length;
      let caretRect: DOMRect | null = null;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const offsets = getSelectionOffsets(editorRef.current, range);
        if (offsets) {
          cursorPosition = offsets.end;
        }
        const rect = range.getBoundingClientRect();
        if (rect && rect.width + rect.height > 0) {
          caretRect = rect;
        } else {
          const rects = range.getClientRects();
          if (rects.length > 0) {
            caretRect = rects[0];
          }
        }
      }

      handleAutocomplete(normalizedText, cursorPosition, editorRef.current || undefined, caretRect);
      validateTriggers(normalizedText);
    },
    [onDisplayedPromptChange, normalizedDisplayedPrompt, debug, handleAutocomplete, validateTriggers]
  );

  const insertTrigger = useCallback(
    (asset: { trigger: string }) => {
      const editor = editorRef.current;
      const text = normalizedDisplayedPrompt ?? '';
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const offsets = getSelectionOffsets(editor, range);
      const cursorPos = offsets?.end ?? text.length;
      const beforeCursor = text.slice(0, cursorPos);
      const triggerStart = beforeCursor.lastIndexOf('@');
      if (triggerStart === -1) {
        return;
      }

      const newText =
        text.slice(0, triggerStart) + asset.trigger + text.slice(cursorPos);
      onDisplayedPromptChange?.(newText);

      const newCursorPos = triggerStart + asset.trigger.length;
      setTimeout(() => {
        restoreSelectionFromOffsets(editor, newCursorPos, newCursorPos);
        editor.focus();
      }, 0);

      closeAutocomplete();
    },
    [normalizedDisplayedPrompt, onDisplayedPromptChange, closeAutocomplete]
  );

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const result = handleAutocompleteKeyDown(event);
      if (result && typeof result === 'object' && 'selected' in result) {
        insertTrigger(result.selected);
        return;
      }
      if (result === true) {
        return;
      }
    },
    [handleAutocompleteKeyDown, insertTrigger]
  );

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
    i2vContext,
    onSuggestionClick,
    setState,
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

  const versionsPanelProps = useMemo(
    () => ({
      versions: versionsForPanel,
      selectedVersionId,
      onSelectVersion: handleSelectVersion,
      onCreateVersion: handleCreateVersion,
    }),
    [versionsForPanel, selectedVersionId, handleSelectVersion, handleCreateVersion]
  );

  const generationsPanelProps = useMemo<GenerationsPanelProps>(
    () => ({
      prompt: normalizedDisplayedPrompt ?? '',
      promptVersionId,
      aspectRatio: effectiveAspectRatio ?? '16:9',
      duration: durationSeconds ?? undefined,
      fps: fpsNumber ?? undefined,
      generationParams: generationParams ?? undefined,
      initialGenerations: activeVersion?.generations ?? undefined,
      onGenerationsChange: handleGenerationsChange,
      versions: currentVersions,
      onRestoreVersion: handleSelectVersion,
      onCreateVersionIfNeeded: createVersionIfNeeded,
    }),
    [
      normalizedDisplayedPrompt,
      promptVersionId,
      effectiveAspectRatio,
      durationSeconds,
      fpsNumber,
      generationParams,
      activeVersion?.generations,
      handleGenerationsChange,
      currentVersions,
      handleSelectVersion,
      createVersionIfNeeded,
    ]
  );

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
      showI2VLockIndicator={showI2VLockIndicator}
      resolvedI2VReason={resolvedI2VReason}
      i2vMotionAlternatives={i2vMotionAlternatives}
      onLockedAlternativeClick={handleLockedAlternativeClick}
      i2vContext={i2vContext}
      coherenceIssues={coherenceIssues}
      isCoherenceChecking={isCoherenceChecking}
      isCoherencePanelExpanded={isCoherencePanelExpanded}
      onToggleCoherencePanelExpanded={onToggleCoherencePanelExpanded}
      onDismissCoherenceIssue={onDismissCoherenceIssue}
      onDismissAllCoherenceIssues={onDismissAllCoherenceIssues}
      onApplyCoherenceFix={onApplyCoherenceFix}
      onScrollToCoherenceSpan={onScrollToCoherenceSpan}
      versionsDrawer={versionsDrawer}
      versionsPanelProps={versionsPanelProps}
      generationsPanelProps={generationsPanelProps}
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
