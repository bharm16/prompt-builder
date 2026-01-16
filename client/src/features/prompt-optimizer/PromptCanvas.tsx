import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import {
  Pencil,
  X,
  Check,
  Lock,
  Unlock,
  LayoutGrid,
  Share2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Play,
  Pause,
  Download,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
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
import { VisualPreview, VideoPreview, type PreviewProvider } from '@/features/preview';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { usePromptState } from './context/PromptStateContext';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue } from '@shared/capabilities';

// Styles
import './PromptCanvas.css';

const RAIL_VIDEO_PREVIEW_MODEL = 'wan-2.2';
const RUN_ARTIFACTS = {
  preview: [
    { id: 'preview-clip', label: 'Preview clip', kind: 'preview' },
    { id: 'preview-keyframe-1', label: 'Keyframe 1', kind: 'keyframe' },
    { id: 'preview-keyframe-2', label: 'Keyframe 2', kind: 'keyframe' },
    { id: 'preview-keyframe-3', label: 'Keyframe 3', kind: 'keyframe' },
    { id: 'preview-variant-1', label: 'Frame 1 (Base)', kind: 'variant' },
    { id: 'preview-variant-2', label: 'Frame 2 (Edit 1)', kind: 'variant' },
    { id: 'preview-variant-3', label: 'Frame 3 (Edit 2)', kind: 'variant' },
    { id: 'preview-variant-4', label: 'Frame 4 (Edit 3)', kind: 'variant' },
  ],
  final: [
    { id: 'final-render', label: 'Final render', kind: 'preview' },
    { id: 'final-keyframe-1', label: 'Keyframe 1', kind: 'keyframe' },
    { id: 'final-keyframe-2', label: 'Keyframe 2', kind: 'keyframe' },
    { id: 'final-variant-1', label: 'Frame 1', kind: 'variant' },
  ],
} as const;

