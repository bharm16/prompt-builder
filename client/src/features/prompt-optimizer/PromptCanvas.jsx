import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import SuggestionsPanel from '../../components/SuggestionsPanel';
import { useToast } from '../../components/Toast';
import { useSpanLabeling, createHighlightSignature } from './hooks/useSpanLabeling.js';
import { createCanonicalText } from '../../utils/canonicalText.js';

// Extracted utilities
import { formatTextToHTML } from './utils/textFormatting.js';
import { getSelectionOffsets, restoreSelectionFromOffsets } from './utils/textSelection.js';
import { convertLabeledSpansToHighlights } from './utils/highlightConversion.js';

// Extracted services
import { ExportService } from '../../services/exportService.js';

// Extracted hooks
import { useClipboard } from './hooks/useClipboard.js';
import { useShareLink } from './hooks/useShareLink.js';
import { useHighlightRendering, useHighlightFingerprint } from './hooks/useHighlightRendering.js';

// Extracted components
import { CategoryLegend } from './components/CategoryLegend.jsx';
import { FloatingToolbar } from './components/FloatingToolbar.jsx';
import { PromptEditor } from './components/PromptEditor.jsx';
import { SpanBentoGrid } from './SpanBentoGrid/SpanBentoGrid.jsx';

// Configuration
import { PERFORMANCE_CONFIG, DEFAULT_LABELING_POLICY, TEMPLATE_VERSIONS } from '../../config/performance.config';

// Styles
import './PromptCanvas.css';

// No inline code needed - everything is extracted!

