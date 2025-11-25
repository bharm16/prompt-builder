import React, { useState, useRef, useEffect } from 'react';
import { detectAndApplySceneChange } from '../utils/sceneChange';
import { API_CONFIG } from '../config/api.config';

export interface HighlightMetadata {
  category: string | null;
  phrase: string | null;
  confidence: number | null;
}

export interface Suggestion {
  text: string;
  [key: string]: unknown;
}

export interface SuggestionsState {
  show: boolean;
  selectedText: string;
  suggestions: Suggestion[];
  isLoading: boolean;
  isPlaceholder: boolean;
  highlightMetadata: HighlightMetadata | null;
  fullPrompt: string;
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  onSuggestionClick: (suggestion: Suggestion | string) => void;
  onClose: () => void;
}

export interface PromptEnhancementEditorProps {
  promptContent: string;
  onPromptUpdate: (prompt: string) => void;
  originalUserPrompt?: string;
  onShowSuggestionsChange?: (state: SuggestionsState) => void;
}

export default function PromptEnhancementEditor({
  promptContent,
  onPromptUpdate,
  originalUserPrompt,
  onShowSuggestionsChange,
}: PromptEnhancementEditorProps): React.ReactElement {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isPlaceholder, setIsPlaceholder] = useState<boolean>(false);
  const [highlightMetadata, setHighlightMetadata] = useState<HighlightMetadata | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const extractMetadataFromSelection = (selection: Selection | null): HighlightMetadata | null => {
    if (!selection) return null;

    const nodesToInspect: Node[] = [];
    if (selection.anchorNode) nodesToInspect.push(selection.anchorNode);
    if (selection.focusNode && selection.focusNode !== selection.anchorNode) {
      nodesToInspect.push(selection.focusNode);
    }

    for (const node of nodesToInspect) {
      if (!node) continue;

      const element =
        node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      const highlightElement = element?.closest
        ? element.closest('[data-category]')
        : null;

      if (highlightElement) {
        const category = highlightElement.getAttribute('data-category');
        const confidenceAttr = highlightElement.getAttribute('data-confidence');
        const phrase = highlightElement.getAttribute('data-phrase');

        const parsedConfidence =
          confidenceAttr !== null && confidenceAttr !== undefined
            ? Number.parseFloat(confidenceAttr)
            : null;

        return {
          category: category || null,
          phrase: phrase || null,
          confidence:
            Number.isFinite(parsedConfidence) && parsedConfidence >= 0 && parsedConfidence <= 1
              ? parsedConfidence
              : null,
        };
      }
    }

    return null;
  };

  // Handle text selection
  const handleMouseUp = async (): Promise<void> => {
    const selection = window.getSelection();
    if (!selection) return;
    
    let text = selection.toString().trim();

    if (text.length > 0 && contentRef.current && selection.anchorNode && contentRef.current.contains(selection.anchorNode)) {
      // Remove leading dash and whitespace from bullet points
      const cleanedText = text.replace(/^-\s*/, '');

      const metadata = extractMetadataFromSelection(selection);
      setHighlightMetadata(metadata);

      setSelectedText(cleanedText);

      // Save the range to restore selection later
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        setSelectionRange(range);
      }

      // Fetch AI suggestions with cleaned text
      await fetchEnhancementSuggestions(cleanedText, metadata);
    }
  };

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
  ]);

  // Fetch enhancement suggestions from API
  const fetchEnhancementSuggestions = async (highlightedText: string, metadata: HighlightMetadata | null = null): Promise<void> => {
    setIsLoading(true);
    setShowSuggestions(true);
    setSuggestions([]);
    setIsPlaceholder(false);

    try {
      // Extract context around the highlighted text (1000 chars for richer semantic understanding)
      const fullText = promptContent;
      const highlightIndex = fullText.indexOf(highlightedText);

      const contextBefore = fullText
        .substring(Math.max(0, highlightIndex - 1000), highlightIndex)
        .trim();

      const contextAfter = fullText
        .substring(
          highlightIndex + highlightedText.length,
          Math.min(
            fullText.length,
            highlightIndex + highlightedText.length + 1000
          )
        )
        .trim();

      const highlightCategory =
        metadata && typeof metadata.category === 'string' && metadata.category.trim().length > 0
          ? metadata.category.trim()
          : null;
      const highlightCategoryConfidence =
        metadata && Number.isFinite(metadata.confidence)
          ? Math.min(1, Math.max(0, metadata.confidence))
          : null;

      const response = await fetch(
        '/api/get-enhancement-suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_CONFIG.apiKey
          },
          body: JSON.stringify({
            highlightedText,
            contextBefore,
            contextAfter,
            fullPrompt: fullText,
            originalUserPrompt,
            highlightedCategory: highlightCategory,
            highlightedCategoryConfidence: highlightCategoryConfidence,
            highlightedPhrase: metadata?.phrase || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json() as { suggestions?: Suggestion[]; isPlaceholder?: boolean };

      // Pass the suggestions directly - they may be grouped or flat
      setSuggestions(data.suggestions || []);
      setIsPlaceholder(data.isPlaceholder || false);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([
        { text: 'Failed to load suggestions. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace selected text with chosen suggestion
  const handleSuggestionClick = async (suggestion: Suggestion | string): Promise<void> => {
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
  };

  // Close suggestions panel
  const handleClose = (): void => {
    setShowSuggestions(false);
    setSelectedText('');
    setSelectionRange(null);
    setIsPlaceholder(false);
    setHighlightMetadata(null);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  return (
    <div
      ref={contentRef}
      onMouseUp={handleMouseUp}
      className="cursor-text select-text font-sans text-base leading-relaxed text-neutral-900"
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
        lineHeight: '1.75',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        paddingLeft: '20px',
        textIndent: '-20px',
        letterSpacing: '-0.01em'
      }}
    >
      {promptContent}
    </div>
  );
}