const RUN_METRICS = {
  preview: { tokens: '1.2k', cost: '$0.08', quality: 'Pass', safety: 'Clear' },
  final: { tokens: '3.6k', cost: '$1.92', quality: 'Pass', safety: 'Clear' },
} as const;

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
  const suggestionsListRef = useRef<HTMLDivElement>(null);
  const outlineOverlayRef = useRef<HTMLDivElement>(null);
  const previewRunMenuRef = useRef<HTMLDivElement>(null);
  const finalRunMenuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [isOutputFocused, setIsOutputFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [customRequestError, setCustomRequestError] = useState('');
  const [openRunMenu, setOpenRunMenu] = useState<'preview' | 'final' | null>(null);
  const interactionSourceRef = useRef<'keyboard' | 'mouse' | 'auto'>('auto');
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
  const [visualProvider, setVisualProvider] = useState<PreviewProvider>('replicate-flux-kontext-fast');
  const [useSelectedFrameAsBase, setUseSelectedFrameAsBase] = useState(true);
  const [storyboardSelectedIndex, setStoryboardSelectedIndex] = useState(3);
  const [storyboardPlaying, setStoryboardPlaying] = useState(false);
  const [visualPreviewState, setVisualPreviewState] = useState<{
    provider: PreviewProvider;
    useReferenceImage: boolean;
    loading: boolean;
    error: string | null;
    imageUrl: string | null;
    imageUrls: Array<string | null>;
  } | null>(null);
  const [videoPreviewState, setVideoPreviewState] = useState<{
    loading: boolean;
    error: string | null;
    videoUrl: string | null;
  } | null>(null);
  const finalVideoElRef = useRef<HTMLVideoElement>(null);
  
  // Refs for tracking previous state to prevent loops
  const previousSelectedSpanIdRef = useRef<string | null>(null);
  const previousSuggestionCountRef = useRef(0);

  // Get model + layout state from context
  const {
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    promptOptimizer,
    showHistory,
    setShowSettings,
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
  const activeVersionIndex = useMemo(() => {
    const entry =
      promptHistory.history.find((item) => item.uuid === currentPromptUuid) ||
      promptHistory.history.find((item) => item.id === currentPromptDocId) ||
      null;
    const versions = Array.isArray(entry?.versions) ? entry.versions : [];
    const index = versions.findIndex((version) => version.versionId === activeVersionId);
    return index >= 0 ? index + 1 : null;
  }, [promptHistory.history, currentPromptUuid, currentPromptDocId, activeVersionId]);

  const seedImageUrl = activeVersion?.preview?.imageUrl ?? null;
  const seedVideoUrl = activeVersion?.video?.videoUrl ?? null;
  const runMetaLabel = typeof activeVersionIndex === 'number' ? `Run #${activeVersionIndex}` : null;

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
    if (!openRunMenu) return;
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      const activeRef = openRunMenu === 'preview' ? previewRunMenuRef : finalRunMenuRef;
      if (activeRef.current && !activeRef.current.contains(target)) {
        setOpenRunMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openRunMenu, setOpenRunMenu]);

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
  const seedValue = generationParams?.seed;
  const durationLabel = typeof durationValue === 'number' ? `${durationValue}s` : '—';
  const fpsLabel = typeof fpsValue === 'number' ? `${fpsValue} fps` : '—';
  const aspectLabel = effectiveAspectRatio ? `AR ${effectiveAspectRatio}` : 'AR —';
  const durationMetaLabel =
    typeof durationValue === 'number' || typeof durationValue === 'string'
      ? `Duration ${durationValue}s`
      : 'Duration —';
  const fpsMetaLabel =
    typeof fpsValue === 'number' || typeof fpsValue === 'string' ? `FPS ${fpsValue}` : 'FPS —';
  const seedLabel =
    typeof seedValue === 'number' || typeof seedValue === 'string' ? String(seedValue) : 'Auto';
  const previewStatusState = isVisualPreviewGenerating
    ? 'generating'
    : visualLastGeneratedAt || seedImageUrl
      ? 'ready'
      : 'idle';
  const finalStatusState = isRailVideoPreviewGenerating
    ? 'generating'
    : railVideoLastGeneratedAt || seedVideoUrl
      ? 'ready'
      : 'idle';
  const previewStatusLabel =
    previewStatusState === 'generating'
      ? 'Running'
      : previewStatusState === 'ready'
        ? 'Complete'
        : 'Idle';
  const finalStatusLabel =
    finalStatusState === 'generating'
      ? 'Running'
      : finalStatusState === 'ready'
        ? 'Complete'
        : 'Idle';
  const previewEta = previewStatusState === 'generating' ? previewMetaDetail : null;
  const finalEta = finalStatusState === 'generating' ? finalMetaDetail : null;
  const canCompareRuns = previewStatusState === 'ready' && finalStatusState === 'ready';
  const previewCtaLabel = previewStatusState === 'ready' ? 'Open in Stage' : 'Generate Preview';
  const finalCtaLabel = finalStatusState === 'ready' ? 'Open Final' : 'Render Final';
  const previewCtaDisabled =
    previewStatusState === 'ready' ? false : !hasPreviewSource || isVisualPreviewGenerating;
  const finalCtaDisabled =
    finalStatusState === 'ready' ? false : !hasVideoPreviewSource || isRailVideoPreviewGenerating;
  const stageIsPreview = stageTab === 'preview';
  const stageIsGenerating = stageIsPreview ? isVisualPreviewGenerating : isRailVideoPreviewGenerating;
  const stageHasOutput = stageIsPreview
    ? Boolean(seedImageUrl || visualLastGeneratedAt)
    : Boolean(seedVideoUrl || railVideoLastGeneratedAt);
  const stageCtaLabel = stageIsPreview ? 'Generate' : 'Render Final';
  const stageCtaDisabled = stageIsPreview
    ? !hasPreviewSource || isVisualPreviewGenerating
    : !hasVideoPreviewSource || isRailVideoPreviewGenerating;
  const qualityLabel = (() => {
    const raw = (generationParams as Record<string, unknown> | null | undefined)?.quality;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return 'High';
  })();
  const stageFooterMeta = stageIsPreview
    ? visualProvider === 'replicate-flux-kontext-fast'
      ? 'Meta: Kontext storyboard · 4 frames · Click a step to preview'
      : `${aspectLabel} · Draft: ${target.label} · ${durationLabel} · ${fpsLabel}`
    : `WAN params: ${aspectLabel} · ${durationLabel} · ${fpsLabel} · Quality ${qualityLabel}`;

  const stageFinalVideoUrl = videoPreviewState?.videoUrl ?? seedVideoUrl ?? null;

  const storyboardFrames = useMemo(() => {
    const urls = visualPreviewState?.imageUrls ?? [];
    if (urls.length >= 4) return urls.slice(0, 4);
    if (urls.length > 0) return [...urls, ...Array.from({ length: Math.max(0, 4 - urls.length) }, () => null)];
    return Array.from({ length: 4 }, () => null);
  }, [visualPreviewState?.imageUrls]);
  const hasStoryboardFrames = useMemo(
    () => storyboardFrames.some((frame) => typeof frame === 'string' && Boolean(frame.trim())),
    [storyboardFrames]
  );
  const selectedStoryboardFrameUrl =
    storyboardFrames[storyboardSelectedIndex] && typeof storyboardFrames[storyboardSelectedIndex] === 'string'
      ? (storyboardFrames[storyboardSelectedIndex] as string)
      : null;

  useEffect(() => {
    if (stageTab !== 'preview') {
      setStoryboardPlaying(false);
    }
  }, [stageTab]);

  useEffect(() => {
    if (visualProvider !== 'replicate-flux-kontext-fast') return;
    if (!storyboardFrames.length) return;
    const lastNonNull = [...storyboardFrames]
      .map((url, index) => ({ url, index }))
      .reverse()
      .find((entry) => typeof entry.url === 'string' && Boolean(entry.url?.trim()));
    if (lastNonNull) {
      setStoryboardSelectedIndex(lastNonNull.index);
    }
  }, [visualProvider, storyboardFrames]);

  useEffect(() => {
    if (!storyboardPlaying) return;
    if (visualProvider !== 'replicate-flux-kontext-fast') return;
    if (!hasStoryboardFrames) return;
    const interval = window.setInterval(() => {
      setStoryboardSelectedIndex((prev) => (prev + 1) % 4);
    }, 1100);
    return () => window.clearInterval(interval);
  }, [hasStoryboardFrames, storyboardPlaying, visualProvider]);

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
    selectedSpanId && (suggestionsData?.isLoading || !suggestionsData || !selectionMatches)
  );
  const isInlineError = Boolean(suggestionsData?.isError);
  const inlineErrorMessage =
    typeof suggestionsData?.errorMessage === 'string' && suggestionsData.errorMessage.trim()
      ? suggestionsData.errorMessage.trim()
      : 'Failed to load suggestions.';
  const isInlineEmpty = Boolean(
    selectedSpanId && !isInlineLoading && !isInlineError && suggestionCount === 0
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
  }, [selectedSpanId, setCustomRequest]);

  useEffect(() => {
    const justOpened = previousSelectedSpanIdRef.current !== selectedSpanId && selectedSpanId;
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
  }, [activeSuggestionIndex, inlineSuggestions, handleSuggestionClickWithFeedback]);

  useEffect(() => {
    if (!selectedSpanId) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isCustomRequestTarget =
        !!target && Boolean(target.closest?.('.po-suggest-custom'));

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
                    <div className="prompt-card card prompt-card--original">
                      <div
                        className="prompt-card__header card__header"
                        data-has-video-controls={showVideoPreview ? 'true' : undefined}
                      >
                        <div className="prompt-card__header-row">
                          <div className="prompt-card__header-left">
                            <div className="prompt-card__title">Prompt</div>
                            <div className="prompt-card__subtitle">Input + settings (compact)</div>
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
                          <div className="prompt-card__chips chip-row" aria-label="Prompt controls">
                            <div className="prompt-chip chip">
                              <span className="chip__dot" aria-hidden="true" />
                              <span className="prompt-chip__label">Model</span>
                              <ModelSelectorDropdown
                                selectedModel={selectedModel}
                                onModelChange={handleModelChange}
                                disabled={isOptimizing}
                                variant="pillDark"
                              />
                            </div>

                            {aspectRatioInfo && (
                              <div className="prompt-chip chip">
                                <span className="chip__dot" aria-hidden="true" />
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
                              <div className="prompt-chip chip">
                                <span className="chip__dot" aria-hidden="true" />
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
                              <div className="prompt-chip chip">
                                <span className="chip__dot" aria-hidden="true" />
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
                      <div className="prompt-card__body card__body">
                        <label htmlFor="original-prompt-input" className="sr-only">
                          Input prompt
                        </label>
                        <div className="editor-well">
                          <textarea
                            ref={textareaRef}
                            id="original-prompt-input"
                            value={inputPrompt}
                            onChange={handleInputPromptChange}
                            onKeyDown={handleInputPromptKeyDown}
                            placeholder="Describe your shot..."
                            rows={3}
                            readOnly={isInputLocked}
                            className="prompt-input prompt-input--original input"
                            aria-label="Original prompt input"
                            aria-readonly={isInputLocked}
                            aria-busy={isOptimizing}
                          />
                        </div>
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
                      className="prompt-card card card--raised prompt-card--optimized"
                      data-settled={normalizedDisplayedPrompt ? 'true' : 'false'}
                    >
                      <div className="prompt-card__header card__header">
                        <div className="prompt-output-header">
                          <div className="prompt-output-title">
                            <div className="prompt-output-label">Optimized Editor</div>
                            <div className="prompt-output-subtitle">Click highlights → replace / edit (no overlay)</div>
                          </div>
                          <div className="prompt-output-actions">
                            <span
                              className="prompt-output-live status-pill"
                              data-state={isOutputFocused ? 'editing' : 'live'}
                            >
                              <span className="status-pill__dot" aria-hidden="true" />
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
                      </div>

                      <div className="prompt-card__body card__body">
                        <div className="po-editor-surface">
                          <div className="po-editor-surface__main">
                            <div
                              className="prompt-editor-wrapper editor-well"
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

                          <aside
                            className="po-suggest-sidecar"
                            aria-label="Suggestions"
                            data-active={selectedSpanId ? 'true' : 'false'}
                          >
                            <div className="inline-suggest-header po-suggest-header">
                              <div className="inline-suggest-title">
                                Suggestions
                                <span className="inline-suggest-pill">{selectedSpanId ? suggestionCount : 0}</span>
                              </div>
                              <div className="inline-suggest-keys" aria-hidden="true">
                                <span className="po-kbd">Up</span>
                                <span className="po-kbd">Down</span>
                                <span className="po-kbd">Enter</span>
                                <span className="po-kbd">Esc</span>
                              </div>
                            </div>

                            {!selectedSpanId ? (
                              <div className="po-surface-empty po-surface-empty--inline" aria-live="polite">
                                <div className="po-surface-empty__icon" aria-hidden="true">
                                  <Sparkles className="h-5 w-5" />
                                </div>
                                <div className="po-surface-empty__title">Select a highlight</div>
                                <div className="po-surface-empty__sub">
                                  Click a highlighted token to see suggestions.
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="inline-suggest-custom po-suggest-custom">
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
                                        data-selected={activeSuggestionIndex === index ? 'true' : 'false'}
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
                                    {selectionLabel ? `Replace "${selectionLabel}"` : 'Replace selection'}
                                  </div>
                                  <div className="inline-suggest-actions">
                                    <button
                                      type="button"
                                      className="inline-suggest-cta"
                                      onClick={closeInlinePopover}
                                    >
                                      Clear
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
                              </>
                            )}
                          </aside>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              <section className="po-runs card">
                <div className="po-runs__header">
                  <div>
                    <div className="po-runs__title">Runs</div>
                    <div className="po-runs__subtitle">
                      Preview + final generations (history, status, ETA)
                    </div>
                  </div>
                  <span className="po-runs__badge status-pill" data-status="live">
                    <span className="status-pill__dot" aria-hidden="true" />
                    Queue
                  </span>
                </div>

                <div className="po-runs__list">
                  <div
                    className="po-run-card card card--raised card--interactive"
                    data-status={previewStatusState}
                    data-variant="preview"
                  >
                    <div className="po-run-card__section po-run-card__header">
                      <div className="po-run-card__heading">
                        <div className="po-run-card__title">Preview Run</div>
                        {runMetaLabel && <div className="po-run-card__run-meta">{runMetaLabel}</div>}
                      </div>
                      <div className="po-run-card__status-group">
                        <span className="po-status-pill status-pill" data-status={previewStatusState}>
                          <span className="status-pill__dot" aria-hidden="true" />
                          {previewStatusLabel}
                        </span>
                        {previewEta && <span className="po-run-card__eta">{previewEta}</span>}
                        <div className="po-run-card__menu po-action-menu" ref={previewRunMenuRef}>
                          <button
                            type="button"
                            className="po-run-card__menu-btn"
                            onClick={() =>
                              setOpenRunMenu(openRunMenu === 'preview' ? null : 'preview')
                            }
                            aria-label="Run menu"
                            aria-haspopup="menu"
                            aria-expanded={openRunMenu === 'preview'}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openRunMenu === 'preview' && (
                            <div className="po-action-menu__popover" role="menu">
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                View logs
                              </button>
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                Duplicate settings
                              </button>
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                Share artifact link
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="po-run-card__section po-run-card__meta">
                      Draft model: {target.label} · {aspectLabel} · {durationMetaLabel} · {fpsMetaLabel}
                      · Seed {seedLabel}
                    </div>
                    <div className="po-run-card__section po-run-card__metrics">
                      <span className="po-run-card__metrics-label">Metrics:</span>
                      <span className="po-run-card__metrics-item">Tokens {RUN_METRICS.preview.tokens}</span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item">Est. cost {RUN_METRICS.preview.cost}</span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item" data-state="pass">
                        <span className="po-run-card__metric-dot" aria-hidden="true" />
                        Quality: {RUN_METRICS.preview.quality}
                      </span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item" data-state="pass">
                        <span className="po-run-card__metric-dot" aria-hidden="true" />
                        Safety: {RUN_METRICS.preview.safety}
                      </span>
                    </div>
                    <div className="po-run-card__section po-run-card__artifacts">
                      <div className="po-run-card__artifacts-label">Artifacts</div>
                      <div className="po-run-card__artifact-strip">
                        {RUN_ARTIFACTS.preview.map((artifact) => (
                          <button
                            key={artifact.id}
                            type="button"
                            className="po-run-card__artifact"
                            data-kind={artifact.kind}
                            aria-label={artifact.label}
                          />
                        ))}
                        <button type="button" className="po-run-card__view-all">
                          View all <span aria-hidden="true">&rarr;</span>
                        </button>
                      </div>
                    </div>
                    <div className="po-run-card__section po-run-card__actions">
                      <div className="po-run-card__links">
                        <button type="button" disabled={previewStatusState !== 'ready'}>
                          Retry
                        </button>
                        <button type="button" disabled={!canCompareRuns}>
                          Compare
                        </button>
                        <button type="button" disabled={previewStatusState === 'idle'}>
                          Logs
                        </button>
                        <button type="button">Copy settings</button>
                      </div>
                      <button
                        type="button"
                        onClick={
                          previewStatusState === 'ready'
                            ? () => setStageTab('preview')
                            : handleGenerateVisualPreview
                        }
                        disabled={previewCtaDisabled}
                        className="po-run-card__cta"
                      >
                        {previewCtaLabel}
                      </button>
                    </div>
                  </div>

                  <div
                    className="po-run-card card card--raised card--interactive"
                    data-status={finalStatusState}
                  >
                    <div className="po-run-card__section po-run-card__header">
                      <div className="po-run-card__heading">
                        <div className="po-run-card__title">Final Render</div>
                        {runMetaLabel && <div className="po-run-card__run-meta">{runMetaLabel}</div>}
                      </div>
                      <div className="po-run-card__status-group">
                        <span className="po-status-pill status-pill" data-status={finalStatusState}>
                          <span className="status-pill__dot" aria-hidden="true" />
                          {finalStatusLabel}
                        </span>
                        {finalEta && <span className="po-run-card__eta">{finalEta}</span>}
                        <div className="po-run-card__menu po-action-menu" ref={finalRunMenuRef}>
                          <button
                            type="button"
                            className="po-run-card__menu-btn"
                            onClick={() =>
                              setOpenRunMenu(openRunMenu === 'final' ? null : 'final')
                            }
                            aria-label="Run menu"
                            aria-haspopup="menu"
                            aria-expanded={openRunMenu === 'final'}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openRunMenu === 'final' && (
                            <div className="po-action-menu__popover" role="menu">
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                View logs
                              </button>
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                Duplicate settings
                              </button>
                              <button type="button" role="menuitem" onClick={() => setOpenRunMenu(null)}>
                                Share artifact link
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="po-run-card__section po-run-card__meta">
                      Draft model: {target.label} · {aspectLabel} · {durationMetaLabel} · {fpsMetaLabel}
                      · Seed {seedLabel}
                    </div>
                    <div className="po-run-card__section po-run-card__metrics">
                      <span className="po-run-card__metrics-label">Metrics:</span>
                      <span className="po-run-card__metrics-item">Tokens {RUN_METRICS.final.tokens}</span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item">Est. cost {RUN_METRICS.final.cost}</span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item" data-state="pass">
                        <span className="po-run-card__metric-dot" aria-hidden="true" />
                        Quality: {RUN_METRICS.final.quality}
                      </span>
                      <span className="po-run-card__metrics-sep">·</span>
                      <span className="po-run-card__metrics-item" data-state="pass">
                        <span className="po-run-card__metric-dot" aria-hidden="true" />
                        Safety: {RUN_METRICS.final.safety}
                      </span>
                    </div>
                    <div className="po-run-card__section po-run-card__artifacts">
                      <div className="po-run-card__artifacts-label">Artifacts</div>
                      <div className="po-run-card__artifact-strip">
                        {RUN_ARTIFACTS.final.map((artifact) => (
                          <button
                            key={artifact.id}
                            type="button"
                            className="po-run-card__artifact"
                            data-kind={artifact.kind}
                            aria-label={artifact.label}
                          />
                        ))}
                        <button type="button" className="po-run-card__view-all">
                          View all <span aria-hidden="true">&rarr;</span>
                        </button>
                      </div>
                    </div>
                    <div className="po-run-card__section po-run-card__actions">
                      <div className="po-run-card__links">
                        <button type="button" disabled={finalStatusState !== 'ready'}>
                          Retry
                        </button>
                        <button type="button" disabled={!canCompareRuns}>
                          Compare
                        </button>
                        <button type="button" disabled={finalStatusState === 'idle'}>
                          Logs
                        </button>
                        <button type="button">Copy settings</button>
                      </div>
                      <button
                        type="button"
                        onClick={
                          finalStatusState === 'ready'
                            ? () => setStageTab('final')
                            : handleGenerateRailVideoPreview
                        }
                        disabled={finalCtaDisabled}
                        className="po-run-card__cta"
                      >
                        {finalCtaLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
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
              <div className="po-stage__tabs segmented">
                <button
                  type="button"
                  onClick={() => setStageTab('preview')}
                  data-active={stageTab === 'preview' ? 'true' : 'false'}
                  className="segmented__tab"
                  aria-selected={stageTab === 'preview'}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setStageTab('final')}
                  data-active={stageTab === 'final' ? 'true' : 'false'}
                  className="segmented__tab"
                  aria-selected={stageTab === 'final'}
                >
                  Final
                </button>
              </div>
            </div>

            <div className="po-stage__frame">
              {stageTab === 'preview' ? (
                <>
                  <div className="po-stagebar" aria-label="Preview controls">
                    <div className="po-stagebar__left">
                      <span className="po-stagebar__label">Provider</span>
                      <select
                        className="po-stagebar__select"
                        value={visualProvider}
                        onChange={(event) => setVisualProvider(event.target.value as PreviewProvider)}
                        aria-label="Preview provider"
                      >
                        <option value="replicate-flux-kontext-fast">Kontext</option>
                        <option value="replicate-flux-schnell">Schnell</option>
                      </select>
                    </div>

                    <div className="po-stagebar__right">
                      {visualProvider === 'replicate-flux-kontext-fast' && hasStoryboardFrames && (
                        <label className="po-stagebar__toggle">
                          <input
                            type="checkbox"
                            checked={useSelectedFrameAsBase}
                            onChange={(event) => setUseSelectedFrameAsBase(event.target.checked)}
                          />
                          <span>Use selected frame as base</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {visualProvider === 'replicate-flux-kontext-fast' ? (
                    <div className="po-storyboard">
                      <div className="po-storyboard__focused">
                        <div className="po-storyboard__section-label">Focused frame (selected from timeline)</div>
                        <div className="po-storyboard__focused-card">
                          <div className="po-storyboard__focused-title">
                            Frame {storyboardSelectedIndex + 1}{' '}
                            <span className="po-storyboard__focused-sub">
                              — {storyboardSelectedIndex === 0 ? 'Base' : `Edit ${storyboardSelectedIndex}`}
                            </span>
                          </div>
                          <div className="po-storyboard__focused-surface">
                            {selectedStoryboardFrameUrl ? (
                              <img
                                src={selectedStoryboardFrameUrl}
                                alt={`Frame ${storyboardSelectedIndex + 1}`}
                                className="po-storyboard__focused-media"
                              />
                            ) : (
                              <div className="po-stage-surface__blank" />
                            )}
                            {hasStoryboardFrames && (
                              <button
                                type="button"
                                className="po-storyboard__play"
                                onClick={() => setStoryboardPlaying((prev) => !prev)}
                                aria-label={storyboardPlaying ? 'Pause storyboard playback' : 'Play storyboard'}
                              >
                                {storyboardPlaying ? (
                                  <Pause className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Play className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            )}
                            {!isVisualPreviewGenerating && !hasStoryboardFrames && (
                              <div className="po-surface-empty" aria-live="polite">
                                <div className="po-surface-empty__icon" aria-hidden="true">
                                  <Play className="h-5 w-5" />
                                </div>
                                <div className="po-surface-empty__title">Stage is set</div>
                                <div className="po-surface-empty__sub">
                                  Generate a preview to validate framing, lighting, and mood.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="po-storyboard__timeline">
                        <div className="po-storyboard__section-label">
                          Timeline (Base &rarr; Edit 1 &rarr; Edit 2 &rarr; Edit 3)
                        </div>
                        <div className="po-storyboard__timeline-list" role="list">
                          {[
                            { title: '1. Base', delta: '(generated or seeded)' },
                            { title: '2. Edit 1', delta: 'pose / gesture' },
                            { title: '3. Edit 2', delta: 'lighting / skyline' },
                            { title: '4. Edit 3', delta: 'final polish / tone' },
                          ].map((step, index) => {
                            const thumb = storyboardFrames[index];
                            const isSelected = storyboardSelectedIndex === index;
                            return (
                              <button
                                key={step.title}
                                type="button"
                                className="po-timeline-item"
                                data-selected={isSelected ? 'true' : 'false'}
                                onClick={() => {
                                  setStoryboardPlaying(false);
                                  setStoryboardSelectedIndex(index);
                                }}
                                role="listitem"
                              >
                                <span className="po-timeline-item__rail" aria-hidden="true" />
                                <span className="po-timeline-item__thumb" aria-hidden="true">
                                  {typeof thumb === 'string' && thumb ? (
                                    <img src={thumb} alt="" />
                                  ) : (
                                    <span className="po-timeline-item__thumb-blank" />
                                  )}
                                </span>
                                <span className="po-timeline-item__text">
                                  <span className="po-timeline-item__title">{step.title}</span>
                                  <span className="po-timeline-item__delta">{step.delta}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hidden renderer to run generation + keep state in sync */}
                      <div className="po-storyboard__hidden" aria-hidden="true">
                        <VisualPreview
                          prompt={previewSource}
                          aspectRatio={effectiveAspectRatio}
                          isVisible={true}
                          provider={visualProvider}
                          seedImageUrl={useSelectedFrameAsBase ? selectedStoryboardFrameUrl : null}
                          useReferenceImage={useSelectedFrameAsBase}
                          generateRequestId={visualGenerateRequestId}
                          lastGeneratedAt={visualLastGeneratedAt}
                          onPreviewGenerated={handleVisualPreviewGenerated}
                          onLoadingChange={setVisualPreviewGenerating}
                          onPreviewStateChange={(state) => setVisualPreviewState(state)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="po-stage-surface">
                      <div className="po-stage-surface__media" aria-label="Image preview surface">
                        <VisualPreview
                          prompt={previewSource}
                          aspectRatio={effectiveAspectRatio}
                          isVisible={true}
                          provider={visualProvider}
                          seedImageUrl={seedImageUrl}
                          generateRequestId={visualGenerateRequestId}
                          lastGeneratedAt={visualLastGeneratedAt}
                          onPreviewGenerated={handleVisualPreviewGenerated}
                          onLoadingChange={setVisualPreviewGenerating}
                          onPreviewStateChange={(state) => setVisualPreviewState(state)}
                        />
                      </div>
                      {!isVisualPreviewGenerating && !stageHasOutput && (
                        <div className="po-surface-empty" aria-live="polite">
                          <div className="po-surface-empty__icon" aria-hidden="true">
                            <Play className="h-5 w-5" />
                          </div>
                          <div className="po-surface-empty__title">Stage is set</div>
                          <div className="po-surface-empty__sub">
                            Generate a preview to validate framing, lighting, and mood.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="po-stagebar po-stagebar--final" aria-label="Final status">
                    <span className="po-stagebar__status status-pill" data-status={finalStatusState}>
                      <span className="status-pill__dot" aria-hidden="true" />
                      {finalStatusState === 'generating'
                        ? 'Generating'
                        : finalStatusState === 'ready'
                          ? 'Ready'
                          : 'Idle'}
                    </span>
                    <span className="po-stagebar__model">Model: WAN 2.2</span>
                    <span className="po-stagebar__spacer" aria-hidden="true" />
                    {finalStatusState === 'ready' && stageFinalVideoUrl && (
                      <div className="po-stagebar__actions" role="group" aria-label="Final quick actions">
                        <button
                          type="button"
                          className="po-stagebar__action"
                          onClick={() => window.open(stageFinalVideoUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Download
                        </button>
                        <button
                          type="button"
                          className="po-stagebar__action"
                          onClick={() => window.open(stageFinalVideoUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="po-final-surface">
                    <div
                      className="po-final-surface__media"
                      onClick={() => {
                        const el = finalVideoElRef.current;
                        if (!el) return;
                        if (el.paused) void el.play();
                        else el.pause();
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Video preview surface"
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        const el = finalVideoElRef.current;
                        if (!el) return;
                        if (el.paused) void el.play();
                        else el.pause();
                      }}
                    >
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
                        videoRef={finalVideoElRef}
                        onPreviewGenerated={handleRailVideoPreviewGenerated}
                        onLoadingChange={setRailVideoPreviewGenerating}
                        onPreviewStateChange={(state) => setVideoPreviewState(state)}
                      />
                      {!stageFinalVideoUrl && <div className="po-stage-surface__blank" />}
                      <div className="po-final-surface__overlay" aria-hidden="true">
                        <div className="po-final-surface__play">
                          <Play className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                      {!isRailVideoPreviewGenerating && !stageFinalVideoUrl && (
                        <div className="po-surface-empty" aria-live="polite">
                          <div className="po-surface-empty__icon" aria-hidden="true">
                            <Play className="h-5 w-5" />
                          </div>
                          <div className="po-surface-empty__title">Stage is set</div>
                          <div className="po-surface-empty__sub">
                            Generate the final render when you are ready.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="po-final-surface__scrub" aria-label="Timeline scrub">
                      <input type="range" min={0} max={100} defaultValue={0} disabled={!stageFinalVideoUrl} />
                    </div>
                  </div>
                </>
              )}

              {/* Stage-owned overlays */}
              {stageTab === 'preview' &&
                visualPreviewState?.error &&
                !isVisualPreviewGenerating && (
                  <div className="po-stage__overlay po-stage__overlay--error" role="alert">
                    Preview failed. Try again.
                  </div>
                )}
              {stageTab === 'final' && videoPreviewState?.error && !isRailVideoPreviewGenerating && (
                <div className="po-stage__overlay po-stage__overlay--error" role="alert">
                  Final preview failed. Try again.
                </div>
              )}
              {stageIsGenerating && (
                <div className="po-stage__overlay po-stage__overlay--loading" aria-label="Generating">
                  <LoadingDots size={3} color="rgb(163, 163, 163)" />
                </div>
              )}
            </div>

            <div className="po-stage__footer">
              <div className="po-stage__meta">
                {stageFooterMeta}
              </div>
              {stageTab === 'final' && (
                <button
                  type="button"
                  className="po-stage__link"
                  onClick={() => setShowSettings(true)}
                >
                  Edit settings
                </button>
              )}
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

          {/* Settings live with the Prompt panel (Stage shows read-only summaries). */}
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
