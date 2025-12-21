import { useState, useRef, useEffect, useCallback } from 'react';
import { detectAndApplySceneChange } from '../../../utils/sceneChange';
import { useDebugLogger } from '../../../hooks/useDebugLogger';
import { fetchEnhancementSuggestions } from '../api/enhancementApi';
import { extractMetadataFromSelection, cleanSelectedText } from '../utils/selectionUtils';
import type { HighlightMetadata, Suggestion, SuggestionsState } from '../types';

interface UseEnhancementEditorProps {
  promptContent: string;
  onPromptUpdate: (prompt: string) => void;
  originalUserPrompt?: string;
  onShowSuggestionsChange?: (state: SuggestionsState) => void;
}

interface UseEnhancementEditorReturn {
  contentRef: React.RefObject<HTMLDivElement | null>;
  handleMouseUp: () => Promise<void>;
}

export function useEnhancementEditor({
  promptContent,
  onPromptUpdate,
  originalUserPrompt,
  onShowSuggestionsChange,
}: UseEnhancementEditorProps): UseEnhancementEditorReturn {
  const debug = useDebugLogger('PromptEnhancementEditor', {
    promptLength: promptContent.length,
  });

  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isPlaceholder, setIsPlaceholder] = useState<boolean>(false);
  const [highlightMetadata, setHighlightMetadata] = useState<HighlightMetadata | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close suggestions panel
  const handleClose = useCallback((): void => {
    setShowSuggestions(false);
    setSelectedText('');
    setSelectionRange(null);
    setIsPlaceholder(false);
    setHighlightMetadata(null);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  // Replace selected text with chosen suggestion
  const handleSuggestionClick = useCallback(
    async (suggestion: Suggestion | string): Promise<void> => {
      const suggestionText =
        typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

      if (!suggestionText) return;

      const updatedPrompt = promptContent.replace(selectedText, suggestionText);

      const finalPrompt = await detectAndApplySceneChange({
        originalPrompt: promptContent,
        updatedPrompt,
        oldValue: selectedText,
        newValue: suggestionText,
      });

      onPromptUpdate(finalPrompt);
      handleClose();
    },
    [promptContent, selectedText, onPromptUpdate, handleClose]
  );

  // Fetch suggestions for highlighted text
  const fetchSuggestions = useCallback(
    async (highlightedText: string, metadata: HighlightMetadata | null): Promise<void> => {
      debug.logAction('fetchSuggestions', {
        textLength: highlightedText.length,
        category: metadata?.category,
        confidence: metadata?.confidence,
      });
      debug.startTimer('fetchSuggestions');

      setIsLoading(true);
      setShowSuggestions(true);
      setSuggestions([]);
      setIsPlaceholder(false);

      const result = await fetchEnhancementSuggestions({
        highlightedText,
        fullPrompt: promptContent,
        originalUserPrompt,
        metadata,
      });

      setSuggestions(result.suggestions);
      setIsPlaceholder(result.isPlaceholder);
      setIsLoading(false);

      debug.endTimer('fetchSuggestions', `Fetched ${result.suggestions.length} suggestions`);
    },
    [promptContent, originalUserPrompt, debug]
  );

  // Handle text selection
  const handleMouseUp = useCallback(async (): Promise<void> => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    if (
      text.length > 0 &&
      contentRef.current &&
      selection.anchorNode &&
      contentRef.current.contains(selection.anchorNode)
    ) {
      const cleanedText = cleanSelectedText(text);
      const metadata = extractMetadataFromSelection(selection);

      setHighlightMetadata(metadata);
      setSelectedText(cleanedText);

      // Save the range to restore selection later
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        setSelectionRange(range);
      }

      await fetchSuggestions(cleanedText, metadata);
    }
  }, [fetchSuggestions]);

  // Restore selection when showing suggestions
  useEffect(() => {
    if (selectionRange && showSuggestions) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(selectionRange);
      }
    }
  }, [showSuggestions, selectionRange]);

  // Notify parent component about suggestions state
  useEffect(() => {
    if (onShowSuggestionsChange) {
      onShowSuggestionsChange({
        show: showSuggestions,
        selectedText,
        suggestions,
        isLoading,
        isPlaceholder,
        highlightMetadata,
        fullPrompt: promptContent,
        setSuggestions,
        onSuggestionClick: handleSuggestionClick,
        onClose: handleClose,
      });
    }
  }, [
    showSuggestions,
    selectedText,
    suggestions,
    isLoading,
    isPlaceholder,
    highlightMetadata,
    promptContent,
    onShowSuggestionsChange,
    handleSuggestionClick,
    handleClose,
  ]);

  return {
    contentRef,
    handleMouseUp,
  };
}