// Main PromptCanvas Component
export const PromptCanvas = ({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
  qualityScore,
  selectedMode,
  currentMode,
  promptUuid,
  promptContext, // NEW: Context from Creative Brainstorm
  onDisplayedPromptChange,
  suggestionsData,
  onFetchSuggestions,
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
  draftSpans = null, // NEW: Spans from parallel execution
  refinedSpans = null, // NEW: Spans from refined text
}) => {
  // UI state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Refs
  const editorRef = useRef(null);
  const toast = useToast();

  // Custom hooks for clipboard and sharing
  const { copied, copy } = useClipboard();
  const { shared, share } = useShareLink();

  const enableMLHighlighting = selectedMode === 'video';

  const labelingPolicy = useMemo(
    () => DEFAULT_LABELING_POLICY,
    []
  );

  const memoizedInitialHighlights = useMemo(() => {
    if (!enableMLHighlighting) {
      return null;
    }

    // PRIORITY 1: Use draft spans if available and we're showing draft text
    // This provides instant highlights at ~300ms
    if (draftSpans && isDraftReady && !refinedSpans) {
      const signature = createHighlightSignature(displayedPrompt ?? '');
      return {
        spans: draftSpans.spans || [],
        meta: draftSpans.meta || null,
        signature,
        cacheId: promptUuid ? String(promptUuid) : null,
        source: 'draft', // Mark as draft spans
      };
    }

    // PRIORITY 2: Use refined spans if available
    // This provides updated highlights when refinement completes
    if (refinedSpans && !isRefining) {
      const signature = createHighlightSignature(displayedPrompt ?? '');
      return {
        spans: refinedSpans.spans || [],
        meta: refinedSpans.meta || null,
        signature,
        cacheId: promptUuid ? String(promptUuid) : null,
        source: 'refined', // Mark as refined spans
      };
    }

    // PRIORITY 3: Fallback to persisted highlights (e.g., loaded from history)
    if (initialHighlights && Array.isArray(initialHighlights.spans)) {
      const resolvedSignature =
        initialHighlights.signature ?? createHighlightSignature(displayedPrompt ?? '');

      return {
        spans: initialHighlights.spans,
        meta: initialHighlights.meta ?? null,
        signature: resolvedSignature,
        cacheId: initialHighlights.cacheId ?? (promptUuid ? String(promptUuid) : null),
        source: 'persisted',
      };
    }

    return null;
  }, [
    enableMLHighlighting,
    draftSpans,
    refinedSpans,
    isDraftReady,
    isRefining,
    initialHighlights,
    initialHighlightsVersion,
    promptUuid,
    displayedPrompt
  ]);

  const handleLabelingResult = useCallback(
    (result) => {
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
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const isInitialOptimization = isDraftReady && !hasUserEdited;

  const {
    spans: labeledSpans,
    meta: labeledMeta,
    status: labelingStatus,
    error: labelingError,
  } = useSpanLabeling({
    text: enableMLHighlighting ? displayedPrompt : '',
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

  const [parseResult, setParseResult] = useState(() => ({
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
        return { html: `<div style="white-space: pre-wrap; line-height: 1.6; font-size: 0.9375rem;">${escaped}</div>` };
      }
      return formatTextToHTML(displayedPrompt, enableMLHighlighting, promptContext);
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
  const handleCopy = () => {
    copy(displayedPrompt);
  };

  const handleShare = () => {
    share(promptUuid);
  };

  const handleExport = (format) => {
    ExportService.export(format, {
      inputPrompt,
      displayedPrompt,
      qualityScore,
      selectedMode,
    });
    setShowExportMenu(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  // NEW: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
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

  const handleTextSelection = () => {
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

    if (onFetchSuggestions) {
      const cleanedText = trimmed.replace(/^-\s*/, '') || trimmed;
      const range = selection.getRangeAt(0).cloneRange();
      const offsets = getSelectionOffsets(editorRef.current, range);
      onFetchSuggestions({
        highlightedText: cleanedText,
        originalText: trimmed,
        displayedPrompt,
        range,
        offsets,
        metadata: null,
        trigger: 'selection',
        allLabeledSpans: labeledSpans, // NEW: Complete span context
      });
    }
  };

  // Shared helper to trigger suggestions from a DOM target
  const triggerSuggestionsFromTarget = (targetElement, e) => {
    // Only handle highlight clicks in video mode
    if (selectedMode !== 'video') {
      return;
    }

    // Check if clicked element or its parent is a highlighted word
    let node = targetElement;

    // Traverse up to find a value-word span (in case user clicks on text inside the span)
    while (node && node !== editorRef.current) {
      if (node.classList && node.classList.contains('value-word')) {
        // Prevent default text selection behavior
        if (e && e.preventDefault) e.preventDefault();

        // Get the word text and metadata
        const wordText = node.textContent.trim();

        let metadata = null;
        if (node.dataset) {
          const {
            category,
            source,
            spanId,
            start,
            end,
            startGrapheme,
            endGrapheme,
            validatorPass,
            confidence,
            quote,
            leftCtx,
            rightCtx,
            idempotencyKey,
          } = node.dataset;

          metadata = {
            category: category || null,
            source: source || null,
            spanId: spanId || null,
            start: start ? Number(start) : -1,
            end: end ? Number(end) : -1,
            startGrapheme: startGrapheme ? Number(startGrapheme) : -1,
            endGrapheme: endGrapheme ? Number(endGrapheme) : -1,
            validatorPass: validatorPass !== 'false',
            confidence: confidence ? Number(confidence) : null,
            quote: quote || wordText,
            leftCtx: leftCtx || '',
            rightCtx: rightCtx || '',
            idempotencyKey: idempotencyKey || null,
          };

          if (metadata.spanId && Array.isArray(parseResult?.spans)) {
            const spanDetail = parseResult.spans.find((span) => span.id === metadata.spanId);
            if (spanDetail) {
              metadata.span = { ...spanDetail };
            }
          }
        }

        if (wordText && onFetchSuggestions) {
          // Create a range for the clicked word
          const range = document.createRange();
          range.selectNodeContents(node);
          const rangeClone = range.cloneRange();
          const offsets = getSelectionOffsets(editorRef.current, rangeClone);

          // Clear any existing selection
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          // Trigger suggestions for this word
          onFetchSuggestions({
            highlightedText: wordText,
            originalText: wordText,
            displayedPrompt,
            range: rangeClone,
            offsets,
            metadata,
            trigger: 'highlight',
            allLabeledSpans: labeledSpans, // NEW: Complete span context
          });
        }

        return;
      }
      node = node.parentElement;
    }
  };

  // Handle clicks on highlighted words
  const handleHighlightClick = (e) => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  // Some headless environments can swallow click on contentEditable.
  // Also listen on mousedown to reliably capture interactions.
  const handleHighlightMouseDown = (e) => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  // Handle clicks on spans from the Bento Grid
  const handleSpanClickFromBento = (span) => {
    if (!onFetchSuggestions || selectedMode !== 'video') {
      return;
    }
    
    // Create synthetic event matching highlight click behavior
    onFetchSuggestions({
      highlightedText: span.quote,
      originalText: span.quote,
      displayedPrompt,
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

  const handleCopyEvent = (e) => {
    // Check if there's a text selection
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // If there's selected text, copy only the selection
    // Otherwise, copy the entire prompt (for backwards compatibility with copy button)
    if (selectedText) {
      // Let the browser handle copying the selected text
      // No need to prevent default or set clipboard data
      return;
    }

    // Only copy the full prompt if there's no selection
    e.clipboardData.setData('text/plain', displayedPrompt);
    e.preventDefault();
  };

  const handleInput = (e) => {
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
        let savedOffsets = null;

        // Try to save cursor selection offsets when focus is within the editor
        if (hadFocus && selection?.rangeCount > 0) {
          try {
            const range = selection.getRangeAt(0);
            if (
              editorRef.current.contains(range.startContainer) &&
              editorRef.current.contains(range.endContainer)
            ) {
              savedOffsets = getSelectionOffsets(editorRef.current, range);
            }
          } catch (e) {
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
          } catch (e) {
            // Ignore focus errors
          }
        }
      }
    } else if (editorRef.current && !displayedPrompt) {
      editorRef.current.innerHTML = '<p style="color: rgb(163, 163, 163); font-size: 0.875rem;">Your optimized prompt will appear here...</p>';
    }
  }, [displayedPrompt, formattedHTML]);

  // Render the component
  return (
    <div className="fixed inset-0 flex bg-neutral-50" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>

      {/* Floating Toolbar */}
      <FloatingToolbar
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

      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext && promptContext.hasContext()}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Span Bento Grid (Desktop) / Bottom Drawer (Mobile) */}
        <div className="w-72 flex-shrink-0 max-md:w-full max-md:h-auto">
          <SpanBentoGrid
            spans={parseResult.spans}
            onSpanClick={handleSpanClickFromBento}
            editorRef={editorRef}
          />
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-12 py-16">
              <PromptEditor
                ref={editorRef}
                onTextSelection={handleTextSelection}
                onHighlightClick={handleHighlightClick}
                onHighlightMouseDown={handleHighlightMouseDown}
                onCopyEvent={handleCopyEvent}
                onInput={handleInput}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - AI Suggestions Panel (Always Visible) */}
      <SuggestionsPanel suggestionsData={suggestionsData || { show: false }} />
    </div>
  );
};
