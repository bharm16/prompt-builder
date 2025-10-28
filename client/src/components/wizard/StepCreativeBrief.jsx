import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, Check, Film, Sparkles } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';

/**
 * StepCreativeBrief Component - Mindset 1: "The Creative Director"
 *
 * Combines Core Concept + Atmosphere into one seamless creative flow
 * Uses conversational language inspired by Airbnb's supportive guide approach
 *
 * Fields:
 * - Subject, Action, Location (required) - "The What"
 * - Time, Mood, Style, Event (optional) - "The Feel"
 */
const StepCreativeBrief = ({
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
  const [showEncouragement, setShowEncouragement] = useState(false);

  // Validate required fields
  const isSubjectValid = formData.subject && formData.subject.trim().length >= 3;
  const isActionValid = formData.action && formData.action.trim().length >= 3;
  const isLocationValid = formData.location && formData.location.trim().length >= 3;
  const isCoreComplete = isSubjectValid && isActionValid && isLocationValid;

  // Show encouraging message when core is complete
  useEffect(() => {
    if (isCoreComplete && !showEncouragement) {
      setShowEncouragement(true);
      // Auto-request suggestions for atmosphere fields
      if (!formData.time) {
        onRequestSuggestions('time', '');
      }
    }
  }, [isCoreComplete, showEncouragement, formData.time, onRequestSuggestions]);

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
    // Focus next field in sequence
    const fieldSequence = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];
    const currentIndex = fieldSequence.indexOf(activeField);
    if (currentIndex < fieldSequence.length - 1) {
      const nextField = fieldSequence[currentIndex + 1];
      setTimeout(() => {
        document.getElementById(`${nextField}-input`)?.focus();
      }, 100);
    }
  };

  // Handle Enter key navigation
  const handleKeyDown = (e, fieldName) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const fieldSequence = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];
      const currentIndex = fieldSequence.indexOf(fieldName);
      if (currentIndex < fieldSequence.length - 1) {
        document.getElementById(`${fieldSequence[currentIndex + 1]}-input`)?.focus();
      } else if (isCoreComplete) {
        onNext();
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-12 animate-fade-slide-in">
      {/* Step Header */}
      <div className="mb-10">
        <div className="flex items-center space-x-3.5 mb-4">
          <div className="p-3 bg-brand-primary-100 rounded-xl">
            <Film className="w-7 h-7 text-brand-primary-600" />
          </div>
          <h2 className="text-4xl font-bold text-neutral-900 tracking-tight">Let's bring your idea to life</h2>
        </div>
        <p className="text-neutral-700 text-lg leading-relaxed ml-[4.25rem]">
          Tell us about your video concept. We'll guide you through it step by step—no worries, we've got you covered.
        </p>
      </div>

      {/* Required Fields Section */}
      <div className="space-y-8 mb-10">
        <div className="border-l-4 border-brand-primary-500 pl-5">
          <h3 className="text-xl font-bold text-neutral-900 mb-2">First, the essentials</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">These three fields form the core of your video—they're required</p>
        </div>

        {/* Subject Field */}
        <div>
          <label htmlFor="subject-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
            What's the star of your video? <span className="text-error-500">*</span>
          </label>
          <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
            This could be a person, object, animal—anything you want in the spotlight
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
                w-full px-5 py-4 text-base border-2 rounded-xl
                transition-all duration-150
                ${isSubjectValid
                  ? 'border-emerald-500 bg-emerald-50/30 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'
                  : touched.subject && validationErrors?.subject
                  ? 'border-error-500 bg-error-50/30 focus:border-error-600 focus:ring-4 focus:ring-error-100'
                  : activeField === 'subject'
                  ? 'border-brand-primary-500 bg-white focus:ring-4 focus:ring-brand-primary-100 shadow-sm'
                  : 'border-neutral-300 bg-white focus:border-brand-primary-500 focus:ring-4 focus:ring-brand-primary-100'
                }
                focus:outline-none placeholder:text-neutral-400
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
            <p className="mt-2.5 text-sm text-error-600 flex items-center animate-slide-in-from-right">
              <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
              {validationErrors.subject}
            </p>
          )}
          {isSubjectValid && !touched.action && (
            <p className="mt-2.5 text-sm text-emerald-600 flex items-center animate-fade-in-simple">
              <Check className="w-4 h-4 mr-1.5 flex-shrink-0 animate-scale-in" />
              Perfect! That's a great starting point.
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
          <label htmlFor="action-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
            What's happening in the scene? <span className="text-error-500">*</span>
          </label>
          <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
            Describe the movement, activity, or transformation—bring it to life!
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
                w-full px-5 py-3 text-base border-2 rounded-xl
                transition-all duration-200
                ${isActionValid
                  ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                  : touched.action && validationErrors?.action
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                  : activeField === 'action'
                  ? 'border-brand-primary-500 bg-white focus:ring-4 focus:ring-brand-primary-100'
                  : 'border-borders-lines bg-white focus:border-brand-primary-500 focus:ring-4 focus:ring-brand-primary-100'
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
          {isActionValid && !touched.location && (
            <p className="mt-2 text-sm text-green-600 flex items-center">
              <Check className="w-4 h-4 mr-1" />
              Perfect! The story is coming together.
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
          <label htmlFor="location-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
            Where does this magic happen? <span className="text-error-500">*</span>
          </label>
          <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
            Set the scene—describe the location or environment
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
                w-full px-5 py-3 text-base border-2 rounded-xl
                transition-all duration-200
                ${isLocationValid
                  ? 'border-green-500 bg-green-50 focus:border-green-600 focus:ring-4 focus:ring-green-100'
                  : touched.location && validationErrors?.location
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                  : activeField === 'location'
                  ? 'border-brand-primary-500 bg-white focus:ring-4 focus:ring-brand-primary-100'
                  : 'border-borders-lines bg-white focus:border-brand-primary-500 focus:ring-4 focus:ring-brand-primary-100'
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
          {isLocationValid && (
            <p className="mt-2 text-sm text-green-600 flex items-center">
              <Check className="w-4 h-4 mr-1" />
              Excellent! You&apos;ve nailed the foundation.
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

      {/* Optional Atmosphere Fields */}
      {isCoreComplete && (
        <>
          <div className="border-l-4 border-brand-accent-500 pl-5 mb-8 mt-12 animate-fade-slide-in">
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Now, let's set the mood</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              These details are optional, but they'll add depth, emotion, and that special something to your video.
            </p>
          </div>

          <div className="space-y-8">
            {/* Time Field */}
            <div>
              <label htmlFor="time-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
                When does this take place?
              </label>
              <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
                Time of day, era, or season—help us set the temporal vibe
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
                  w-full px-5 py-3 text-base border-2 rounded-xl
                  transition-all duration-200
                  ${activeField === 'time'
                    ? 'border-brand-accent-500 bg-white focus:ring-4 focus:ring-brand-accent-100'
                    : formData.time
                    ? 'border-green-500 bg-green-50'
                    : 'border-borders-lines bg-white focus:border-brand-accent-500 focus:ring-4 focus:ring-brand-accent-100'
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
              <label htmlFor="mood-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
                What feeling should this evoke?
              </label>
              <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
                The emotional atmosphere—joyful, mysterious, calm, intense?
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
                  w-full px-5 py-3 text-base border-2 rounded-xl
                  transition-all duration-200
                  ${activeField === 'mood'
                    ? 'border-brand-accent-500 bg-white focus:ring-4 focus:ring-brand-accent-100'
                    : formData.mood
                    ? 'border-green-500 bg-green-50'
                    : 'border-borders-lines bg-white focus:border-brand-accent-500 focus:ring-4 focus:ring-brand-accent-100'
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
              <label htmlFor="style-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
                What's your visual aesthetic?
              </label>
              <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
                Think cinematic, documentary, vintage, or something entirely unique
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
                  w-full px-5 py-3 text-base border-2 rounded-xl
                  transition-all duration-200
                  ${activeField === 'style'
                    ? 'border-brand-accent-500 bg-white focus:ring-4 focus:ring-brand-accent-100'
                    : formData.style
                    ? 'border-green-500 bg-green-50'
                    : 'border-borders-lines bg-white focus:border-brand-accent-500 focus:ring-4 focus:ring-brand-accent-100'
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
              <label htmlFor="event-input" className="block text-base font-semibold text-neutral-800 mb-2.5">
                Is there a bigger story here?
              </label>
              <p className="text-sm text-neutral-600 mb-3.5 leading-relaxed">
                Any specific context, occasion, or narrative that ties it all together
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
                  w-full px-5 py-3 text-base border-2 rounded-xl
                  transition-all duration-200
                  ${activeField === 'event'
                    ? 'border-brand-accent-500 bg-white focus:ring-4 focus:ring-brand-accent-100'
                    : formData.event
                    ? 'border-green-500 bg-green-50'
                    : 'border-borders-lines bg-white focus:border-brand-accent-500 focus:ring-4 focus:ring-brand-accent-100'
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
        </>
      )}

      {/* Action Buttons */}
      <div className="mt-12 flex justify-end">
        <button
          onClick={onNext}
          disabled={!isCoreComplete}
          className={`
            px-10 py-4 rounded-xl font-bold text-base
            transition-all duration-150 flex items-center space-x-2.5 shadow-lg
            ${isCoreComplete
              ? 'bg-gradient-to-r from-brand-accent-500 to-brand-accent-600 text-white hover:shadow-accent hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none'
            }
          `}
        >
          <span>Continue to Technical Specs</span>
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-8 p-5 bg-blue-50/80 rounded-xl border border-blue-200 backdrop-blur-sm">
        <p className="text-sm text-blue-900 leading-relaxed">
          <strong className="font-bold">💡 Pro Tip:</strong> Be specific and vivid! Instead of "a person walking", try "a young woman in a flowing red dress walking confidently through a cobblestone street" for richer, more cinematic results.
        </p>
      </div>
    </div>
  );
};

StepCreativeBrief.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string,
    time: PropTypes.string,
    mood: PropTypes.string,
    style: PropTypes.string,
    event: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
  validationErrors: PropTypes.object
};

StepCreativeBrief.defaultProps = {
  suggestions: {},
  isLoadingSuggestions: {},
  validationErrors: {}
};

export default StepCreativeBrief;
