import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import SuggestionsPanel from '../../components/SuggestionsPanel';
import { useToast } from '../../components/Toast';
import { useSpanLabeling } from './hooks/useSpanLabeling';
import { useHighlightSourceSelection } from './hooks/useHighlightSourceSelection';
import { createCanonicalText } from '../../utils/canonicalText';

// Extracted utilities
import { formatTextToHTML } from './utils/textFormatting';
import { getSelectionOffsets, restoreSelectionFromOffsets, selectRange } from './utils/textSelection';
import { convertLabeledSpansToHighlights } from './utils/highlightConversion';
import {
  findHighlightNode,
  extractHighlightMetadata,
  createHighlightRange,
} from './utils/highlightInteractionHelpers';

// Extracted services
import { ExportService } from '../../services/exportService';

// Extracted hooks
import { useClipboard } from './hooks/useClipboard';
import { useShareLink } from './hooks/useShareLink';
import { useHighlightRendering } from '../span-highlighting/hooks/useHighlightRendering';
import { useHighlightFingerprint } from '../span-highlighting/hooks/useHighlightFingerprint';

// Extracted components
import { CategoryLegend } from './components/CategoryLegend';
import { PromptActions } from './components/PromptActions';
import { PromptEditor } from './components/PromptEditor';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../span-highlighting/components/HighlightingErrorBoundary';

// Configuration
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '@config/performance.config';

// Styles
import './PromptCanvas.css';

import type { PromptCanvasProps } from './PromptCanvas/types';

interface ParseResult {
  canonical: string;
  spans: unknown[];
  meta: unknown | null;
  status: string;
  error: Error | null;
  displayText: string;
}

type ExportFormat = 'json' | 'txt' | 'md';

