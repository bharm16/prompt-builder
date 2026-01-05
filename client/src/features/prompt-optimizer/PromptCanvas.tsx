import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Pencil, X, Check, ChevronLeft, Lock, Unlock, LayoutGrid } from 'lucide-react';
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
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue, type CapabilityValues } from '@shared/capabilities';

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
  const editorColumnRef = useRef<HTMLDivElement>(null);
  const videoPanelRef = useRef<HTMLDivElement>(null);
  const outputLocklineRef = useRef<HTMLDivElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const tokenPopoverRef = useRef<HTMLDivElement>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const hasTriggeredVideoTransitionRef = useRef(false);
  const toast = useToast();
  const [isOutputFocused, setIsOutputFocused] = useState(false);
  const [isOutputHovered, setIsOutputHovered] = useState(false);
  const [tokenPopover, setTokenPopover] = useState<{ left: number; top: number } | null>(null);
  const [isVideoTransitionActive, setIsVideoTransitionActive] = useState(false);

  // Get model state from context
  const { selectedModel, setSelectedModel, generationParams, setGenerationParams, promptOptimizer } =
    usePromptState();
  const { lockedSpans, addLockedSpan, removeLockedSpan } = promptOptimizer;

  // Load capabilities schema to access generation controls
  const { schema } = useCapabilities(selectedModel);

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
            className="h-8 pl-2 pr-6 text-sm bg-transparent border-none rounded-md text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 focus:ring-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23666%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_4px_center] bg-no-repeat disabled:opacity-50 disabled:cursor-not-allowed"
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
  const showVideoPreview = selectedMode === 'video';
  const videoPreviewPrompt = normalizedDisplayedPrompt ?? '';
  const promptEcho = useMemo(
    () => (videoPreviewPrompt ? videoPreviewPrompt.replace(/\s+/g, ' ').trim() : ''),
    [videoPreviewPrompt]
  );
  const showVideoPanel = Boolean(showVideoPreview && isVideoTransitionActive && videoPreviewPrompt.trim());

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

  const clearIdleTransitionTimer = useCallback((): void => {
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!showVideoPreview || !normalizedDisplayedPrompt?.trim() || isOutputLoading) {
      hasTriggeredVideoTransitionRef.current = false;
      setIsVideoTransitionActive(false);
      clearIdleTransitionTimer();
    }
  }, [showVideoPreview, normalizedDisplayedPrompt, isOutputLoading, clearIdleTransitionTimer]);

  useEffect(() => {
    return () => {
      clearIdleTransitionTimer();
    };
  }, [clearIdleTransitionTimer]);

  const escapeAttr = (value: string): string => {
    if (typeof (globalThis as any)?.CSS?.escape === 'function') {
      return (globalThis as any).CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
  };

  // Position contextual alternatives popover near the selected token
  useEffect(() => {
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

    const panelWidth = 260;
    const padding = 12;
    const leftPreferred = rect.left - wrapperRect.left;
    const top = rect.bottom - wrapperRect.top + 10;
    const leftMax = Math.max(padding, wrapperRect.width - panelWidth - padding);
    const left = Math.max(padding, Math.min(leftPreferred, leftMax));

    setTokenPopover({ left, top });
  }, [selectedSpanId]);

  // Close popover on outside click
  useEffect(() => {
    if (!tokenPopover) return;
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (tokenPopoverRef.current?.contains(target)) return;
      if (target.closest?.('span.value-word')) return;
      setSelectedSpanId(null);
      setTokenPopover(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [tokenPopover, setSelectedSpanId]);

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

  const triggerVideoTransition = useCallback(
    (reason: 'idle' | 'blur' | 'scroll'): void => {
      if (hasTriggeredVideoTransitionRef.current) return;
      if (!showVideoPreview) return;
      if (!normalizedDisplayedPrompt?.trim()) return;
      if (isOutputLoading) return;
      clearIdleTransitionTimer();
      hasTriggeredVideoTransitionRef.current = true;
      setIsVideoTransitionActive(true);
      debug.logAction('videoTransitionTriggered', { reason });
    },
    [showVideoPreview, normalizedDisplayedPrompt, isOutputLoading, clearIdleTransitionTimer, debug]
  );

  const scheduleIdleTransition = useCallback(
    (text: string): void => {
      if (!showVideoPreview || isOutputLoading) return;
      if (hasTriggeredVideoTransitionRef.current) return;
      if (!text.trim()) return;
      clearIdleTransitionTimer();
      idleTimeoutRef.current = window.setTimeout(() => {
        triggerVideoTransition('idle');
      }, 1200);
    },
    [showVideoPreview, isOutputLoading, clearIdleTransitionTimer, triggerVideoTransition]
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
      scheduleIdleTransition(normalizedText);
    },
    [onDisplayedPromptChange, normalizedDisplayedPrompt, debug, scheduleIdleTransition]
  );

  const handleOutputFocus = useCallback((): void => {
    setIsOutputFocused(true);
  }, []);

  const handleOutputBlur = useCallback((): void => {
    setIsOutputFocused(false);
    triggerVideoTransition('blur');
  }, [triggerVideoTransition]);

  const handleEditorScroll = useCallback((): void => {
    const container = editorColumnRef.current;
    const lockline = outputLocklineRef.current;
    if (!container || !lockline || !showVideoPreview) return;
    if (container.scrollTop <= 0) return;

    const containerRect = container.getBoundingClientRect();
    const locklineRect = lockline.getBoundingClientRect();
    if (locklineRect.bottom <= containerRect.bottom) {
      triggerVideoTransition('scroll');
    }
  }, [showVideoPreview, triggerVideoTransition]);

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

  const hoverPreview = hoveredSpanId !== null && !selectedSpanId;
  const suggestionsPanelData = useMemo(
    () =>
      suggestionsData
        ? ({
            ...suggestionsData,
            onSuggestionClick: handleSuggestionClickWithFeedback,
            ...(normalizedDisplayedPrompt
              ? { currentPrompt: normalizedDisplayedPrompt }
              : {}),
            variant: 'tokenEditor',
            tokenEditorHeader: false,
            panelClassName: 'h-full flex flex-col', // Ensure it fits the container
            contextValue: suggestionsData.selectedText || '',
            showCategoryTabs: false,
            showCopyAction: false,
            customRequestPlaceholder: 'e.g. more cinematic, more intense...',
            customRequestCtaLabel: 'Generate',
            hoverPreview,
          } as Record<string, unknown>)
        : ({
            show: false,
            ...(normalizedDisplayedPrompt
              ? { currentPrompt: normalizedDisplayedPrompt }
              : {}),
            variant: 'tokenEditor',
            tokenEditorHeader: false,
            panelClassName: 'h-full flex flex-col',
            showCategoryTabs: false,
            showCopyAction: false,
            hoverPreview,
          } as Record<string, unknown>),
    [
      suggestionsData,
      handleSuggestionClickWithFeedback,
      normalizedDisplayedPrompt,
      hoverPreview,
    ]
  );

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

  const scrollVideoPanelIntoView = useCallback((): void => {
    const container = editorColumnRef.current;
    const panel = videoPanelRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const isAbove = panelRect.top < containerRect.top;
    const isBelow = panelRect.bottom > containerRect.bottom;
    if (!isAbove && !isBelow) return;

    let delta = 0;
    if (isBelow) {
      delta = panelRect.bottom - containerRect.bottom;
    } else if (isAbove) {
      delta = panelRect.top - containerRect.top;
    }

    const target = Math.max(
      0,
      Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + delta)
    );
    animateScroll(container, target);
  }, [animateScroll]);

  useEffect(() => {
    if (!isVideoTransitionActive) return;
    const timer = window.setTimeout(() => {
      scrollVideoPanelIntoView();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [isVideoTransitionActive, scrollVideoPanelIntoView]);

  const videoControls = [
    {
      id: 'model',
      label: 'Model',
      node: (
        <ModelSelectorDropdown
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          disabled={isOptimizing}
        />
      ),
    },
    aspectRatioInfo
      ? {
          id: 'aspect_ratio',
          label: 'Aspect ratio',
          node: renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio', isOptimizing),
        }
      : null,
    durationInfo
      ? {
          id: 'duration',
          label: 'Duration',
          node: renderDropdown(durationInfo, 'duration_s', 'Duration', isOptimizing),
        }
      : null,
    fpsInfo
      ? {
          id: 'fps',
          label: 'FPS',
          node: renderDropdown(fpsInfo, 'fps', 'Frame Rate', isOptimizing),
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; node: React.ReactNode }>;

  const ctaDelayMs = 120 + Math.max(0, videoControls.length - 1) * 40 + 180;

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
                    spans={bentoSpans}
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
        <div
          ref={editorColumnRef}
          onScroll={handleEditorScroll}
          className="prompt-canvas-editor flex flex-col overflow-y-auto scrollbar-auto-hide min-w-0"
        >
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
                maxWidth: '880px',
                width: '100%',
              }}
            >
              <div
                className="prompt-card prompt-card--optimized"
                data-settled={isVideoTransitionActive ? 'true' : 'false'}
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
                      data-active={isVideoTransitionActive ? 'true' : 'false'}
                      aria-hidden="true"
                    />
                    {/* Contextual alternatives panel (anchored to selected token) */}
                    {tokenPopover &&
                      suggestionsData &&
                      Array.isArray((suggestionsData as any).suggestions) &&
                      (suggestionsData as any).suggestions.length > 0 && (
                        <div
                          ref={tokenPopoverRef}
                          className="token-alternatives-popover"
                          style={{
                            left: tokenPopover.left,
                            top: tokenPopover.top,
                          }}
                          role="dialog"
                          aria-label="Alternatives"
                        >
                          {((suggestionsData as any).suggestions as Array<any>).slice(0, 6).map((item, idx) => (
                            <div
                              key={item?.id ?? `${item?.text ?? 'suggestion'}_${idx}`}
                              className="token-alternatives-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                handleSuggestionClickWithFeedback(item);
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {typeof item?.text === 'string' ? item.text : String(item)}
                            </div>
                          ))}
                        </div>
                      )}
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
            <div className="prompt-band prompt-band--video mt-4">
              <div
                className="prompt-band__content prompt-canvas-content-wrapper"
                style={{
                  maxWidth: '880px',
                  width: '100%',
                }}
              >
                <div
                  ref={videoPanelRef}
                  className="prompt-card prompt-card--video video-generation-panel"
                >
                  <div className="video-generation-header">Generate video</div>
                  <div className="video-generation-echo" title={promptEcho}>
                    {promptEcho}
                  </div>
                  <div className="video-generation-controls">
                    {videoControls.map((control, index) => (
                      <div
                        key={control.id}
                        className="video-generation-control"
                        style={{ '--delay': `${120 + index * 40}ms` } as React.CSSProperties}
                      >
                        <span className="video-generation-control__label">
                          {control.label}
                        </span>
                        {control.node}
                      </div>
                    ))}
                  </div>
                  <div
                    className="video-generation-cta"
                    style={{ '--delay': `${ctaDelayMs}ms` } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      onClick={handleGenerateVideoPreview}
                      disabled={!videoPreviewPrompt.trim()}
                      className="video-generation-button"
                      aria-label="Generate video"
                    >
                      Generate video
                    </button>
                  </div>
                  <div className="video-generation-preview">
                    <VideoPreview
                      prompt={videoPreviewPrompt}
                      aspectRatio={effectiveAspectRatio}
                      model={selectedModel}
                      generationParams={generationParams}
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
          )}
        </div>

        {/* Right Rail - Drafting & Refinement */}
        <div
          className="prompt-canvas-right-rail flex flex-col overflow-hidden border-l"
          style={
            {
              background: '#0E0F11',
              borderLeftColor: '#1C1F24',
              padding: 24,
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
          {/* Panel Title */}
          <div className="text-[12px] tracking-[0.08em] uppercase text-[#8B9098] mb-4">
            Preview &amp; Refine
          </div>

          {/* Preview Frame */}
          <div>
            <VisualPreview
              prompt={previewSource}
              aspectRatio={effectiveAspectRatio}
              isVisible={true}
              generateRequestId={visualGenerateRequestId}
              lastGeneratedAt={visualLastGeneratedAt}
              onPreviewGenerated={handleVisualPreviewGenerated}
              onKeepRefining={handleKeepRefiningFromPreview}
              onRefinePrompt={handleSomethingOffFromPreview}
            />
          </div>

          {/* Suggestions */}
          <div className="mt-6 pt-4 border-t flex-1 min-h-0 flex flex-col" style={{ borderTopColor: '#1C1F24' }}>
            <div className="text-[12px] text-[#7C818A] mb-2">Suggestions</div>

            {/* Inline replacement feedback */}
            {justReplaced && (
              <div className="mb-3">
                <div
                  className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-2"
                  style={{ background: '#111318', border: '1px solid #1C1F24' }}
                >
                  <div className="text-[12px] text-[#C9CDD3] truncate">
                    ✓ Replaced “{justReplaced.from}”
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUndo?.();
                      setState({ justReplaced: null });
                    }}
                    className="text-[12px] font-medium text-[#8B9098] hover:text-white"
                  >
                    Undo
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              <SuggestionsPanel suggestionsData={suggestionsPanelData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
