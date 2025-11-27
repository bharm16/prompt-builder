/**
 * useTextSelection Hook
 * 
 * Handles text selection and highlight interaction logic.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useCallback, type RefObject } from 'react';
import { getSelectionOffsets, selectRange } from '../../utils/textSelection';
import {
  findHighlightNode,
  extractHighlightMetadata,
  createHighlightRange,
} from '../../utils/highlightInteractionHelpers';
import type { ParseResult, SuggestionPayload, SpanClickPayload } from '../types';

export interface UseTextSelectionOptions {
  selectedMode: string;
  editorRef: RefObject<HTMLElement>;
  displayedPrompt: string | null;
  labeledSpans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  parseResult: ParseResult;
  onFetchSuggestions: ((payload: SuggestionPayload) => void) | undefined;
}

export interface UseTextSelectionReturn {
  handleTextSelection: () => void;
  handleHighlightClick: (e: React.MouseEvent) => void;
  handleHighlightMouseDown: (e: React.MouseEvent) => void;
  handleSpanClickFromBento: (span: SpanClickPayload) => void;
}

export function useTextSelection({
  selectedMode,
  editorRef,
  displayedPrompt,
  labeledSpans,
  parseResult,
  onFetchSuggestions,
}: UseTextSelectionOptions): UseTextSelectionReturn {
  const handleTextSelection = useCallback((): void => {
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
        allLabeledSpans: labeledSpans,
      });
    }
  }, [selectedMode, editorRef, displayedPrompt, labeledSpans, onFetchSuggestions]);

  const triggerSuggestionsFromTarget = useCallback(
    (targetElement: EventTarget | null, e: React.MouseEvent | null): void => {
      if (selectedMode !== 'video' || !editorRef.current) {
        return;
      }

      // Find the highlighted word element
      const node = findHighlightNode(targetElement as HTMLElement | null, editorRef.current);
      if (!node) {
        return;
      }

      // Prevent default text selection behavior
      if (e && e.preventDefault) {
        e.preventDefault();
      }

      // Extract metadata from the node
      const metadata = extractHighlightMetadata(node, {
        spans: parseResult.spans,
        displayText: parseResult.displayText,
      });
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
          metadata: metadata ?? null,
          trigger: 'highlight',
          allLabeledSpans: labeledSpans,
        });
      }
    },
    [selectedMode, editorRef, displayedPrompt, labeledSpans, parseResult, onFetchSuggestions]
  );

  const handleHighlightClick = useCallback(
    (e: React.MouseEvent): void => {
      triggerSuggestionsFromTarget(e.target, e);
    },
    [triggerSuggestionsFromTarget]
  );

  const handleHighlightMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      triggerSuggestionsFromTarget(e.target, e);
    },
    [triggerSuggestionsFromTarget]
  );

  const handleSpanClickFromBento = useCallback(
    (span: SpanClickPayload): void => {
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
    },
    [onFetchSuggestions, selectedMode, displayedPrompt, labeledSpans]
  );

  return {
    handleTextSelection,
    handleHighlightClick,
    handleHighlightMouseDown,
    handleSpanClickFromBento,
  };
}

