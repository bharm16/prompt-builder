import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Sparkles, X, Info } from 'lucide-react';

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
    const text = selection.toString().trim();

    if (text.length > 0 && contentRef.current?.contains(selection.anchorNode)) {
      setSelectedText(text);

      // Save the range to restore selection later
      const range = selection.getRangeAt(0).cloneRange();
      setSelectionRange(range);

      // Fetch AI suggestions
      await fetchEnhancementSuggestions(text);
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
        'http://localhost:3001/api/get-enhancement-suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
  const handleSuggestionClick = async (suggestionText) => {
    const updatedPrompt = promptContent.replace(selectedText, suggestionText);

    // Check if this is an environment change in a WHERE section
    await detectAndHandleSceneChange(
      selectedText,
      suggestionText,
      updatedPrompt
    );

    onPromptUpdate(updatedPrompt);
    handleClose();
  };

  // Detect if changing Environment Type and offer to update related fields
  const detectAndHandleSceneChange = async (
    oldValue,
    newValue,
    updatedPrompt
  ) => {
    // Check if we're in the WHERE section and changing Environment Type
    const whereMatch = promptContent.match(
      /\*\*WHERE - LOCATION\/SETTING\*\*[\s\S]*?(?=\*\*WHEN|$)/
    );
    if (!whereMatch) return;

    const whereSection = whereMatch[0];
    const envTypeMatch = whereSection.match(/- Environment Type: \[(.*?)\]/);

    // Check if the selected text is the Environment Type value
    if (!envTypeMatch || !whereSection.includes(selectedText)) return;

    const isEnvironmentType =
      whereSection.indexOf(selectedText) >
        whereSection.indexOf('- Environment Type:') &&
      whereSection.indexOf(selectedText) <
        whereSection.indexOf('- Architectural Details:');

    if (!isEnvironmentType) return;

    // Define the related fields that might need updating
    const affectedFieldsMap = {
      'Architectural Details':
        whereSection.match(/- Architectural Details: \[(.*?)\]/)?.[1] || '',
      'Environmental Scale':
        whereSection.match(/- Environmental Scale: \[(.*?)\]/)?.[1] || '',
      'Atmospheric Conditions':
        whereSection.match(/- Atmospheric Conditions: \[(.*?)\]/)?.[1] || '',
      'Background Elements':
        whereSection.match(/- Background Elements: \[(.*?)\]/)?.[1] || '',
      'Foreground Elements':
        whereSection.match(/- Foreground Elements: \[(.*?)\]/)?.[1] || '',
      'Spatial Depth':
        whereSection.match(/- Spatial Depth: \[(.*?)\]/)?.[1] || '',
      'Environmental Storytelling':
        whereSection.match(/- Environmental Storytelling: \[(.*?)\]/)?.[1] ||
        '',
    };

    try {
      const response = await fetch(
        'http://localhost:3001/api/detect-scene-change',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changedField: 'Environment Type',
            oldValue,
            newValue,
            fullPrompt: updatedPrompt,
            affectedFields: affectedFieldsMap,
          }),
        }
      );

      if (!response.ok) return;

      const result = await response.json();

      if (result.isSceneChange && result.confidence !== 'low') {
        // Show confirmation dialog
        const shouldUpdate = window.confirm(
          `🎬 Scene Change Detected!\n\n` +
            `Changing from "${oldValue}" to "${newValue}" represents a complete environment change.\n\n` +
            `Would you like to automatically update the related location fields to match this new environment?\n\n` +
            `${result.reasoning}`
        );

        if (shouldUpdate && result.suggestedUpdates) {
          // Apply the suggested updates
          let finalPrompt = updatedPrompt;

          Object.entries(result.suggestedUpdates).forEach(
            ([fieldName, newFieldValue]) => {
              const oldFieldValue = affectedFieldsMap[fieldName];
              if (oldFieldValue && newFieldValue) {
                // Replace the old value with the new value for this field
                const fieldPattern = new RegExp(
                  `(- ${fieldName}: \\[)${oldFieldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\])`,
                  'g'
                );
                finalPrompt = finalPrompt.replace(
                  fieldPattern,
                  `$1${newFieldValue}$2`
                );
              }
            }
          );

          onPromptUpdate(finalPrompt);
        }
      }
    } catch (error) {
      console.error('Error detecting scene change:', error);
      // Silently fail - don't disrupt the user's workflow
    }
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
      className="cursor-text select-text whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800"
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
      }}
    >
      {promptContent}
    </div>
  );
}

