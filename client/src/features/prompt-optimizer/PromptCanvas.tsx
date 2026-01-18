import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import {
  Pencil,
  X,
  Check,
  Copy,
  Diff,
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
import { Button, type ButtonProps } from '@promptstudio/system/components/ui/button';
import { Checkbox } from '@promptstudio/system/components/ui/checkbox';
import { Dialog, DialogContent } from '@promptstudio/system/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptstudio/system/components/ui/select';
import { Slider } from '@promptstudio/system/components/ui/slider';
import { Textarea } from '@promptstudio/system/components/ui/textarea';

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
import { VersionsPanel } from './components/VersionsPanel';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import { VisualPreview, VideoPreview, type PreviewProvider } from '@/features/preview';
import { useModelRegistry } from './hooks/useModelRegistry';
import { AI_MODEL_IDS, AI_MODEL_LABELS, AI_MODEL_PROVIDERS } from './components/constants';
import { usePromptState } from './context/PromptStateContext';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue } from '@shared/capabilities';
import { cn } from '@/utils/cn';


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

const CanvasButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, ...props }, ref) => (
    <Button ref={ref} variant={variant ?? 'ghost'} {...props} />
  )
);

CanvasButton.displayName = 'CanvasButton';

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
  const { models: registryModels } = useModelRegistry();

  const modelOptions = useMemo(() => {
    if (registryModels.length) return registryModels;
    return [...AI_MODEL_IDS]
      .map((id) => ({
        id,
        label: AI_MODEL_LABELS[id],
        provider: AI_MODEL_PROVIDERS[id],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registryModels]);

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
      if (Object.is(generationParams?.[key], value)) {
        return;
      }
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
      ariaLabel: string,
      disabled: boolean
    ) => {
      if (!info) return null;

      const formatDisplay = (val: unknown) => {
        if (key === 'duration_s') return `${val}s`;
        if (key === 'fps') return `${val} fps`;
        return String(val);
      };

      const currentRaw = generationParams?.[key] ?? info.field.default ?? '';

      return (
        <Select
          value={String(currentRaw)}
          onValueChange={(value) => {
            const val = info.field.type === 'int' ? Number(value) : value;
            handleParamChange(key, val);
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              'h-9 w-auto rounded-full border border-border bg-surface-2 px-3 text-label-sm font-semibold text-foreground shadow-sm transition-colors',
              'hover:border-border-strong hover:bg-surface-3'
            )}
            aria-label={ariaLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {info.allowedValues.map((value) => (
              <SelectItem key={String(value)} value={String(value)}>
                {formatDisplay(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
    [generationParams, handleParamChange]
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
    const nextVisual = toMs(activeVersion?.preview?.generatedAt ?? null);
    const nextVideo = toMs(activeVersion?.video?.generatedAt ?? null);
    // Use setState directly to batch updates and avoid dependency on wrapper callbacks
    setState({
      visualLastGeneratedAt: nextVisual,
      videoLastGeneratedAt: nextVideo,
    });
  }, [
    activeVersion?.preview?.generatedAt,
    activeVersion?.video?.generatedAt,
    setState,
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

    const el = root.querySelector(`[data-span-id="${escapeAttr(hoveredSpanId)}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.add('brightness-90');
    inspectedSpanElementRef.current = el;
    return () => {
      el.classList.remove('brightness-90');
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
    const nextModel = modelId.trim();
    // Only enter edit mode if model actually changed
    const modelChanged = nextModel !== selectedModel;
    if (!modelChanged) {
      return;
    }
    setSelectedModel(nextModel);
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
    // Note: setCustomRequest is stable (from useState) so not needed in deps
  }, [selectedSpanId]);

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

  const handleVisualPreviewStateChange = useCallback(
    (nextState: {
      provider: PreviewProvider;
      useReferenceImage: boolean;
      loading: boolean;
      error: string | null;
      imageUrl: string | null;
      imageUrls: Array<string | null>;
    }) => {
      setVisualPreviewState((prev) => {
        if (
          prev &&
          prev.provider === nextState.provider &&
          prev.useReferenceImage === nextState.useReferenceImage &&
          prev.loading === nextState.loading &&
          prev.error === nextState.error &&
          prev.imageUrl === nextState.imageUrl &&
          prev.imageUrls.length === nextState.imageUrls.length &&
          prev.imageUrls.every((url, index) => url === nextState.imageUrls[index])
        ) {
          return prev;
        }
        return nextState;
      });
    },
    [setVisualPreviewState]
  );

  const handleVideoPreviewStateChange = useCallback(
    (nextState: { loading: boolean; error: string | null; videoUrl: string | null }) => {
      setVideoPreviewState((prev) => {
        if (
          prev &&
          prev.loading === nextState.loading &&
          prev.error === nextState.error &&
          prev.videoUrl === nextState.videoUrl
        ) {
          return prev;
        }
        return nextState;
      });
    },
    [setVideoPreviewState]
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

  const outputStatusStyles = isOutputFocused
    ? { text: 'text-warning', dot: 'bg-warning' }
    : { text: 'text-foreground', dot: 'bg-accent' };

  const runStatusStyles = (state: 'idle' | 'generating' | 'ready' | 'failed') => {
    switch (state) {
      case 'generating':
        return { text: 'text-foreground', dot: 'bg-accent' };
      case 'ready':
        return { text: 'text-foreground', dot: 'bg-success' };
      case 'failed':
        return { text: 'text-error', dot: 'bg-error' };
      default:
        return { text: 'text-muted', dot: 'bg-border' };
    }
  };

  const metricStyles = (state: 'pass' | 'warn' | 'fail') => {
    switch (state) {
      case 'warn':
        return { text: 'text-warning', dot: 'bg-warning' };
      case 'fail':
        return { text: 'text-error', dot: 'bg-error' };
      default:
        return { text: 'text-foreground', dot: 'bg-success' };
    }
  };

  const previewStatusStyles = runStatusStyles(previewStatusState);
  const finalStatusStyles = runStatusStyles(finalStatusState);

  const actionButtonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg border border-transparent bg-transparent px-3 text-label-sm font-semibold text-muted transition-colors hover:border-border hover:bg-surface-3 hover:text-foreground disabled:opacity-50 disabled:pointer-events-none';
  const iconButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-muted transition-colors hover:border-border hover:bg-surface-3 hover:text-foreground disabled:opacity-50 disabled:pointer-events-none';
  const primaryButtonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-gradient-to-r from-accent to-accent-2 px-4 text-label-sm font-semibold text-app shadow-md transition-transform hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0';
  const statusPillClass =
    'inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2 py-1 text-label-sm font-semibold uppercase tracking-wide';

  // Render the component
  return (
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col', isPreviewGenerating && 'cursor-progress')}
      data-mode={selectedMode}
      data-preview-generating={isPreviewGenerating ? 'true' : 'false'}
      data-outline-open={outlineOverlayActive ? 'true' : 'false'}
      aria-busy={isPreviewGenerating ? 'true' : 'false'}
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
            'absolute left-6 top-6 bottom-6 z-modal flex w-96 flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg',
            'ps-animate-scale-in'
          )}
          data-state={outlineOverlayState}
          role="dialog"
          aria-label="Prompt structure"
        >
          <div className="border-b border-border p-4">
            <div className="text-body-lg font-semibold text-foreground">Prompt Structure</div>
            <div className="mt-1 text-label-sm text-muted">Semantic breakdown used for generation</div>
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
          <div className="border-t border-border p-3 text-label-sm text-muted">
            Hover a token to locate it in the prompt
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col gap-6 p-6 xl:flex-row',
          outlineOverlayActive && 'pointer-events-none opacity-60'
        )}
      >
        {showVideoPreview && isAnyVideoPreviewGenerating && (
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-surface-1/70 backdrop-blur-sm"
            aria-hidden="true"
          />
        )}

        {/* Context gutter (xl+ only) */}
        <div className="hidden min-h-0 flex-shrink-0 xl:flex xl:w-80">
          <VersionsPanel />
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div
          ref={editorColumnRef}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {!outlineOverlayActive && (
            <div className="mx-auto flex w-full max-w-5xl">
              <CanvasButton
                type="button"
                onClick={openOutlineOverlay}
                className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted shadow-sm transition hover:border-border-strong hover:text-foreground"
                aria-label="Open outline"
                title="Open outline"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </CanvasButton>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-6">
              <div
                className={cn(
                  'rounded-xl border border-border bg-surface-2 shadow-sm transition-opacity',
                  isOptimizing && 'opacity-70'
                )}
              >
                <div
                  className={cn(
                    'flex flex-col gap-3 border-b border-border p-4',
                    showVideoPreview && 'items-stretch'
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="text-body-lg font-semibold text-foreground">Prompt</div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <CanvasButton
                          type="button"
                          onClick={handleEditClick}
                          disabled={isOptimizing}
                          className={actionButtonClass}
                          aria-label="Edit prompt"
                          title="Edit prompt"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </CanvasButton>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CanvasButton
                            type="button"
                            onClick={handleCancel}
                            disabled={isOptimizing}
                            className={actionButtonClass}
                            aria-label="Cancel editing"
                            title="Cancel editing"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Cancel</span>
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            onClick={handleUpdate}
                            disabled={isReoptimizeDisabled}
                            className={primaryButtonClass}
                            aria-label="Update prompt"
                            title="Update and re-optimize (Cmd/Ctrl+Enter)"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Update</span>
                          </CanvasButton>
                        </div>
                      )}
                    </div>
                  </div>

                  {showVideoPreview && (
                    <div className="flex flex-wrap items-center gap-2" aria-label="Prompt controls">
                      <Select
                        value={selectedModel && selectedModel.trim() ? selectedModel : 'auto'}
                        onValueChange={(value) => handleModelChange(value === 'auto' ? '' : value)}
                        disabled={isOptimizing}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-9 w-auto rounded-full border border-border bg-surface-2 px-3 text-label-sm font-semibold text-foreground shadow-sm transition-colors',
                            'hover:border-border-strong hover:bg-surface-3'
                          )}
                          aria-label="Model"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (Recommended)</SelectItem>
                          {modelOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {aspectRatioInfo &&
                        renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect ratio', isOptimizing)}

                      {durationInfo &&
                        renderDropdown(durationInfo, 'duration_s', 'Duration', isOptimizing)}

                      {fpsInfo && renderDropdown(fpsInfo, 'fps', 'Frame rate', isOptimizing)}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <label htmlFor="original-prompt-input" className="ps-sr-only">
                    Input prompt
                  </label>
                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <Textarea
                      ref={textareaRef}
                      id="original-prompt-input"
                      value={inputPrompt}
                      onChange={handleInputPromptChange}
                      onKeyDown={handleInputPromptKeyDown}
                      placeholder="Describe your shot..."
                      rows={3}
                      readOnly={isInputLocked}
                      className="min-h-24 max-h-48 w-full resize-y bg-transparent p-0 text-body text-foreground placeholder:text-faint focus-visible:ring-0 focus-visible:ring-offset-0"
                      aria-label="Original prompt input"
                      aria-readonly={isInputLocked}
                      aria-busy={isOptimizing}
                    />
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'rounded-xl border border-border bg-surface-3 shadow-sm transition-opacity',
                  isOutputLoading && 'opacity-80'
                )}
              >
                <div className="border-b border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="text-body-lg font-semibold text-foreground">Optimized Editor</div>
                      <div className="text-label-sm text-muted">
                        Click highlights → replace / edit (no overlay)
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(statusPillClass, outputStatusStyles.text)}>
                        <span
                          className={cn('h-2 w-2 rounded-full', outputStatusStyles.dot)}
                          aria-hidden="true"
                        />
                        {isOutputFocused ? 'Editing' : 'LIVE'}
                      </span>
                      <CanvasButton
                        type="button"
                        className={iconButtonClass}
                        onClick={handleCopy}
                        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
                        title={copied ? 'Copied' : 'Copy'}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                      </CanvasButton>
                      <CanvasButton
                        type="button"
                        className={iconButtonClass}
                        onClick={() => setShowDiff(true)}
                        aria-label="Open diff"
                        title="Diff"
                      >
                        <Diff className="h-4 w-4" aria-hidden="true" />
                      </CanvasButton>
                      <div className="relative" ref={exportMenuRef}>
                        <CanvasButton
                          type="button"
                          className={iconButtonClass}
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          aria-expanded={showExportMenu}
                          aria-label="Export"
                          title="Export"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </CanvasButton>
                        {showExportMenu && (
                          <div
                            className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-border bg-surface-2 p-2 shadow-md"
                            role="menu"
                          >
                            <CanvasButton
                              type="button"
                              onClick={() => handleExport('text')}
                              role="menuitem"
                              className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                            >
                              Export .txt
                            </CanvasButton>
                            <CanvasButton
                              type="button"
                              onClick={() => handleExport('markdown')}
                              role="menuitem"
                              className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                            >
                              Export .md
                            </CanvasButton>
                            <CanvasButton
                              type="button"
                              onClick={() => handleExport('json')}
                              role="menuitem"
                              className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                            >
                              Export .json
                            </CanvasButton>
                          </div>
                        )}
                      </div>
                      <CanvasButton
                        type="button"
                        className={iconButtonClass}
                        onClick={handleShare}
                        aria-label="Share prompt"
                      >
                        <Share2 className="h-4 w-4" />
                      </CanvasButton>
                      <CanvasButton
                        type="button"
                        className={iconButtonClass}
                        onClick={onUndo}
                        disabled={!canUndo}
                        aria-label="Undo"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </CanvasButton>
                      <CanvasButton
                        type="button"
                        className={iconButtonClass}
                        onClick={onRedo}
                        disabled={!canRedo}
                        aria-label="Redo"
                      >
                        <RotateCw className="h-4 w-4" />
                      </CanvasButton>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex min-h-0 flex-col gap-6 xl:flex-row">
                    <div
                      className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface-1 p-4"
                      aria-busy={isOutputLoading}
                      ref={editorWrapperRef}
                    >
                      <PromptEditor
                        ref={editorRef as React.RefObject<HTMLDivElement>}
                        className="min-h-44 w-full whitespace-pre-wrap font-sans text-body text-foreground outline-none"
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
                        className={cn(
                          'mt-4 h-px w-full origin-left scale-x-0 bg-border transition-transform duration-300',
                          stageIsGenerating && 'scale-x-100'
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
                              'absolute z-10 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-full -mt-1.5 items-center justify-center rounded-full border border-border bg-surface-2 text-muted shadow-md transition-colors',
                              'hover:border-border-strong hover:bg-surface-3 hover:text-foreground',
                              isHoveredLocked && 'border-accent text-foreground'
                            )}
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
                          </CanvasButton>
                        )}
                      {isOutputLoading && (
                        <div
                          className="absolute inset-0 flex items-start justify-start rounded-lg bg-surface-1/80 p-5 backdrop-blur-sm"
                          role="status"
                          aria-live="polite"
                          aria-label="Optimizing prompt"
                        >
                          <LoadingDots size={3} className="text-faint" />
                        </div>
                      )}
                    </div>

                    <aside
                      className={cn(
                        'flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-surface-2 shadow-sm xl:w-80',
                        !selectedSpanId && 'opacity-80'
                      )}
                      aria-label="Suggestions"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                          Suggestions
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-3 px-2 py-0.5 text-label-sm text-muted">
                            {selectedSpanId ? suggestionCount : 0}
                          </span>
                        </div>
                        <div className="hidden items-center gap-1 text-muted sm:flex" aria-hidden="true">
                          <span className="rounded-md border border-border bg-surface-3 px-2 py-0.5 text-label-sm font-semibold text-muted">
                            Up
                          </span>
                          <span className="rounded-md border border-border bg-surface-3 px-2 py-0.5 text-label-sm font-semibold text-muted">
                            Down
                          </span>
                          <span className="rounded-md border border-border bg-surface-3 px-2 py-0.5 text-label-sm font-semibold text-muted">
                            Enter
                          </span>
                          <span className="rounded-md border border-border bg-surface-3 px-2 py-0.5 text-label-sm font-semibold text-muted">
                            Esc
                          </span>
                        </div>
                      </div>

                      {!selectedSpanId ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-3 text-muted shadow-sm">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="text-body-sm font-semibold text-foreground">Select a highlight</div>
                          <div className="text-label-sm text-muted">
                            Click a highlighted token to see suggestions.
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="border-b border-border px-4 py-3" data-suggest-custom>
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
                                className="min-h-9 flex-1 resize-none rounded-lg border border-border bg-surface-1 px-3 py-2 text-body-sm text-foreground placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0"
                                maxLength={MAX_REQUEST_LENGTH}
                                rows={1}
                                aria-label="Custom suggestion request"
                              />
                              <CanvasButton
                                type="submit"
                                className={cn(
                                  'h-9 rounded-lg border border-accent bg-accent px-3 text-label-sm font-semibold text-app shadow-sm transition hover:opacity-90',
                                  isCustomRequestDisabled && 'opacity-50'
                                )}
                                disabled={isCustomRequestDisabled}
                                aria-busy={isCustomLoading}
                              >
                                {isCustomLoading ? 'Applying...' : 'Apply'}
                              </CanvasButton>
                            </form>
                            {customRequestError && (
                              <div className="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error" role="alert">
                                {customRequestError}
                              </div>
                            )}
                          </div>

                          {isInlineError && (
                            <div className="mx-4 mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error" role="alert">
                              {inlineErrorMessage}
                            </div>
                          )}

                          {isInlineLoading && (
                            <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                              <div className="h-9 w-full animate-pulse rounded-lg bg-surface-3" />
                              <div className="h-9 w-full animate-pulse rounded-lg bg-surface-3" />
                              <div className="h-9 w-full animate-pulse rounded-lg bg-surface-3" />
                            </div>
                          )}

                          {!isInlineLoading && !isInlineError && suggestionCount > 0 && (
                            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3" ref={suggestionsListRef}>
                              {inlineSuggestions.map((suggestion, index) => (
                                <div
                                  key={suggestion.key}
                                  data-index={index}
                                  data-selected={activeSuggestionIndex === index ? 'true' : 'false'}
                                  className={cn(
                                    'flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2 text-body-sm text-foreground transition-colors',
                                    'hover:border-border-strong hover:bg-surface-2',
                                    activeSuggestionIndex === index && 'border-accent/50 bg-accent/10'
                                  )}
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
                                  <div className="min-w-0 text-body-sm text-foreground">{suggestion.text}</div>
                                  {index === 0 ? (
                                    <span className="inline-flex flex-shrink-0 items-center rounded-full bg-accent/10 px-2 py-0.5 text-label-sm font-semibold text-accent">
                                      Best match
                                    </span>
                                  ) : suggestion.meta ? (
                                    <div className="flex-shrink-0 text-label-sm text-muted">{suggestion.meta}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}

                          {isInlineEmpty && (
                            <div className="flex flex-1 items-center px-4 pb-4 text-label-sm text-muted">
                              No suggestions yet.
                            </div>
                          )}

                          <div className="border-t border-border px-4 py-3">
                            <div className="text-label-sm text-muted">
                              {selectionLabel ? `Replace "${selectionLabel}"` : 'Replace selection'}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <CanvasButton
                                type="button"
                                className="h-9 rounded-lg border border-border bg-surface-3 px-3 text-label-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                                onClick={closeInlinePopover}
                              >
                                Clear
                              </CanvasButton>
                              <CanvasButton
                                type="button"
                                className={cn(
                                  'h-9 rounded-lg border border-accent bg-accent px-3 text-label-sm font-semibold text-app shadow-sm transition hover:opacity-90',
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
                        </>
                      )}
                    </aside>
                  </div>
                </div>
              </div>

              <section className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-body-lg font-semibold text-foreground">Runs</div>
                    <div className="mt-1 text-label-sm text-muted">
                      Preview + final generations (history, status, ETA)
                    </div>
                  </div>
                  <span className={cn(statusPillClass, 'text-foreground normal-case tracking-normal')}>
                    <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                    Queue
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <div
                    className={cn(
                      'flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 shadow-sm',
                      previewStatusState === 'ready' && 'border-accent/50'
                    )}
                    data-status={previewStatusState}
                  >
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-body-sm font-semibold text-foreground">Preview Run</div>
                          {runMetaLabel && (
                            <div className="text-label-sm text-faint">{runMetaLabel}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(statusPillClass, previewStatusStyles.text, 'normal-case tracking-normal')}>
                            <span
                              className={cn('h-2 w-2 rounded-full', previewStatusStyles.dot)}
                              aria-hidden="true"
                            />
                            {previewStatusLabel}
                          </span>
                          {previewEta && <span className="text-label-sm text-faint">{previewEta}</span>}
                          <div className="relative" ref={previewRunMenuRef}>
                            <CanvasButton
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                              onClick={() =>
                                setOpenRunMenu(openRunMenu === 'preview' ? null : 'preview')
                              }
                              aria-label="Run menu"
                              aria-haspopup="menu"
                              aria-expanded={openRunMenu === 'preview'}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </CanvasButton>
                            {openRunMenu === 'preview' && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-border bg-surface-2 p-2 shadow-md" role="menu">
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  View logs
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  Duplicate settings
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  Share artifact link
                                </CanvasButton>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3 text-label-sm text-muted">
                      Draft model: {target.label} · {aspectLabel} · {durationMetaLabel} · {fpsMetaLabel}
                      · Seed {seedLabel}
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-label-sm text-muted">
                        <span className="font-semibold text-faint">Metrics:</span>
                        <span>Tokens {RUN_METRICS.preview.tokens}</span>
                        <span className="text-faint">·</span>
                        <span>Est. cost {RUN_METRICS.preview.cost}</span>
                        <span className="text-faint">·</span>
                        <span className={cn('inline-flex items-center gap-1.5', metricStyles('pass').text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', metricStyles('pass').dot)} aria-hidden="true" />
                          Quality: {RUN_METRICS.preview.quality}
                        </span>
                        <span className="text-faint">·</span>
                        <span className={cn('inline-flex items-center gap-1.5', metricStyles('pass').text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', metricStyles('pass').dot)} aria-hidden="true" />
                          Safety: {RUN_METRICS.preview.safety}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="text-label-sm text-faint">Artifacts</div>
                      <div className="mt-2 flex items-center gap-2 overflow-hidden">
                        {RUN_ARTIFACTS.preview.map((artifact) => (
                          <CanvasButton
                            key={artifact.id}
                            type="button"
                            className={cn(
                              'h-8 w-12 rounded-md border border-border bg-surface-3 transition-colors hover:border-border-strong',
                              artifact.kind === 'preview' && 'border-accent/50 bg-accent/10'
                            )}
                            data-kind={artifact.kind}
                            aria-label={artifact.label}
                          />
                        ))}
                        <CanvasButton
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-label-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          View all <span aria-hidden="true">&rarr;</span>
                        </CanvasButton>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CanvasButton
                            type="button"
                            disabled={previewStatusState !== 'ready'}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Retry
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            disabled={!canCompareRuns}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Compare
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            disabled={previewStatusState === 'idle'}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Logs
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Copy settings
                          </CanvasButton>
                        </div>
                        <CanvasButton
                          type="button"
                          onClick={
                            previewStatusState === 'ready'
                              ? () => setStageTab('preview')
                              : handleGenerateVisualPreview
                          }
                          disabled={previewCtaDisabled}
                          className={cn(primaryButtonClass, 'min-w-40 justify-center')}
                        >
                          {previewCtaLabel}
                        </CanvasButton>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 shadow-sm"
                    data-status={finalStatusState}
                  >
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-body-sm font-semibold text-foreground">Final Render</div>
                          {runMetaLabel && (
                            <div className="text-label-sm text-faint">{runMetaLabel}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(statusPillClass, finalStatusStyles.text, 'normal-case tracking-normal')}>
                            <span
                              className={cn('h-2 w-2 rounded-full', finalStatusStyles.dot)}
                              aria-hidden="true"
                            />
                            {finalStatusLabel}
                          </span>
                          {finalEta && <span className="text-label-sm text-faint">{finalEta}</span>}
                          <div className="relative" ref={finalRunMenuRef}>
                            <CanvasButton
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                              onClick={() =>
                                setOpenRunMenu(openRunMenu === 'final' ? null : 'final')
                              }
                              aria-label="Run menu"
                              aria-haspopup="menu"
                              aria-expanded={openRunMenu === 'final'}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </CanvasButton>
                            {openRunMenu === 'final' && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-border bg-surface-2 p-2 shadow-md" role="menu">
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  View logs
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  Duplicate settings
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setOpenRunMenu(null)}
                                  className="w-full justify-start rounded-md px-3 py-2 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  Share artifact link
                                </CanvasButton>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3 text-label-sm text-muted">
                      Draft model: {target.label} · {aspectLabel} · {durationMetaLabel} · {fpsMetaLabel}
                      · Seed {seedLabel}
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-label-sm text-muted">
                        <span className="font-semibold text-faint">Metrics:</span>
                        <span>Tokens {RUN_METRICS.final.tokens}</span>
                        <span className="text-faint">·</span>
                        <span>Est. cost {RUN_METRICS.final.cost}</span>
                        <span className="text-faint">·</span>
                        <span className={cn('inline-flex items-center gap-1.5', metricStyles('pass').text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', metricStyles('pass').dot)} aria-hidden="true" />
                          Quality: {RUN_METRICS.final.quality}
                        </span>
                        <span className="text-faint">·</span>
                        <span className={cn('inline-flex items-center gap-1.5', metricStyles('pass').text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', metricStyles('pass').dot)} aria-hidden="true" />
                          Safety: {RUN_METRICS.final.safety}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="text-label-sm text-faint">Artifacts</div>
                      <div className="mt-2 flex items-center gap-2 overflow-hidden">
                        {RUN_ARTIFACTS.final.map((artifact) => (
                          <CanvasButton
                            key={artifact.id}
                            type="button"
                            className={cn(
                              'h-8 w-12 rounded-md border border-border bg-surface-3 transition-colors hover:border-border-strong',
                              artifact.kind === 'preview' && 'border-accent/50 bg-accent/10'
                            )}
                            data-kind={artifact.kind}
                            aria-label={artifact.label}
                          />
                        ))}
                        <CanvasButton
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-label-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          View all <span aria-hidden="true">&rarr;</span>
                        </CanvasButton>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CanvasButton
                            type="button"
                            disabled={finalStatusState !== 'ready'}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Retry
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            disabled={!canCompareRuns}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Compare
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            disabled={finalStatusState === 'idle'}
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Logs
                          </CanvasButton>
                          <CanvasButton
                            type="button"
                            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                          >
                            Copy settings
                          </CanvasButton>
                        </div>
                        <CanvasButton
                          type="button"
                          onClick={
                            finalStatusState === 'ready'
                              ? () => setStageTab('final')
                              : handleGenerateRailVideoPreview
                          }
                          disabled={finalCtaDisabled}
                          className={cn(primaryButtonClass, 'min-w-40 justify-center')}
                        >
                          {finalCtaLabel}
                        </CanvasButton>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Right Rail - Stage + Inspector */}
        <div className="flex min-h-0 flex-col gap-6 xl:w-96 xl:flex-shrink-0">
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface-2 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-body-lg font-semibold text-foreground">Stage</div>
                <div className="mt-1 text-label-sm text-muted">Preview &amp; refine output</div>
              </div>
              <div className="flex h-9 items-center rounded-full border border-border bg-surface-1 p-0.5">
                <CanvasButton
                  type="button"
                  onClick={() => setStageTab('preview')}
                  aria-selected={stageTab === 'preview'}
                  className={cn(
                    'h-8 rounded-full px-3 text-body-sm font-semibold transition-colors',
                    stageTab === 'preview'
                      ? 'bg-surface-2 text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  Preview
                </CanvasButton>
                <CanvasButton
                  type="button"
                  onClick={() => setStageTab('final')}
                  aria-selected={stageTab === 'final'}
                  className={cn(
                    'h-8 rounded-full px-3 text-body-sm font-semibold transition-colors',
                    stageTab === 'final'
                      ? 'bg-surface-2 text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  Final
                </CanvasButton>
              </div>
            </div>

            <div className="relative mt-5 flex min-h-72 flex-1 flex-col gap-3">
              {stageTab === 'preview' ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-label-sm font-semibold uppercase tracking-wide text-muted">Provider</span>
                      <Select
                        value={visualProvider}
                        onValueChange={(value) => setVisualProvider(value as PreviewProvider)}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-9 w-auto rounded-full border border-border bg-surface-2 px-3 text-label-sm font-semibold text-foreground shadow-sm transition-colors',
                            'hover:border-border-strong hover:bg-surface-3'
                          )}
                          aria-label="Preview provider"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="replicate-flux-kontext-fast">Kontext</SelectItem>
                          <SelectItem value="replicate-flux-schnell">Schnell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {visualProvider === 'replicate-flux-kontext-fast' && hasStoryboardFrames && (
                        <label className="inline-flex items-center gap-2 text-label-sm font-semibold text-muted">
                          <Checkbox
                            checked={useSelectedFrameAsBase}
                            onCheckedChange={(checked) => setUseSelectedFrameAsBase(Boolean(checked))}
                          />
                          <span>Use selected frame as base</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {visualProvider === 'replicate-flux-kontext-fast' ? (
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="rounded-lg border border-border bg-surface-2">
                        <div className="border-b border-border px-3 py-2 text-label-sm font-semibold text-foreground">
                          Frame {storyboardSelectedIndex + 1}{' '}
                          <span className="text-muted">
                            — {storyboardSelectedIndex === 0 ? 'Base' : `Edit ${storyboardSelectedIndex}`}
                          </span>
                        </div>
                        <div className="relative h-36 bg-surface-3">
                          {selectedStoryboardFrameUrl ? (
                            <img
                              src={selectedStoryboardFrameUrl}
                              alt={`Frame ${storyboardSelectedIndex + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-surface-3" />
                          )}
                          {hasStoryboardFrames && (
                            <CanvasButton
                              type="button"
                              className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-3 text-foreground shadow-md transition-colors hover:bg-surface-2"
                              onClick={() => setStoryboardPlaying((prev) => !prev)}
                              aria-label={storyboardPlaying ? 'Pause storyboard playback' : 'Play storyboard'}
                            >
                              {storyboardPlaying ? (
                                <Pause className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Play className="h-4 w-4" aria-hidden="true" />
                              )}
                            </CanvasButton>
                          )}
                          {!isVisualPreviewGenerating && !hasStoryboardFrames && (
                            <div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-2 p-4 text-center">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-3 text-muted shadow-sm">
                                <Play className="h-5 w-5" />
                              </div>
                              <div className="text-body-sm font-semibold text-foreground">Stage is set</div>
                              <div className="text-label-sm text-muted">
                                Generate a preview to validate framing, lighting, and mood.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {[
                          { title: '1. Base', delta: '(generated or seeded)' },
                          { title: '2. Edit 1', delta: 'pose / gesture' },
                          { title: '3. Edit 2', delta: 'lighting / skyline' },
                          { title: '4. Edit 3', delta: 'final polish / tone' },
                        ].map((step, index) => {
                          const thumb = storyboardFrames[index];
                          const isSelected = storyboardSelectedIndex === index;
                          return (
                            <CanvasButton
                              key={step.title}
                              type="button"
                              className={cn(
                                'flex w-full items-start justify-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-left transition-colors',
                                'hover:border-border-strong hover:bg-surface-3',
                                isSelected && 'border-accent/60 bg-accent/10'
                              )}
                              data-selected={isSelected ? 'true' : 'false'}
                              onClick={() => {
                                setStoryboardPlaying(false);
                                setStoryboardSelectedIndex(index);
                              }}
                              role="listitem"
                            >
                              <span className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface-3">
                                {typeof thumb === 'string' && thumb ? (
                                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="block h-full w-full" />
                                )}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-body-sm font-semibold text-foreground">{step.title}</span>
                                <span className="text-label-sm text-muted">{step.delta}</span>
                              </span>
                            </CanvasButton>
                          );
                        })}
                      </div>

                      <div className="hidden" aria-hidden="true">
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
                          onPreviewStateChange={handleVisualPreviewStateChange}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-1">
                      <div className="h-full w-full" aria-label="Image preview surface">
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
                          onPreviewStateChange={handleVisualPreviewStateChange}
                        />
                      </div>
                      {!isVisualPreviewGenerating && !stageHasOutput && (
                        <div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-2 p-4 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-3 text-muted shadow-sm">
                            <Play className="h-5 w-5" />
                          </div>
                          <div className="text-body-sm font-semibold text-foreground">Stage is set</div>
                          <div className="text-label-sm text-muted">
                            Generate a preview to validate framing, lighting, and mood.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2">
                    <span className={cn(statusPillClass, finalStatusStyles.text, 'normal-case tracking-normal')}>
                      <span
                        className={cn('h-2 w-2 rounded-full', finalStatusStyles.dot)}
                        aria-hidden="true"
                      />
                      {finalStatusState === 'generating'
                        ? 'Generating'
                        : finalStatusState === 'ready'
                          ? 'Ready'
                          : 'Idle'}
                    </span>
                    <span className="text-label-sm font-semibold text-muted">Model: WAN 2.2</span>
                    <span className="ml-auto" aria-hidden="true" />
                    {finalStatusState === 'ready' && stageFinalVideoUrl && (
                      <div className="flex items-center gap-2" role="group" aria-label="Final quick actions">
                        <CanvasButton
                          type="button"
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-label-sm font-semibold text-foreground transition-colors hover:bg-surface-3"
                          onClick={() => window.open(stageFinalVideoUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Download
                        </CanvasButton>
                        <CanvasButton
                          type="button"
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-label-sm font-semibold text-foreground transition-colors hover:bg-surface-3"
                          onClick={() => window.open(stageFinalVideoUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open
                        </CanvasButton>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    <div
                      className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-1"
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
                        onPreviewStateChange={handleVideoPreviewStateChange}
                      />
                      {!stageFinalVideoUrl && <div className="h-full w-full bg-surface-3" />}
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-3 text-foreground shadow-sm">
                          <Play className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                      {!isRailVideoPreviewGenerating && !stageFinalVideoUrl && (
                        <div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-2 p-4 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-3 text-muted shadow-sm">
                            <Play className="h-5 w-5" />
                          </div>
                          <div className="text-body-sm font-semibold text-foreground">Stage is set</div>
                          <div className="text-label-sm text-muted">
                            Generate the final render when you are ready.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-surface-1 px-3 py-2" aria-label="Timeline scrub">
                      <Slider min={0} max={100} defaultValue={[0]} disabled={!stageFinalVideoUrl} />
                    </div>
                  </div>
                </>
              )}

              {stageTab === 'preview' && visualPreviewState?.error && !isVisualPreviewGenerating && (
                <div className="absolute inset-3 z-10 flex items-center justify-center rounded-lg border border-border bg-surface-2/90 p-4 text-body-sm font-semibold text-foreground">
                  Preview failed. Try again.
                </div>
              )}
              {stageTab === 'final' && videoPreviewState?.error && !isRailVideoPreviewGenerating && (
                <div className="absolute inset-3 z-10 flex items-center justify-center rounded-lg border border-border bg-surface-2/90 p-4 text-body-sm font-semibold text-foreground">
                  Final preview failed. Try again.
                </div>
              )}
              {stageIsGenerating && (
                <div className="absolute inset-3 z-10 flex items-center justify-center rounded-lg border border-border bg-surface-2/90 p-4 text-muted" aria-label="Generating">
                  <LoadingDots size={3} className="text-faint" />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-label-sm text-muted">{stageFooterMeta}</div>
              {stageTab === 'final' && (
                <CanvasButton
                  type="button"
                  className="h-9 rounded-lg border border-border bg-transparent px-3 text-label-sm font-semibold text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                  onClick={() => setShowSettings(true)}
                >
                  Edit settings
                </CanvasButton>
              )}
              <CanvasButton
                type="button"
                onClick={stageTab === 'preview' ? handleGenerateVisualPreview : handleGenerateRailVideoPreview}
                disabled={stageCtaDisabled}
                className={cn(primaryButtonClass, 'min-w-40 justify-center')}
              >
                {stageCtaLabel}
              </CanvasButton>
            </div>
          </section>

          {/* Settings live with the Prompt panel (Stage shows read-only summaries). */}
        </div>
      </div>
      {showDiff && (
        <Dialog open={showDiff} onOpenChange={setShowDiff}>
          <DialogContent className="w-full max-w-5xl gap-0 rounded-xl border border-border bg-surface-1 p-0 shadow-lg [&>button]:hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <div className="text-body-lg font-semibold text-foreground">Diff</div>
                <div className="mt-1 text-label-sm text-muted">Input vs optimized output</div>
              </div>
              <CanvasButton
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                onClick={() => setShowDiff(false)}
                aria-label="Close diff"
              >
                <X className="h-4 w-4" />
              </CanvasButton>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-label-sm font-semibold uppercase tracking-widest text-muted">Input</div>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-body-sm text-muted">
                  {inputPrompt || '—'}
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-label-sm font-semibold uppercase tracking-widest text-muted">Optimized</div>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-body-sm text-muted">
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
