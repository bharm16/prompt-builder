import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Pencil, X, Check, Lock, Unlock, LayoutGrid, Share2, RotateCcw, RotateCw } from 'lucide-react';
import { LoadingDots } from '@components/LoadingDots';

// External libraries
import { useToast } from '@components/Toast';
import { MAX_REQUEST_LENGTH } from '@components/SuggestionsPanel/config/panelConfig';
import { useCustomRequest } from '@components/SuggestionsPanel/hooks/useCustomRequest';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Internal absolute imports
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Relative imports - types first
import type { HighlightSnapshot, PromptCanvasProps, SuggestionItem } from './PromptCanvas/types';

// Relative imports - implementations
import { useSpanLabeling, sanitizeText } from '@/features/span-highlighting';
import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import { useHighlightRendering } from '@/features/span-highlighting';
import { useHighlightFingerprint } from '@/features/span-highlighting';
import type { SpanLabelingResult } from '@/features/span-highlighting/hooks/types';
import { formatTextToHTML, escapeHTMLForMLHighlighting } from './utils/textFormatting';
import { buildSuggestionContext } from './utils/enhancementSuggestionContext';
import { useSpanDataConversion } from './PromptCanvas/hooks/useSpanDataConversion';
import { useSuggestionDetection } from './PromptCanvas/hooks/useSuggestionDetection';
import { useParseResult } from './PromptCanvas/hooks/useParseResult';
import { usePromptCanvasState } from './PromptCanvas/hooks/usePromptCanvasState';
import { usePreviewGenerationState } from './PromptCanvas/hooks/usePreviewGenerationState';
import { usePromptStatus } from './PromptCanvas/hooks/usePromptStatus';
import { useSpanSelectionEffects } from './PromptCanvas/hooks/useSpanSelectionEffects';
import { useSuggestionFeedback } from './PromptCanvas/hooks/useSuggestionFeedback';
import { useSuggestionSelection } from './PromptCanvas/hooks/useSuggestionSelection';
import { useTextSelection } from './PromptCanvas/hooks/useTextSelection';
import { useEditorContent } from './PromptCanvas/hooks/useEditorContent';
import { useKeyboardShortcuts } from './PromptCanvas/hooks/useKeyboardShortcuts';
import { usePromptExport } from './PromptCanvas/hooks/usePromptExport';
import { useLockedSpanInteractions } from './PromptCanvas/hooks/useLockedSpanInteractions';
import { usePromptVersioning } from './PromptCanvas/hooks/usePromptVersioning';
import { scrollToSpan } from './SpanBentoGrid/utils/spanFormatting';

// Relative imports - components
import { CategoryLegend } from './components/CategoryLegend';
import { PromptEditor } from './components/PromptEditor';
import { PromptSidebar } from './components/PromptSidebar';
import { VersionsPanel } from './components/VersionsPanel';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import { VisualPreview, VideoPreview } from '@/features/preview';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { usePromptState } from './context/PromptStateContext';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue } from '@shared/capabilities';

// Styles
import './PromptCanvas.css';

const RAIL_VIDEO_PREVIEW_MODEL = 'wan-2.2';

type InlineSuggestion = {
  key: string;
  text: string;
  meta: string | null;
  item: SuggestionItem | string;
};