// Separate component for the suggestions panel
export function SuggestionsPanel({ suggestionsData }) {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);

  if (!suggestionsData || !suggestionsData.show) {
    return null;
  }

  const {
    selectedText,
    suggestions,
    isLoading,
    onSuggestionClick,
    onClose,
    isPlaceholder, // New prop to differentiate suggestion types
  } = suggestionsData;

  // Handle custom suggestion request
  const handleCustomRequest = async () => {
    if (!customRequest.trim()) return;

    setIsCustomLoading(true);

    try {
      const response = await fetch(
        'http://localhost:3001/api/get-custom-suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            highlightedText: selectedText,
            customRequest: customRequest.trim(),
            fullPrompt: suggestionsData.fullPrompt || '',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch custom suggestions');
      }

      const data = await response.json();

      if (suggestionsData.setSuggestions) {
        // Don't change isPlaceholder mode when doing custom requests
        // The second parameter is undefined, so it will preserve the current isPlaceholder state
        suggestionsData.setSuggestions(data.suggestions || [], undefined);
      }
    } catch (error) {
      console.error('Error fetching custom suggestions:', error);
      if (suggestionsData.setSuggestions) {
        // Preserve isPlaceholder state even on error
        suggestionsData.setSuggestions(
          [{ text: 'Failed to load custom suggestions. Please try again.' }],
          undefined
        );
      }
    } finally {
      setIsCustomLoading(false);
      setCustomRequest('');
    }
  };

  return (
    <div className="fixed right-6 top-24 z-50 flex max-h-[calc(100vh-120px)] w-96 flex-col rounded-xl border-2 border-gray-300 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <div className="flex flex-1 items-center gap-2">
          <Sparkles className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900">
              {isPlaceholder ? 'Value Suggestions' : 'AI Suggestions'}
            </h3>
            <p className="truncate text-xs text-gray-600">
              &quot;{selectedText}&quot;
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-gray-200"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Context hint for placeholder mode */}
      {isPlaceholder && !isLoading && suggestions.length > 0 && (
        <div className="flex items-start gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <p className="text-xs text-blue-800">
            These are context-aware values that can replace your placeholder
          </p>
        </div>
      )}

      {/* Custom Request Input */}
      <div className="border-b-2 border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-700">
          Custom request:
        </p>
        <textarea
          value={customRequest}
          onChange={(e) => setCustomRequest(e.target.value)}
          placeholder="e.g., Make it more cinematic, Add more emotion, Simplify the language..."
          className="w-full resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          rows={2}
        />
        <button
          onClick={handleCustomRequest}
          disabled={!customRequest.trim() || isCustomLoading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isCustomLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Get Custom Suggestions
            </>
          )}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">
              {isPlaceholder
                ? 'Finding relevant values...'
                : 'Analyzing context...'}
            </span>
          </div>
        </div>
      )}

      {/* Suggestions List - Enhanced for placeholder mode */}
      {!isLoading && suggestions.length > 0 && (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="group w-full rounded-lg border-2 border-gray-200 bg-gray-50 p-3 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm transition-colors group-hover:bg-blue-700">
                    {index + 1}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  {isPlaceholder && suggestion.explanation ? (
                    // Value suggestion with explanation
                    <>
                      <div className="mb-1 text-sm font-semibold text-gray-900">
                        {suggestion.text}
                      </div>
                      <div className="text-xs leading-relaxed text-gray-600">
                        {suggestion.explanation}
                      </div>
                    </>
                  ) : (
                    // Regular rewrite suggestion
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                      {suggestion.text}
                    </pre>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && suggestions.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="px-4 text-center">
            <p className="text-sm text-gray-500">
              No suggestions available. Try selecting a different section.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
