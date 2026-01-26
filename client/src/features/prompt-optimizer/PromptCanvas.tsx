import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { LoadingDots } from '@components/LoadingDots';
import {
  Button,
  type ButtonProps,
} from '@promptstudio/system/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@promptstudio/system/components/ui/dialog';
import { Sheet, SheetContent } from '@promptstudio/system/components/ui/sheet';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Check,
  Copy,
  DotsThree,
  GridFour,
  Icon,
  Lock,
  LockOpen,
  X,
} from '@promptstudio/system/components/ui';

// External libraries
import { useToast } from '@components/Toast';
import { MAX_REQUEST_LENGTH } from '@components/SuggestionsPanel/config/panelConfig';
import { useCustomRequest } from '@components/SuggestionsPanel/hooks/useCustomRequest';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Internal absolute imports
import {
  PERFORMANCE_CONFIG,
  DEFAULT_LABELING_POLICY,
  TEMPLATE_VERSIONS,
} from '@config/performance.config';
import { logger } from '@/services/LoggingService';

// Relative imports - types first
import type {
  HighlightSnapshot,
  PromptCanvasProps,
  SuggestionItem,
} from './PromptCanvas/types';
import type { Generation } from './GenerationsPanel/types';

// Relative imports - implementations
import {
  createHighlightSignature,
  useSpanLabeling,
  sanitizeText,
} from '@/features/span-highlighting';
import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import { useHighlightRendering } from '@/features/span-highlighting';
import { useHighlightFingerprint } from '@/features/span-highlighting';
import type { SpanLabelingResult } from '@/features/span-highlighting/hooks/types';
import {
  formatTextToHTML,
  escapeHTMLForMLHighlighting,
} from './utils/textFormatting';
import { buildSuggestionContext } from './utils/enhancementSuggestionContext';
import { useSpanDataConversion } from './PromptCanvas/hooks/useSpanDataConversion';
import { useSuggestionDetection } from './PromptCanvas/hooks/useSuggestionDetection';
import { useParseResult } from './PromptCanvas/hooks/useParseResult';
import { usePromptCanvasState } from './PromptCanvas/hooks/usePromptCanvasState';
import { usePromptStatus } from './PromptCanvas/hooks/usePromptStatus';
import { useSpanSelectionEffects } from './PromptCanvas/hooks/useSpanSelectionEffects';
import { useCoherenceSpanMarkers } from './PromptCanvas/hooks/useCoherenceSpanMarkers';
import { useSuggestionFeedback } from './PromptCanvas/hooks/useSuggestionFeedback';
import { useSuggestionSelection } from './PromptCanvas/hooks/useSuggestionSelection';
import { useTextSelection } from './PromptCanvas/hooks/useTextSelection';
import { useEditorContent } from './PromptCanvas/hooks/useEditorContent';
import { useKeyboardShortcuts } from './PromptCanvas/hooks/useKeyboardShortcuts';
import { usePromptExport } from './PromptCanvas/hooks/usePromptExport';
import { useLockedSpanInteractions } from './PromptCanvas/hooks/useLockedSpanInteractions';
import { usePromptVersioning } from './PromptCanvas/hooks/usePromptVersioning';
import { scrollToSpan } from './SpanBentoGrid/utils/spanFormatting';
import { useTriggerAutocomplete } from '@features/assets/hooks/useTriggerAutocomplete';
import TriggerAutocomplete from '@features/assets/components/TriggerAutocomplete';
import { assetApi } from '@features/assets/api/assetApi';
import debounce from 'lodash/debounce';
import { getSelectionOffsets, restoreSelectionFromOffsets } from '@features/prompt-optimizer/utils/textSelection';

// Relative imports - components
import { CategoryLegend } from './components/CategoryLegend';
import { PromptEditor } from './components/PromptEditor';
import { VersionsPanel } from './components/VersionsPanel';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import { usePromptState } from './context/PromptStateContext';
import { cn } from '@/utils/cn';
import { GenerationsPanel } from './GenerationsPanel';
import {
  CollapsibleDrawer,
  useDrawerState,
} from '@components/CollapsibleDrawer';
import { CoherencePanel } from './components/coherence/CoherencePanel';

const CanvasButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, ...props }, ref) => (
    <Button ref={ref} variant={variant ?? 'canvas'} {...props} />
  )
);

CanvasButton.displayName = 'CanvasButton';

const log = logger.child('PromptCanvas');

type InlineSuggestion = {
  key: string;
  text: string;
  meta: string | null;
  item: SuggestionItem | string;
};

export const resolveVersionTimestamp = (
  value: string | number | undefined
): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return null;
};

export const isHighlightSnapshot = (value: unknown): value is HighlightSnapshot =>
  !!value &&
  typeof value === 'object' &&
  Array.isArray((value as HighlightSnapshot).spans);

