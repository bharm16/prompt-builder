import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Pencil, X, Check, ChevronLeft } from 'lucide-react';
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
import { findHighlightNode } from './utils/highlightInteractionHelpers';
import { scrollToSpan } from './SpanBentoGrid/utils/spanFormatting';

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

  // UI state (simple boolean flags - declared early to avoid hook order issues)
  const [showExportMenu, setShowExportMenu] = React.useState<boolean>(false);
  const [showModelMenu, setShowModelMenu] = React.useState<boolean>(false);
  const [showLegend, setShowLegend] = React.useState<boolean>(false);
  const [rightPaneMode, setRightPaneMode] = React.useState<'refine' | 'preview'>('refine');
  const [activePreviewTab, setActivePreviewTab] = React.useState<'visual' | 'video'>('visual');
  const [showPreviewStatusHelp, setShowPreviewStatusHelp] = React.useState<boolean>(false);

  const [visualLastGeneratedAt, setVisualLastGeneratedAt] = React.useState<number | null>(null);
  const [visualLastGeneratedPrompt, setVisualLastGeneratedPrompt] = React.useState<string>('');
  const [videoLastGeneratedAt, setVideoLastGeneratedAt] = React.useState<number | null>(null);
  const [videoLastGeneratedPrompt, setVideoLastGeneratedPrompt] = React.useState<string>('');
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [originalInputPrompt, setOriginalInputPrompt] = React.useState<string>('');
  const [originalSelectedModel, setOriginalSelectedModel] = React.useState<string | undefined>(undefined);
  const [selectedSpanId, setSelectedSpanId] = React.useState<string | null>(null);
  const [lastAppliedSpanId, setLastAppliedSpanId] = React.useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = React.useState<boolean>(false);
  const [hoveredSpanId, setHoveredSpanId] = React.useState<string | null>(null);
  const [showHighlights, setShowHighlights] = React.useState<boolean>(true);
  const [lastSwapTime, setLastSwapTime] = React.useState<number | null>(null);
  const [promptState, setPromptState] = React.useState<'generated' | 'edited' | 'synced'>('generated');
  const [generatedTimestamp, setGeneratedTimestamp] = React.useState<number | null>(null);
  const [justReplaced, setJustReplaced] = React.useState<{ from: string; to: string } | null>(null);
  const justReplacedTimeoutRef = React.useRef<number | null>(null);

  // Normalize to NFC so span offsets and rendered text stay aligned.
  const normalizedDisplayedPrompt = useMemo(
    () => (displayedPrompt == null ? null : sanitizeText(displayedPrompt)),
    [displayedPrompt]
  );

  const previewSource = previewPrompt ?? normalizedDisplayedPrompt ?? '';

  const labelingPolicy = useMemo(() => DEFAULT_LABELING_POLICY, []);

  // Extract suggestions panel visibility state
  const isSuggestionsOpen = Boolean(suggestionsData && suggestionsData.show !== false);

  const formatCategoryLabel = useCallback((raw?: string | null): string => {
    if (!raw) return '';
    // "subject" -> "Subject", "shotType" -> "Shot Type"
    return raw
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }, []);

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

  // Handle hover preview - lightly prime right panel
  const handleHighlightMouseEnter = useCallback((e: React.MouseEvent): void => {
    if (!enableMLHighlighting || !editorRef.current) return;
    try {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const node = findHighlightNode(target, editorRef.current);
      if (node) {
        const spanId = node.dataset?.spanId || null;
        // Only update if spanId actually changed to avoid unnecessary re-renders
        setHoveredSpanId((prev) => prev !== spanId ? spanId : prev);
      } else {
        // Only clear if we're not over any highlight
        setHoveredSpanId((prev) => prev !== null ? null : prev);
      }
    } catch (error) {
      // Silently handle errors in hover detection
      console.debug('[PromptCanvas] Error in hover detection:', error);
    }
  }, [enableMLHighlighting]);

  const handleHighlightMouseLeave = useCallback((): void => {
    setHoveredSpanId(null);
  }, []);

  // Track prompt state changes
  useEffect(() => {
    if (!normalizedDisplayedPrompt) {
      setPromptState('generated');
      setGeneratedTimestamp(null);
      return;
    }

    // Check if prompt matches input (synced) or has been edited
    if (normalizedDisplayedPrompt === inputPrompt) {
      setPromptState('synced');
    } else {
      // Check if this is a fresh generation or an edit
      // If we just finished processing, it's "generated just now"
      if (isDraftReady && !isRefining && !isProcessing) {
        setPromptState('generated');
        // Set timestamp when first generated (only if not already set)
        setGeneratedTimestamp((prev) => prev || Date.now());
      } else {
        setPromptState('edited');
      }
    }
  }, [normalizedDisplayedPrompt, inputPrompt, isDraftReady, isRefining, isProcessing]);

  // Track swaps for undo hint
  useEffect(() => {
    if (selectedSpanId && prevPromptRef.current !== null && 
        prevPromptRef.current !== normalizedDisplayedPrompt) {
      setLastSwapTime(Date.now());
      // Clear hint after 3 seconds
      setTimeout(() => setLastSwapTime(null), 3000);
    }
  }, [selectedSpanId, normalizedDisplayedPrompt]);

  // Track previous prompt for swap detection
  const prevPromptRef = React.useRef<string | null>(null);

  // Editor content hook
  useEditorContent({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    displayedPrompt: normalizedDisplayedPrompt,
    formattedHTML,
  });

  // Manage selected span CSS classes
  useEffect(() => {
    if (!editorRef.current || !enableMLHighlighting) return;

    const editor = editorRef.current;
    const allHighlights = editor.querySelectorAll('.value-word');
    
    // Detect swap by comparing prompt text
    const promptChanged = prevPromptRef.current !== null && 
                         prevPromptRef.current !== normalizedDisplayedPrompt &&
                         selectedSpanId !== null;
    
    allHighlights.forEach((highlight) => {
      const element = highlight as HTMLElement;
      const spanId = element.dataset?.spanId;
      
      if (selectedSpanId && spanId === selectedSpanId) {
        element.classList.add('value-word--selected');
        element.classList.remove('value-word--dimmed');
        
        // Add swap feedback animation if prompt changed
        if (promptChanged) {
          element.classList.add('value-word--swapped');
          setTimeout(() => {
            element.classList.remove('value-word--swapped');
          }, 300);
        }
      } else if (selectedSpanId) {
        element.classList.add('value-word--dimmed');
        element.classList.remove('value-word--selected');
      } else {
        element.classList.remove('value-word--selected', 'value-word--dimmed', 'value-word--swapped');
      }
    });

    // Update previous prompt ref
    prevPromptRef.current = normalizedDisplayedPrompt;
  }, [selectedSpanId, enableMLHighlighting, normalizedDisplayedPrompt]);

  // Track interaction for instruction visibility
  useEffect(() => {
    if (selectedSpanId && !hasInteracted) {
      setHasInteracted(true);
    }
  }, [selectedSpanId, hasInteracted]);

  // Clear selection when suggestions panel closes
  useEffect(() => {
    if (!isSuggestionsOpen && selectedSpanId) {
      setSelectedSpanId(null);
    }
  }, [isSuggestionsOpen, selectedSpanId]);

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

  const clearJustReplacedTimeout = useCallback((): void => {
    if (justReplacedTimeoutRef.current) {
      window.clearTimeout(justReplacedTimeoutRef.current);
      justReplacedTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearJustReplacedTimeout();
    };
  }, [clearJustReplacedTimeout]);

  const handleSuggestionClickWithFeedback = useCallback(
    (suggestion: unknown): void => {
      const suggestionText =
        typeof suggestion === 'string'
          ? suggestion
          : (suggestion as { text?: string } | null)?.text || '';
      const from = suggestionsData?.selectedText || '';

      if (from && suggestionText) {
        setJustReplaced({ from, to: suggestionText });
        clearJustReplacedTimeout();
        justReplacedTimeoutRef.current = window.setTimeout(() => {
          setJustReplaced(null);
          justReplacedTimeoutRef.current = null;
        }, 3000);
      }

      // Track the last intentful change so Preview can route users back to the most likely culprit.
      if (selectedSpanId) {
        setLastAppliedSpanId(selectedSpanId);
      }

      onSuggestionClick?.(suggestion as never);
    },
    [onSuggestionClick, suggestionsData?.selectedText, clearJustReplacedTimeout, selectedSpanId]
  );

  const formatRelativeUpdate = useCallback((timestamp: number): string => {
    const diffMs = Math.max(0, Date.now() - timestamp);
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  const currentPreviewPrompt = activePreviewTab === 'visual' ? previewSource : normalizedDisplayedPrompt ?? '';
  const lastGeneratedPrompt = activePreviewTab === 'visual' ? visualLastGeneratedPrompt : videoLastGeneratedPrompt;
  const lastGeneratedAt = activePreviewTab === 'visual' ? visualLastGeneratedAt : videoLastGeneratedAt;

  const previewHasGeneration = Boolean(lastGeneratedAt && lastGeneratedPrompt);
  const previewIsFresh =
    previewHasGeneration && currentPreviewPrompt.trim().length > 0
      ? lastGeneratedPrompt === currentPreviewPrompt
      : false;
  const previewStatusText = !previewHasGeneration
    ? 'No preview yet'
    : previewIsFresh
      ? `Previewing latest prompt · Updated ${formatRelativeUpdate(lastGeneratedAt as number)}`
      : `Edits since last preview · Updated ${formatRelativeUpdate(lastGeneratedAt as number)}`;

  const handleVisualPreviewGenerated = useCallback(
    ({ prompt: generatedPrompt, generatedAt }: { prompt: string; generatedAt: number }) => {
      setVisualLastGeneratedPrompt(generatedPrompt);
      setVisualLastGeneratedAt(generatedAt);
    },
    []
  );

  const handleVideoPreviewGenerated = useCallback(
    ({ prompt: generatedPrompt, generatedAt }: { prompt: string; generatedAt: number }) => {
      setVideoLastGeneratedPrompt(generatedPrompt);
      setVideoLastGeneratedAt(generatedAt);
    },
    []
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
    [onFetchSuggestions, normalizedDisplayedPrompt, parseResult.spans, editorRef]
  );

  const handleKeepRefiningFromPreview = useCallback((): void => {
    setRightPaneMode('refine');
    setShowPreviewStatusHelp(false);
  }, []);

  const handleSomethingOffFromPreview = useCallback((): void => {
    setRightPaneMode('refine');
    setShowPreviewStatusHelp(false);
    focusSpan(lastAppliedSpanId ?? selectedSpanId);
  }, [focusSpan, lastAppliedSpanId, selectedSpanId]);

  // Format timestamp helper - declared early to avoid hoisting issues
  const formatTimestamp = useCallback((timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

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
          className={`flex flex-col h-full overflow-hidden bg-geist-accents-1 border-l border-geist-accents-2 max-md:w-full max-md:h-auto transition-opacity duration-300 ${
            selectedSpanId ? 'opacity-60' : 'opacity-100'
          }`}
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
              selectedSpanId={selectedSpanId}
            />
          </HighlightingErrorBoundary>
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex flex-col flex-1 overflow-y-auto scrollbar-auto-hide min-w-0">
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

          {/* Directionality Indicator */}
          {normalizedDisplayedPrompt && (
            <div className="prompt-transformation-indicator">
              <div className="prompt-transformation-indicator__line" />
              <div className="prompt-transformation-indicator__content">
                <svg
                  className="prompt-transformation-indicator__arrow"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 4L10 16M10 16L4 10M10 16L16 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="prompt-transformation-indicator__label">Optimized output</span>
              </div>
              <div className="prompt-transformation-indicator__line" />
            </div>
          )}

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
                      Output
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
                  promptText={normalizedDisplayedPrompt ?? ''}
                  showModelMenu={showModelMenu}
                  onToggleModelMenu={setShowModelMenu}
                />
              )}
            </div>
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
          {/* Sticky right-pane header + mode controls */}
          <div className="sticky top-0 z-20 bg-geist-background border-b border-geist-accents-2">
            <div className="px-geist-4 py-geist-3 flex items-start justify-between gap-geist-3">
              <div className="min-w-0">
                <div className="flex items-center gap-geist-2">
                  {rightPaneMode === 'preview' && (
                    <button
                      type="button"
                      onClick={() => setRightPaneMode('refine')}
                      className="inline-flex items-center gap-1.5 px-geist-2 py-geist-1 text-label-12 font-medium text-geist-accents-6 hover:text-geist-foreground hover:bg-geist-accents-1 rounded-geist transition-colors"
                      aria-label="Back to refinement"
                      title="Back to refinement"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Back</span>
                    </button>
                  )}
                  <h2 className="text-sm font-semibold text-geist-foreground truncate">
                    {rightPaneMode === 'preview' ? 'Preview' : 'Refine Prompt'}
                  </h2>
                </div>
                {rightPaneMode === 'refine' ? (
                  suggestionsData?.selectedText ? (
                    <p className="mt-1 text-label-12 text-geist-accents-5 truncate">
                      Editing “{suggestionsData.selectedText}”
                      {formatCategoryLabel(suggestionsData.metadata?.category) ? (
                        <> · {formatCategoryLabel(suggestionsData.metadata?.category)}</>
                      ) : null}
                    </p>
                  ) : null
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPreviewStatusHelp((prev) => !prev)}
                        className="inline-flex items-center gap-2 text-label-12 text-geist-accents-5 hover:text-geist-foreground"
                        aria-label="Preview status"
                        aria-expanded={showPreviewStatusHelp}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            !previewHasGeneration
                              ? 'bg-neutral-300'
                              : previewIsFresh
                                ? 'bg-success-600'
                                : 'bg-warning-600'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{previewStatusText}</span>
                      </button>
                      {showPreviewStatusHelp && (
                        <div className="absolute top-full left-0 mt-2 z-tooltip w-72 p-3 bg-neutral-900 text-white text-xs rounded-lg shadow-xl">
                          <div className="space-y-2">
                            <div className="font-semibold">What this means</div>
                            <div className="space-y-1 opacity-90">
                              <div>Green: this preview matches the current prompt.</div>
                              <div>Yellow: you’ve edited since the last preview.</div>
                              <div>Generate again anytime to validate changes.</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-geist-2 flex-shrink-0">
                {rightPaneMode === 'refine' && suggestionsData?.selectedText && suggestionsData?.onClose && (
                  <button
                    type="button"
                    onClick={() => {
                      suggestionsData.onClose?.();
                      setSelectedSpanId(null);
                      setHoveredSpanId(null);
                    }}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors"
                    aria-label="Clear selection"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4 text-geist-accents-6" aria-hidden="true" />
                  </button>
                )}

                <div
                  className="flex items-center bg-geist-accents-1 border border-geist-accents-2 rounded-geist overflow-hidden"
                  role="tablist"
                  aria-label="Right pane mode"
                >
                  <button
                    type="button"
                    onClick={() => setRightPaneMode('refine')}
                    className={`px-geist-3 py-geist-1.5 text-label-12 font-medium transition-colors ${
                      rightPaneMode === 'refine'
                        ? 'bg-geist-foreground text-geist-background'
                        : 'text-geist-accents-6 hover:text-geist-foreground'
                    }`}
                    role="tab"
                    aria-selected={rightPaneMode === 'refine'}
                  >
                    Refine
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPaneMode('preview')}
                    className={`px-geist-3 py-geist-1.5 text-label-12 font-medium transition-colors ${
                      rightPaneMode === 'preview'
                        ? 'bg-geist-foreground text-geist-background'
                        : 'text-geist-accents-6 hover:text-geist-foreground'
                    }`}
                    role="tab"
                    aria-selected={rightPaneMode === 'preview'}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right-pane body (single responsibility at a time) */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {rightPaneMode === 'preview' ? (
              <div className="flex flex-col flex-1 overflow-y-auto p-geist-4 min-h-0">
                <TabbedPreview
                  visualPrompt={previewSource}
                  videoPrompt={normalizedDisplayedPrompt ?? ''}
                  aspectRatio={previewAspectRatio}
                  isVisible={true}
                  selectedMode={selectedMode}
                  onActiveTabChange={(tab) => {
                    setActivePreviewTab(tab);
                    setShowPreviewStatusHelp(false);
                  }}
                  onVisualPreviewGenerated={handleVisualPreviewGenerated}
                  onVideoPreviewGenerated={handleVideoPreviewGenerated}
                  onKeepRefining={handleKeepRefiningFromPreview}
                  onRefinePrompt={handleSomethingOffFromPreview}
                />
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Inline replacement feedback (auto-dismiss) */}
                {justReplaced && (
                  <div className="px-geist-4 pt-geist-3">
                    <div className="flex items-center justify-between gap-geist-3 bg-geist-accents-1 border border-geist-accents-2 rounded-geist px-geist-3 py-geist-2">
                      <div className="text-label-12 text-geist-foreground truncate">
                        ✓ Replaced “{justReplaced.from}” → “{justReplaced.to}”
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onUndo?.();
                          setJustReplaced(null);
                        }}
                        className="text-label-12 font-medium text-geist-accents-6 hover:text-geist-foreground"
                        aria-label="Undo replacement"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col flex-1 overflow-hidden min-h-0 pt-geist-2">
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
                            panelClassName: 'h-full flex flex-col',
                            contextValue: suggestionsData.selectedText || '',
                            showCategoryTabs: false,
                            showCopyAction: false,
                            customRequestPlaceholder: 'e.g. more cinematic, more intense, younger, older',
                            customRequestCtaLabel: 'Generate more',
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
                            customRequestPlaceholder: 'e.g. more cinematic, more intense, younger, older',
                            customRequestCtaLabel: 'Generate more',
                            hoverPreview: hoveredSpanId !== null && !selectedSpanId,
                          } as Record<string, unknown>)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
