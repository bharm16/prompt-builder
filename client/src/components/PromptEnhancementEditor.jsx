import React, { useState, useRef, useEffect } from 'react';
import { detectAndApplySceneChange } from '../utils/detectSceneChange';

export default function PromptEnhancementEditor({
  promptContent,
  onPromptUpdate,
  originalUserPrompt,
  onShowSuggestionsChange,
}) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(false); // NEW: Track suggestion type
  const contentRef = useRef(null);

  // Handle text selection
  const handleMouseUp = async () => {
    const selection = window.getSelection();
    let text = selection.toString().trim();

    if (text.length > 0 && contentRef.current?.contains(selection.anchorNode)) {
      // Remove leading dash and whitespace from bullet points
      const cleanedText = text.replace(/^-\s*/, '');

      setSelectedText(cleanedText);

      // Save the range to restore selection later
      const range = selection.getRangeAt(0).cloneRange();
      setSelectionRange(range);

      // Fetch AI suggestions with cleaned text
      await fetchEnhancementSuggestions(cleanedText);
    }
  };

  // Restore selection when showing suggestions
  useEffect(() => {
    if (selectionRange && showSuggestions) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRange);
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
        isPlaceholder, // NEW: Pass placeholder flag
        fullPrompt: promptContent,
        setSuggestions, // Allow panel to update suggestions
        onSuggestionClick: handleSuggestionClick,
        onClose: handleClose,
      });
    }
  }, [showSuggestions, selectedText, suggestions, isLoading, isPlaceholder]);

  // Fetch enhancement suggestions from API
  const fetchEnhancementSuggestions = async (highlightedText) => {
    setIsLoading(true);
    setShowSuggestions(true);
    setSuggestions([]);
    setIsPlaceholder(false);

    try {
      // Extract context around the highlighted text
      const fullText = promptContent;
      const highlightIndex = fullText.indexOf(highlightedText);

      const contextBefore = fullText
        .substring(Math.max(0, highlightIndex - 300), highlightIndex)
        .trim();

      const contextAfter = fullText
        .substring(
          highlightIndex + highlightedText.length,
          Math.min(
            fullText.length,
            highlightIndex + highlightedText.length + 300
          )
        )
        .trim();

      const response = await fetch(
        '/api/get-enhancement-suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({
            highlightedText,
            contextBefore,
            contextAfter,
            fullPrompt: fullText,
            originalUserPrompt,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      console.log('Enhancement API Response:', {
        isPlaceholder: data.isPlaceholder,
        hasCategories: data.hasCategories,
        suggestionsCount: data.suggestions?.length,
        firstSuggestion: data.suggestions?.[0],
        suggestions: data.suggestions,
        isGrouped: data.suggestions?.[0]?.suggestions !== undefined
      });

      // Pass the suggestions directly - they may be grouped or flat
      setSuggestions(data.suggestions || []);
      setIsPlaceholder(data.isPlaceholder || false); // NEW: Set placeholder flag
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
  const handleSuggestionClick = async (suggestion) => {
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
  const handleClose = () => {
    setShowSuggestions(false);
    setSelectedText('');
    setSelectionRange(null);
    setIsPlaceholder(false);
    window.getSelection().removeAllRanges();
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

