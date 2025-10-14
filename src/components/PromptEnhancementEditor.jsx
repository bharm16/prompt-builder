import React, { useState, useRef, useEffect, useMemo } from 'react';
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
        'http://localhost:3001/api/get-enhancement-suggestions',
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
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
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

// Separate component for the suggestions panel with improved accessibility
export function SuggestionsPanel({ suggestionsData }) {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

  // Extract data safely with defaults
  const selectedText = suggestionsData?.selectedText || '';
  const suggestions = suggestionsData?.suggestions || [];
  const isLoading = suggestionsData?.isLoading || false;
  const onSuggestionClick = suggestionsData?.onSuggestionClick || (() => {});
  const onClose = suggestionsData?.onClose || (() => {});
  const isPlaceholder = suggestionsData?.isPlaceholder || false;

  // Check if suggestions are categorized
  const hasCategories = suggestions?.length > 0 && suggestions[0]?.category !== undefined;
  const isGroupedFormat = suggestions?.length > 0 && suggestions[0]?.suggestions !== undefined;

  // Process suggestions into categories - MUST be called on every render
  const categories = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];

    if (isGroupedFormat) {
      // Already grouped format from backend
      return suggestions;
    } else if (hasCategories) {
      // Group flat suggestions by category
      const grouped = {};
      suggestions.forEach(suggestion => {
        const cat = suggestion.category || 'Other';
        if (!grouped[cat]) {
          grouped[cat] = { category: cat, suggestions: [] };
        }
        grouped[cat].suggestions.push(suggestion);
      });
      return Object.values(grouped);
    } else {
      // No categories - return as single group
      return [{ category: 'Suggestions', suggestions }];
    }
  }, [suggestions, hasCategories, isGroupedFormat]);

  // Set initial active category - MUST be called on every render
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].category);
    }
  }, [categories]);

  // Reset active category if it doesn't exist in current categories
  useEffect(() => {
    if (categories.length > 0 && activeCategory) {
      const categoryExists = categories.some(cat => cat.category === activeCategory);
      if (!categoryExists) {
        setActiveCategory(categories[0].category);
      }
    }
  }, [categories, activeCategory]);

  // Get current category's suggestions - MUST be called on every render
  const currentSuggestions = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    // Try to find the active category
    const current = categories.find(cat => cat.category === activeCategory);

    // Fallback to first category if active category not found
    if (!current && categories.length > 0) {
      return categories[0].suggestions || [];
    }

    return current?.suggestions || [];
  }, [categories, activeCategory]);

  // Conditional return AFTER all hooks
  if (!suggestionsData || !suggestionsData.show) {
    return null;
  }

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
            'X-API-Key': 'dev-key-12345'
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
    <aside
      className="fixed top-24 right-6 bottom-6 z-popover flex w-80 flex-col bg-white rounded-xl border border-neutral-200 shadow-xl animate-slide-up overflow-hidden"
      role="complementary"
      aria-labelledby="suggestions-title"
      style={{ maxHeight: 'calc(100vh - 144px)' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 id="suggestions-title" className="truncate text-sm font-semibold text-neutral-900">
              {isPlaceholder ? 'Value Suggestions' : 'Smart Suggestions'}
            </h3>
            <p className="break-words text-xs text-neutral-600 line-clamp-2" aria-label={`Selected text: ${selectedText}`}>
              &quot;{selectedText}&quot;
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost btn-sm"
          aria-label="Close suggestions panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* Context hint for placeholder mode */}
      {isPlaceholder && !isLoading && suggestions.length > 0 && (
        <div className="flex-shrink-0 flex items-start gap-2 bg-info-50 border-l-2 border-info-600 p-3 border-b border-neutral-200">
          <Info className="h-4 w-4 flex-shrink-0 text-info-700 mt-0.5" aria-hidden="true" />
          <p className="text-xs break-words text-info-900">
            These are context-aware values that can replace your placeholder
          </p>
        </div>
      )}

      {/* Category Tabs - Only show if we have multiple categories */}
      {!isLoading && categories.length > 1 && (
        <div className="flex-shrink-0 flex flex-wrap gap-1.5 p-3 border-b bg-neutral-50">
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeCategory === cat.category
                  ? 'bg-primary-700 text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
              }`}
              aria-pressed={activeCategory === cat.category}
              aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
            >
              {cat.category}
              <span className="ml-1.5 opacity-75">({cat.suggestions.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Custom Request Input */}
      <div className="flex-shrink-0 border-b border-neutral-200 bg-neutral-50 p-3">
        <label htmlFor="custom-request" className="block mb-2 text-xs font-medium text-neutral-800">
          Custom request:
        </label>
        <textarea
          id="custom-request"
          value={customRequest}
          onChange={(e) => setCustomRequest(e.target.value)}
          placeholder="e.g., Make it more cinematic, Add more emotion, Simplify the language..."
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:border-primary-600 focus:ring-1 focus:ring-primary-600 transition-colors shadow-xs resize-none"
          rows={2}
          aria-describedby="custom-request-hint"
        />
        <span id="custom-request-hint" className="sr-only">
          Describe how you want to modify the selected text
        </span>
        <button
          onClick={handleCustomRequest}
          disabled={!customRequest.trim() || isCustomLoading}
          className="btn-primary w-full mt-2 btn-sm"
          aria-label="Generate custom suggestions based on your request"
        >
          {isCustomLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Get Custom Suggestions</span>
            </>
          )}
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-1 items-center justify-center py-12" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-hidden="true" />
              <span className="text-sm text-neutral-600 font-medium">
                {isPlaceholder
                  ? 'Finding relevant values...'
                  : 'Analyzing context...'}
              </span>
            </div>
          </div>
        )}

        {/* Suggestions List */}
        {!isLoading && currentSuggestions.length > 0 && (
          <div
            className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-100 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400"
            role="list"
            aria-label="Suggestion options"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db #f3f4f6'
            }}>
          {currentSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="group w-full p-3 text-left rounded-lg border border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-sm transition-all"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestion.text.substring(0, 50)}...`}
            >
              {isPlaceholder && suggestion.explanation ? (
                // Value suggestion with explanation
                <div className="space-y-1.5">
                  <div className="text-sm font-medium text-neutral-900 break-words group-hover:text-primary-900">
                    {suggestion.text}
                  </div>
                  <div className="text-xs leading-relaxed text-neutral-600 break-words">
                    {suggestion.explanation}
                  </div>
                </div>
              ) : (
                // Regular rewrite suggestion
                <div className="text-sm leading-relaxed text-neutral-800 break-words whitespace-pre-wrap group-hover:text-neutral-900">
                  {suggestion.text}
                </div>
              )}
            </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!suggestions || suggestions.length === 0 || currentSuggestions.length === 0) && (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="px-4 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-neutral-400" aria-hidden="true" />
              <p className="text-sm text-neutral-700 font-medium mb-1">
                No suggestions available
              </p>
              <p className="text-xs text-neutral-600">
                Try selecting a different section or use a custom request
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
