/**
 * StepAtmosphere - 2025 Redesign
 *
 * Modern, minimalist atmosphere and style form matching StepCoreConcept design patterns.
 *
 * Design Principles Applied:
 * - Neutral color palette (matching PromptCanvas & StepCoreConcept)
 * - System font stack for native feel
 * - Micro-interactions and smooth transitions
 * - Accessibility-first (WCAG 2.1 AA)
 * - Subtle focus states with 1px borders
 * - Consistent spacing and typography
 *
 * @version 2.0.0
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Palette, ChevronRight, ArrowLeft } from 'lucide-react';
import InlineSuggestions from './InlineSuggestions';

// ============================================================================
// DESIGN TOKENS - 2025 Minimalist System (matches StepCoreConcept)
// ============================================================================

const tokens = {
  // System font stack (matches PromptCanvas & StepCoreConcept)
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    size: {
      xs: "0.75rem",      // 12px
      sm: "0.8125rem",    // 13px
      base: "0.875rem",   // 14px
      md: "0.9375rem",    // 15px
      lg: "1rem",         // 16px
      xl: "1.125rem",     // 18px
      xxl: "1.25rem",     // 20px
      xxxl: "1.5rem",     // 24px
      display: "2rem",    // 32px
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.75,
    },
    letterSpacing: {
      tight: "-0.02em",
      normal: "-0.01em",
      wide: "0.025em",
    },
  },

  // Neutral color palette (matches StepCoreConcept)
  color: {
    neutral: {
      50: "#FAFAFA",
      100: "#F5F5F5",
      200: "#E5E5E5",
      300: "#D4D4D4",
      400: "#A3A3A3",
      500: "#737373",
      600: "#525252",
      700: "#404040",
      800: "#262626",
      900: "#171717",
    },
    success: {
      50: "#F0FDF4",
      100: "#DCFCE7",
      500: "#22C55E",
      600: "#16A34A",
      700: "#15803D",
    },
    info: {
      50: "#F0F9FF",
      100: "#E0F2FE",
      600: "#0284C7",
      700: "#0369A1",
    },
    white: "#FFFFFF",
  },

  // Spacing scale
  space: {
    1: "0.25rem",   // 4px
    2: "0.5rem",    // 8px
    3: "0.75rem",   // 12px
    4: "1rem",      // 16px
    5: "1.25rem",   // 20px
    6: "1.5rem",    // 24px
    8: "2rem",      // 32px
    10: "2.5rem",   // 40px
    12: "3rem",     // 48px
    16: "4rem",     // 64px
  },

  // Border radius
  radius: {
    sm: "0.25rem",  // 4px
    md: "0.375rem", // 6px
    lg: "0.5rem",   // 8px
    xl: "0.75rem",  // 12px
  },

  // Shadows (subtle, matching PromptCanvas)
  shadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  },

  // Transitions (smooth, delightful micro-interactions)
  transition: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * AtmosphereTextField - Minimalist input field for atmosphere data
 * Features: Subtle borders, soft focus states, micro-interactions
 */
function AtmosphereTextField({
  id,
  label,
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  hint,
  isActive,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div>
      {/* Label */}
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.lg,
          fontWeight: tokens.font.weight.semibold,
          color: tokens.color.neutral[900],
          marginBottom: tokens.space[2],
          lineHeight: tokens.font.lineHeight.snug,
          letterSpacing: tokens.font.letterSpacing.tight,
          transition: `color ${tokens.transition.base}`,
        }}
      >
        {label}
      </label>

      {/* Hint text */}
      {hint && (
        <p
          style={{
            margin: 0,
            marginBottom: tokens.space[3],
            fontFamily: tokens.font.family,
            fontSize: tokens.font.size.sm,
            color: tokens.color.neutral[500],
            lineHeight: tokens.font.lineHeight.relaxed,
            letterSpacing: tokens.font.letterSpacing.normal,
          }}
        >
          {hint}
        </p>
      )}

      {/* Input */}
      <input
        id={id}
        type="text"
        value={value ?? ""}
        onChange={onChange}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: tokens.space[4],
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.md,
          lineHeight: tokens.font.lineHeight.relaxed,
          color: tokens.color.neutral[900],
          backgroundColor: tokens.color.white,
          border: `1px solid ${
            isFocused || isActive
              ? tokens.color.neutral[400]
              : isHovered
              ? tokens.color.neutral[300]
              : tokens.color.neutral[200]
          }`,
          borderRadius: tokens.radius.lg,
          outline: "none",
          transition: `all ${tokens.transition.base}`,
          boxShadow: isFocused || isActive ? `0 0 0 3px ${tokens.color.neutral[100]}` : "none",
        }}
      />
    </div>
  );
}

