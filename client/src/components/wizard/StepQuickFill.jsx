import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronRight, AlertCircle, Check, Lock } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';
import { wizardTheme } from '../../styles/wizardTheme';

/**
 * StepQuickFill - Fast, all-in-one form entry for wizard
 *
 * Displays all 10 wizard fields in a single view:
 * - Core Concept: Subject, Descriptors 1-3, Action
 * - Atmosphere: Location, Time, Mood, Style, Event
 *
 * Layout:
 * - Desktop (≥1024px): 2-column grid within each section
 * - Mobile/Tablet (<1024px): Single column stack
 *
 * Features:
 * - Grouped sections with visual separation
 * - Show suggestions only for focused field
 * - Switch to step-by-step mode
 * - Continue to summary (requires Subject + Action)
 */
const StepQuickFill = ({
  formData,
  onChange,
  onContinue,
  onSwitchToStepByStep,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions
}) => {
  // Active field tracking for suggestions
  const [activeField, setActiveField] = useState(null);
  const suggestionsRef = React.useRef(null);

  // Responsive breakpoints
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

  // Validation (no minimum length required)
  const isSubjectValid = formData.subject && formData.subject.trim().length > 0;
  const isActionValid = formData.action && formData.action.trim().length > 0;
  const canContinue = isSubjectValid && isActionValid;

  // Field change handler
  const handleFieldChange = useCallback((field, value) => {
    onChange(field, value);
  }, [onChange]);

  // Suggestion selection
  const handleSuggestionSelect = useCallback((field, text) => {
    onChange(field, text);
  }, [onChange]);

  // Focus handler
  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
    onRequestSuggestions(fieldName, formData[fieldName] || '');
  };

  // Blur handler
  const handleBlur = (e) => {
    if (!suggestionsRef.current?.contains(e.relatedTarget)) {
      setActiveField(null);
    }
  };

  // Responsive padding
  const containerPadding = isDesktop
    ? '48px 40px'
    : isTablet
    ? '40px 32px'
    : '32px 24px';

  const cardPadding = isDesktop
    ? '32px'
    : isTablet
    ? '28px'
    : '24px';

  // TextField component (reused from StepCoreConcept)
  const TextField = ({ id, label, description, value, placeholder, required, minLength, showCharCount }) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasError = minLength && value && value.length < minLength;
    const showSuccess = value && minLength && value.length >= minLength;

    return (
      <div style={{ marginBottom: wizardTheme.spacing.field.marginBottom }}>
        <label
          htmlFor={id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontFamily: wizardTheme.fontFamily.primary,
            fontSize: wizardTheme.typography.label.fontSize,
            fontWeight: wizardTheme.typography.label.fontWeight,
            letterSpacing: wizardTheme.typography.label.letterSpacing,
            color: wizardTheme.colors.neutral[700],
          }}
        >
          {label}
          {required && (
            <span style={{ color: wizardTheme.colors.accent.base }} aria-label="required">
              *
            </span>
          )}
          {showCharCount && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: wizardTheme.typography.caption.fontSize,
                color: showSuccess ? wizardTheme.colors.neutral[500] : wizardTheme.colors.accent.base,
                fontWeight: 500,
              }}
            >
              {value?.length || 0}
              {!showSuccess && minLength && ` (min ${minLength})`}
            </span>
          )}
        </label>

        {description && isFocused && (
          <p
            style={{
              margin: 0,
              marginBottom: '6px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.hint.fontSize,
              color: wizardTheme.colors.neutral[500],
            }}
          >
            {description}
          </p>
        )}

        <div style={{ position: 'relative' }}>
          <input
            id={id}
            type="text"
            value={value || ''}
            onChange={(e) => handleFieldChange(id.replace('-input', ''), e.target.value)}
            onFocus={(e) => {
              setIsFocused(true);
              handleFocus(id.replace('-input', ''));
            }}
            onBlur={(e) => {
              setIsFocused(false);
              handleBlur(e);
            }}
            placeholder={placeholder}
            required={required}
            style={{
              width: '100%',
              height: '52px',
              padding: '14px 20px',
              paddingRight: (showSuccess || hasError) ? '48px' : '20px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.input.fontSize,
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 1.5,
              color: wizardTheme.colors.neutral[900],
              backgroundColor: wizardTheme.colors.background.card,
              border: `2px solid ${
                hasError ? wizardTheme.colors.error.base : isFocused ? wizardTheme.colors.accent.base : wizardTheme.colors.neutral[200]
              }`,
              borderRadius: wizardTheme.borderRadius.md,
              outline: 'none',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isFocused && !hasError
                ? `0 0 0 4px ${wizardTheme.colors.accent.light}, 0 2px 8px ${wizardTheme.colors.accent.lighter}`
                : 'none',
            }}
          />

          {showSuccess && (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Check size={20} color={wizardTheme.colors.success.base} />
            </div>
          )}

          {hasError && (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <AlertCircle size={20} color={wizardTheme.colors.error.base} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main
      style={{
        flex: '1',
        width: '100%',
        maxWidth: '1920px',
        margin: '0 auto',
        padding: containerPadding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 4px)',
        background: wizardTheme.colors.background.page,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '32px',
          maxWidth: '1200px',
          width: '100%',
        }}
      >
        {/* Heading */}
        <section style={{ textAlign: 'center', width: '100%' }}>
          <h1
            style={{
              margin: 0,
              marginBottom: '16px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.heading.fontSize,
              fontWeight: wizardTheme.typography.heading.fontWeight,
              lineHeight: wizardTheme.typography.heading.lineHeight,
              letterSpacing: wizardTheme.typography.heading.letterSpacing,
              background: `linear-gradient(135deg, ${wizardTheme.colors.neutral[800]} 0%, ${wizardTheme.colors.neutral[600]} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Quick Fill
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.subheading.fontSize,
              fontWeight: 400,
              lineHeight: 1.5,
              color: wizardTheme.colors.neutral[500],
            }}
          >
            Fill all fields at once, or switch to guided mode anytime.
          </p>
        </section>

        {/* Form Card */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              backgroundColor: wizardTheme.colors.background.card,
              borderRadius: wizardTheme.borderRadius.xl,
              border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
              padding: cardPadding,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Mode Toggle - Top Right Corner */}
            <div
              style={{
                position: 'absolute',
                top: cardPadding,
                right: cardPadding,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                backgroundColor: wizardTheme.colors.neutral[50],
                borderRadius: wizardTheme.borderRadius.full,
                border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              }}
            >
              <span
                style={{
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: wizardTheme.colors.neutral[700],
                }}
              >
                Quick Fill
              </span>
              <button
                onClick={onSwitchToStepByStep}
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '24px',
                  backgroundColor: wizardTheme.colors.accent.base,
                  borderRadius: wizardTheme.borderRadius.full,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: 0,
                }}
                aria-label="Switch to Step-by-Step mode"
                title="Switch to Step-by-Step mode"
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  }}
                />
              </button>
              <span
                style={{
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: wizardTheme.colors.neutral[400],
                }}
              >
                Step-by-Step
              </span>
            </div>
            {/* Core Concept Section */}
            <div style={{ marginBottom: '40px', paddingTop: '48px' }}>
              <h2
                style={{
                  margin: 0,
                  marginBottom: '24px',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: wizardTheme.colors.neutral[900],
                }}
              >
                Core Concept
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <TextField
                    id="subject"
                    label="Subject"
                    description="What's the main focus? (e.g., person, object, animal)"
                    value={formData.subject}
                    placeholder="e.g., A professional athlete"
                    required
                  />
                  {activeField === 'subject' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.subject || []}
                      isLoading={Boolean(isLoadingSuggestions?.subject)}
                      onSelect={(text) => handleSuggestionSelect('subject', text)}
                      fieldName="subject"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="descriptor1"
                    label="Descriptor 1"
                    description="Physical appearance"
                    value={formData.descriptor1}
                    placeholder="e.g., muscular and toned"
                  />
                  {activeField === 'descriptor1' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.descriptor1 || []}
                      isLoading={Boolean(isLoadingSuggestions?.descriptor1)}
                      onSelect={(text) => handleSuggestionSelect('descriptor1', text)}
                      fieldName="descriptor1"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="descriptor2"
                    label="Descriptor 2"
                    description="Visual details"
                    value={formData.descriptor2}
                    placeholder="e.g., wearing a red jersey"
                  />
                  {activeField === 'descriptor2' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.descriptor2 || []}
                      isLoading={Boolean(isLoadingSuggestions?.descriptor2)}
                      onSelect={(text) => handleSuggestionSelect('descriptor2', text)}
                      fieldName="descriptor2"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="descriptor3"
                    label="Descriptor 3"
                    description="Physical state or condition"
                    value={formData.descriptor3}
                    placeholder="e.g., in mid-stride"
                  />
                  {activeField === 'descriptor3' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.descriptor3 || []}
                      isLoading={Boolean(isLoadingSuggestions?.descriptor3)}
                      onSelect={(text) => handleSuggestionSelect('descriptor3', text)}
                      fieldName="descriptor3"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="action"
                    label="Action"
                    description="What's happening?"
                    value={formData.action}
                    placeholder="e.g., running through"
                    required
                  />
                  {activeField === 'action' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.action || []}
                      isLoading={Boolean(isLoadingSuggestions?.action)}
                      onSelect={(text) => handleSuggestionSelect('action', text)}
                      fieldName="action"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Atmosphere Section */}
            <div style={{ marginBottom: '32px' }}>
              <h2
                style={{
                  margin: 0,
                  marginBottom: '24px',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: wizardTheme.colors.neutral[900],
                }}
              >
                Atmosphere & Style
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <TextField
                    id="location"
                    label="Location"
                    description="Where does it take place?"
                    value={formData.location}
                    placeholder="e.g., a sun-drenched beach"
                  />
                  {activeField === 'location' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.location || []}
                      isLoading={Boolean(isLoadingSuggestions?.location)}
                      onSelect={(text) => handleSuggestionSelect('location', text)}
                      fieldName="location"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="time"
                    label="Time"
                    description="When does it happen?"
                    value={formData.time}
                    placeholder="e.g., during golden hour"
                  />
                  {activeField === 'time' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.time || []}
                      isLoading={Boolean(isLoadingSuggestions?.time)}
                      onSelect={(text) => handleSuggestionSelect('time', text)}
                      fieldName="time"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="mood"
                    label="Mood"
                    description="Emotional atmosphere"
                    value={formData.mood}
                    placeholder="e.g., energetic and joyful"
                  />
                  {activeField === 'mood' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.mood || []}
                      isLoading={Boolean(isLoadingSuggestions?.mood)}
                      onSelect={(text) => handleSuggestionSelect('mood', text)}
                      fieldName="mood"
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="style"
                    label="Style"
                    description="Visual treatment"
                    value={formData.style}
                    placeholder="e.g., cinematic"
                  />
                  {activeField === 'style' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.style || []}
                      isLoading={Boolean(isLoadingSuggestions?.style)}
                      onSelect={(text) => handleSuggestionSelect('style', text)}
                      fieldName="style"
                    />
                  )}
                </div>

                <div style={{ gridColumn: isDesktop ? '1 / -1' : 'auto' }}>
                  <TextField
                    id="event"
                    label="Event"
                    description="Context or occasion"
                    value={formData.event}
                    placeholder="e.g., a celebration"
                  />
                  {activeField === 'event' && (
                    <InlineSuggestions
                      innerRef={suggestionsRef}
                      suggestions={suggestions?.event || []}
                      isLoading={Boolean(isLoadingSuggestions?.event)}
                      onSelect={(text) => handleSuggestionSelect('event', text)}
                      fieldName="event"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button
                onClick={onContinue}
                disabled={!canContinue}
                style={{
                  padding: '14px 32px',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: wizardTheme.typography.button.fontSize,
                  fontWeight: wizardTheme.typography.button.fontWeight,
                  color: '#FFFFFF',
                  background: canContinue
                    ? `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`
                    : wizardTheme.colors.neutral[200],
                  borderRadius: wizardTheme.borderRadius.lg,
                  border: 'none',
                  cursor: canContinue ? 'pointer' : 'not-allowed',
                  boxShadow: canContinue ? '0 4px 12px rgba(255, 56, 92, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 56, 92, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 56, 92, 0.3)';
                  }
                }}
              >
                Continue to Summary
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

StepQuickFill.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string,
    time: PropTypes.string,
    mood: PropTypes.string,
    style: PropTypes.string,
    event: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onSwitchToStepByStep: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
};

StepQuickFill.defaultProps = {
  suggestions: {},
  isLoadingSuggestions: {},
};

export default StepQuickFill;
