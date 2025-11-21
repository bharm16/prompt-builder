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
  suggestions = [],
  isLoading = false,
  onSelect,
  fieldName = '',
  disabled = false
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
      <div className="absolute left-0 right-0 top-full mt-2 p-5 bg-brand-primary-50 rounded-xl border border-brand-primary-200 shadow-lg animate-fade-in-simple" style={{ zIndex: 9999 }}>
        <div className="flex items-center justify-center space-x-2 text-brand-primary-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-semibold">Finding perfect suggestions...</span>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border-2 border-neutral-200 shadow-2xl animate-fade-slide-in max-h-96 overflow-y-auto p-4" style={{ zIndex: 9999 }}>
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-white pb-2 border-b border-neutral-100">
        <div className="flex items-center space-x-2.5">
          <Sparkles className="w-5 h-5 text-brand-primary-600" />
          <span className="text-sm font-semibold text-neutral-800">
            Suggestions
          </span>
        </div>
        <span className="text-xs font-medium text-neutral-500">
          Press 1-{Math.min(suggestions.length, 9)}
        </span>
      </div>

      <div className="space-y-2 pt-2">
        {suggestions.slice(0, 9).map((suggestion, index) => (
          <button
            key={index}
            onClick={() => !disabled && onSelect(suggestion.text)}
            disabled={disabled}
            className={`
              group w-full text-left p-3 rounded-lg border transition-all duration-150 hover-lift
              ${disabled
                ? 'border-neutral-200 bg-neutral-50 cursor-not-allowed opacity-50'
                : 'border-neutral-200 bg-white hover:border-brand-primary-300 hover:bg-brand-primary-50/50 hover:shadow-md cursor-pointer active:scale-[0.98]'
              }
            `}
            aria-label={`Select suggestion ${index + 1}: ${suggestion.text}`}
          >
            <div className="flex items-start space-x-2.5">
              {/* Number Badge */}
              <div
                className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm
                  ${disabled
                    ? 'bg-neutral-300 text-neutral-500'
                    : 'bg-brand-primary-600 text-white group-hover:bg-brand-primary-700 group-hover:scale-110 transition-transform'
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Suggestion Content */}
              <div className="flex-1 min-w-0">
                <p className={`
                  text-sm font-normal break-words leading-relaxed
                  ${disabled ? 'text-neutral-500' : 'text-neutral-900 group-hover:text-brand-primary-900'}
                `}>
                  {suggestion.text}
                </p>
                {suggestion.explanation && (
                  <p className="mt-2 text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                    {suggestion.explanation}
                  </p>
                )}
              </div>

              {/* Hover indicator with animated arrow */}
              {!disabled && (
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5">
                  <svg
                    className="w-5 h-5 text-brand-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
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
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong className="font-semibold">💡 Pro Tip:</strong> Click any suggestion or press its number key (1-{Math.min(suggestions.length, 9)}) for instant selection
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

export default InlineSuggestions;