AtmosphereTextField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func,
  onKeyDown: PropTypes.func,
  placeholder: PropTypes.string,
  hint: PropTypes.string,
  isActive: PropTypes.bool,
};

/**
 * ContextPreview - Shows what user created in Step 1
 */
function ContextPreview({ subject, action, location }) {
  return (
    <div
      style={{
        padding: tokens.space[5],
        backgroundColor: tokens.color.neutral[50],
        border: `1px solid ${tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.lg,
        marginBottom: tokens.space[8],
      }}
    >
      <p
        style={{
          margin: 0,
          marginBottom: tokens.space[2],
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.xs,
          fontWeight: tokens.font.weight.semibold,
          color: tokens.color.neutral[600],
          textTransform: "uppercase",
          letterSpacing: tokens.font.letterSpacing.wide,
        }}
      >
        Core Concept
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.lg,
          lineHeight: tokens.font.lineHeight.relaxed,
          color: tokens.color.neutral[800],
        }}
      >
        <span style={{ fontWeight: tokens.font.weight.semibold }}>
          {subject || '...'}
        </span>
        {' '}
        <span style={{ color: tokens.color.neutral[600] }}>
          {action || '...'}
        </span>
        {' at '}
        <span style={{ fontWeight: tokens.font.weight.semibold }}>
          {location || '...'}
        </span>
      </p>
    </div>
  );
}

ContextPreview.propTypes = {
  subject: PropTypes.string,
  action: PropTypes.string,
  location: PropTypes.string,
};

/**
 * HelpBox - Neutral help text box
 */
function HelpBox({ children }) {
  return (
    <div
      style={{
        padding: tokens.space[4],
        backgroundColor: tokens.color.neutral[50],
        border: `1px solid ${tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.lg,
        marginTop: tokens.space[8],
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.sm,
          lineHeight: tokens.font.lineHeight.relaxed,
          color: tokens.color.neutral[700],
        }}
      >
        <span style={{ fontWeight: tokens.font.weight.semibold }}>Tip:</span> {children}
      </p>
    </div>
  );
}

HelpBox.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * SecondaryButton - Subtle secondary button
 */
function SecondaryButton({ children, onClick, icon: Icon }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.space[2],
        padding: `${tokens.space[3]} ${tokens.space[5]}`,
        fontFamily: tokens.font.family,
        fontSize: tokens.font.size.md,
        fontWeight: tokens.font.weight.medium,
        color: tokens.color.neutral[700],
        backgroundColor: isHovered ? tokens.color.neutral[100] : tokens.color.neutral[50],
        border: `1px solid ${tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.lg,
        cursor: "pointer",
        transition: `all ${tokens.transition.base}`,
        outline: "none",
        transform: isPressed ? "translateY(0)" : isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isPressed ? "none" : isHovered ? tokens.shadow.sm : "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </button>
  );
}

SecondaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType,
};

/**
 * PrimaryButton - Modern CTA button
 */
function PrimaryButton({ children, onClick, icon: Icon }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.space[2],
        padding: `${tokens.space[3]} ${tokens.space[6]}`,
        fontFamily: tokens.font.family,
        fontSize: tokens.font.size.md,
        fontWeight: tokens.font.weight.semibold,
        color: tokens.color.white,
        backgroundColor: isPressed
          ? tokens.color.neutral[800]
          : isHovered
          ? tokens.color.neutral[800]
          : tokens.color.neutral[900],
        border: "none",
        borderRadius: tokens.radius.lg,
        cursor: "pointer",
        transition: `all ${tokens.transition.base}`,
        outline: "none",
        transform: isPressed ? "translateY(0)" : isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isPressed ? "none" : isHovered ? tokens.shadow.md : tokens.shadow.sm,
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      {children}
      {Icon && <Icon size={18} strokeWidth={2} />}
    </button>
  );
}

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * StepAtmosphere Component - 2025 Redesign
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

  // Handle Enter key to move to next field or submit
  const handleKeyDown = (e, fieldName) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const fields = ['time', 'mood', 'style', 'event'];
      const currentIndex = fields.indexOf(fieldName);
      if (currentIndex < fields.length - 1) {
        document.getElementById(`${fields[currentIndex + 1]}-input`)?.focus();
      } else {
        onNext();
      }
    }
  };

  return (
    <main
      style={{
        flex: "1",
        width: "100%",
        maxWidth: "1920px",
        margin: "0 auto",
        padding: tokens.space[10],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 4px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: tokens.space[8],
          maxWidth: "720px",
          width: "100%",
        }}
      >
        {/* Header Section */}
        <header
          style={{
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              marginBottom: tokens.space[4],
              backgroundColor: tokens.color.neutral[100],
              borderRadius: tokens.radius.xl,
            }}
          >
            <Palette size={24} strokeWidth={2} color={tokens.color.neutral[700]} />
          </div>
          <h1
            style={{
              margin: 0,
              marginBottom: tokens.space[2],
              fontFamily: tokens.font.family,
              fontSize: tokens.font.size.display,
              lineHeight: tokens.font.lineHeight.tight,
              letterSpacing: tokens.font.letterSpacing.tight,
              fontWeight: tokens.font.weight.bold,
              color: tokens.color.neutral[900],
            }}
          >
            Add atmosphere and style
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.family,
              fontSize: tokens.font.size.xl,
              lineHeight: tokens.font.lineHeight.relaxed,
              color: tokens.color.neutral[600],
              letterSpacing: tokens.font.letterSpacing.normal,
            }}
          >
            Bring depth to your scene with mood, timing, and visual treatment. All fields are optional.
          </p>
        </header>

        {/* Context Preview */}
        <ContextPreview
          subject={formData.subject}
          action={formData.action}
          location={formData.location}
        />

        {/* Form Card */}
        <section
          style={{
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: tokens.color.white,
              borderRadius: tokens.radius.xl,
              border: `1px solid ${tokens.color.neutral[200]}`,
              boxShadow: tokens.shadow.base,
              padding: tokens.space[10],
              width: "100%",
            }}
          >
            {/* Fields Grid */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.space[8],
              }}
            >
              {/* Time Field */}
              <div>
                <AtmosphereTextField
                  id="time-input"
                  label="Time"
                  value={formData.time}
                  onChange={(e) => handleChange('time', e.target.value)}
                  onFocus={() => handleFocus('time')}
                  onKeyDown={(e) => handleKeyDown(e, 'time')}
                  placeholder="e.g., during golden hour, at midnight, in the 1920s"
                  hint="When does it happen? (time of day, era, season) - Optional"
                  isActive={activeField === 'time'}
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
                <AtmosphereTextField
                  id="mood-input"
                  label="Mood"
                  value={formData.mood}
                  onChange={(e) => handleChange('mood', e.target.value)}
                  onFocus={() => handleFocus('mood')}
                  onKeyDown={(e) => handleKeyDown(e, 'mood')}
                  placeholder="e.g., energetic and joyful, mysterious and tense, calm and peaceful"
                  hint="What's the emotional atmosphere? - Optional"
                  isActive={activeField === 'mood'}
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
                <AtmosphereTextField
                  id="style-input"
                  label="Style"
                  value={formData.style}
                  onChange={(e) => handleChange('style', e.target.value)}
                  onFocus={() => handleFocus('style')}
                  onKeyDown={(e) => handleKeyDown(e, 'style')}
                  placeholder="e.g., cinematic, documentary, vintage film, minimalist"
                  hint="What visual treatment? (cinematic, documentary, etc.) - Optional"
                  isActive={activeField === 'style'}
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
                <AtmosphereTextField
                  id="event-input"
                  label="Event"
                  value={formData.event}
                  onChange={(e) => handleChange('event', e.target.value)}
                  onFocus={() => handleFocus('event')}
                  onKeyDown={(e) => handleKeyDown(e, 'event')}
                  placeholder="e.g., a celebration, a chase scene, a quiet moment"
                  hint="What's the context or occasion? - Optional"
                  isActive={activeField === 'event'}
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
          </div>
        </section>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: tokens.space[4],
          }}
        >
          <SecondaryButton onClick={onBack} icon={ArrowLeft}>
            Back
          </SecondaryButton>

          <div
            style={{
              display: "flex",
              gap: tokens.space[3],
            }}
          >
            <SecondaryButton onClick={onNext}>
              Skip
            </SecondaryButton>
            <PrimaryButton onClick={onNext} icon={ChevronRight}>
              Continue
            </PrimaryButton>
          </div>
        </div>

        {/* Help Text */}
        <HelpBox>
          Atmosphere fields are optional but highly recommended. They add emotional depth and visual richness to your video prompt.
        </HelpBox>
      </div>
    </main>
  );
};

StepAtmosphere.propTypes = {
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
