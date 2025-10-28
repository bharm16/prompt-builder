import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronRight, AlertCircle, Check, Sparkles, Zap } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';
import { wizardTheme } from '../../styles/wizardTheme';

/**
 * StepQuickFill - Modern, enterprise-grade form with premium UX
 *
 * Enhanced with:
 * - Horizontal layout: Core Concept (left) | Atmosphere & Style (right)
 * - Floating labels with smooth animations
 * - Layered shadows for depth
 * - Staggered entrance animations
 * - Progress indicators
 * - Glassmorphism effects
 * - Micro-interactions
 */
const StepQuickFill = ({
  formData,
  onChange,
  onContinue,
  onSwitchToStepByStep,
  suggestions = {},
  isLoadingSuggestions = {},
  onRequestSuggestions
}) => {
  // Active field tracking for suggestions
  const [activeField, setActiveField] = useState(null);
  const suggestionsRef = React.useRef(null);
  const [mounted, setMounted] = useState(false);

  // Responsive breakpoints
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    setMounted(true);
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

  // Calculate completion percentage
  const totalFields = 10;
  const filledFields = Object.values(formData).filter(v => v && v.trim && v.trim().length > 0).length;
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

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
    ? '40px'
    : isTablet
    ? '32px'
    : '24px';

  // Premium TextField component with floating label
  const TextField = ({ id, label, description, value, placeholder, required, delay = 0 }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const hasValue = value && value.length > 0;
    const showFloatingLabel = isFocused || hasValue;

    return (
      <div 
        style={{ 
          marginBottom: '24px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        }}
      >
        <div 
          style={{ position: 'relative' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Floating Label */}
          <label
            htmlFor={id}
            style={{
              position: 'absolute',
              left: '20px',
              top: showFloatingLabel ? '8px' : '50%',
              transform: showFloatingLabel ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
              transformOrigin: 'left center',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: '15px',
              fontWeight: showFloatingLabel ? 600 : 400,
              color: isFocused 
                ? wizardTheme.colors.accent.base 
                : showFloatingLabel 
                  ? wizardTheme.colors.neutral[700]
                  : wizardTheme.colors.neutral[400],
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'none',
              background: showFloatingLabel ? 'linear-gradient(to bottom, transparent 50%, white 50%)' : 'none',
              padding: showFloatingLabel ? '0 4px' : '0',
              zIndex: 1,
            }}
          >
            {label}
            {required && (
              <span style={{ color: wizardTheme.colors.accent.base, marginLeft: '2px' }}>*</span>
            )}
          </label>

          {/* Input Field */}
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
            placeholder={isFocused ? placeholder : ''}
            required={required}
            style={{
              width: '100%',
              height: '60px',
              padding: showFloatingLabel ? '28px 20px 12px 20px' : '18px 20px',
              paddingRight: hasValue ? '48px' : '20px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: '16px',
              fontWeight: 400,
              lineHeight: 1.5,
              color: wizardTheme.colors.neutral[900],
              backgroundColor: wizardTheme.colors.background.card,
              border: `2px solid ${
                isFocused 
                  ? wizardTheme.colors.accent.base 
                  : isHovered
                    ? wizardTheme.colors.neutral[300]
                    : wizardTheme.colors.neutral[200]
              }`,
              borderRadius: '12px',
              outline: 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isFocused
                ? `0 0 0 4px ${wizardTheme.colors.accent.light}, 0 8px 16px rgba(0, 0, 0, 0.08)`
                : isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                  : '0 2px 4px rgba(0, 0, 0, 0.04)',
            }}
          />

          {/* Success Indicator */}
          {hasValue && !isFocused && (
            <div
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%) scale(1)',
                pointerEvents: 'none',
                animation: 'bounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              }}
            >
              <Check size={20} color={wizardTheme.colors.success.base} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Description - shown on focus */}
        {description && isFocused && (
          <p
            style={{
              margin: '8px 0 0 0',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: '13px',
              color: wizardTheme.colors.neutral[600],
              lineHeight: 1.4,
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {description}
          </p>
        )}
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
        background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)',
      }}
    >
      {/* Global Styles */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes bounceIn {
            0% { transform: translateY(-50%) scale(0); }
            50% { transform: translateY(-50%) scale(1.2); }
            100% { transform: translateY(-50%) scale(1); }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
          @keyframes slideDown {
            from { 
              opacity: 0;
              transform: translateY(-10px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

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
        {/* Enhanced Heading */}
        <section style={{ textAlign: 'center', width: '100%' }}>
          <h1
            style={{
              margin: 0,
              marginBottom: '12px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: isDesktop ? '48px' : '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #2D2D2D 0%, #5A5A5A 50%, #2D2D2D 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: mounted ? 'none' : 'shimmer 3s linear infinite',
            }}
          >
            Quick Fill Mode
          </h1>
          <p
            style={{
              margin: 0,
              marginBottom: '16px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: '17px',
              fontWeight: 400,
              lineHeight: 1.5,
              color: wizardTheme.colors.neutral[600],
            }}
          >
            Complete all fields at once for faster creation
          </p>

          {/* Progress Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 20px',
              background: 'linear-gradient(135deg, rgba(255, 56, 92, 0.08) 0%, rgba(255, 56, 92, 0.12) 100%)',
              borderRadius: '24px',
              border: `1px solid ${wizardTheme.colors.accent.lighter}`,
            }}
          >
            <Sparkles size={16} color={wizardTheme.colors.accent.base} />
            <span
              style={{
                fontFamily: wizardTheme.fontFamily.primary,
                fontSize: '14px',
                fontWeight: 600,
                color: wizardTheme.colors.neutral[700],
              }}
            >
              {filledFields}/{totalFields} fields completed
            </span>
            <div
              style={{
                width: '60px',
                height: '6px',
                background: wizardTheme.colors.neutral[200],
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${completionPercentage}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`,
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        </section>

        {/* Premium Form Card */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              backgroundColor: wizardTheme.colors.background.card,
              borderRadius: '20px',
              border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
              padding: cardPadding,
              width: '100%',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Mode Toggle - Enhanced Glassmorphism */}
            <div
              style={{
                position: 'absolute',
                top: cardPadding,
                right: cardPadding,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 18px',
                background: 'rgba(247, 247, 247, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '24px',
                border: '1px solid rgba(227, 227, 227, 0.6)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
              }}
            >
              <span
                style={{
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: wizardTheme.colors.accent.base,
                }}
              >
                Quick Fill
              </span>
              <button
                onClick={onSwitchToStepByStep}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '26px',
                  backgroundColor: wizardTheme.colors.accent.base,
                  borderRadius: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: 0,
                  boxShadow: `0 0 0 0 ${wizardTheme.colors.accent.light}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 4px ${wizardTheme.colors.accent.light}`;
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 0 ${wizardTheme.colors.accent.light}`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Switch to Step-by-Step mode"
                title="Switch to guided mode"
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: '3px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
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

            {/* Two-Column Layout: Core Concept (Left) | Atmosphere & Style (Right) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
                gap: isDesktop ? '40px' : '0',
                paddingTop: '64px',
              }}
            >
              {/* LEFT COLUMN - Core Concept Section */}
              <div>
                {/* Section Header with Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '28px',
                    paddingBottom: '16px',
                    borderBottom: `2px solid ${wizardTheme.colors.neutral[100]}`,
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`,
                      borderRadius: '10px',
                      boxShadow: `0 4px 12px ${wizardTheme.colors.accent.lighter}`,
                    }}
                  >
                    <Zap size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: wizardTheme.fontFamily.primary,
                        fontSize: '22px',
                        fontWeight: 700,
                        color: wizardTheme.colors.neutral[900],
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Core Concept
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: wizardTheme.fontFamily.primary,
                        fontSize: '13px',
                        color: wizardTheme.colors.neutral[500],
                      }}
                    >
                      Define the essence of your video
                    </p>
                  </div>
                </div>

                {/* Core Concept Fields */}
                <div>
                  {/* Subject Field */}
                  <div>
                    <TextField
                      id="subject"
                      label="Subject"
                      description="What's the main focus? (e.g., person, object, animal)"
                      value={formData.subject}
                      placeholder="e.g., A professional athlete"
                      required
                      delay={0}
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

                  {/* Descriptor 1 Field */}
                  <div>
                    <TextField
                      id="descriptor1"
                      label="Descriptor 1"
                      description="Physical appearance (optional)"
                      value={formData.descriptor1}
                      placeholder="e.g., muscular and toned"
                      delay={50}
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

                  {/* Descriptor 2 Field */}
                  <div>
                    <TextField
                      id="descriptor2"
                      label="Descriptor 2"
                      description="Visual details (optional)"
                      value={formData.descriptor2}
                      placeholder="e.g., wearing a red jersey"
                      delay={100}
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

                  {/* Descriptor 3 Field */}
                  <div>
                    <TextField
                      id="descriptor3"
                      label="Descriptor 3"
                      description="Physical state (optional)"
                      value={formData.descriptor3}
                      placeholder="e.g., in mid-stride"
                      delay={150}
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

                  {/* Action Field */}
                  <div>
                    <TextField
                      id="action"
                      label="Action"
                      description="What's happening?"
                      value={formData.action}
                      placeholder="e.g., running through"
                      required
                      delay={200}
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

              {/* RIGHT COLUMN - Atmosphere & Style Section */}
              <div>
                {/* Section Header with Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '28px',
                    paddingBottom: '16px',
                    borderBottom: `2px solid ${wizardTheme.colors.neutral[100]}`,
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    <Sparkles size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: wizardTheme.fontFamily.primary,
                        fontSize: '22px',
                        fontWeight: 700,
                        color: wizardTheme.colors.neutral[900],
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Atmosphere & Style
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: wizardTheme.fontFamily.primary,
                        fontSize: '13px',
                        color: wizardTheme.colors.neutral[500],
                      }}
                    >
                      Add mood, timing, and visual treatment
                    </p>
                  </div>
                </div>

                {/* Atmosphere Fields */}
                <div>
                  {/* Location Field */}
                  <div>
                    <TextField
                      id="location"
                      label="Location"
                      description="Where does it take place?"
                      value={formData.location}
                      placeholder="e.g., a sun-drenched beach"
                      delay={250}
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

                  {/* Time Field */}
                  <div>
                    <TextField
                      id="time"
                      label="Time"
                      description="When does it happen?"
                      value={formData.time}
                      placeholder="e.g., during golden hour"
                      delay={300}
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

                  {/* Mood Field */}
                  <div>
                    <TextField
                      id="mood"
                      label="Mood"
                      description="Emotional atmosphere"
                      value={formData.mood}
                      placeholder="e.g., energetic and joyful"
                      delay={350}
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

                  {/* Style Field */}
                  <div>
                    <TextField
                      id="style"
                      label="Style"
                      description="Visual treatment"
                      value={formData.style}
                      placeholder="e.g., cinematic"
                      delay={400}
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

                  {/* Event Field */}
                  <div>
                    <TextField
                      id="event"
                      label="Event"
                      description="Context or occasion"
                      value={formData.event}
                      placeholder="e.g., a celebration"
                      delay={450}
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
            </div>

            {/* Premium CTA Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
              <button
                onClick={onContinue}
                disabled={!canContinue}
                style={{
                  position: 'relative',
                  padding: '16px 40px',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                  background: canContinue
                    ? `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`
                    : wizardTheme.colors.neutral[200],
                  borderRadius: '14px',
                  border: 'none',
                  cursor: canContinue ? 'pointer' : 'not-allowed',
                  boxShadow: canContinue 
                    ? '0 8px 20px rgba(255, 56, 92, 0.3), 0 2px 8px rgba(0, 0, 0, 0.06)' 
                    : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(255, 56, 92, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 56, 92, 0.3), 0 2px 8px rgba(0, 0, 0, 0.06)';
                  }
                }}
              >
                Continue to Summary
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Keyboard Shortcut Hint */}
            {canContinue && (
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'right',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '12px',
                  color: wizardTheme.colors.neutral[400],
                  animation: 'slideDown 0.3s ease-out',
                }}
              >
                Press <kbd style={{ 
                  padding: '2px 6px', 
                  background: wizardTheme.colors.neutral[100], 
                  border: `1px solid ${wizardTheme.colors.neutral[200]}`,
                  borderRadius: '4px',
                  fontFamily: wizardTheme.fontFamily.mono,
                  fontSize: '11px',
                }}>Enter</kbd> to continue
              </div>
            )}
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

export default StepQuickFill;
