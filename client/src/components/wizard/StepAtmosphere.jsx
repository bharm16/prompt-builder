import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Palette, ChevronRight } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';

/**
 * StepAtmosphere Component - Desktop Step 2
 *
 * Displays 4 optional fields:
 * - Time (when)
 * - Mood (emotional atmosphere)
 * - Style (visual treatment)
 * - Event (context/occasion)
 *
 * Shows context preview from Step 1
 * All fields are optional (can skip)
 * Inline suggestions for each field
 */
const StepAtmosphere = ({
  formData,
  onChange,
  onNext,
  onBack,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions
}) => {
  const [activeField, setActiveField] = useState(null);

  // Request suggestions when field gains focus
  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
    const value = formData[fieldName] || '';
    onRequestSuggestions(fieldName, value);
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
  };

  // Check if any atmosphere field is filled
  const hasAnyAtmosphereData = formData.time || formData.mood || formData.style || formData.event;

  // Handle Enter key to move to next field or submit
  const handleKeyDown = (e, fieldName) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const fields = ['location', 'time', 'mood', 'style', 'event'];
      const currentIndex = fields.indexOf(fieldName);
      if (currentIndex < fields.length - 1) {
        document.getElementById(`${fields[currentIndex + 1]}-input`)?.focus();
      } else {
        onNext();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Palette className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Atmosphere & Style</h2>
        </div>
        <p className="text-gray-600 text-lg">
          Add depth to your scene with mood, timing, and style. All fields are optional.
        </p>
      </div>

      {/* Context Preview */}
      <div className="mb-8 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
        <p className="text-sm font-semibold text-indigo-900 mb-1">Creating:</p>
        <p className="text-base text-indigo-800">
          <span className="font-medium">{formData.subject || '...'}</span>
          {' '}
          <span className="text-indigo-600">{formData.action || '...'}</span>
          {' at '}
          <span className="font-medium">{formData.location || '...'}</span>
        </p>
      </div>

      {/* Fields Grid */}
      <div className="space-y-6">
        {/* Location Field */}
        <div>
          <label htmlFor="location-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Location
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Where does it take place? (setting, environment)
          </p>
          <input
            id="location-input"
            type="text"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            onFocus={() => handleFocus('location')}
            onKeyDown={(e) => handleKeyDown(e, 'location')}
            placeholder="e.g., a sun-drenched beach, a futuristic city, an ancient forest"
            className={`
              w-full px-4 py-3 text-base border-2 rounded-lg
              transition-all duration-200
              ${activeField === 'location'
                ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
                : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
              }
              focus:outline-none
            `}
          />

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

        {/* Time Field */}
        <div>
          <label htmlFor="time-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Time
          </label>
          <p className="text-sm text-gray-600 mb-3">
            When does it happen? (time of day, era, season) - Optional
          </p>
          <input
            id="time-input"
            type="text"
            value={formData.time}
            onChange={(e) => handleChange('time', e.target.value)}
            onFocus={() => handleFocus('time')}
            onKeyDown={(e) => handleKeyDown(e, 'time')}
            placeholder="e.g., during golden hour, at midnight, in the 1920s"
            className={`
              w-full px-4 py-3 text-base border-2 rounded-lg
              transition-all duration-200
              ${activeField === 'time'
                ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
                : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
              }
              focus:outline-none
            `}
          />

          {/* Suggestions for Time */}
          {activeField === 'time' && (
            <InlineSuggestions
              suggestions={suggestions.time || []}
              isLoading={isLoadingSuggestions.time}
              onSelect={handleSuggestionSelect}
              fieldName="time"
            />
          )}
        </div>

        {/* Mood Field */}
        <div>
          <label htmlFor="mood-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Mood
          </label>
          <p className="text-sm text-gray-600 mb-3">
            What's the emotional atmosphere? - Optional
          </p>
          <input
            id="mood-input"
            type="text"
            value={formData.mood}
            onChange={(e) => handleChange('mood', e.target.value)}
            onFocus={() => handleFocus('mood')}
            onKeyDown={(e) => handleKeyDown(e, 'mood')}
            placeholder="e.g., energetic and joyful, mysterious and tense, calm and peaceful"
            className={`
              w-full px-4 py-3 text-base border-2 rounded-lg
              transition-all duration-200
              ${activeField === 'mood'
                ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
                : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
              }
              focus:outline-none
            `}
          />

          {/* Suggestions for Mood */}
          {activeField === 'mood' && (
            <InlineSuggestions
              suggestions={suggestions.mood || []}
              isLoading={isLoadingSuggestions.mood}
              onSelect={handleSuggestionSelect}
              fieldName="mood"
            />
          )}
        </div>

        {/* Style Field */}
        <div>
          <label htmlFor="style-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Style
          </label>
          <p className="text-sm text-gray-600 mb-3">
            What visual treatment? (cinematic, documentary, etc.) - Optional
          </p>
          <input
            id="style-input"
            type="text"
            value={formData.style}
            onChange={(e) => handleChange('style', e.target.value)}
            onFocus={() => handleFocus('style')}
            onKeyDown={(e) => handleKeyDown(e, 'style')}
            placeholder="e.g., cinematic, documentary, vintage film, minimalist"
            className={`
              w-full px-4 py-3 text-base border-2 rounded-lg
              transition-all duration-200
              ${activeField === 'style'
                ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
                : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
              }
              focus:outline-none
            `}
          />

          {/* Suggestions for Style */}
          {activeField === 'style' && (
            <InlineSuggestions
              suggestions={suggestions.style || []}
              isLoading={isLoadingSuggestions.style}
              onSelect={handleSuggestionSelect}
              fieldName="style"
            />
          )}
        </div>

        {/* Event Field */}
        <div>
          <label htmlFor="event-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Event
          </label>
          <p className="text-sm text-gray-600 mb-3">
            What's the context or occasion? - Optional
          </p>
          <input
            id="event-input"
            type="text"
            value={formData.event}
            onChange={(e) => handleChange('event', e.target.value)}
            onFocus={() => handleFocus('event')}
            onKeyDown={(e) => handleKeyDown(e, 'event')}
            placeholder="e.g., a celebration, a chase scene, a quiet moment"
            className={`
              w-full px-4 py-3 text-base border-2 rounded-lg
              transition-all duration-200
              ${activeField === 'event'
                ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
                : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
              }
              focus:outline-none
            `}
          />

          {/* Suggestions for Event */}
          {activeField === 'event' && (
            <InlineSuggestions
              suggestions={suggestions.event || []}
              isLoading={isLoadingSuggestions.event}
              onSelect={handleSuggestionSelect}
              fieldName="event"
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-10 flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          Back to Core Concept
        </button>

        <div className="flex space-x-3">
          <button
            onClick={onNext}
            className="px-6 py-3 rounded-lg font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all duration-200 flex items-center"
          >
            Skip Atmosphere
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
          <button
            onClick={onNext}
            className="px-8 py-3 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-sm text-yellow-900">
          <strong>Tip:</strong> Atmosphere fields are optional but highly recommended. They add emotional depth and visual richness to your video prompt.
        </p>
      </div>
    </div>
  );
};

StepAtmosphere.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    location: PropTypes.string,
    time: PropTypes.string,
    mood: PropTypes.string,
    style: PropTypes.string,
    event: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired
};

StepAtmosphere.defaultProps = {
  suggestions: {},
  isLoadingSuggestions: {}
};

export default StepAtmosphere;
