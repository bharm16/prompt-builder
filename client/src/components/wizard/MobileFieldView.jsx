import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';

/**
 * MobileFieldView Component
 *
 * Single field at a time view optimized for mobile:
 * - Large touch targets (56px minimum)
 * - Swipe gestures (left = next, right = previous)
 * - Auto-advance on Enter key
 * - Validation with visual feedback
 * - Skip optional empty fields automatically
 */
const MobileFieldView = ({
  field,
  value,
  onChange,
  onNext,
  onPrevious,
  onComplete,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
  currentFieldIndex,
  totalFields,
  isLastField,
  canGoBack,
  canGoNext,
  validationError,
  isValid
}) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const inputRef = useRef(null);

  const minSwipeDistance = 50;

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 300); // Delay to ensure smooth transition
    }
  }, [field.name]);

  // Request suggestions when field changes
  useEffect(() => {
    if (value && value.length > 0) {
      onRequestSuggestions(field.name, value);
    }
  }, [value, field.name, onRequestSuggestions]);

  // Handle touch start
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart && Math.abs(e.targetTouches[0].clientX - touchStart) > 10) {
      setIsSwiping(true);
    }
  };

  // Handle touch end
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canGoNext) {
      handleNext();
    } else if (isRightSwipe && canGoBack) {
      handlePrevious();
    }

    setIsSwiping(false);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle next action
  const handleNext = () => {
    if (isLastField) {
      onComplete();
    } else {
      onNext();
    }
  };

  // Handle previous action
  const handlePrevious = () => {
    if (canGoBack) {
      onPrevious();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canGoNext || isLastField) {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handlePrevious();
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestionText) => {
    onChange(suggestionText);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle blur - validate and maybe auto-advance
  const handleBlur = () => {
    // Skip auto-advance if user is interacting with suggestions
    if (document.activeElement?.closest('.inline-suggestions')) {
      return;
    }

    // Auto-advance if valid and required field is filled
    if (field.required && isValid && value && value.trim().length > 0) {
      // Small delay to ensure smooth UX
      setTimeout(() => {
        if (canGoNext && !isLastField) {
          handleNext();
        }
      }, 300);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress Indicator */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Question {currentFieldIndex + 1} of {totalFields}
          </span>
          <span className="text-xs text-gray-500">
            {Math.round(((currentFieldIndex + 1) / totalFields) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentFieldIndex + 1) / totalFields) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto">
          {/* Field Label */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </h2>
            {field.description && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {field.description}
              </p>
            )}
            {!field.required && (
              <p className="text-xs text-indigo-600 mt-1 font-medium">
                Optional - you can skip this
              </p>
            )}
          </div>

          {/* Input Field */}
          <div className="mb-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={field.placeholder}
                className={`
                  w-full px-4 py-4 text-lg border-2 rounded-xl
                  transition-all duration-200 min-h-[56px]
                  ${isValid && value
                    ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                    : validationError
                    ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                    : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
                  }
                  focus:outline-none
                `}
                aria-label={field.label}
                aria-required={field.required}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'field-error' : undefined}
              />

              {/* Validation Icon */}
              {isValid && value && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
              )}
              {validationError && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              )}
            </div>

            {/* Validation Error */}
            {validationError && (
              <p id="field-error" className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {validationError}
              </p>
            )}

            {/* Character count for longer fields */}
            {value && value.length > 50 && (
              <p className="mt-2 text-xs text-gray-500 text-right">
                {value.length} / 200 characters
              </p>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="inline-suggestions">
            <InlineSuggestions
              suggestions={suggestions}
              isLoading={isLoadingSuggestions}
              onSelect={handleSuggestionSelect}
              fieldName={field.name}
            />
          </div>

          {/* Swipe Hint */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 text-center">
              Swipe left for next, right for previous
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons - Always visible */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={handlePrevious}
            disabled={!canGoBack}
            className={`
              flex items-center justify-center px-4 py-3 rounded-xl font-medium
              transition-all duration-200 min-h-[56px]
              ${canGoBack
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label="Previous field"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="ml-1">Back</span>
          </button>

          {/* Skip/Next/Complete Button */}
          <button
            onClick={handleNext}
            disabled={!canGoNext && !isLastField}
            className={`
              flex-1 flex items-center justify-center px-6 py-3 rounded-xl font-semibold
              transition-all duration-200 min-h-[56px]
              ${canGoNext || isLastField
                ? isLastField
                  ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-lg'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label={isLastField ? 'Complete and review' : !field.required && !value ? 'Skip this field' : 'Next field'}
          >
            <span>
              {isLastField
                ? 'Review & Generate'
                : !field.required && (!value || value.trim().length === 0)
                ? 'Skip'
                : 'Next'
              }
            </span>
            {!isLastField && <ChevronRight className="w-5 h-5 ml-1" />}
            {isLastField && <Check className="w-5 h-5 ml-2" />}
          </button>
        </div>
      </div>

      {/* Swipe Animation Overlay */}
      {isSwiping && (
        <div className="fixed inset-0 bg-black bg-opacity-10 pointer-events-none" />
      )}
    </div>
  );
};

MobileFieldView.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    placeholder: PropTypes.string,
    required: PropTypes.bool
  }).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  suggestions: PropTypes.array,
  isLoadingSuggestions: PropTypes.bool,
  onRequestSuggestions: PropTypes.func.isRequired,
  currentFieldIndex: PropTypes.number.isRequired,
  totalFields: PropTypes.number.isRequired,
  isLastField: PropTypes.bool,
  canGoBack: PropTypes.bool,
  canGoNext: PropTypes.bool,
  validationError: PropTypes.string,
  isValid: PropTypes.bool
};

MobileFieldView.defaultProps = {
  value: '',
  suggestions: [],
  isLoadingSuggestions: false,
  isLastField: false,
  canGoBack: true,
  canGoNext: false,
  validationError: null,
  isValid: false
};

export default MobileFieldView;