// Main PromptCanvas Component
export function PromptCanvas({
  user = null,
  inputPrompt,
  onInputPromptChange,
  onReoptimize,
  displayedPrompt,
  previewPrompt = null,
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
  const editorColumnRef = useRef<HTMLDivElement>(null);
  const outputLocklineRef = useRef<HTMLDivElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const tokenPopoverRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLDivElement>(null);
  const outlineOverlayRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [isOutputFocused, setIsOutputFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [customRequestError, setCustomRequestError] = useState('');
  const interactionSourceRef = useRef<'keyboard' | 'mouse' | 'auto'>('auto');
  const [tokenPopover, setTokenPopover] = useState<{
    left: number;
    top: number;
    placement: 'top' | 'bottom';
    arrowLeft: number;
  } | null>(null);
  const [videoInputReference, setVideoInputReference] = useState('');
  const [stageTab, setStageTab] = useState<'preview' | 'final'>('preview');
  const [showDiff, setShowDiff] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const {
    previewLoading,
    setVisualPreviewGenerating,
    setRailVideoPreviewGenerating,
  } = usePreviewGenerationState();
  const {
    visual: isVisualPreviewGenerating,
    railVideo: isRailVideoPreviewGenerating,
  } = previewLoading;
  const [railVideoGenerateRequestId, setRailVideoGenerateRequestId] = useState(0);
  const [railVideoLastGeneratedAt, setRailVideoLastGeneratedAt] = useState<number | null>(null);
  
  // Refs for tracking previous state to prevent loops
  const previousTokenPopoverRef = useRef(tokenPopover);
  const previousSuggestionCountRef = useRef(0);

  // Get model + layout state from context
  const {
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    promptOptimizer,
    showHistory,
    promptHistory,
    currentPromptUuid,
    currentPromptDocId,
    activeVersionId,
    latestHighlightRef,
    versionEditCountRef,
    versionEditsRef,
    resetVersionEdits,
  } = usePromptState();
  const { lockedSpans, addLockedSpan, removeLockedSpan } = promptOptimizer;

  // Load capabilities schema to access generation controls
  const { schema, target } = useCapabilities(selectedModel);

  const effectiveAspectRatio = useMemo(() => {
    const fromParams = generationParams?.aspect_ratio;
    if (typeof fromParams === 'string' && fromParams.trim()) {
      return fromParams.trim();
    }
    return previewAspectRatio;
  }, [generationParams, previewAspectRatio]);

  // Helper to extract field info from capabilities schema
  const getFieldInfo = useCallback(
    (fieldName: string) => {
      if (!schema?.fields?.[fieldName]) return null;

      const field = schema.fields[fieldName];
      const state = resolveFieldState(field, generationParams);

      if (!state.available || state.disabled) return null;

      const allowedValues = field.type === 'enum'
        ? state.allowedValues ?? field.values ?? []
        : [];

      return { field, allowedValues };
    },
    [schema, generationParams]
  );

  const aspectRatioInfo = useMemo(() => getFieldInfo('aspect_ratio'), [getFieldInfo]);
  const durationInfo = useMemo(() => getFieldInfo('duration_s'), [getFieldInfo]);
  const fpsInfo = useMemo(() => getFieldInfo('fps'), [getFieldInfo]);

  const allowsVideoInputReference = useMemo(() => /sora/i.test(selectedModel ?? ''), [selectedModel]);

  useEffect(() => {
    if (!allowsVideoInputReference && videoInputReference) {
      setVideoInputReference('');
    }
  }, [allowsVideoInputReference, videoInputReference]);

  const resolvedVideoInputReference = useMemo(() => {
    if (!allowsVideoInputReference) return undefined;
    const trimmed = videoInputReference.trim();
    return trimmed ? trimmed : undefined;
  }, [allowsVideoInputReference, videoInputReference]);

  const handleParamChange = useCallback(
    (key: string, value: CapabilityValue) => {
      setGenerationParams({
        ...(generationParams ?? {}),
        [key]: value,
      });
    },
    [generationParams, setGenerationParams]
  );

  const renderDropdown = useCallback(
    (
      info: ReturnType<typeof getFieldInfo>,
      key: string,
      label: string,
      disabled: boolean
    ) => {
      if (!info) return null;

      const formatDisplay = (val: unknown) => {
        if (key === 'duration_s') return `${val}s`;
        if (key === 'fps') return `${val} fps`;
        return String(val);
      };

      return (
        <div className="flex items-center">
          <select
            value={String(generationParams?.[key] ?? info.field.default ?? '')}
            onChange={(e) => {
              const val = info.field.type === 'int' ? Number(e.target.value) : e.target.value;
              handleParamChange(key, val);
            }}
            disabled={disabled}
            className="po-chip-select"
            aria-label={label}
          >
            {info.allowedValues.map((value) => (
              <option key={String(value)} value={String(value)}>
                {formatDisplay(value)}
              </option>
            ))}
          </select>
        </div>
      );
    },
    [generationParams, getFieldInfo, handleParamChange]
  );

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  // Span bento overlay (collapsed by default on desktop)
  const [outlineOverlayState, setOutlineOverlayState] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const outlineOverlayActive = outlineOverlayState !== 'closed';

  const { state, setState, incrementVisualRequestId } = usePromptCanvasState();
  const {
    showExportMenu,
    showLegend,
    visualLastGeneratedAt,
    visualGenerateRequestId,
    isEditing,
    originalInputPrompt,
    originalSelectedModel,
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

  const previewSource = previewPrompt ?? normalizedDisplayedPrompt ?? '';
  const hasPreviewSource = Boolean(previewSource.trim());
  const isAnyVideoPreviewGenerating = isRailVideoPreviewGenerating;
  const isPreviewGenerating = isVisualPreviewGenerating || isAnyVideoPreviewGenerating;

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions visibility state for contextual UI
  const isSuggestionsOpen = Boolean(selectedSpanId || (suggestionsData && suggestionsData.show !== false));
  const showVideoPreview = selectedMode === 'video';
  const videoPreviewPrompt = useMemo(() => {
    const generic =
      typeof promptOptimizer.genericOptimizedPrompt === 'string' &&
      promptOptimizer.genericOptimizedPrompt.trim()
        ? promptOptimizer.genericOptimizedPrompt
        : null;

    if (generic) {
      return sanitizeText(generic);
    }

    return normalizedDisplayedPrompt ?? '';
  }, [promptOptimizer.genericOptimizedPrompt, normalizedDisplayedPrompt]);

  const activeVersion = useMemo(() => {
    const entry =
      promptHistory.history.find((item) => item.uuid === currentPromptUuid) ||
      promptHistory.history.find((item) => item.id === currentPromptDocId) ||
      null;
    const versions = Array.isArray(entry?.versions) ? entry.versions : [];
    return versions.find((version) => version.versionId === activeVersionId) ?? null;
  }, [promptHistory.history, currentPromptUuid, currentPromptDocId, activeVersionId]);

  const seedImageUrl = activeVersion?.preview?.imageUrl ?? null;
  const seedVideoUrl = activeVersion?.video?.videoUrl ?? null;

  const { upsertVersionOutput, syncVersionHighlights } = usePromptVersioning({
    promptHistory,
    currentPromptUuid,
    currentPromptDocId,
    latestHighlightRef,
    versionEditCountRef,
    versionEditsRef,
    resetVersionEdits,
    effectiveAspectRatio,
    generationParams,
    selectedModel,
  });

  const setShowExportMenu = useCallback(
    (value: boolean) => setState({ showExportMenu: value }),
    [setState]
  );

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    const toMs = (iso?: string | null): number | null =>
      iso ? Date.parse(iso) : null;
    setVisualLastGeneratedAt(toMs(activeVersion?.preview?.generatedAt ?? null));
    setVideoLastGeneratedAt(toMs(activeVersion?.video?.generatedAt ?? null));
  }, [
    activeVersion?.preview?.generatedAt,
    activeVersion?.video?.generatedAt,
    setVisualLastGeneratedAt,
    setVideoLastGeneratedAt,
  ]);

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
          cacheId: result.cacheId ?? (currentPromptUuid ? String(currentPromptUuid) : null),
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

  const tokenHighlights = useMemo(() => {
    const seen = new Set<string>();
    const variants = ['a', 'b', 'c'] as const;
    const tokens: Array<{ id: string; label: string; variant: typeof variants[number] }> = [];

    for (const span of bentoSpans) {
      const raw = typeof span.quote === 'string' ? span.quote : '';
      const label = raw.replace(/\s+/g, ' ').trim();
      if (!label || label.length < 3) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({
        id: span.id ?? `token_${span.start}_${span.end}`,
        label: label.length > 28 ? `${label.slice(0, 28).trim()}…` : label,
        variant: variants[tokens.length % variants.length],
      });
      if (tokens.length >= 6) break;
    }

    return tokens;
  }, [bentoSpans]);

  // Highlight rendering using extracted hook
  const highlightFingerprint = useHighlightFingerprint(enableMLHighlighting, {
    spans: parseResult.spans,
    displayText: parseResult.displayText,
  });

  // Memoize formatted HTML - DO NOT format if ML highlighting is enabled
  const { html: formattedHTML } = useMemo(
    () => {
      if (enableMLHighlighting) {
        return { html: escapeHTMLForMLHighlighting(normalizedDisplayedPrompt || '') };
      }
      return formatTextToHTML(normalizedDisplayedPrompt ?? '');
    },
    [normalizedDisplayedPrompt, enableMLHighlighting]
  );

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
    if (normalizedDisplayedPrompt && normalizedDisplayedPrompt.trim() && enableMLHighlighting) {
      performance.mark('prompt-displayed-on-screen');
      debug.logEffect('Prompt displayed on screen', {
        promptLength: normalizedDisplayedPrompt.length,
        mlHighlighting: enableMLHighlighting,
      });
    }
  }, [normalizedDisplayedPrompt, enableMLHighlighting, debug]);

  const isOptimizing = Boolean(isProcessing || isRefining);
  const isOutputLoading = Boolean(isProcessing || isRefining);
  const isInputLocked = !isEditing || isOptimizing;

  const escapeAttr = (value: string): string => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
  };

  const inspectedSpanElementRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = editorRef.current;
    if (!root || !enableMLHighlighting || !showHighlights || !outlineOverlayActive) {
      if (inspectedSpanElementRef.current) {
        inspectedSpanElementRef.current.classList.remove('value-word--inspected');
        inspectedSpanElementRef.current = null;
      }
      return;
    }

    if (inspectedSpanElementRef.current) {
      inspectedSpanElementRef.current.classList.remove('value-word--inspected');
      inspectedSpanElementRef.current = null;
    }

    if (!hoveredSpanId) {
      return;
    }

    const el = root.querySelector(`[data-span-id="${escapeAttr(hoveredSpanId)}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.add('value-word--inspected');
    inspectedSpanElementRef.current = el;
    return () => {
      el.classList.remove('value-word--inspected');
      if (inspectedSpanElementRef.current === el) {
        inspectedSpanElementRef.current = null;
      }
    };
  }, [enableMLHighlighting, hoveredSpanId, showHighlights, outlineOverlayActive]);

  const updateTokenPopover = useCallback((): void => {
    if (typeof window === 'undefined') return;
    if (!selectedSpanId || !editorRef.current || !editorWrapperRef.current) {
      setTokenPopover(null);
      return;
    }

    const el = editorRef.current.querySelector(
      `span.value-word[data-span-id="${escapeAttr(selectedSpanId)}"]`
    ) as HTMLElement | null;

    if (!el) {
      setTokenPopover(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
    const viewportMargin = 12;
    const maxPanelWidth = Math.max(240, window.innerWidth - viewportMargin * 2);
    const panelWidth = Math.min(420, maxPanelWidth);
    const panelHeight = 280;
    const shouldShowBelow = window.innerHeight - rect.bottom >= 180;
    const placement: 'top' | 'bottom' = shouldShowBelow ? 'bottom' : 'top';

    const leftPreferred = rect.left;
    const leftClamped = Math.max(
      viewportMargin,
      Math.min(leftPreferred, window.innerWidth - panelWidth - viewportMargin)
    );
    const topPreferred = shouldShowBelow ? rect.bottom + 10 : rect.top - panelHeight - 10;
    const topClamped = Math.max(
      viewportMargin,
      Math.min(topPreferred, window.innerHeight - panelHeight - viewportMargin)
    );
    const arrowLeft = Math.max(
      12,
      Math.min(panelWidth - 12, rect.left + rect.width / 2 - leftClamped)
    );

    setTokenPopover({
      left: leftClamped - wrapperRect.left,
      top: topClamped - wrapperRect.top,
      placement,
      arrowLeft,
    });
  }, [selectedSpanId]);

  const closeInlinePopover = useCallback((): void => {
    setSelectedSpanId(null);
    setTokenPopover(null);
    setActiveSuggestionIndex(0);
    suggestionsData?.onClose?.();
  }, [setSelectedSpanId, suggestionsData]);

  useEffect(() => {
    updateTokenPopover();
  }, [updateTokenPopover, normalizedDisplayedPrompt]);

  useEffect(() => {
    if (!selectedSpanId) return;
    const handleResize = (): void => updateTokenPopover();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedSpanId, updateTokenPopover]);

  useEffect(() => {
    if (!selectedSpanId) return;
    const handleScroll = (e: Event): void => {
      // Don't update if the scroll came from the suggestions list
      if (suggestionsListRef.current && suggestionsListRef.current.contains(e.target as Node)) {
        return;
      }
      updateTokenPopover();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [selectedSpanId, updateTokenPopover]);

  // Close popover on outside click
  useEffect(() => {
    if (!tokenPopover) return;
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (tokenPopoverRef.current?.contains(target)) return;
      if (target.closest?.('span.value-word')) return;
      closeInlinePopover();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [tokenPopover, closeInlinePopover]);

  // Ambient motion: every ~6s, momentarily fade a random token
  useEffect(() => {
    if (!showHighlights) return;
    const root = editorRef.current;
    if (!root) return;
    const interval = window.setInterval(() => {
      const nodes = root.querySelectorAll('span.value-word[data-span-id]');
      if (!nodes.length) return;
      const node = nodes[Math.floor(Math.random() * nodes.length)] as HTMLElement;
      node.classList.add('value-word--ambient');
      window.setTimeout(() => node.classList.remove('value-word--ambient'), 200);
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

  const handleOutputFocus = useCallback((): void => {
    setIsOutputFocused(true);
  }, []);

  const handleOutputBlur = useCallback((): void => {
    setIsOutputFocused(false);
  }, [setIsOutputFocused]);

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
    const promptChanged = inputPrompt !== originalInputPrompt;
    const modelChanged =
      typeof originalSelectedModel === 'string' && originalSelectedModel !== selectedModel;
    const genericPrompt =
      typeof promptOptimizer.genericOptimizedPrompt === 'string' &&
      promptOptimizer.genericOptimizedPrompt.trim()
        ? promptOptimizer.genericOptimizedPrompt
        : null;

    if (modelChanged && !promptChanged && genericPrompt) {
      void onReoptimize(inputPrompt, {
        compileOnly: true,
        compilePrompt: genericPrompt,
        createVersion: true,
      });
    } else {
      void onReoptimize(inputPrompt);
    }
    // Exit edit mode
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [
    inputPrompt,
    originalInputPrompt,
    originalSelectedModel,
    promptOptimizer,
    selectedModel,
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
  const previewMetaDetail = 'ETA ~6s';
  const finalMetaDetail = 'ETA ~45s';
  const hasVideoPreviewSource = Boolean(videoPreviewPrompt.trim());
  const durationValue = generationParams?.duration_s;
  const fpsValue = generationParams?.fps;
  const durationLabel = typeof durationValue === 'number' ? `${durationValue}s` : '—';
  const fpsLabel = typeof fpsValue === 'number' ? `${fpsValue} fps` : '—';
  const aspectLabel = effectiveAspectRatio ? `AR ${effectiveAspectRatio}` : 'AR —';
  const previewStatus = isVisualPreviewGenerating
    ? 'Generating'
    : visualLastGeneratedAt || seedImageUrl
      ? 'Ready'
      : 'Idle';
  const finalStatus = isRailVideoPreviewGenerating
    ? 'Generating'
    : railVideoLastGeneratedAt || seedVideoUrl
      ? 'Ready'
      : 'Idle';
  const canCompareRuns = previewStatus === 'Ready' && finalStatus === 'Ready';
  const stageIsPreview = stageTab === 'preview';
  const stageIsGenerating = stageIsPreview ? isVisualPreviewGenerating : isRailVideoPreviewGenerating;
  const stageHasOutput = stageIsPreview
    ? Boolean(seedImageUrl || visualLastGeneratedAt)
    : Boolean(seedVideoUrl || railVideoLastGeneratedAt);
  const stageCtaLabel = stageIsPreview ? 'Generate Preview' : 'Generate Final';
  const stageCtaDisabled = stageIsPreview
    ? !hasPreviewSource || isVisualPreviewGenerating
    : !hasVideoPreviewSource || isRailVideoPreviewGenerating;

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
      typeof selectedSpan.displayQuote === 'string' && selectedSpan.displayQuote.trim()
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
    const rawSuggestions = (suggestionsData?.suggestions ?? []) as Array<SuggestionItem | string>;
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
    tokenPopover && (suggestionsData?.isLoading || !suggestionsData || !selectionMatches)
  );
  const isInlineError = Boolean(suggestionsData?.isError);
  const inlineErrorMessage =
    typeof suggestionsData?.errorMessage === 'string' && suggestionsData.errorMessage.trim()
      ? suggestionsData.errorMessage.trim()
      : 'Failed to load suggestions.';
  const isInlineEmpty = Boolean(
    tokenPopover && !isInlineLoading && !isInlineError && suggestionCount === 0
  );
  const selectionLabel = selectedSpanText || suggestionsData?.selectedText || '';
  const customRequestSelection = selectionLabel.trim();
  const customRequestPrompt = (suggestionsData?.fullPrompt || normalizedDisplayedPrompt || '').trim();

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
    contextBefore: customRequestContext?.contextBefore,
    contextAfter: customRequestContext?.contextAfter,
    metadata: suggestionsData?.metadata ?? null,
    setSuggestions: suggestionsData?.setSuggestions,
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
  }, [selectedSpanId, setCustomRequest]);

  useEffect(() => {
    const justOpened = !previousTokenPopoverRef.current && tokenPopover;
    const countChanged = suggestionCount !== previousSuggestionCountRef.current;

    if (tokenPopover && (justOpened || countChanged)) {
      interactionSourceRef.current = 'auto';
      setActiveSuggestionIndex(0);
    }

    previousTokenPopoverRef.current = tokenPopover;
    previousSuggestionCountRef.current = suggestionCount;
  }, [tokenPopover, suggestionCount]);

  useEffect(() => {
    if (!tokenPopover || !suggestionsListRef.current) return;
    
    // Skip scrolling if the change came from mouse hover to prevent fighting/looping
    if (interactionSourceRef.current === 'mouse') return;

    const list = suggestionsListRef.current;
    const activeItem = list.querySelector(
      `[data-index="${activeSuggestionIndex}"]`
    ) as HTMLElement | null;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [tokenPopover, activeSuggestionIndex]);

  const handleApplyActiveSuggestion = useCallback((): void => {
    const active = inlineSuggestions[activeSuggestionIndex];
    if (!active) return;
    handleSuggestionClickWithFeedback(active.item);
  }, [activeSuggestionIndex, inlineSuggestions, handleSuggestionClickWithFeedback]);

  useEffect(() => {
    if (!tokenPopover) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isEditableTarget && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeInlinePopover();
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
    tokenPopover,
    suggestionCount,
    closeInlinePopover,
    handleApplyActiveSuggestion,
  ]);

  const handleVisualPreviewGenerated = useCallback(
    ({
      prompt,
      generatedAt,
      imageUrl,
      aspectRatio,
    }: {
      prompt: string;
      generatedAt: number;
      imageUrl?: string | null;
      aspectRatio?: string | null;
    }) => {
      setVisualLastGeneratedAt(generatedAt);
      upsertVersionOutput({
        action: 'preview',
        prompt,
        generatedAt,
        imageUrl: imageUrl ?? null,
        aspectRatio: aspectRatio ?? null,
      });
    },
    [setVisualLastGeneratedAt, upsertVersionOutput]
  );

  const handleVideoPreviewGenerated = useCallback(
    ({
      prompt,
      generatedAt,
      videoUrl,
      aspectRatio,
    }: {
      prompt: string;
      generatedAt: number;
      videoUrl?: string | null;
      aspectRatio?: string | null;
    }) => {
      setVideoLastGeneratedAt(generatedAt);
      upsertVersionOutput({
        action: 'video',
        prompt,
        generatedAt,
        videoUrl: videoUrl ?? null,
        aspectRatio: aspectRatio ?? null,
      });
    },
    [setVideoLastGeneratedAt, upsertVersionOutput]
  );

  const handleRailVideoPreviewGenerated = useCallback(
    ({
      prompt,
      generatedAt,
      videoUrl,
      aspectRatio,
    }: {
      prompt: string;
      generatedAt: number;
      videoUrl?: string | null;
      aspectRatio?: string | null;
    }) => {
      setRailVideoLastGeneratedAt(generatedAt);
      handleVideoPreviewGenerated({
        prompt,
        generatedAt,
        videoUrl: videoUrl ?? null,
        aspectRatio: aspectRatio ?? null,
      });
    },
    [handleVideoPreviewGenerated]
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
    setStageTab('preview');
    incrementVisualRequestId();
  }, [incrementVisualRequestId, setStageTab]);

  const handleGenerateRailVideoPreview = useCallback((): void => {
    setStageTab('final');
    setRailVideoGenerateRequestId((current) => current + 1);
  }, [setStageTab]);

  // Render the component
  return (
    <div
      className="prompt-canvas-root relative flex flex-col min-h-0 flex-1"
      data-mode={selectedMode}
      data-preview-generating={isPreviewGenerating ? 'true' : 'false'}
      data-outline-open={outlineOverlayActive ? 'true' : 'false'}
      aria-busy={isPreviewGenerating ? 'true' : 'false'}
      style={
        {
          // Drive the history sidebar width from PromptCanvas state (avoid global vw tokens).
          '--sidebar-width': showHistory ? 'var(--pc-sidebar-expanded)' : 'var(--pc-sidebar-collapsed)',
        } as React.CSSProperties
      }
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
          className="pc-outline-overlay po-surface po-surface--grad po-animate-pop-in"
          data-state={outlineOverlayState}
          role="dialog"
          aria-label="Prompt structure"
        >
	          <div className="pc-outline-overlay__header">
	            <div className="pc-outline-overlay__title">Prompt Structure</div>
	            <div className="pc-outline-overlay__subtitle">
	              Semantic breakdown used for generation
	            </div>
	          </div>
	          <div className="pc-outline-overlay__sections">
	            <HighlightingErrorBoundary>
              <SpanBentoGrid
                spans={bentoSpans}
                editorRef={editorRef as React.RefObject<HTMLElement>}
                onSpanHoverChange={setHoveredSpanId}
              />
	            </HighlightingErrorBoundary>
	          </div>
	          <div className="pc-outline-overlay__footer">
	            <div className="pc-outline-overlay__hint">Hover a token to locate it in the prompt</div>
	          </div>
	        </div>
	      )}

	      {/* Main Content Container */}
	      <div className="flex-1 overflow-hidden prompt-canvas-grid">
        {showVideoPreview && isAnyVideoPreviewGenerating && (
          <div className="prompt-canvas-generation-overlay" aria-hidden="true" />
        )}

	        {/* History Sidebar */}
	        <div className="prompt-canvas-history">
	          <PromptSidebar user={user} />
	        </div>

        {/* Context gutter (xl+ only) */}
        <div className="prompt-canvas-gutter">
          <VersionsPanel />
        </div>

	        {/* Outline toggle when collapsed (overlay drawer default) */}
	        {!outlineOverlayActive && (
	          <button
	            type="button"
	            onClick={openOutlineOverlay}
	            className="prompt-outline-open-fab"
	            aria-label="Open outline"
	            title="Open outline"
	          >
	            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
	          </button>
	        )}

        {/* Main Editor Area - Optimized Prompt */}
        <div
          ref={editorColumnRef}
          id="main-content"
          className="prompt-canvas-editor flex flex-col overflow-hidden min-h-0 min-w-0"
        >
          <div className="prompt-canvas-editor-frame">
            <div className="po-editor-stack">
              <div className="po-editor-grid">
                <div className="prompt-band prompt-band--original" data-optimizing={isOptimizing}>
                  <div className="prompt-band__content prompt-canvas-content-wrapper">
                    <div className="prompt-card prompt-card--original">
                      <div
                        className="prompt-card__header"
                        data-has-video-controls={showVideoPreview ? 'true' : undefined}
                      >
                        <div className="prompt-card__header-row">
                          <div className="prompt-card__header-left">
                            <div className="prompt-card__title">Prompt</div>
                            <div className="prompt-card__subtitle">Compose your input</div>
                          </div>

                          <div className="prompt-card__header-actions">
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={handleEditClick}
                                disabled={isOptimizing}
                                className="prompt-card__action-button"
                                aria-label="Edit prompt"
                                title="Edit prompt"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <div className="prompt-card__action-group">
                                <button
                                  type="button"
                                  onClick={handleCancel}
                                  disabled={isOptimizing}
                                  className="prompt-card__action-button"
                                  aria-label="Cancel editing"
                                  title="Cancel editing"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleUpdate}
                                  disabled={isReoptimizeDisabled}
                                  className="prompt-card__action-primary"
                                  aria-label="Update prompt"
                                  title="Update and re-optimize (Cmd/Ctrl+Enter)"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Update</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {showVideoPreview && (
                          <div className="prompt-card__chips" aria-label="Prompt controls">
                            <div className="prompt-chip">
                              <span className="prompt-chip__label">Model</span>
                              <ModelSelectorDropdown
                                selectedModel={selectedModel}
                                onModelChange={handleModelChange}
                                disabled={isOptimizing}
                                variant="pillDark"
                              />
                            </div>

                            {aspectRatioInfo && (
                              <div className="prompt-chip">
                                <span className="prompt-chip__label">Aspect</span>
                                {renderDropdown(
                                  aspectRatioInfo,
                                  'aspect_ratio',
                                  'Aspect Ratio',
                                  isOptimizing
                                )}
                              </div>
                            )}

                            {durationInfo && (
                              <div className="prompt-chip">
                                <span className="prompt-chip__label">Duration</span>
                                {renderDropdown(
                                  durationInfo,
                                  'duration_s',
                                  'Duration',
                                  isOptimizing
                                )}
                              </div>
                            )}

                            {fpsInfo && (
                              <div className="prompt-chip">
                                <span className="prompt-chip__label">FPS</span>
                                {renderDropdown(
                                  fpsInfo,
                                  'fps',
                                  'Frame Rate',
                                  isOptimizing
                                )}
                              </div>
                            )}
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
                          placeholder="Describe your shot..."
                          rows={3}
                          readOnly={isInputLocked}
                          className="prompt-input prompt-input--original"
                          aria-label="Original prompt input"
                          aria-readonly={isInputLocked}
                          aria-busy={isOptimizing}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="prompt-band prompt-band--optimized"
                  data-loading={isOutputLoading}
                  data-has-content={!!normalizedDisplayedPrompt}
                >
                  <div className="prompt-band__content prompt-canvas-content-wrapper">
                    <div
                      className="prompt-card prompt-card--optimized"
                      data-settled={normalizedDisplayedPrompt ? 'true' : 'false'}
                    >
                      <div className="prompt-output-header">
                        <div className="prompt-output-title">
                          <div className="prompt-output-label">Optimized</div>
                          <div className="prompt-output-subtitle">Live rewrite + highlights</div>
                        </div>
                        <div className="prompt-output-actions">
                          <span
                            className="prompt-output-live"
                            data-state={isOutputFocused ? 'editing' : 'live'}
                          >
                            {isOutputFocused ? 'Editing' : 'LIVE'}
                          </span>
                          <button
                            type="button"
                            className="po-action-btn"
                            onClick={handleCopy}
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            className="po-action-btn"
                            onClick={() => setShowDiff(true)}
                          >
                            Diff
                          </button>
                          <div className="po-action-menu" ref={exportMenuRef}>
                            <button
                              type="button"
                              className="po-action-btn"
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              aria-expanded={showExportMenu}
                            >
                              Export
                            </button>
                            {showExportMenu && (
                              <div
                                className="po-action-menu__popover po-popover po-surface po-surface--grad po-animate-pop-in"
                                role="menu"
                              >
                                <button type="button" onClick={() => handleExport('text')} role="menuitem">
                                  Export .txt
                                </button>
                                <button type="button" onClick={() => handleExport('markdown')} role="menuitem">
                                  Export .md
                                </button>
                                <button type="button" onClick={() => handleExport('json')} role="menuitem">
                                  Export .json
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="po-action-icon"
                            onClick={handleShare}
                            aria-label="Share prompt"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="po-action-icon"
                            onClick={onUndo}
                            disabled={!canUndo}
                            aria-label="Undo"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="po-action-icon"
                            onClick={onRedo}
                            disabled={!canRedo}
                            aria-label="Redo"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

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
                          onFocus={handleOutputFocus}
                          onBlur={handleOutputBlur}
                        />
                        <div
                          ref={outputLocklineRef}
                          className="prompt-output-lockline"
                          data-active={stageIsGenerating ? 'true' : 'false'}
                          aria-hidden="true"
                        />
                        {/* Inline suggestions popover (anchored to selected span) */}
                        {tokenPopover && (
                          <>
                            <div
                              className="inline-suggest-backdrop po-backdrop--local po-animate-fade-in"
                              aria-hidden="true"
                            />
                            <div
                              ref={tokenPopoverRef}
                              className="inline-suggest-popover po-popover po-surface po-surface--grad po-animate-pop-in"
                              data-open="true"
                              data-placement={tokenPopover.placement}
                              style={
                                {
                                  left: tokenPopover.left,
                                  top: tokenPopover.top,
                                  '--arrow-x': `${tokenPopover.arrowLeft}px`,
                                } as React.CSSProperties
                              }
                              role="dialog"
                              aria-label="Suggestions"
                            >
                              <div className="inline-suggest-arrow" aria-hidden="true" />

                              <div className="inline-suggest-header">
                                <div className="inline-suggest-title">
                                  Suggestions
                                  <span className="inline-suggest-pill">{suggestionCount}</span>
                                </div>
                                <div className="inline-suggest-keys" aria-hidden="true">
                                  <span className="kbd">Up</span>
                                  <span className="kbd">Down</span>
                                  <span className="kbd">Enter</span>
                                  <span className="kbd">Esc</span>
                                </div>
                              </div>

                              <div className="inline-suggest-divider" />

                              <div className="inline-suggest-custom">
                                <form
                                  className="inline-suggest-custom-form"
                                  onSubmit={handleCustomRequestSubmit}
                                >
                                  <textarea
                                    id="inline-custom-request"
                                    value={customRequest}
                                    onChange={(event) => {
                                      setCustomRequest(event.target.value);
                                      if (customRequestError) {
                                        setCustomRequestError('');
                                      }
                                    }}
                                    placeholder="Add a specific change (e.g. football field)"
                                    className="inline-suggest-custom-input"
                                    maxLength={MAX_REQUEST_LENGTH}
                                    rows={1}
                                    aria-label="Custom suggestion request"
                                  />
                                  <button
                                    type="submit"
                                    className="inline-suggest-cta"
                                    disabled={isCustomRequestDisabled}
                                    aria-busy={isCustomLoading}
                                  >
                                    {isCustomLoading ? 'Applying...' : 'Apply'}
                                  </button>
                                </form>
                                {customRequestError && (
                                  <div className="inline-suggest-custom-error" role="alert">
                                    {customRequestError}
                                  </div>
                                )}
                              </div>

                              {isInlineError && (
                                <div className="inline-suggest-error" role="alert">
                                  {inlineErrorMessage}
                                </div>
                              )}

                              {isInlineLoading && (
                                <div className="inline-suggest-list">
                                  <div className="skeleton-row" />
                                  <div className="skeleton-row" />
                                  <div className="skeleton-row" />
                                </div>
                              )}

                              {!isInlineLoading && !isInlineError && suggestionCount > 0 && (
                                <div className="inline-suggest-list" ref={suggestionsListRef}>
                                  {inlineSuggestions.map((suggestion, index) => (
                                    <div
                                      key={suggestion.key}
                                      data-index={index}
                                      data-selected={
                                        activeSuggestionIndex === index ? 'true' : 'false'
                                      }
                                      className="inline-suggest-item po-row po-row--interactive"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onMouseEnter={() => {
                                        interactionSourceRef.current = 'mouse';
                                        setActiveSuggestionIndex(index);
                                      }}
                                      onClick={() => {
                                        handleSuggestionClickWithFeedback(suggestion.item);
                                        closeInlinePopover();
                                      }}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <div className="inline-suggest-text">{suggestion.text}</div>
                                      {index === 0 ? (
                                        <span
                                          className="inline-suggest-badge po-badge po-badge--best"
                                          data-accent="true"
                                        >
                                          Best match
                                        </span>
                                      ) : suggestion.meta ? (
                                        <div className="inline-suggest-meta">{suggestion.meta}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isInlineEmpty && (
                                <div className="inline-suggest-empty">No suggestions yet.</div>
                              )}

                              <div className="inline-suggest-footer">
                                <div className="inline-suggest-footnote">
                                  {selectionLabel
                                    ? `Replace "${selectionLabel}"`
                                    : 'Replace selection'}
                                </div>
                                <div className="inline-suggest-actions">
                                  <button
                                    type="button"
                                    className="inline-suggest-cta"
                                    onClick={closeInlinePopover}
                                  >
                                    Close
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-suggest-cta"
                                    data-primary="true"
                                    onClick={() => {
                                      handleApplyActiveSuggestion();
                                      closeInlinePopover();
                                    }}
                                    disabled={!suggestionCount}
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        {enableMLHighlighting &&
                          !outlineOverlayActive &&
                          hoveredSpanId &&
                          lockButtonPosition &&
                          !isOutputLoading && (
                          <button
                            ref={lockButtonRef}
                            type="button"
                            onClick={handleToggleLock}
                            onMouseEnter={cancelHideLockButton}
                            onMouseLeave={handleLockButtonMouseLeave}
                            onMouseDown={(e) => e.preventDefault()}
                            className="prompt-lock-button po-fab po-animate-pop-in"
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
                </div>
              </div>

              <section className="po-runs">
                <div className="po-runs__header">
                  <div>
                    <div className="po-runs__title">Runs</div>
                    <div className="po-runs__subtitle">
                      Preview + final generations (history, status, ETA)
                    </div>
                  </div>
                  <span className="po-runs__badge">Queue</span>
                </div>

                <div className="po-runs__list">
                  <div
                    className="po-run-card"
                    data-status={previewStatus.toLowerCase()}
                    data-variant="preview"
                  >
                    <div className="po-run-card__main">
                      <div className="po-run-card__title">Preview Run</div>
                      <div className="po-run-card__meta">
                        Draft model: {target.label} · {aspectLabel} · {durationLabel} · {fpsLabel}
                      </div>
                    </div>
                    <div className="po-run-card__status">
                      <span className="po-status-pill" data-status={previewStatus.toLowerCase()}>
                        {previewStatus}
                      </span>
                      <span className="po-run-card__eta">{previewMetaDetail}</span>
                    </div>
                    <div className="po-run-card__actions">
                      <div className="po-run-card__links">
                        <button type="button" disabled={previewStatus !== 'Ready'}>
                          Retry
                        </button>
                        <button type="button" disabled={!canCompareRuns}>
                          Compare
                        </button>
                        <button type="button" disabled={previewStatus === 'Idle'}>
                          Logs
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateVisualPreview}
                        disabled={!hasPreviewSource || isVisualPreviewGenerating}
                        className="po-run-card__cta"
                      >
                        Generate Preview
                      </button>
                    </div>
                  </div>

                  <div className="po-run-card" data-status={finalStatus.toLowerCase()}>
                    <div className="po-run-card__main">
                      <div className="po-run-card__title">Final Render</div>
                      <div className="po-run-card__meta">
                        Quality: High · {aspectLabel} · {durationLabel} · {fpsLabel}
                      </div>
                    </div>
                    <div className="po-run-card__status">
                      <span className="po-status-pill" data-status={finalStatus.toLowerCase()}>
                        {finalStatus}
                      </span>
                      <span className="po-run-card__eta">{finalMetaDetail}</span>
                    </div>
                    <div className="po-run-card__actions">
                      <div className="po-run-card__links">
                        <button type="button" disabled={finalStatus !== 'Ready'}>
                          Retry
                        </button>
                        <button type="button" disabled={!canCompareRuns}>
                          Compare
                        </button>
                        <button type="button" disabled={finalStatus === 'Idle'}>
                          Logs
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateRailVideoPreview}
                        disabled={!hasVideoPreviewSource || isRailVideoPreviewGenerating}
                        className="po-run-card__cta"
                      >
                        Generate Final
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Right Rail - Stage + Inspector */}
        <div className="prompt-canvas-right-rail">
          <section className="po-stage">
            <div className="po-stage__header">
              <div>
                <div className="po-stage__title">Stage</div>
                <div className="po-stage__subtitle">Preview &amp; refine output</div>
              </div>
              <div className="po-stage__tabs">
                <button
                  type="button"
                  onClick={() => setStageTab('preview')}
                  data-active={stageTab === 'preview' ? 'true' : 'false'}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setStageTab('final')}
                  data-active={stageTab === 'final' ? 'true' : 'false'}
                >
                  Final
                </button>
              </div>
            </div>

            <div className="po-stage__frame">
              <div className="po-stage__media">
                {stageTab === 'preview' ? (
                  <VisualPreview
                    prompt={previewSource}
                    aspectRatio={effectiveAspectRatio}
                    isVisible={true}
                    seedImageUrl={seedImageUrl}
                    generateRequestId={visualGenerateRequestId}
                    lastGeneratedAt={visualLastGeneratedAt}
                    onPreviewGenerated={handleVisualPreviewGenerated}
                    onLoadingChange={setVisualPreviewGenerating}
                    onKeepRefining={handleKeepRefiningFromPreview}
                    onRefinePrompt={handleSomethingOffFromPreview}
                    showActions={false}
                    variant="rail"
                  />
                ) : (
                  <VideoPreview
                    prompt={videoPreviewPrompt}
                    aspectRatio={effectiveAspectRatio}
                    model={RAIL_VIDEO_PREVIEW_MODEL}
                    generationParams={generationParams}
                    {...(resolvedVideoInputReference
                      ? { inputReference: resolvedVideoInputReference }
                      : {})}
                    isVisible={showVideoPreview}
                    seedVideoUrl={seedVideoUrl}
                    generateRequestId={railVideoGenerateRequestId}
                    lastGeneratedAt={railVideoLastGeneratedAt}
                    onPreviewGenerated={handleRailVideoPreviewGenerated}
                    onLoadingChange={setRailVideoPreviewGenerating}
                    onKeepRefining={handleKeepRefiningFromPreview}
                    onRefinePrompt={handleSomethingOffFromPreview}
                  />
                )}
              </div>

              {!stageHasOutput && !stageIsGenerating && (
                <div className="po-stage__empty">
                  <div className="po-stage__empty-title">Stage is set</div>
                  <div className="po-stage__empty-sub">
                    {stageTab === 'preview'
                      ? 'Generate a preview to validate framing, lighting, and mood.'
                      : 'Generate the final render when you are ready.'}
                  </div>
                </div>
              )}
            </div>

            <div className="po-stage__footer">
              <div className="po-stage__meta">
                {aspectLabel} · {target.label}
              </div>
              <button
                type="button"
                onClick={stageTab === 'preview' ? handleGenerateVisualPreview : handleGenerateRailVideoPreview}
                disabled={stageCtaDisabled}
                className="po-stage__cta"
              >
                {stageCtaLabel}
              </button>
            </div>
          </section>

          <section className="po-inspector">
            <div className="po-inspector__header">
              <div className="po-inspector__title">Controls</div>
              <div className="po-inspector__subtitle">Draft model &amp; settings</div>
            </div>

            <div className="po-inspector__body">
              <div className="po-inspector__group">
                <label>Draft model</label>
                <ModelSelectorDropdown
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  disabled={isOptimizing}
                  variant="pillDark"
                />
              </div>

              <div className="po-inspector__group">
                <label>Aspect</label>
                {aspectRatioInfo
                  ? renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio', isOptimizing)
                  : <span className="po-inspector__hint">Auto</span>}
              </div>

              <div className="po-inspector__row">
                <div className="po-inspector__group">
                  <label>Duration</label>
                  {durationInfo
                    ? renderDropdown(durationInfo, 'duration_s', 'Duration', isOptimizing)
                    : <span className="po-inspector__hint">Auto</span>}
                </div>

                <div className="po-inspector__group">
                  <label>FPS</label>
                  {fpsInfo
                    ? renderDropdown(fpsInfo, 'fps', 'Frame Rate', isOptimizing)
                    : <span className="po-inspector__hint">Auto</span>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {showDiff && (
        <div
          className="po-diff po-backdrop po-animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Prompt diff"
          onClick={() => setShowDiff(false)}
        >
          <div
            className="po-diff__card po-modal po-modal--xl po-surface po-surface--grad po-animate-pop-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="po-diff__header">
              <div>
                <div className="po-diff__title">Diff</div>
                <div className="po-diff__subtitle">Input vs optimized output</div>
              </div>
              <button
                type="button"
                className="po-diff__close"
                onClick={() => setShowDiff(false)}
                aria-label="Close diff"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="po-diff__body">
              <div className="po-diff__panel">
                <div className="po-diff__label">Input</div>
                <pre>{inputPrompt || '—'}</pre>
              </div>
              <div className="po-diff__panel">
                <div className="po-diff__label">Optimized</div>
                <pre>{normalizedDisplayedPrompt || '—'}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
