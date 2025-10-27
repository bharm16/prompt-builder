import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronRight,
} from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';
import { wizardTheme } from '../../styles/wizardTheme';

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
  
  // Responsive spacing state
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsTablet(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Check if any atmosphere field is filled
  const hasAnyAtmosphereData = formData.time || formData.mood || formData.style || formData.event;

  // Responsive padding values
  const cardPadding = isDesktop
    ? wizardTheme.getCardPadding('desktop')
    : isTablet
    ? wizardTheme.getCardPadding('tablet')
    : wizardTheme.getCardPadding('mobile');

  const containerPadding = wizardTheme.getContainerPadding(
    isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile'
  );

  return (
    <main
      style={{
        flex: "1",
        width: "100%",
        maxWidth: "1920px",
        margin: "0 auto",
        padding: containerPadding,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 4px)",
        background: wizardTheme.colors.background.page,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "32px",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        {/* Heading Section */}
        <section style={{ textAlign: "center", width: "100%" }}>
          <h1
            style={{
              margin: 0,
              marginBottom: "16px",
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.heading.fontSize,
              fontWeight: wizardTheme.typography.heading.fontWeight,
              lineHeight: wizardTheme.typography.heading.lineHeight,
              letterSpacing: wizardTheme.typography.heading.letterSpacing,
              background: `linear-gradient(135deg, ${wizardTheme.colors.neutral[800]} 0%, ${wizardTheme.colors.neutral[600]} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Atmosphere & Style
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.subheading.fontSize,
              fontWeight: wizardTheme.typography.subheading.fontWeight,
              lineHeight: wizardTheme.typography.subheading.lineHeight,
              color: wizardTheme.colors.neutral[500],
            }}
          >
            Add depth to your scene with mood, timing, and style. All fields are optional.
          </p>
        </section>

        {/* Form Card */}
        <section style={{ width: "100%" }}>
          {/* UI Card container */}
          <div
            style={{
              backgroundColor: wizardTheme.colors.background.card,
              borderRadius: wizardTheme.borderRadius.xl,
              border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              padding: cardPadding,
              width: "100%",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Context Preview */}
            <div
              style={{
                padding: "16px",
                marginBottom: "24px",
                backgroundColor: "rgba(255, 56, 92, 0.05)",
                border: `2px solid ${wizardTheme.colors.accent.light}`,
                borderRadius: wizardTheme.borderRadius.md,
              }}
            >
              <p
                style={{
                  margin: 0,
                  marginBottom: "6px",
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: wizardTheme.colors.neutral[700],
                }}
              >
                Creating:
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: "16px",
                  color: wizardTheme.colors.neutral[700],
                }}
              >
                <span style={{ fontWeight: 500 }}>{formData.subject || '...'}</span>
                {' '}
                <span style={{ color: wizardTheme.colors.accent.base }}>{formData.action || '...'}</span>
                {' at '}
                <span style={{ fontWeight: 500 }}>{formData.location || '...'}</span>
              </p>
            </div>

            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: wizardTheme.spacing.field.marginBottom }}>
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
            <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={onBack}
                style={{
                  padding: "12px 24px",
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: "15px",
                  fontWeight: 500,
                  color: wizardTheme.colors.neutral[700],
                  backgroundColor: wizardTheme.colors.neutral[100],
                  borderRadius: wizardTheme.borderRadius.md,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = wizardTheme.colors.neutral[200]; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = wizardTheme.colors.neutral[100]; }}
              >
                Back
              </button>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={onNext}
                  style={{
                    padding: "14px 32px",
                    fontFamily: wizardTheme.fontFamily.primary,
                    fontSize: wizardTheme.typography.button.fontSize,
                    fontWeight: wizardTheme.typography.button.fontWeight,
                    color: "#FFFFFF",
                    background: `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`,
                    borderRadius: wizardTheme.borderRadius.lg,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(255, 56, 92, 0.3)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 56, 92, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 56, 92, 0.3)";
                  }}
                >
                  Continue
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
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