// Main PromptCanvas Component
export function PromptCanvas({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
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
  draftSpans = null,
  refinedSpans = null,
}: PromptCanvasProps): React.ReactElement {
  // UI state
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(false);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  const labelingPolicy = useMemo(
    () => DEFAULT_LABELING_POLICY,
    []
  );

  // EXTRACTED: Highlight source selection logic
  const memoizedInitialHighlights = useHighlightSourceSelection({
    draftSpans,
    refinedSpans,
    isDraftReady,
    isRefining,
    initialHighlights,
    promptUuid,
    displayedPrompt,
    enableMLHighlighting,
    initialHighlightsVersion,
  });

  const handleLabelingResult = useCallback(
    (result: unknown): void => {
      if (!enableMLHighlighting || !result) {
        return;
      }
      if (onHighlightsPersist) {
        onHighlightsPersist(result);
      }
    },
    [enableMLHighlighting, onHighlightsPersist]
  );

  // Track if this is the first time seeing this text (skip debounce for initial optimization)
  const [hasUserEdited, setHasUserEdited] = useState<boolean>(false);
  const isInitialOptimization = isDraftReady && !hasUserEdited;

  const {
    spans: labeledSpans,
    meta: labeledMeta,
    status: labelingStatus,
    error: labelingError,
  } = useSpanLabeling({
    text: enableMLHighlighting ? displayedPrompt ?? '' : '',
    initialData: memoizedInitialHighlights,
    initialDataVersion: initialHighlightsVersion,
    cacheKey: enableMLHighlighting && promptUuid ? String(promptUuid) : null,
    enabled: enableMLHighlighting && Boolean(displayedPrompt?.trim()),
    immediate: isInitialOptimization, // Skip debounce on initial draft display
    maxSpans: PERFORMANCE_CONFIG.MAX_HIGHLIGHTS,
    minConfidence: PERFORMANCE_CONFIG.MIN_CONFIDENCE_SCORE,
    policy: labelingPolicy,
    templateVersion: TEMPLATE_VERSIONS.SPAN_LABELING_V1,
    debounceMs: PERFORMANCE_CONFIG.DEBOUNCE_DELAY_MS,
    onResult: handleLabelingResult,
  });

  const [parseResult, setParseResult] = useState<ParseResult>(() => ({
    canonical: createCanonicalText(displayedPrompt ?? ''),
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
    displayText: displayedPrompt ?? '',
  }));

  // Highlight rendering using extracted hook
  const highlightFingerprint = useHighlightFingerprint(enableMLHighlighting, parseResult);

  useHighlightRendering({
    editorRef,
    parseResult,
    enabled: enableMLHighlighting,
    fingerprint: highlightFingerprint,
    text: displayedPrompt ?? '',
  });

  // Memoize formatted HTML - DO NOT format if ML highlighting is enabled
  // We need to preserve the original text structure for span offsets to work
  const { html: formattedHTML } = useMemo(
    () => {
      // If ML highlighting is enabled, don't apply formatting
      // Highlighting needs the raw text to match span offsets
      if (enableMLHighlighting) {
        // Return plain text with preserved whitespace
        // Escape HTML but preserve newlines and spaces
        const escaped = (displayedPrompt || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        return { html: `<div style="white-space: pre-wrap; line-height: 1.6; font-size: 0.9375rem; font-family: var(--font-geist-sans);">${escaped}</div>` };
      }
      return formatTextToHTML(displayedPrompt ?? '', enableMLHighlighting, promptContext);
    },
    // Only depend on promptContext when NOT using ML highlighting (to prevent infinite loops)
    enableMLHighlighting 
      ? [displayedPrompt, enableMLHighlighting] 
      : [displayedPrompt, enableMLHighlighting, promptContext]
  );

  // ⏱️ CRITICAL PERFORMANCE TIMER: Track when prompt appears on screen
  useEffect(() => {
    if (displayedPrompt && displayedPrompt.trim() && enableMLHighlighting) {
      performance.mark('prompt-displayed-on-screen');
    }
  }, [displayedPrompt, enableMLHighlighting]);

  useEffect(() => {
    const canonical = createCanonicalText(displayedPrompt ?? '');
    const currentText = displayedPrompt ?? '';

    if (!enableMLHighlighting || !currentText.trim()) {
      setParseResult({
        canonical,
        spans: [],
        meta: labeledMeta,
        status: labelingStatus,
        error: labelingError,
        displayText: currentText,
      });
      return;
    }

    const highlights = convertLabeledSpansToHighlights({
      spans: labeledSpans,
      text: currentText,
      canonical,
    });

    setParseResult({
      canonical,
      spans: highlights,
      meta: labeledMeta,
      status: labelingStatus,
      error: labelingError,
      displayText: currentText,
    });
  }, [
    labeledSpans,
    labeledMeta,
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt,
  ]);


  // Event handlers using extracted hooks and services
  const handleCopy = (): void => {
    copy(displayedPrompt ?? '');
  };

  const handleShare = (): void => {
    share(promptUuid);
  };

  const handleExport = (format: ExportFormat): void => {
    ExportService.export(format, {
      inputPrompt,
      displayedPrompt: displayedPrompt ?? '',
      qualityScore,
      selectedMode,
    });
    setShowExportMenu(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  // NEW: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl + Z (without Shift)
      if (modifier && e.key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          onUndo();
          toast.info('Undone');
        }
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z OR Cmd/Ctrl + Y
      if ((modifier && e.shiftKey && e.key === 'z') || (modifier && e.key === 'y')) {
        if (canRedo) {
          e.preventDefault();
          onRedo();
          toast.info('Redone');
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, canUndo, canRedo, toast]);

  // Text selection helpers (using extracted utilities)
  const handleTextSelection = (): void => {
    if (selectedMode !== 'video') {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const rawText = selection.toString();
    const trimmed = rawText.trim();
    if (!trimmed) {
      return;
    }

    if (onFetchSuggestions && editorRef.current) {
      const cleanedText = trimmed.replace(/^-\s*/, '') || trimmed;
      const range = selection.getRangeAt(0).cloneRange();
      const offsets = getSelectionOffsets(editorRef.current, range);
      onFetchSuggestions({
        highlightedText: cleanedText,
        originalText: trimmed,
        displayedPrompt: displayedPrompt ?? '',
        range,
        offsets,
        metadata: null,
        trigger: 'selection',
        allLabeledSpans: labeledSpans, // NEW: Complete span context
      });
    }
  };

  // REFACTORED: Trigger suggestions from a DOM target (highlight click)
  const triggerSuggestionsFromTarget = (targetElement: EventTarget | null, e: React.MouseEvent | null): void => {
    if (selectedMode !== 'video' || !editorRef.current) {
      return;
    }

    // Find the highlighted word element
    const node = findHighlightNode(targetElement, editorRef.current);
    if (!node) {
      return;
    }

    // Prevent default text selection behavior
    if (e && e.preventDefault) e.preventDefault();

    // Extract metadata from the node
    const metadata = extractHighlightMetadata(node, parseResult);
    const wordText = node.textContent?.trim() ?? '';

    if (wordText && onFetchSuggestions) {
      // Create range and get offsets
      const { range, rangeClone, offsets } = createHighlightRange(
        node,
        editorRef.current,
        getSelectionOffsets
      );

      // Update browser selection
      selectRange(range);

      // Trigger suggestions
      onFetchSuggestions({
        highlightedText: wordText,
        originalText: wordText,
        displayedPrompt: displayedPrompt ?? '',
        range: rangeClone,
        offsets,
        metadata,
        trigger: 'highlight',
        allLabeledSpans: labeledSpans,
      });
    }
  };

  // Handle clicks on highlighted words
  const handleHighlightClick = (e: React.MouseEvent): void => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  // Some headless environments can swallow click on contentEditable.
  // Also listen on mousedown to reliably capture interactions.
  const handleHighlightMouseDown = (e: React.MouseEvent): void => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  // Handle clicks on spans from the Bento Grid
  const handleSpanClickFromBento = (span: { quote: string; start: number; end: number; category?: string; source?: string; spanId?: string; startGrapheme?: number; endGrapheme?: number; validatorPass?: boolean; confidence?: number; leftCtx?: string; rightCtx?: string; idempotencyKey?: string; id?: string; [key: string]: unknown }): void => {
    if (!onFetchSuggestions || selectedMode !== 'video') {
      return;
    }
    
    // Create synthetic event matching highlight click behavior
    onFetchSuggestions({
      highlightedText: span.quote,
      originalText: span.quote,
      displayedPrompt: displayedPrompt ?? '',
      range: null, // Not needed for bento clicks
      offsets: { start: span.start, end: span.end },
      metadata: {
        category: span.category,
        source: span.source,
        spanId: span.id,
        start: span.start,
        end: span.end,
        startGrapheme: span.startGrapheme,
        endGrapheme: span.endGrapheme,
        validatorPass: span.validatorPass,
        confidence: span.confidence,
        quote: span.quote,
        leftCtx: span.leftCtx,
        rightCtx: span.rightCtx,
        idempotencyKey: span.idempotencyKey,
        span: span, // Full span object
      },
      trigger: 'bento-grid',
      allLabeledSpans: labeledSpans,
    });
  };

  const handleCopyEvent = (e: React.ClipboardEvent): void => {
    // Check if there's a text selection
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';

    // If there's selected text, copy only the selection
    // Otherwise, copy the entire prompt (for backwards compatibility with copy button)
    if (selectedText) {
      // Let the browser handle copying the selected text
      // No need to prevent default or set clipboard data
      return;
    }

    // Only copy the full prompt if there's no selection
    e.clipboardData.setData('text/plain', displayedPrompt ?? '');
    e.preventDefault();
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>): void => {
    // Extract plain text from the contentEditable div
    const newText = e.currentTarget.innerText || e.currentTarget.textContent || '';
    if (onDisplayedPromptChange) {
      onDisplayedPromptChange(newText);
    }
  };

  // Update the editor content when displayedPrompt changes
  useEffect(() => {
    if (editorRef.current && displayedPrompt) {
      const newHTML = formattedHTML || displayedPrompt;

      // Only update if content has actually changed to preserve cursor position
      const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
      const newText = displayedPrompt;

      if (currentText !== newText) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorRef.current;
        let savedOffsets: { start: number; end: number } | null = null;

        // Try to save cursor selection offsets when focus is within the editor
        if (hadFocus && selection && selection.rangeCount > 0) {
          try {
            const range = selection.getRangeAt(0);
            if (
              editorRef.current.contains(range.startContainer) &&
              editorRef.current.contains(range.endContainer)
            ) {
              savedOffsets = getSelectionOffsets(editorRef.current, range);
            }
          } catch {
            savedOffsets = null;
          }
        }

        // Set the HTML content
        editorRef.current.innerHTML = newHTML;

        // Restore focus and cursor if it had focus before
        if (hadFocus) {
          try {
            editorRef.current.focus();
            if (savedOffsets) {
              restoreSelectionFromOffsets(
                editorRef.current,
                savedOffsets.start,
                savedOffsets.end
              );
            }
          } catch {
            // Ignore focus errors
          }
        }
      }
    } else if (editorRef.current && !displayedPrompt) {
      editorRef.current.innerHTML = '<p style="color: rgb(163, 163, 163); font-size: 0.875rem; font-family: var(--font-geist-sans);">Your optimized prompt will appear here...</p>';
    }
  }, [displayedPrompt, formattedHTML]);

  // Render the component
  return (
    <div className="fixed inset-0 flex flex-col bg-geist-accents-1" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>

      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext?.hasContext() ?? false}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Span Bento Grid (Desktop) / Bottom Drawer (Mobile) */}
        <div className="w-72 h-full flex-shrink-0 max-md:w-full max-md:h-auto">
          <HighlightingErrorBoundary>
            <SpanBentoGrid
              spans={parseResult.spans as Array<{ id: string; quote: string; start: number; end: number; confidence?: number; category?: string; [key: string]: unknown }>}
              onSpanClick={handleSpanClickFromBento}
              editorRef={editorRef}
            />
          </HighlightingErrorBoundary>
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-auto-hide">
            <div className="max-w-3xl mx-auto px-geist-8 pt-geist-12 pb-geist-12">
              <div className="group">
                {/* PromptEditor continues working even if highlighting fails */}
                <PromptEditor
                  ref={editorRef}
                  onTextSelection={handleTextSelection}
                  onHighlightClick={handleHighlightClick}
                  onHighlightMouseDown={handleHighlightMouseDown}
                  onCopyEvent={handleCopyEvent}
                  onInput={handleInput}
                />
                
                {/* Action buttons floating below prompt content, aligned right */}
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
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - AI Suggestions Panel (Always Visible) */}
        <SuggestionsPanel 
          suggestionsData={
            suggestionsData 
              ? { ...(suggestionsData as Record<string, unknown>), onSuggestionClick } 
              : { show: false }
          } 
        />
      </div>
    </div>
  );
}

