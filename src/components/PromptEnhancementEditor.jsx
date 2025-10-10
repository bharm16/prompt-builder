import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Sparkles, X, Info } from 'lucide-react';

export default function PromptEnhancementEditor({
  promptContent,
  onPromptUpdate,
  originalUserPrompt,
  onShowSuggestionsChange
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
        onClose: handleClose
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

      const contextBefore = fullText.substring(
        Math.max(0, highlightIndex - 300),
        highlightIndex
      ).trim();

      const contextAfter = fullText.substring(
        highlightIndex + highlightedText.length,
        Math.min(fullText.length, highlightIndex + highlightedText.length + 300)
      ).trim();

      const response = await fetch('http://localhost:3001/api/get-enhancement-suggestions', {
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
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setIsPlaceholder(data.isPlaceholder || false); // NEW: Set placeholder flag
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([
        { text: 'Failed to load suggestions. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace selected text with chosen suggestion
  const handleSuggestionClick = (suggestionText) => {
    const updatedPrompt = promptContent.replace(selectedText, suggestionText);
    onPromptUpdate(updatedPrompt);
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
      className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-sans select-text cursor-text"
      style={{ userSelect: 'text' }}
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
    isPlaceholder // New prop to differentiate suggestion types
  } = suggestionsData;

  // Handle custom suggestion request
  const handleCustomRequest = async () => {
    if (!customRequest.trim()) return;

    setIsCustomLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/get-custom-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          highlightedText: selectedText,
          customRequest: customRequest.trim(),
          fullPrompt: suggestionsData.fullPrompt || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch custom suggestions');
      }

      const data = await response.json();

      if (suggestionsData.setSuggestions) {
        suggestionsData.setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching custom suggestions:', error);
      if (suggestionsData.setSuggestions) {
        suggestionsData.setSuggestions([
          { text: 'Failed to load custom suggestions. Please try again.' }
        ]);
      }
    } finally {
      setIsCustomLoading(false);
      setCustomRequest('');
    }
  };

  return (
    <div className="fixed right-6 top-24 w-96 bg-white border-2 border-gray-300 rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-120px)] z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2 flex-1">
          <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              {isPlaceholder ? 'Value Suggestions' : 'AI Suggestions'}
            </h3>
            <p className="text-xs text-gray-600 truncate">
              "{selectedText}"
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Context hint for placeholder mode */}
      {isPlaceholder && !isLoading && suggestions.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            These are context-aware values that can replace your placeholder
          </p>
        </div>
      )}

      {/* Custom Request Input */}
      <div className="p-3 border-b-2 border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-700 mb-2 font-medium">Custom request:</p>
        <textarea
          value={customRequest}
          onChange={(e) => setCustomRequest(e.target.value)}
          placeholder="e.g., Make it more cinematic, Add more emotion, Simplify the language..."
          className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
          rows={2}
        />
        <button
          onClick={handleCustomRequest}
          disabled={!customRequest.trim() || isCustomLoading}
          className="mt-2 w-full px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {isCustomLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Get Custom Suggestions
            </>
          )}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">
              {isPlaceholder ? 'Finding relevant values...' : 'Analyzing context...'}
            </span>
          </div>
        </div>
      )}

      {/* Suggestions List - Enhanced for placeholder mode */}
      {!isLoading && suggestions.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors border-2 border-gray-200 hover:border-blue-300 shadow-sm group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center text-xs font-bold shadow-sm transition-colors">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {isPlaceholder && suggestion.explanation ? (
                    // Value suggestion with explanation
                    <>
                      <div className="font-semibold text-gray-900 text-sm mb-1">
                        {suggestion.text}
                      </div>
                      <div className="text-xs text-gray-600 leading-relaxed">
                        {suggestion.explanation}
                      </div>
                    </>
                  ) : (
                    // Regular rewrite suggestion
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">
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
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center px-4">
            <p className="text-sm text-gray-500">
              No suggestions available. Try selecting a different section.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
