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
        '/api/detect-scene-change',
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

  // Determine if we have active suggestions to show
  const hasActiveSuggestions = suggestionsData?.show;

  // Handle custom suggestion request
  const handleCustomRequest = async () => {
    if (!customRequest.trim()) return;

    setIsCustomLoading(true);

    try {
      const response = await fetch(
        '/api/get-custom-suggestions',
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
      className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-neutral-200 overflow-hidden pt-20"
      role="complementary"
      aria-labelledby="suggestions-title"
    >
      {/* Modern Header with Glassmorphism */}
      <header className="flex-shrink-0 px-4 py-3.5 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-lg shadow-sm ring-1 ring-neutral-200/50">
              <Sparkles className="h-3.5 w-3.5 text-neutral-700" aria-hidden="true" />
            </div>
            <h3 id="suggestions-title" className="text-[13px] font-semibold text-neutral-900 tracking-tight">
              AI Suggestions
            </h3>
          </div>
        </div>
        {hasActiveSuggestions && selectedText && (
          <div className="mt-3">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">For:</span>
            <p className="mt-1 text-[12px] text-neutral-900 line-clamp-2 font-medium" aria-label={`Selected text: ${selectedText}`}>
              &quot;{selectedText}&quot;
            </p>
          </div>
        )}
      </header>

      {hasActiveSuggestions && (
        <>
          {/* Modern Context Hint for Placeholder Mode */}
          {isPlaceholder && !isLoading && suggestions.length > 0 && (
            <div className="flex-shrink-0 flex items-start gap-3 bg-blue-50 border-l-4 border-blue-500 p-4 border-b border-neutral-200">
              <div className="p-1 bg-blue-100 rounded-lg">
                <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-700" aria-hidden="true" />
              </div>
              <p className="text-[12px] leading-relaxed break-words text-blue-900 font-medium">
                Context-aware values to replace your placeholder
              </p>
            </div>
          )}

          {/* Modern Category Tabs - Only show if we have multiple categories */}
          {!isLoading && categories.length > 1 && (
            <div className="flex-shrink-0 flex flex-wrap gap-2 p-4 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white">
              {categories.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-150 ${
                    activeCategory === cat.category
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400'
                  }`}
                  aria-pressed={activeCategory === cat.category}
                  aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
                >
                  <span>{cat.category}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeCategory === cat.category
                      ? 'bg-white/20'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {cat.suggestions.length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Modern Custom Request Input */}
          <div className="flex-shrink-0 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white p-4">
            <label htmlFor="custom-request" className="block mb-2 text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
              Custom Request
            </label>
            <textarea
              id="custom-request"
              value={customRequest}
              onChange={(e) => setCustomRequest(e.target.value)}
              placeholder="e.g., Make it more cinematic, Add more emotion, Simplify the language..."
              className="w-full px-3 py-2.5 text-[13px] border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all duration-150 resize-none placeholder:text-neutral-400"
              rows={2}
              aria-describedby="custom-request-hint"
            />
            <span id="custom-request-hint" className="sr-only">
              Describe how you want to modify the selected text
            </span>
            <button
              onClick={handleCustomRequest}
              disabled={!customRequest.trim() || isCustomLoading}
              className="inline-flex items-center justify-center gap-2 w-full mt-3 px-4 py-2.5 text-[13px] font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
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
                  <span>Get Suggestions</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Scrollable Content Container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {hasActiveSuggestions ? (
          <>
            {/* Modern Skeleton Loading State */}
            {isLoading && (
              <div className="p-4 space-y-3" role="status" aria-live="polite">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden p-4 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
                    style={{
                      animationDelay: `${i * 75}ms`,
                      animationDuration: '1.5s'
                    }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />

                    <div className="relative space-y-2.5">
                      <div className="h-4 bg-neutral-200/70 rounded-md w-3/4" />
                      <div className="h-3 bg-neutral-200/50 rounded-md w-full" />
                      <div className="h-3 bg-neutral-200/50 rounded-md w-5/6" />
                    </div>
                  </div>
                ))}
                <p className="text-center text-[13px] text-neutral-500 font-medium mt-6">
                  {isPlaceholder ? 'Finding relevant values...' : 'Analyzing context...'}
                </p>
              </div>
            )}

            {/* Modern Suggestions List with Stagger Animation */}
            {!isLoading && currentSuggestions.length > 0 && (
              <div
                className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-100 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400"
                role="list"
                aria-label="Suggestion options"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db #f3f4f6'
                }}>
              {currentSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="group relative animate-[slideIn_0.3s_ease-out_forwards] opacity-0"
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <button
                    onClick={() => onSuggestionClick(suggestion.text)}
                    className="w-full p-3.5 text-left rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 active:scale-[0.98]"
                    role="listitem"
                    aria-label={`Suggestion ${index + 1}: ${suggestion.text.substring(0, 50)}...`}
                  >
                    {/* Keyboard Shortcut Indicator */}
                    {index < 8 && (
                      <kbd className="absolute top-3 right-3 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {index + 1}
                      </kbd>
                    )}

                    {isPlaceholder && suggestion.explanation ? (
                      // Value suggestion with explanation
                      <div className="space-y-2 pr-6">
                        <div className="text-[14px] font-semibold text-neutral-900 break-words leading-snug">
                          {suggestion.text}
                        </div>
                        <div className="text-[12px] leading-relaxed text-neutral-600 break-words">
                          {suggestion.explanation}
                        </div>
                      </div>
                    ) : (
                      // Regular rewrite suggestion
                      <div className="text-[14px] leading-relaxed text-neutral-900 break-words whitespace-pre-wrap pr-6">
                        {suggestion.text}
                      </div>
                    )}

                    {/* Hover Action Bar */}
                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(suggestion.text);
                        }}
                        className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-150"
                      >
                        Copy
                      </button>
                      <span className="text-neutral-300">•</span>
                      <span className="text-[11px] text-neutral-500">
                        Click to apply
                      </span>
                    </div>
                  </button>
                </div>
                ))}
              </div>
            )}

            {/* Modern Empty State - No Suggestions Found */}
            {!isLoading && (!suggestions || suggestions.length === 0 || currentSuggestions.length === 0) && (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="px-4 text-center max-w-[240px]">
                  <div className="relative inline-flex mb-4">
                    <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
                    <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
                      <Sparkles className="h-8 w-8 text-neutral-400" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="text-[14px] text-neutral-900 font-semibold mb-2">
                    No suggestions available
                  </p>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">
                    Try selecting a different section or use a custom request above
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Modern Default Empty State - No Selection Made */
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center max-w-[240px]">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
                <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
                  <Sparkles className="h-8 w-8 text-neutral-400" aria-hidden="true" />
                </div>
              </div>
              <h4 className="text-[14px] font-semibold text-neutral-900 mb-2">
                Ready to enhance
              </h4>
              <p className="text-[12px] text-neutral-600 leading-relaxed">
                Highlight any part of your prompt to see AI-powered suggestions for improvement
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Custom CSS for Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </aside>
  );
}
