import React from 'react';
import PropTypes from 'prop-types';
import { Loader2, Lightbulb, Sparkles } from 'lucide-react';

/**
 * InlineSuggestions Component
 *
 * Displays AI-powered suggestions directly below the active field
 * - Numbered badges/pills for easy selection
 * - Keyboard shortcuts (1-9) for quick selection
 * - Loading and empty states
 * - Click to insert into field
 */
const InlineSuggestions = ({
  suggestions,
  isLoading,
  onSelect,
  fieldName,
  disabled
}) => {
  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (disabled || isLoading || suggestions.length === 0) return;

    const handleKeyPress = (e) => {
      // Check if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key;
      const numKey = parseInt(key);

      if (numKey >= 1 && numKey <= 9 && suggestions[numKey - 1]) {
        e.preventDefault();
        onSelect(suggestions[numKey - 1].text);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [suggestions, isLoading, disabled, onSelect]);

  if (isLoading) {
    return (
      <div className="mt-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <div className="flex items-center justify-center space-x-2 text-indigo-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Getting AI suggestions...</span>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 text-gray-500">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm">
            Start typing to see AI suggestions
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center space-x-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          AI Suggestions
        </span>
        <span className="text-xs text-gray-500">
          (Press 1-{Math.min(suggestions.length, 9)} to select)
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 9).map((suggestion, index) => (
          <button
            key={index}
            onClick={() => !disabled && onSelect(suggestion.text)}
            disabled={disabled}
            className={`
              group w-full text-left p-3 rounded-lg border-2 transition-all duration-150
              ${disabled
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md cursor-pointer'
              }
            `}
            aria-label={`Select suggestion ${index + 1}: ${suggestion.text}`}
          >
            <div className="flex items-start space-x-3">
              {/* Number Badge */}
              <div
                className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${disabled
                    ? 'bg-gray-300 text-gray-500'
                    : 'bg-indigo-600 text-white group-hover:bg-indigo-700'
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Suggestion Content */}
              <div className="flex-1 min-w-0">
                <p className={`
                  text-sm font-medium break-words
                  ${disabled ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-900'}
                `}>
                  {suggestion.text}
                </p>
                {suggestion.explanation && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {suggestion.explanation}
                  </p>
                )}
              </div>

              {/* Hover indicator */}
              {!disabled && (
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Help text */}
      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Click a suggestion to use it, or press the number key (1-{Math.min(suggestions.length, 9)}) for quick selection
        </p>
      </div>
    </div>
  );
};

InlineSuggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      explanation: PropTypes.string
    })
  ),
  isLoading: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  fieldName: PropTypes.string,
  disabled: PropTypes.bool
};

InlineSuggestions.defaultProps = {
  suggestions: [],
  isLoading: false,
  fieldName: '',
  disabled: false
};

export default InlineSuggestions;