// Main PromptCanvas Component
export function PromptCanvas({
  user = null,
  showResults = false,
  inputPrompt,
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
  onUndo = () => {},
  onRedo = () => {},
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
  const suggestionsListRef = useRef<HTMLDivElement>(null);
  const outlineOverlayRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [customRequestError, setCustomRequestError] = useState('');
  const [generationsSheetOpen, setGenerationsSheetOpen] = useState(false);
  const interactionSourceRef = useRef<'keyboard' | 'mouse' | 'auto'>('auto');
  const [showDiff, setShowDiff] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const versionsDrawer = useDrawerState({
    defaultOpen: true,
    storageKey: 'prompt-optimizer:versions-drawer',
    position: 'bottom',
    desktopMode: 'push',
  });

  // Refs for tracking previous state to prevent loops
  const previousSelectedSpanIdRef = useRef<string | null>(null);
  const previousSuggestionCountRef = useRef(0);

  // Get model + layout state from context
  const {
    selectedModel,
    generationParams,
    promptOptimizer,
    promptHistory,
    currentPromptUuid,
    currentPromptDocId,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    latestHighlightRef,
    versionEditCountRef,
    versionEditsRef,
    resetVersionEdits,
  } = usePromptState();
  const { lockedSpans, addLockedSpan, removeLockedSpan } = promptOptimizer;

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

  const debouncedValidateTriggers = useMemo(
    () =>
      debounce(async (text: string) => {
        if (!text.trim() || !text.includes('@')) {
          return;
        }
        try {
          const validation = await assetApi.validate(text);
          if (!validation.isValid) {
            log.warn('Missing triggers', {
              missingTriggers: validation.missingTriggers,
            });
          }
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          log.error('Trigger validation failed', errorObj);
        }
      }, 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedValidateTriggers.cancel();
    };
  }, [debouncedValidateTriggers]);
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
  const currentPromptEntry = useMemo(() => {
    if (!promptHistory.history.length) return null;
    return (
      promptHistory.history.find((item) => item.uuid === currentPromptUuid) ||
      promptHistory.history.find((item) => item.id === currentPromptDocId) ||
      null
    );
  }, [promptHistory.history, currentPromptUuid, currentPromptDocId]);
  const currentVersions = useMemo(
    () =>
      Array.isArray(currentPromptEntry?.versions)
        ? currentPromptEntry.versions
        : [],
    [currentPromptEntry]
  );
  const orderedVersions = useMemo(() => {
    if (currentVersions.length <= 1) return currentVersions;
    return [...currentVersions].sort((left, right) => {
      const leftTime = resolveVersionTimestamp(left.timestamp);
      const rightTime = resolveVersionTimestamp(right.timestamp);
      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return rightTime - leftTime;
    });
  }, [currentVersions]);
  const currentSignature = useMemo(() => {
    if (!normalizedDisplayedPrompt) return '';
    return createHighlightSignature(normalizedDisplayedPrompt);
  }, [normalizedDisplayedPrompt]);
  const latestVersionSignature = orderedVersions[0]?.signature ?? null;
  const hasEditsSinceLastVersion = Boolean(
    latestVersionSignature &&
      currentSignature &&
      latestVersionSignature !== currentSignature
  );
  const versionsForPanel = useMemo(
    () =>
      orderedVersions.map((entry, index) => ({
        ...entry,
        isDirty:
          index === 0 && hasEditsSinceLastVersion
            ? true
            : Boolean(entry.isDirty ?? (entry as { dirty?: boolean }).dirty),
      })),
    [orderedVersions, hasEditsSinceLastVersion]
  );
  const selectedVersionId =
    activeVersionId ?? versionsForPanel[0]?.versionId ?? '';
  const activeVersion = useMemo(() => {
    if (activeVersionId) {
      return currentVersions.find(
        (version) => version.versionId === activeVersionId
      ) ?? null;
    }
    return orderedVersions[0] ?? null;
  }, [activeVersionId, currentVersions, orderedVersions]);
  const promptVersionId = activeVersion?.versionId ?? selectedVersionId ?? '';
  const { syncVersionHighlights, syncVersionGenerations } = usePromptVersioning(
    {
      promptHistory,
      currentPromptUuid,
      currentPromptDocId,
      activeVersionId,
      latestHighlightRef,
      versionEditCountRef,
      versionEditsRef,
      resetVersionEdits,
      effectiveAspectRatio,
      generationParams,
      selectedModel,
    }
  );

  const handleSelectVersion = useCallback(
    (versionId: string): void => {
      const target =
        currentVersions.find((version) => version.versionId === versionId) ||
        orderedVersions.find((version) => version.versionId === versionId) ||
        null;
      if (!target) return;
      const promptText = typeof target.prompt === 'string' ? target.prompt : '';
      if (!promptText.trim()) return;

      setActiveVersionId(versionId);
      promptOptimizer.setOptimizedPrompt(promptText);
      setDisplayedPromptSilently(promptText);

      const highlights = isHighlightSnapshot(target.highlights)
        ? target.highlights
        : null;
      applyInitialHighlightSnapshot(highlights, {
        bumpVersion: true,
        markPersisted: false,
      });
      resetEditStacks();
      resetVersionEdits();
    },
    [
      applyInitialHighlightSnapshot,
      currentVersions,
      orderedVersions,
      promptOptimizer,
      resetEditStacks,
      resetVersionEdits,
      setActiveVersionId,
      setDisplayedPromptSilently,
    ]
  );

  const ensureDraftEntry = useCallback((): { uuid: string; docId: string } => {
    if (currentPromptUuid) {
      return { uuid: currentPromptUuid, docId: currentPromptDocId ?? '' };
    }
    const draft = promptHistory.createDraft({
      mode: selectedMode,
      targetModel: selectedModel?.trim() ? selectedModel.trim() : null,
      generationParams: (generationParams as unknown as Record<string, unknown>) ?? null,
    });
    setCurrentPromptUuid(draft.uuid);
    setCurrentPromptDocId(draft.id);
    return { uuid: draft.uuid, docId: draft.id };
  }, [
    currentPromptDocId,
    currentPromptUuid,
    generationParams,
    promptHistory,
    selectedMode,
    selectedModel,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
  ]);

  const handleCreateVersion = useCallback((): void => {
    if (!currentVersions) return;
    const promptText =
      (normalizedDisplayedPrompt ?? '').trim() || (inputPrompt ?? '').trim();
    if (!promptText) return;
    const { uuid, docId } = ensureDraftEntry();

    const signature = createHighlightSignature(promptText);
    const lastSignature =
      currentVersions[currentVersions.length - 1]?.signature ?? null;
    if (lastSignature && lastSignature === signature) {
      return;
    }

    const editCount = versionEditCountRef.current;
    const edits = versionEditsRef.current.length
      ? [...versionEditsRef.current]
      : [];
    const nextVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: `v${currentVersions.length + 1}`,
      signature,
      prompt: promptText,
      timestamp: new Date().toISOString(),
      highlights: latestHighlightRef.current ?? null,
      preview: null,
      video: null,
      ...(editCount > 0 ? { editCount } : {}),
      ...(edits.length ? { edits } : {}),
    };

    promptHistory.updateEntryVersions(uuid, docId || null, [
      ...currentVersions,
      nextVersion,
    ]);
    setActiveVersionId(nextVersion.versionId);
    resetVersionEdits();
  }, [
    ensureDraftEntry,
    currentVersions,
    inputPrompt,
    latestHighlightRef,
    normalizedDisplayedPrompt,
    promptHistory,
    resetVersionEdits,
    setActiveVersionId,
    versionEditCountRef,
    versionEditsRef,
  ]);

  const createVersionIfNeeded = useCallback((): string => {
    const promptText =
      (normalizedDisplayedPrompt ?? '').trim() || (inputPrompt ?? '').trim();
    if (!promptText) {
      return activeVersion?.versionId ?? '';
    }
    const { uuid, docId } = ensureDraftEntry();

    const signature = createHighlightSignature(promptText);

    if (!currentVersions.length) {
      const editCount = versionEditCountRef.current;
      const edits = versionEditsRef.current.length
        ? [...versionEditsRef.current]
        : [];
      const newVersion = {
        versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: 'v1',
        signature,
        prompt: promptText,
        timestamp: new Date().toISOString(),
        highlights: latestHighlightRef.current ?? null,
        preview: null,
        video: null,
        generations: [],
        ...(editCount > 0 ? { editCount } : {}),
        ...(edits.length ? { edits } : {}),
      };

      promptHistory.updateEntryVersions(uuid, docId || null, [
        newVersion,
      ]);
      setActiveVersionId(newVersion.versionId);
      resetVersionEdits();
      return newVersion.versionId;
    }

    const lastVersion = currentVersions[currentVersions.length - 1];
    if (lastVersion && lastVersion.signature === signature) {
      return lastVersion.versionId;
    }

    const editCount = versionEditCountRef.current;
    const edits = versionEditsRef.current.length
      ? [...versionEditsRef.current]
      : [];
    const newVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: `v${currentVersions.length + 1}`,
      signature,
      prompt: promptText,
      timestamp: new Date().toISOString(),
      highlights: latestHighlightRef.current ?? null,
      preview: null,
      video: null,
      generations: [],
      ...(editCount > 0 ? { editCount } : {}),
      ...(edits.length ? { edits } : {}),
    };

    promptHistory.updateEntryVersions(uuid, docId || null, [
      ...currentVersions,
      newVersion,
    ]);
    setActiveVersionId(newVersion.versionId);
    resetVersionEdits();
    return newVersion.versionId;
  }, [
    activeVersion?.versionId,
    currentVersions,
    ensureDraftEntry,
    inputPrompt,
    latestHighlightRef,
    normalizedDisplayedPrompt,
    promptHistory,
    resetVersionEdits,
    setActiveVersionId,
    versionEditCountRef,
    versionEditsRef,
  ]);

  const handleGenerationsChange = useCallback(
    (nextGenerations: Generation[]) => {
      syncVersionGenerations(nextGenerations);
    },
    [syncVersionGenerations]
  );

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
            (currentPromptUuid ? String(currentPromptUuid) : null),
          updatedAt: new Date().toISOString(),
        };
        syncVersionHighlights(snapshot, normalizedDisplayedPrompt ?? '');
      }
    },
    [
      enableMLHighlighting,
      onHighlightsPersist,
      debug,
      currentPromptUuid,
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

  const closeInlinePopover = useCallback((): void => {
    setSelectedSpanId(null);
    setActiveSuggestionIndex(0);
    suggestionsData?.onClose?.();
  }, [setSelectedSpanId, suggestionsData]);

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
      debouncedValidateTriggers(normalizedText);
    },
    [onDisplayedPromptChange, normalizedDisplayedPrompt, debug, handleAutocomplete, debouncedValidateTriggers]
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

  const { handleSuggestionClickWithFeedback } = useSuggestionFeedback({
    suggestionsData,
    selectedSpanId,
    ...(onSuggestionClick ? { onSuggestionClick } : {}),
    setState,
  });

  const selectedSpan = useMemo(() => {
    if (!selectedSpanId || !Array.isArray(parseResult?.spans)) {
      return null;
    }
    return (
      parseResult.spans.find((span) => {
        const candidateId =
          typeof span?.id === 'string' && span.id.length > 0
            ? span.id
            : `span_${span.start}_${span.end}`;
        return candidateId === selectedSpanId;
      }) ?? null
    );
  }, [parseResult?.spans, selectedSpanId]);

  const selectedSpanText = useMemo(() => {
    if (!selectedSpan) return '';
    const displayQuote =
      typeof selectedSpan.displayQuote === 'string' &&
      selectedSpan.displayQuote.trim()
        ? selectedSpan.displayQuote
        : '';
    const quote =
      typeof selectedSpan.quote === 'string' && selectedSpan.quote.trim()
        ? selectedSpan.quote
        : '';
    const text =
      typeof selectedSpan.text === 'string' && selectedSpan.text.trim()
        ? selectedSpan.text
        : '';
    return (displayQuote || quote || text).trim();
  }, [selectedSpan]);

  const inlineSuggestions = useMemo<InlineSuggestion[]>(() => {
    const rawSuggestions = (suggestionsData?.suggestions ?? []) as Array<
      SuggestionItem | string
    >;
    return rawSuggestions
      .map((item, index) => {
        const rawText =
          typeof item === 'string'
            ? item
            : typeof item?.text === 'string'
              ? item.text
              : typeof (item as { label?: string } | null)?.label === 'string'
                ? (item as { label?: string }).label
                : '';
        const text = (rawText ?? '').trim();

        if (!text) {
          return null;
        }

        const meta =
          typeof item === 'object' && item
            ? typeof item.compatibility === 'number'
              ? `${Math.round(item.compatibility * 100)}% match`
              : typeof item.category === 'string'
                ? item.category
                : typeof item.explanation === 'string'
                  ? item.explanation
                  : null
            : null;

        return {
          key: (item as { id?: string } | null)?.id ?? `${text}_${index}`,
          text,
          meta,
          item,
        };
      })
      .filter((item): item is InlineSuggestion => item !== null);
  }, [suggestionsData?.suggestions]);

  const suggestionCount = inlineSuggestions.length;
  const selectionMatches = useMemo(() => {
    if (!selectedSpanText || !suggestionsData?.selectedText) {
      return true;
    }
    return suggestionsData.selectedText.trim() === selectedSpanText.trim();
  }, [selectedSpanText, suggestionsData?.selectedText]);

  const isInlineLoading = Boolean(
    selectedSpanId &&
      (suggestionsData?.isLoading || !suggestionsData || !selectionMatches)
  );
  const isInlineError = Boolean(suggestionsData?.isError);
  const inlineErrorMessage =
    typeof suggestionsData?.errorMessage === 'string' &&
    suggestionsData.errorMessage.trim()
      ? suggestionsData.errorMessage.trim()
      : 'Failed to load suggestions.';
  const isInlineEmpty = Boolean(
    selectedSpanId &&
      !isInlineLoading &&
      !isInlineError &&
      suggestionCount === 0
  );
  const selectionLabel =
    selectedSpanText || suggestionsData?.selectedText || '';
  const customRequestSelection = selectionLabel.trim();
  const customRequestPrompt = (
    suggestionsData?.fullPrompt ||
    normalizedDisplayedPrompt ||
    ''
  ).trim();

  const customRequestPreferIndex = useMemo(() => {
    const preferIndexRaw =
      suggestionsData?.metadata?.span?.start ??
      suggestionsData?.metadata?.start ??
      suggestionsData?.offsets?.start ??
      null;
    return typeof preferIndexRaw === 'number' && Number.isFinite(preferIndexRaw)
      ? preferIndexRaw
      : null;
  }, [suggestionsData?.metadata, suggestionsData?.offsets]);

  const customRequestContext = useMemo(() => {
    if (!customRequestSelection || !customRequestPrompt) {
      return null;
    }
    const normalizedPrompt = customRequestPrompt.normalize('NFC');
    const normalizedHighlight = customRequestSelection.normalize('NFC');
    return buildSuggestionContext(
      normalizedPrompt,
      normalizedHighlight,
      customRequestPreferIndex,
      1000
    );
  }, [customRequestSelection, customRequestPrompt, customRequestPreferIndex]);

  const {
    customRequest,
    setCustomRequest,
    handleCustomRequest,
    isCustomLoading,
  } = useCustomRequest({
    selectedText: customRequestSelection,
    fullPrompt: customRequestPrompt,
    contextBefore: customRequestContext?.contextBefore ?? '',
    contextAfter: customRequestContext?.contextAfter ?? '',
    metadata: suggestionsData?.metadata ?? null,
    setSuggestions: suggestionsData?.setSuggestions ?? (() => {}),
    setError: setCustomRequestError,
  });

  const isCustomRequestReady =
    Boolean(customRequestSelection && customRequestPrompt) && !isInlineLoading;
  const isCustomRequestDisabled =
    !isCustomRequestReady || !customRequest.trim() || isCustomLoading;

  const handleCustomRequestSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (isCustomRequestDisabled) return;
      void handleCustomRequest();
    },
    [handleCustomRequest, isCustomRequestDisabled]
  );

  useEffect(() => {
    setCustomRequest('');
    setCustomRequestError('');
    // Note: setCustomRequest is stable (from useState) so not needed in deps
  }, [selectedSpanId]);

  useEffect(() => {
    const justOpened =
      previousSelectedSpanIdRef.current !== selectedSpanId && selectedSpanId;
    const countChanged = suggestionCount !== previousSuggestionCountRef.current;

    if (selectedSpanId && (justOpened || countChanged)) {
      interactionSourceRef.current = 'auto';
      setActiveSuggestionIndex(0);
    }

    previousSelectedSpanIdRef.current = selectedSpanId;
    previousSuggestionCountRef.current = suggestionCount;
  }, [selectedSpanId, suggestionCount]);

  useEffect(() => {
    if (!selectedSpanId || !suggestionsListRef.current) return;

    // Skip scrolling if the change came from mouse hover to prevent fighting/looping
    if (interactionSourceRef.current === 'mouse') return;

    const list = suggestionsListRef.current;
    const activeItem = list.querySelector(
      `[data-index="${activeSuggestionIndex}"]`
    ) as HTMLElement | null;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedSpanId, activeSuggestionIndex]);

  const handleApplyActiveSuggestion = useCallback((): void => {
    const active = inlineSuggestions[activeSuggestionIndex];
    if (!active) return;
    handleSuggestionClickWithFeedback(active.item);
  }, [
    activeSuggestionIndex,
    inlineSuggestions,
    handleSuggestionClickWithFeedback,
  ]);

  useEffect(() => {
    if (!selectedSpanId) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isCustomRequestTarget =
        !!target && Boolean(target.closest?.('[data-suggest-custom]'));

      if (event.key === 'Escape') {
        event.preventDefault();
        closeInlinePopover();
        return;
      }

      // Don't hijack navigation while typing into inputs (including the custom request box).
      if (isTextInput || isCustomRequestTarget) {
        return;
      }

      if (!suggestionCount) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        interactionSourceRef.current = 'keyboard';
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestionCount);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        interactionSourceRef.current = 'keyboard';
        setActiveSuggestionIndex((prev) =>
          prev - 1 < 0 ? suggestionCount - 1 : prev - 1
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleApplyActiveSuggestion();
        closeInlinePopover();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedSpanId,
    suggestionCount,
    closeInlinePopover,
    handleApplyActiveSuggestion,
  ]);

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

  // NOTE: Phosphor icons require numeric size values, not CSS variables.
  // CSS variables like 'var(--ps-icon-md)' cause icons to render as dots.
  const iconSizes = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
  } as const;

  // Render the component
  return (
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col pb-20 lg:pb-0')}
      data-mode={selectedMode}
      data-outline-open={outlineOverlayActive ? 'true' : 'false'}
    >
      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext?.hasContext() ?? false}
        isSuggestionsOpen={isSuggestionsOpen}
      />

      {outlineOverlayActive && (
        <div
          ref={outlineOverlayRef}
          className={cn(
            'z-modal border-border bg-surface-1 absolute bottom-6 left-6 top-6 flex w-96 flex-col overflow-hidden rounded-xl border shadow-lg',
            'ps-animate-scale-in'
          )}
          data-state={outlineOverlayState}
          role="dialog"
          aria-label="Prompt structure"
        >
          <div className="border-border border-b p-4">
            <div className="text-body-lg text-foreground font-semibold">
              Prompt Structure
            </div>
            <div className="text-meta text-muted mt-1">
              Semantic breakdown used for generation
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <HighlightingErrorBoundary>
              <SpanBentoGrid
                spans={bentoSpans}
                editorRef={editorRef as React.RefObject<HTMLElement>}
                onSpanHoverChange={setHoveredSpanId}
              />
            </HighlightingErrorBoundary>
          </div>
          <div className="border-border p-ps-3 text-meta text-muted border-t">
            Hover a token to locate it in the prompt
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div
        className={cn(
          'gap-ps-3 p-ps-3 relative flex min-h-0 flex-1 flex-col',
          outlineOverlayActive && 'pointer-events-none opacity-60'
        )}
      >
        {/* Empty State - shown when no prompt yet */}
        {!hasCanvasContent ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <div className="max-w-md space-y-4">
              <h2 className="text-heading-24 text-foreground font-semibold">
                Describe your shot
              </h2>
              <p className="text-body text-muted">
                Enter a rough prompt in the bar above and we'll optimize it for
                cinematic video generation.
              </p>
              <div className="pt-4">
                <p className="text-label-sm text-faint">
                  Tip: Press{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-muted font-mono text-xs">
                    ⌘
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-muted font-mono text-xs">
                    Enter
                  </kbd>{' '}
                  to optimize
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="gap-ps-4 lg:gap-ps-5 flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="gap-ps-3 flex min-h-0 min-w-0 flex-1 flex-col self-stretch lg:min-w-80 lg:flex-[9]">
              {/* Main Editor Area - Optimized Prompt */}
              <div
                ref={editorColumnRef}
                className={cn('flex min-h-0 min-w-0 flex-1 flex-col')}
              >
                <div className="flex min-h-[200px] flex-auto flex-col overflow-y-auto lg:min-h-[300px]">
                  <div className="pb-ps-card flex h-full min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden px-0">
                    <div
                      className={cn(
                        'flex min-h-0 flex-1 flex-col transition-opacity',
                        isOutputLoading && 'opacity-80'
                      )}
                    >
                      <div className="gap-ps-3 px-ps-6 flex h-ps-9 items-center justify-between">
                        <span className="text-label-sm text-muted">
                          Optimized Editor
                        </span>
                        <div className="flex flex-wrap items-center gap-ps-2">
                          {!outlineOverlayActive && (
                            <CanvasButton
                              type="button"
                              size="icon-sm"
                              onClick={openOutlineOverlay}
                              aria-label="Open outline"
                              title="Open outline"
                            >
                              <Icon
                                icon={GridFour}
                                size="sm"
                                weight="bold"
                                aria-hidden="true"
                              />
                            </CanvasButton>
                          )}
                          <CanvasButton
                            type="button"
                            size="icon-sm"
                            onClick={handleCopy}
                            aria-label={
                              copied
                                ? 'Copied to clipboard'
                                : 'Copy to clipboard'
                            }
                            title={copied ? 'Copied' : 'Copy'}
                          >
                            {copied ? (
                              <Icon
                                icon={Check}
                                size="sm"
                                weight="bold"
                                aria-hidden="true"
                              />
                            ) : (
                              <Icon
                                icon={Copy}
                                size="sm"
                                weight="bold"
                                aria-hidden="true"
                              />
                            )}
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            size="icon-sm"
                            onClick={onUndo}
                            disabled={!canUndo}
                            aria-label="Undo"
                          >
                            <Icon
                              icon={ArrowCounterClockwise}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            size="icon-sm"
                            onClick={onRedo}
                            disabled={!canRedo}
                            aria-label="Redo"
                          >
                            <Icon
                              icon={ArrowClockwise}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          </CanvasButton>
                          <div className="relative" ref={exportMenuRef}>
                            <CanvasButton
                              type="button"
                              size="icon-sm"
                              onClick={() =>
                                setShowExportMenu(!showExportMenu)
                              }
                              aria-expanded={showExportMenu}
                              aria-haspopup="menu"
                              aria-label="More actions"
                              title="More"
                            >
                              <Icon
                                icon={DotsThree}
                                size="sm"
                                weight="bold"
                                aria-hidden="true"
                              />
                            </CanvasButton>
                            {showExportMenu && (
                              <div
                                className="border-border bg-surface-3 absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border p-2 shadow-md"
                                role="menu"
                              >
                                <CanvasButton
                                  type="button"
                                  onClick={() => {
                                    setShowDiff(true);
                                    setShowExportMenu(false);
                                  }}
                                  role="menuitem"
                                  className="text-label-sm text-muted hover:bg-surface-3 hover:text-foreground w-full justify-start rounded-md px-3 py-2 transition-colors"
                                >
                                  Compare versions
                                </CanvasButton>
                                <div
                                  className="bg-border my-1 h-px"
                                  aria-hidden="true"
                                />
                                <CanvasButton
                                  type="button"
                                  onClick={() => {
                                    handleExport('text');
                                    setShowExportMenu(false);
                                  }}
                                  role="menuitem"
                                  className="text-label-sm text-muted hover:bg-surface-3 hover:text-foreground w-full justify-start rounded-md px-3 py-2 transition-colors"
                                >
                                  Export .txt
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  onClick={() => {
                                    handleExport('markdown');
                                    setShowExportMenu(false);
                                  }}
                                  role="menuitem"
                                  className="text-label-sm text-muted hover:bg-surface-3 hover:text-foreground w-full justify-start rounded-md px-3 py-2 transition-colors"
                                >
                                  Export .md
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  onClick={() => {
                                    handleExport('json');
                                    setShowExportMenu(false);
                                  }}
                                  role="menuitem"
                                  className="text-label-sm text-muted hover:bg-surface-3 hover:text-foreground w-full justify-start rounded-md px-3 py-2 transition-colors"
                                >
                                  Export .json
                                </CanvasButton>
                                <div
                                  className="bg-border my-1 h-px"
                                  aria-hidden="true"
                                />
                                <CanvasButton
                                  type="button"
                                  onClick={() => {
                                    handleShare();
                                    setShowExportMenu(false);
                                  }}
                                  role="menuitem"
                                  className="text-label-sm text-muted hover:bg-surface-3 hover:text-foreground w-full justify-start rounded-md px-3 py-2 transition-colors"
                                >
                                  Share
                                </CanvasButton>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="px-ps-3 pb-ps-card pt-ps-4 flex min-h-0 flex-1 flex-col">
                        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                          <div
                            className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col"
                            aria-busy={isOutputLoading}
                            ref={editorWrapperRef}
                          >
                            <PromptEditor
                              ref={editorRef as React.RefObject<HTMLDivElement>}
                              className="px-ps-3 py-ps-4 text-body-xl text-foreground-warm min-h-0 min-h-44 w-full flex-1 overflow-y-auto whitespace-pre-wrap outline-none"
                              onTextSelection={handleTextSelection}
                              onHighlightClick={handleHighlightClick}
                              onHighlightMouseDown={handleHighlightMouseDown}
                              onHighlightMouseEnter={handleHighlightMouseEnter}
                              onHighlightMouseLeave={handleHighlightMouseLeave}
                              onCopyEvent={handleCopyEvent}
                              onInput={handleInput}
                              onKeyDown={handleEditorKeyDown}
                              onBlur={() => closeAutocomplete()}
                            />
                            {autocompleteOpen && (
                              <TriggerAutocomplete
                                isOpen={autocompleteOpen}
                                suggestions={autocompleteSuggestions}
                                selectedIndex={autocompleteSelectedIndex}
                                position={autocompletePosition}
                                isLoading={autocompleteLoading}
                                onSelect={(asset) => {
                                  insertTrigger(asset);
                                }}
                                onClose={closeAutocomplete}
                                setSelectedIndex={setAutocompleteSelectedIndex}
                              />
                            )}
                            <div
                              ref={outputLocklineRef}
                              className={cn(
                                'bg-border mt-4 h-px w-full origin-left scale-x-0 transition-transform duration-300',
                                isOutputLoading && 'scale-x-100'
                              )}
                              aria-hidden="true"
                            />
                            {enableMLHighlighting &&
                              !outlineOverlayActive &&
                              hoveredSpanId &&
                              lockButtonPosition &&
                              !isOutputLoading && (
                                <CanvasButton
                                  ref={lockButtonRef}
                                  type="button"
                                  onClick={handleToggleLock}
                                  onMouseEnter={cancelHideLockButton}
                                  onMouseLeave={handleLockButtonMouseLeave}
                                  onMouseDown={(e) => e.preventDefault()}
                                  className={cn(
                                    'border-border bg-surface-2 text-muted absolute z-10 -mt-1.5 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border shadow-md transition-colors',
                                    'hover:border-border-strong hover:bg-surface-3 hover:text-foreground',
                                    isHoveredLocked &&
                                      'border-accent text-foreground'
                                  )}
                                  style={{
                                    top: `${lockButtonPosition.top}px`,
                                    left: `${lockButtonPosition.left}px`,
                                  }}
                                  data-locked={
                                    isHoveredLocked ? 'true' : 'false'
                                  }
                                  aria-label={
                                    isHoveredLocked
                                      ? 'Unlock span'
                                      : 'Lock span'
                                  }
                                  title={
                                    isHoveredLocked
                                      ? 'Unlock span'
                                      : 'Lock span'
                                  }
                                  aria-pressed={isHoveredLocked}
                                >
                                  {isHoveredLocked ? (
                                    <Icon
                                      icon={LockOpen}
                                      size="sm"
                                      weight="bold"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Icon
                                      icon={Lock}
                                      size="sm"
                                      weight="bold"
                                      aria-hidden="true"
                                    />
                                  )}
                                </CanvasButton>
                              )}
                            {isOutputLoading && (
                              <div
                                className="bg-surface-3/80 p-ps-4 absolute inset-0 flex items-start justify-start backdrop-blur-sm"
                                role="status"
                                aria-live="polite"
                                aria-label="Optimizing prompt"
                              >
                                <LoadingDots size={3} className="text-faint" />
                              </div>
                            )}
                          </div>

                        {selectedSpanId ? (
                          <aside
                            className="border-border bg-surface-2 absolute right-0 top-0 bottom-0 z-20 flex w-80 min-w-0 flex-col overflow-hidden rounded-lg border shadow-lg"
                            aria-label="Suggestions"
                          >
                            <div className="border-border flex items-center justify-between gap-3 border-b px-3 py-2">
                              <div className="text-body-sm text-foreground flex items-center gap-2 font-semibold">
                                Suggestions
                                <span className="bg-surface-3 text-label-sm text-muted inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5">
                                  {suggestionCount}
                                </span>
                              </div>
                              <div
                                className="text-muted hidden items-center gap-1 sm:flex"
                                aria-hidden="true"
                              >
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Up
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Down
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Enter
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Esc
                                </span>
                              </div>
                            </div>

                            <div
                              className="border-border border-b px-3 py-2"
                              data-suggest-custom
                            >
                              <form
                                className="flex items-center gap-2"
                                onSubmit={handleCustomRequestSubmit}
                              >
                                <Textarea
                                  id="inline-custom-request"
                                  value={customRequest}
                                  onChange={(event) => {
                                    setCustomRequest(event.target.value);
                                    if (customRequestError) {
                                      setCustomRequestError('');
                                    }
                                  }}
                                  placeholder="Add a specific change (e.g. football field)"
                                  className="border-border bg-surface-2 text-body-sm text-foreground placeholder:text-faint focus-visible:ring-accent min-h-9 flex-1 resize-none rounded-lg border px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                                  maxLength={MAX_REQUEST_LENGTH}
                                  rows={1}
                                  aria-label="Custom suggestion request"
                                />
                                <CanvasButton
                                  type="submit"
                                  className={cn(
                                    'border-accent bg-accent text-label-sm text-app h-9 rounded-lg border px-3 font-semibold shadow-sm transition hover:opacity-90',
                                    isCustomRequestDisabled && 'opacity-50'
                                  )}
                                  disabled={isCustomRequestDisabled}
                                  aria-busy={isCustomLoading}
                                >
                                  {isCustomLoading ? 'Applying...' : 'Apply'}
                                </CanvasButton>
                              </form>
                              {customRequestError && (
                                <div
                                  className="border-error/30 bg-error/10 text-label-sm text-error mt-2 rounded-lg border px-3 py-2"
                                  role="alert"
                                >
                                  {customRequestError}
                                </div>
                              )}
                            </div>

                            {isInlineError && (
                              <div
                                className="border-error/30 bg-error/10 text-label-sm text-error mx-3 mt-2 rounded-lg border px-3 py-2"
                                role="alert"
                              >
                                {inlineErrorMessage}
                              </div>
                            )}

                            {isInlineLoading && (
                              <div className="flex flex-1 flex-col gap-2 px-3 py-2">
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                              </div>
                            )}

                            {!isInlineLoading &&
                              !isInlineError &&
                              suggestionCount > 0 && (
                                <div
                                  className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2"
                                  ref={suggestionsListRef}
                                >
                                  {inlineSuggestions.map(
                                    (suggestion, index) => (
                                      <div
                                        key={suggestion.key}
                                        data-index={index}
                                        data-selected={
                                          activeSuggestionIndex === index
                                            ? 'true'
                                            : 'false'
                                        }
                                        className={cn(
                                          'border-border bg-surface-2 text-body-sm text-foreground flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
                                          'hover:border-border-strong hover:bg-surface-3',
                                          activeSuggestionIndex === index &&
                                            'border-accent/50 bg-accent/10'
                                        )}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onMouseEnter={() => {
                                          interactionSourceRef.current =
                                            'mouse';
                                          setActiveSuggestionIndex(index);
                                        }}
                                        onClick={() => {
                                          handleSuggestionClickWithFeedback(
                                            suggestion.item
                                          );
                                          closeInlinePopover();
                                        }}
                                        role="button"
                                        tabIndex={0}
                                      >
                                        <div className="text-body-sm text-foreground min-w-0">
                                          {suggestion.text}
                                        </div>
                                        {index === 0 ? (
                                          <span className="bg-accent/10 text-label-sm text-accent inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 font-semibold">
                                            Best match
                                          </span>
                                        ) : suggestion.meta ? (
                                          <div className="text-label-sm text-muted flex-shrink-0">
                                            {suggestion.meta}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {isInlineEmpty && (
                              <div className="text-label-sm text-muted flex flex-1 items-center px-3 py-2">
                                No suggestions yet.
                              </div>
                            )}

                            <div className="border-border border-t px-3 py-2">
                              <div className="text-label-sm text-muted">
                                {selectionLabel
                                  ? `Replace "${selectionLabel}"`
                                  : 'Replace selection'}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <CanvasButton
                                  type="button"
                                  className="border-border bg-surface-3 text-label-sm text-muted hover:bg-surface-2 hover:text-foreground h-9 rounded-lg border px-3 font-semibold transition-colors"
                                  onClick={closeInlinePopover}
                                >
                                  Clear
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  className={cn(
                                    'border-accent bg-accent text-label-sm text-app h-9 rounded-lg border px-3 font-semibold shadow-sm transition hover:opacity-90',
                                    !suggestionCount && 'opacity-50'
                                  )}
                                  onClick={() => {
                                    handleApplyActiveSuggestion();
                                    closeInlinePopover();
                                  }}
                                  disabled={!suggestionCount}
                                >
                                  Apply
                                </CanvasButton>
                              </div>
                            </div>
                          </aside>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <CoherencePanel
              issues={coherenceIssues ?? []}
              isChecking={Boolean(isCoherenceChecking)}
              isExpanded={Boolean(isCoherencePanelExpanded)}
              onToggleExpanded={onToggleCoherencePanelExpanded ?? (() => {})}
              onDismissIssue={onDismissCoherenceIssue ?? (() => {})}
              onDismissAll={onDismissAllCoherenceIssues ?? (() => {})}
              onApplyFix={onApplyCoherenceFix ?? (() => {})}
              onScrollToSpan={onScrollToCoherenceSpan}
            />

            <CollapsibleDrawer
              isOpen={versionsDrawer.isOpen}
              onToggle={versionsDrawer.toggle}
              height="180px"
              collapsedHeight="44px"
              position="bottom"
              displayMode={versionsDrawer.displayMode}
              showToggle={false}
            >
              <VersionsPanel
                versions={versionsForPanel}
                selectedVersionId={selectedVersionId}
                onSelectVersion={handleSelectVersion}
                onCreateVersion={handleCreateVersion}
                isCompact={!versionsDrawer.isOpen}
                onExpandDrawer={versionsDrawer.open}
                onCollapseDrawer={versionsDrawer.close}
                layout="horizontal"
              />
            </CollapsibleDrawer>
          </div>

          <div
            className="bg-border/10 hidden w-px self-stretch lg:block"
            aria-hidden="true"
          />

          {/* Right Rail - Generations */}
          <div className="lg:min-w-88 hidden min-h-0 flex-1 flex-col lg:flex lg:flex-[11]">
            <GenerationsPanel
              prompt={normalizedDisplayedPrompt ?? ''}
              promptVersionId={promptVersionId}
              aspectRatio={effectiveAspectRatio ?? '16:9'}
              duration={durationSeconds ?? undefined}
              fps={fpsNumber ?? undefined}
              generationParams={generationParams ?? undefined}
              initialGenerations={activeVersion?.generations ?? undefined}
              onGenerationsChange={handleGenerationsChange}
              versions={currentVersions}
              onRestoreVersion={handleSelectVersion}
              onCreateVersionIfNeeded={createVersionIfNeeded}
            />
          </div>
        </div>
      )}
      </div>

      {hasCanvasContent && (
        <div className="border-border bg-surface-2 p-ps-3 fixed bottom-0 left-0 right-0 z-40 border-t lg:hidden">
          <div className="flex items-center gap-3">
            <CanvasButton
              type="button"
              variant="gradient"
              className="flex-1 justify-center"
              onClick={() => setGenerationsSheetOpen(true)}
            >
              Open Generations
            </CanvasButton>
          </div>
        </div>
      )}

      {hasCanvasContent && (
        <Sheet open={generationsSheetOpen} onOpenChange={setGenerationsSheetOpen}>
          <SheetContent
            side="bottom"
            className="p-ps-3 h-[85vh] overflow-auto border-0 bg-transparent shadow-none [&>button]:hidden"
          >
            <GenerationsPanel
              prompt={normalizedDisplayedPrompt ?? ''}
              promptVersionId={promptVersionId}
              aspectRatio={effectiveAspectRatio ?? '16:9'}
              duration={durationSeconds ?? undefined}
              fps={fpsNumber ?? undefined}
              generationParams={generationParams ?? undefined}
              initialGenerations={activeVersion?.generations ?? undefined}
              onGenerationsChange={handleGenerationsChange}
              className="h-full"
              versions={currentVersions}
              onRestoreVersion={handleSelectVersion}
              onCreateVersionIfNeeded={createVersionIfNeeded}
            />
          </SheetContent>
        </Sheet>
      )}
      {hasCanvasContent && showDiff && (
        <Dialog open={showDiff} onOpenChange={setShowDiff}>
          <DialogContent className="border-border bg-surface-3 w-full max-w-5xl gap-0 rounded-xl border p-0 shadow-lg [&>button]:hidden">
            <div className="border-border flex items-center justify-between border-b p-4">
              <div>
                <div className="text-body-lg text-foreground font-semibold">
                  Diff
                </div>
                <div className="text-meta text-muted mt-1">
                  Input vs optimized output
                </div>
              </div>
              <CanvasButton
                type="button"
                className="border-border text-muted hover:bg-surface-2 hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
                onClick={() => setShowDiff(false)}
                aria-label="Close diff"
              >
                <X weight="bold" size={iconSizes.md} />
              </CanvasButton>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="border-border bg-surface-2 p-ps-3 rounded-lg border">
                <div className="text-label-sm text-muted font-semibold uppercase tracking-widest">
                  Input
                </div>
                <pre className="text-body-sm text-muted mt-3 whitespace-pre-wrap font-mono">
                  {inputPrompt || '—'}
                </pre>
              </div>
              <div className="border-border bg-surface-2 p-ps-3 rounded-lg border">
                <div className="text-label-sm text-muted font-semibold uppercase tracking-widest">
                  Optimized
                </div>
                <pre className="text-body-sm text-muted mt-3 whitespace-pre-wrap font-mono">
                  {normalizedDisplayedPrompt || '—'}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
