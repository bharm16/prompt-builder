import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, Check, Film } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';

/**
 * StepCoreConcept Component - Desktop Step 1
 *
 * Displays 3 required fields simultaneously:
 * - Subject (what)
 * - Action (doing what)
 * - Location (where)
 *
 * All fields visible without scrolling
 * Tab navigation between fields
 * Real-time validation
 * Inline AI suggestions for each field
 */
const StepCoreConcept = ({
  formData,
  onChange,
  onNext,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
  validationErrors
}) => {
  const [activeField, setActiveField] = useState('subject');
  const [touched, setTouched] = useState({
    subject: false,
    action: false,
    location: false
  });

  // Validate all required fields
  const isSubjectValid = formData.subject && formData.subject.trim().length >= 3;
  const isActionValid = formData.action && formData.action.trim().length >= 3;
  const isLocationValid = formData.location && formData.location.trim().length >= 3;
  const isStepValid = isSubjectValid && isActionValid && isLocationValid;

  // Request suggestions when field gains focus
  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
    const value = formData[fieldName] || '';
    onRequestSuggestions(fieldName, value);
  };

  // Handle field blur
  const handleBlur = (fieldName) => {
    setTouched({ ...touched, [fieldName]: true });
  };

  // Handle field change
  const handleChange = (fieldName, value) => {
    onChange(fieldName, value);
    // Request new suggestions on change
    if (value.length > 0) {
      onRequestSuggestions(fieldName, value);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestionText) => {
    onChange(activeField, suggestionText);
    // Focus next field
    if (activeField === 'subject') {
      document.getElementById('action-input')?.focus();
    } else if (activeField === 'action') {
      document.getElementById('location-input')?.focus();
    }
  };

  // Handle Enter key to move to next field or submit
  const handleKeyDown = (e, fieldName) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (fieldName === 'subject') {
        document.getElementById('action-input')?.focus();
      } else if (fieldName === 'action') {
        document.getElementById('location-input')?.focus();
      } else if (fieldName === 'location' && isStepValid) {
        onNext();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Film className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Core Concept</h2>
        </div>
        <p className="text-gray-600 text-lg">
          Define the fundamental elements of your video. All three fields are required.
        </p>
      </div>

      {/* Fields Grid */}
      <div className="space-y-6">
        {/* Subject Field */}
        <div>
          <label htmlFor="subject-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-600 mb-3">
            What is the main focus? (person, object, animal, etc.)
          </p>
          <div className="relative">
            <input
              id="subject-input"
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              onFocus={() => handleFocus('subject')}
              onBlur={() => handleBlur('subject')}
              onKeyDown={(e) => handleKeyDown(e, 'subject')}
              placeholder="e.g., A professional athlete, A vintage car, A golden retriever"
              className={`
                w-full px-4 py-3 text-base border-2 rounded-lg
                transition-all duration-200
                ${isSubjectValid
                  ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                  : touched.subject && validationErrors?.subject
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                  : activeField === 'subject'
                  ? 'border-indigo-500 bg-white focus:ring-4 focus:ring-indigo-100'
                  : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
                }
                focus:outline-none
              `}
              aria-required="true"
              aria-invalid={touched.subject && !isSubjectValid}
            />
            {isSubjectValid && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            )}
          </div>
          {touched.subject && validationErrors?.subject && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {validationErrors.subject}
            </p>
          )}

          {/* Suggestions for Subject */}
          {activeField === 'subject' && (
            <InlineSuggestions
              suggestions={suggestions.subject || []}
              isLoading={isLoadingSuggestions.subject}
              onSelect={handleSuggestionSelect}
              fieldName="subject"
            />
          )}
        </div>

        {/* Action Field */}
        <div>
          <label htmlFor="action-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Action <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-600 mb-3">
            What is happening? (movement, activity, transformation)
          </p>
          <div className="relative">
            <input
              id="action-input"
              type="text"
              value={formData.action}
              onChange={(e) => handleChange('action', e.target.value)}
              onFocus={() => handleFocus('action')}
              onBlur={() => handleBlur('action')}
              onKeyDown={(e) => handleKeyDown(e, 'action')}
              placeholder="e.g., running through, transforming into, dancing with"
              className={`
                w-full px-4 py-3 text-base border-2 rounded-lg
                transition-all duration-200
                ${isActionValid
                  ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                  : touched.action && validationErrors?.action
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                  : activeField === 'action'
                  ? 'border-indigo-500 bg-white focus:ring-4 focus:ring-indigo-100'
                  : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
                }
                focus:outline-none
              `}
              aria-required="true"
              aria-invalid={touched.action && !isActionValid}
            />
            {isActionValid && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            )}
          </div>
          {touched.action && validationErrors?.action && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {validationErrors.action}
            </p>
          )}

          {/* Suggestions for Action */}
          {activeField === 'action' && (
            <InlineSuggestions
              suggestions={suggestions.action || []}
              isLoading={isLoadingSuggestions.action}
              onSelect={handleSuggestionSelect}
              fieldName="action"
            />
          )}
        </div>

        {/* Location Field */}
        <div>
          <label htmlFor="location-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Where does it take place? (setting, environment)
          </p>
          <div className="relative">
            <input
              id="location-input"
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              onFocus={() => handleFocus('location')}
              onBlur={() => handleBlur('location')}
              onKeyDown={(e) => handleKeyDown(e, 'location')}
              placeholder="e.g., a sun-drenched beach, a futuristic city, an ancient forest"
              className={`
                w-full px-4 py-3 text-base border-2 rounded-lg
                transition-all duration-200
                ${isLocationValid
                  ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                  : touched.location && validationErrors?.location
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                  : activeField === 'location'
                  ? 'border-indigo-500 bg-white focus:ring-4 focus:ring-indigo-100'
                  : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
                }
                focus:outline-none
              `}
              aria-required="true"
              aria-invalid={touched.location && !isLocationValid}
            />
            {isLocationValid && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            )}
          </div>
          {touched.location && validationErrors?.location && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {validationErrors.location}
            </p>
          )}

          {/* Suggestions for Location */}
          {activeField === 'location' && (
            <InlineSuggestions
              suggestions={suggestions.location || []}
              isLoading={isLoadingSuggestions.location}
              onSelect={handleSuggestionSelect}
              fieldName="location"
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={onNext}
          disabled={!isStepValid}
          className={`
            px-8 py-3 rounded-lg font-semibold text-base
            transition-all duration-200
            ${isStepValid
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Continue to Atmosphere
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Pro Tip:</strong> Be specific! Instead of "a person walking", try "a young woman in a red dress walking" for better results.
        </p>
      </div>
    </div>
  );
};

StepCoreConcept.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
  validationErrors: PropTypes.object
};

StepCoreConcept.defaultProps = {
  suggestions: {},
  isLoadingSuggestions: {},
  validationErrors: {}
};

export default StepCoreConcept;
