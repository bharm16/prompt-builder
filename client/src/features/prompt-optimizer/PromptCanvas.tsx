import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Pencil, X, Check, Lock, Unlock, LayoutGrid } from 'lucide-react';
import { LoadingDots } from '@components/LoadingDots';

// External libraries
import { useToast } from '@components/Toast';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Internal absolute imports
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Relative imports - types first
import type { HighlightSnapshot, PromptCanvasProps, SuggestionItem } from './PromptCanvas/types';
import type { PromptVersionEntry } from '@hooks/types';

// Relative imports - implementations
import { useSpanLabeling, sanitizeText, createHighlightSignature } from '@/features/span-highlighting';
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
import { PromptSidebar } from './components/PromptSidebar';
import { VersionsPanel } from './components/VersionsPanel';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';
import { VisualPreview, VideoPreview } from '@/features/preview';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { usePromptState } from './context/PromptStateContext';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue, type CapabilityValues } from '@shared/capabilities';

// Styles
import './PromptCanvas.css';

const RAIL_VIDEO_PREVIEW_MODEL = 'wan-2.2';

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
  const editorColumnRef = useRef<HTMLDivElement>(null);
  const videoPanelRef = useRef<HTMLDivElement>(null);
  const outputLocklineRef = useRef<HTMLDivElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const tokenPopoverRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLDivElement>(null);
  const outlineOverlayRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [isOutputFocused, setIsOutputFocused] = useState(false);
  const [isOutputHovered, setIsOutputHovered] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [tokenPopover, setTokenPopover] = useState<{
    left: number;
    top: number;
    placement: 'top' | 'bottom';
    arrowLeft: number;
  } | null>(null);
  const [videoInputReference, setVideoInputReference] = useState('');
  const [isVisualPreviewGenerating, setIsVisualPreviewGenerating] = useState(false);
  const [isVideoPreviewGenerating, setIsVideoPreviewGenerating] = useState(false);
  const [isRailVideoPreviewGenerating, setIsRailVideoPreviewGenerating] = useState(false);
  const [railVideoGenerateRequestId, setRailVideoGenerateRequestId] = useState(0);
  const [railVideoLastGeneratedAt, setRailVideoLastGeneratedAt] = useState<number | null>(null);

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
      const state = resolveFieldState(field, generationParams as CapabilityValues);

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
            value={String((generationParams as any)?.[key] ?? info.field.default ?? '')}
            onChange={(e) => {
              const val = info.field.type === 'int' ? Number(e.target.value) : e.target.value;
              handleParamChange(key, val);
            }}
            disabled={disabled}
            className="pc-video-advanced-select"
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

  const renderPills = useCallback(
    (
      info: ReturnType<typeof getFieldInfo>,
      key: string,
      label: string,
      disabled: boolean
    ): React.ReactNode => {
      if (!info) return null;

      const selected = (generationParams as any)?.[key] ?? info.field.default ?? '';
      const allowed = info.allowedValues;
      const formatDisplay = (val: unknown) => {
        if (key === 'duration_s') return `${val}s`;
        if (key === 'fps') return `${val} fps`;
        return String(val);
      };

      if (allowed.length > 6) {
        return renderDropdown(info, key, label, disabled);
      }

      return (
        <div className="pc-video-pill-row" role="radiogroup" aria-label={label}>
          {allowed.map((value) => {
            const isSelected = String(value) === String(selected);
            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => handleParamChange(key, value as CapabilityValue)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={`pc-video-pill${isSelected ? ' pc-video-pill--active' : ''}`}
              >
                {formatDisplay(value)}
              </button>
            );
          })}
        </div>
      );
    },
    [generationParams, handleParamChange, renderDropdown]
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
  } = state;

  // Normalize to NFC so span offsets and rendered text stay aligned.
  const normalizedDisplayedPrompt = useMemo(
    () => (displayedPrompt == null ? null : sanitizeText(displayedPrompt)),
    [displayedPrompt]
  );

  const previewSource = previewPrompt ?? normalizedDisplayedPrompt ?? '';
  const hasPreviewSource = Boolean(previewSource.trim());
  const showPreviewMeta = Boolean(effectiveAspectRatio);
  const isAnyVideoPreviewGenerating = isVideoPreviewGenerating || isRailVideoPreviewGenerating;
  const isPreviewGenerating =
    selectedMode === 'video' ? isAnyVideoPreviewGenerating : isVisualPreviewGenerating;

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions visibility state for contextual UI
  const isSuggestionsOpen = Boolean(selectedSpanId || (suggestionsData && suggestionsData.show !== false));
  const showVideoPreview = selectedMode === 'video';
  const videoPreviewPrompt = normalizedDisplayedPrompt ?? '';
  const promptEcho = useMemo(
    () => (videoPreviewPrompt ? videoPreviewPrompt.replace(/\s+/g, ' ').trim() : ''),
    [videoPreviewPrompt]
  );
  const showVideoPanel = Boolean(showVideoPreview && videoPreviewPrompt.trim());

  const currentPromptEntry = useMemo(() => {
    if (!promptHistory?.history?.length) return null;
    return (
      promptHistory.history.find((entry) => entry.uuid === currentPromptUuid) ||
      promptHistory.history.find((entry) => entry.id === currentPromptDocId) ||
      null
    );
  }, [promptHistory.history, currentPromptUuid, currentPromptDocId]);

  const currentVersions = useMemo<PromptVersionEntry[]>(
    () => (Array.isArray(currentPromptEntry?.versions) ? currentPromptEntry.versions : []),
    [currentPromptEntry]
  );

  const persistVersions = useCallback(
    (versions: PromptVersionEntry[]): void => {
      if (!currentPromptUuid) return;
      promptHistory.updateEntryVersions(currentPromptUuid, currentPromptDocId, versions);
    },
    [promptHistory, currentPromptUuid, currentPromptDocId]
  );

  const toIsoString = (value: number | string): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
      return value;
    }
    return new Date().toISOString();
  };

  const createVersionEntry = useCallback(
    ({
      signature,
      prompt,
      highlights,
      preview,
      video,
    }: {
      signature: string;
      prompt: string;
      highlights?: PromptVersionEntry['highlights'];
      preview?: PromptVersionEntry['preview'];
      video?: PromptVersionEntry['video'];
    }): PromptVersionEntry => {
      const versionNumber = currentVersions.length + 1;
      const editCount = versionEditCountRef.current;
      const edits = versionEditsRef.current.length ? [...versionEditsRef.current] : [];
      return {
        versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: `v${versionNumber}`,
        signature,
        prompt,
        timestamp: new Date().toISOString(),
        highlights: highlights ?? null,
        ...(editCount > 0 ? { editCount } : {}),
        ...(edits.length ? { edits } : {}),
        preview: preview ?? null,
        video: video ?? null,
      };
    },
    [currentVersions.length, versionEditCountRef, versionEditsRef]
  );

  const upsertVersionOutput = useCallback(
    (params: {
      action: 'preview' | 'video';
      prompt: string;
      generatedAt: number | string;
      imageUrl?: string | null;
      videoUrl?: string | null;
      aspectRatio?: string | null;
    }): void => {
      if (!currentPromptUuid) return;
      if (!currentPromptEntry) return;
      const promptText = params.prompt.trim();
      if (!promptText) return;

      const signature = createHighlightSignature(promptText);
      const lastVersion = currentVersions[currentVersions.length - 1] ?? null;
      const hasEditsSinceLastVersion = !lastVersion || lastVersion.signature !== signature;

      const previewPayload = params.action === 'preview'
        ? {
            generatedAt: toIsoString(params.generatedAt),
            imageUrl: params.imageUrl ?? null,
            aspectRatio: params.aspectRatio ?? effectiveAspectRatio ?? null,
          }
        : undefined;

      const videoPayload = params.action === 'video'
        ? {
            generatedAt: toIsoString(params.generatedAt),
            videoUrl: params.videoUrl ?? null,
            model: selectedModel?.trim() ? selectedModel.trim() : null,
            generationParams: generationParams ?? null,
          }
        : undefined;

      if (hasEditsSinceLastVersion) {
        const newVersion = createVersionEntry({
          signature,
          prompt: promptText,
          highlights: latestHighlightRef.current ?? null,
          preview: previewPayload ?? null,
          video: videoPayload ?? null,
        });
        persistVersions([...currentVersions, newVersion]);
        resetVersionEdits();
        return;
      }

      if (!lastVersion) return;
      const updatedLast: PromptVersionEntry = {
        ...lastVersion,
        ...(previewPayload ? { preview: previewPayload } : {}),
        ...(videoPayload ? { video: videoPayload } : {}),
      };
      const updatedVersions = [...currentVersions.slice(0, -1), updatedLast];
      persistVersions(updatedVersions);
    },
    [
      currentPromptUuid,
      currentPromptEntry,
      currentVersions,
      createVersionEntry,
      effectiveAspectRatio,
      generationParams,
      latestHighlightRef,
      persistVersions,
      resetVersionEdits,
      selectedModel,
    ]
  );

  const syncVersionHighlights = useCallback(
    (snapshot: HighlightSnapshot, promptText: string): void => {
      if (!currentPromptUuid) return;
      if (!currentPromptEntry) return;
      if (!snapshot?.signature) return;

      const versions = currentVersions;
      if (versions.length === 0) {
        const fallbackPrompt = promptText.trim();
        if (!fallbackPrompt) return;
        const initialVersion = createVersionEntry({
          signature: snapshot.signature,
          prompt: fallbackPrompt,
          highlights: snapshot,
        });
        persistVersions([initialVersion]);
        resetVersionEdits();
        return;
      }

      const lastVersion = versions[versions.length - 1];
      if (lastVersion.signature !== snapshot.signature) {
        return;
      }

      const updatedLast: PromptVersionEntry = {
        ...lastVersion,
        highlights: snapshot,
      };
      persistVersions([...versions.slice(0, -1), updatedLast]);
    },
    [
      createVersionEntry,
      currentPromptEntry,
      currentPromptUuid,
      currentVersions,
      persistVersions,
      resetVersionEdits,
    ]
  );

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
  const isOutputLoading = Boolean(isProcessing && !isDraftReady);
  const isInputLocked = !isEditing || isOptimizing;

  const hasSuggestionSelection =
    Boolean(selectedSpanId) ||
    Boolean(
      typeof (suggestionsData as any)?.selectedText === 'string' &&
        (suggestionsData as any).selectedText.trim()
    );

  const showPrimaryActions = isOutputHovered || isOutputFocused || hasSuggestionSelection;

  const escapeAttr = (value: string): string => {
    if (typeof (globalThis as any)?.CSS?.escape === 'function') {
      return (globalThis as any).CSS.escape(value);
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
    const handleScroll = (): void => updateTokenPopover();
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
  const previewMetaDetail = 'ETA ~6s';
  const hasVideoPreviewSource = Boolean(videoPreviewPrompt.trim());

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

  const inlineSuggestions = useMemo(() => {
    const rawSuggestions = suggestionsData?.suggestions ?? [];
    return rawSuggestions
      .map((item, index) => {
        const text =
          typeof item === 'string'
            ? item
            : typeof item?.text === 'string'
              ? item.text
              : typeof (item as { label?: string } | null)?.label === 'string'
                ? (item as { label?: string }).label
                : '';

        if (!text.trim()) {
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
      .filter((item): item is { key: string; text: string; meta: string | null; item: SuggestionItem | string } =>
        Boolean(item)
      );
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

  useEffect(() => {
    if (!tokenPopover) return;
    setActiveSuggestionIndex(0);
  }, [tokenPopover, suggestionCount]);

  useEffect(() => {
    if (!tokenPopover || !suggestionsListRef.current) return;
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
      if (event.key === 'Escape') {
        event.preventDefault();
        closeInlinePopover();
        return;
      }

      if (!suggestionCount) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestionCount);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
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
        videoUrl,
        aspectRatio,
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
    incrementVisualRequestId();
  }, [incrementVisualRequestId]);

  const handleGenerateVideoPreview = useCallback((): void => {
    incrementVideoRequestId();
  }, [incrementVideoRequestId]);

  const handleGenerateRailVideoPreview = useCallback((): void => {
    setRailVideoGenerateRequestId((current) => current + 1);
  }, []);

  const animateScroll = useCallback((element: HTMLElement, target: number): void => {
    const start = element.scrollTop;
    const delta = target - start;
    if (delta === 0) return;

    const duration = 300;
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number): void => {
      const progress = Math.min(1, (now - startTime) / duration);
      element.scrollTop = start + delta * easeOut(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, []);

  const handleJumpToPromptEditor = useCallback((): void => {
    const container = editorColumnRef.current;
    if (container) {
      animateScroll(container, 0);
    }
    if (isEditing) {
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }
    handleEditClick();
  }, [animateScroll, handleEditClick, isEditing]);

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
	          className="pc-outline-overlay"
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
          className="prompt-canvas-editor flex flex-col overflow-y-auto scrollbar-auto-hide min-w-0"
        >
          <div className="prompt-canvas-editor-frame">
            {/* Original Prompt Band */}
            <div className="prompt-band prompt-band--original" data-optimizing={isOptimizing}>
              <div className="prompt-band__content prompt-canvas-content-wrapper">
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
            <div className="prompt-band__content prompt-canvas-content-wrapper">
              <div
                className="prompt-card prompt-card--optimized"
                data-settled={showVideoPanel ? 'true' : 'false'}
              >
                <div className="prompt-output-header">
                  <div className="prompt-output-label">Optimized output</div>
                  <div className="prompt-output-status" data-editing={isOutputFocused ? 'true' : 'false'}>
                    {isOutputFocused ? 'Editing' : 'Live'}
                  </div>
                </div>

                <div
                  className="prompt-editor-wrapper"
                  aria-busy={isOutputLoading}
                  ref={editorWrapperRef}
                  onMouseEnter={() => setIsOutputHovered(true)}
                  onMouseLeave={() => setIsOutputHovered(false)}
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
                      data-active={showVideoPanel ? 'true' : 'false'}
                      aria-hidden="true"
                    />
                    {/* Inline suggestions popover (anchored to selected span) */}
                    {tokenPopover && (
                      <>
                        <div className="inline-suggest-backdrop" aria-hidden="true" />
                        <div
                          ref={tokenPopoverRef}
                          className="inline-suggest-popover"
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
                                  className="inline-suggest-item"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                                  onClick={() => {
                                    handleSuggestionClickWithFeedback(suggestion.item);
                                    closeInlinePopover();
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="inline-suggest-text">{suggestion.text}</div>
                                  {index === 0 ? (
                                    <span className="inline-suggest-badge" data-accent="true">
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
                  primaryVisible={showPrimaryActions}
                />
              )}
            </div>
          </div>

          {showVideoPanel && (
            <div className="prompt-band prompt-band--video">
              <div className="prompt-band__content prompt-canvas-content-wrapper">
                <div
                  ref={videoPanelRef}
                  className="prompt-card prompt-card--video video-generation-panel"
                >
                  <div className="pc-video-panel">
                    <div className="pc-video-panel__eyebrow">Video Generation</div>
                    <button
                      type="button"
                      onClick={handleJumpToPromptEditor}
                      disabled={isVideoPreviewGenerating}
                      className="pc-video-panel__prompt"
                      title={promptEcho}
                      aria-label="Jump to prompt editor"
                    >
                      {promptEcho || '—'}
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateVideoPreview}
                      disabled={!videoPreviewPrompt.trim() || isVideoPreviewGenerating}
                      className="pc-video-panel__cta"
                      aria-label="Generate preview"
                    >
                      <span className="pc-video-panel__cta-label">Generate Preview</span>
                      <span className="pc-video-panel__cta-sub">
                        Validates framing, lighting, and motion
                      </span>
                    </button>

                    <div className="pc-video-panel__stage-label">Preview Stage</div>
                    <div className="pc-video-panel__stage">
                      <VideoPreview
                        prompt={videoPreviewPrompt}
                        aspectRatio={effectiveAspectRatio}
                        model={selectedModel}
                        generationParams={generationParams}
                        inputReference={allowsVideoInputReference ? videoInputReference : undefined}
                        isVisible={true}
                        generateRequestId={videoGenerateRequestId}
                        lastGeneratedAt={videoLastGeneratedAt}
                        onPreviewGenerated={handleVideoPreviewGenerated}
                        onLoadingChange={setIsVideoPreviewGenerating}
                        onKeepRefining={handleKeepRefiningFromPreview}
                        onRefinePrompt={handleSomethingOffFromPreview}
                      />
                    </div>

                    <details
                      className="pc-video-panel__advanced"
                      data-disabled={isVideoPreviewGenerating ? 'true' : 'false'}
                    >
                      <summary className="pc-video-panel__advanced-summary">
                        Advanced Controls
                      </summary>
                      <div className="pc-video-panel__advanced-inner">
                        <div className="pc-video-advanced-row">
                          <div className="pc-video-advanced-label">Model</div>
                          <ModelSelectorDropdown
                            selectedModel={selectedModel}
                            onModelChange={handleModelChange}
                            disabled={isOptimizing || isVideoPreviewGenerating}
                            variant="pillDark"
                          />
                        </div>

                        {aspectRatioInfo && (
                          <div className="pc-video-advanced-row">
                            <div className="pc-video-advanced-label">Aspect</div>
                            {renderPills(
                              aspectRatioInfo,
                              'aspect_ratio',
                              'Aspect Ratio',
                              isOptimizing
                            )}
                          </div>
                        )}

                        {durationInfo && (
                          <div className="pc-video-advanced-row">
                            <div className="pc-video-advanced-label">Duration</div>
                            {renderPills(durationInfo, 'duration_s', 'Duration', isOptimizing)}
                          </div>
                        )}

                        {fpsInfo && (
                          <div className="pc-video-advanced-row">
                            <div className="pc-video-advanced-label">FPS</div>
                            {renderPills(fpsInfo, 'fps', 'Frame Rate', isOptimizing)}
                          </div>
                        )}

                        {allowsVideoInputReference && (
                          <div className="pc-video-advanced-row">
                            <div className="pc-video-advanced-label">Reference</div>
                            <input
                              type="url"
                              value={videoInputReference}
                              onChange={(event) => setVideoInputReference(event.target.value)}
                              placeholder="Reference image URL (optional)"
                              className="pc-video-advanced-input"
                              disabled={isOptimizing || isVideoPreviewGenerating}
                              aria-label="Reference image URL (optional)"
                            />
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Right Rail - Drafting & Refinement */}
        <div
          className="prompt-canvas-right-rail flex flex-col overflow-hidden"
          style={
            {
              background:
                'radial-gradient(120% 80% at 18% 0%, rgba(109, 94, 243, 0.22), transparent 58%), radial-gradient(120% 80% at 88% 0%, rgba(255, 176, 32, 0.14), transparent 62%), linear-gradient(180deg, #0E0F11 0%, #0B0C0E 100%)',
              // Local Geist token overrides so existing components render correctly in this dark panel.
              '--geist-background': '#0E0F11',
              '--geist-foreground': '#F5F6F7',
              '--accents-1': '#111318',
              '--accents-2': '#1C1F24',
              '--accents-3': '#2A2F36',
              '--accents-4': '#5C616A',
              '--accents-5': '#7C818A',
              '--accents-6': '#8B9098',
              '--accents-7': '#C9CDD3',
              '--accents-8': '#F5F6F7',
            } as React.CSSProperties
          }
        >
          {/* Header */}
          <div className="prompt-right-rail__header">
            <div className="prompt-right-rail__eyebrow">Preview &amp; Refine</div>
          </div>

          {/* Preview Module */}
          <div className="prompt-right-rail__preview-module">
            <div className="prompt-right-rail__preview-top">
              <div className="prompt-right-rail__section-label">Preview</div>
            </div>

            <div className="prompt-right-rail__preview-frame">
              <VisualPreview
                prompt={previewSource}
                aspectRatio={effectiveAspectRatio}
                isVisible={true}
                generateRequestId={visualGenerateRequestId}
                lastGeneratedAt={visualLastGeneratedAt}
                onPreviewGenerated={handleVisualPreviewGenerated}
                onLoadingChange={setIsVisualPreviewGenerating}
                onKeepRefining={handleKeepRefiningFromPreview}
                onRefinePrompt={handleSomethingOffFromPreview}
                showActions={false}
                variant="rail"
              />
            </div>

            <div
              className={`prompt-right-rail__preview-cta${
                showPreviewMeta ? '' : ' prompt-right-rail__preview-cta--solo'
              }`}
            >
              {showPreviewMeta && (
                <div className="prompt-right-rail__preview-meta">
                  {`AR ${effectiveAspectRatio}`}
                </div>
              )}
              <div className="prompt-right-rail__preview-actions">
                <button
                  type="button"
                  onClick={handleGenerateVisualPreview}
                  disabled={!hasPreviewSource || isVisualPreviewGenerating}
                  className="prompt-right-rail__preview-button"
                >
                  Generate
                </button>
                <div className="prompt-right-rail__preview-meta-secondary">
                  {previewMetaDetail}
                </div>
              </div>
            </div>
          </div>

          {showVideoPreview && (
            <div className="prompt-right-rail__preview-module">
              <div className="prompt-right-rail__preview-top">
                <div className="prompt-right-rail__section-label">Video Preview</div>
              </div>

              <div className="prompt-right-rail__preview-frame">
                <VideoPreview
                  prompt={videoPreviewPrompt}
                  aspectRatio={effectiveAspectRatio}
                  model={RAIL_VIDEO_PREVIEW_MODEL}
                  generationParams={generationParams}
                  inputReference={allowsVideoInputReference ? videoInputReference : undefined}
                  isVisible={showVideoPreview}
                  generateRequestId={railVideoGenerateRequestId}
                  lastGeneratedAt={railVideoLastGeneratedAt}
                  onPreviewGenerated={handleRailVideoPreviewGenerated}
                  onLoadingChange={setIsRailVideoPreviewGenerating}
                  onKeepRefining={handleKeepRefiningFromPreview}
                  onRefinePrompt={handleSomethingOffFromPreview}
                />
              </div>

              <div
                className={`prompt-right-rail__preview-cta${
                  showPreviewMeta ? '' : ' prompt-right-rail__preview-cta--solo'
                }`}
              >
                {showPreviewMeta && (
                  <div className="prompt-right-rail__preview-meta">
                    {`AR ${effectiveAspectRatio}`}
                  </div>
                )}
                <div className="prompt-right-rail__preview-actions">
                  <button
                    type="button"
                    onClick={handleGenerateRailVideoPreview}
                    disabled={!hasVideoPreviewSource || isRailVideoPreviewGenerating}
                    className="prompt-right-rail__preview-button"
                  >
                    Generate
                  </button>
                  <div className="prompt-right-rail__preview-meta-secondary">
                    {previewMetaDetail}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
