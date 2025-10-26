/**
 * StepCoreConcept - 2025 Redesign
 *
 * Modern, minimalist progressive disclosure form matching PromptCanvas design patterns.
 *
 * Design Principles Applied:
 * - Neutral color palette (matching PromptCanvas)
 * - System font stack for native feel
 * - Micro-interactions and smooth transitions
 * - Accessibility-first (WCAG 2.1 AA)
 * - Progressive disclosure through opacity
 * - Minimal, clean interface
 *
 * @version 3.0.0
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Check } from "lucide-react";

// ============================================================================
// DESIGN TOKENS - 2025 Minimalist System (matches PromptCanvas)
// ============================================================================

const tokens = {
  // System font stack (matches PromptCanvas exactly)
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

  // Neutral color palette (matches PromptCanvas)
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
// VALIDATION
// ============================================================================

const validators = {
  minLength: (value, min = 3) => {
    const trimmed = value?.trim() || "";
    return trimmed.length >= min;
  },
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * TextField - Modern minimalist input field
 * Features: Clean borders, subtle focus states, micro-interactions
 */
function TextField({
  id,
  label,
  value,
  onChange,
  onFocus,
  placeholder,
  hint,
  disabled,
  autoFocus,
  showSuccess,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transition: `opacity ${tokens.transition.slow}`,
      }}
    >
      {/* Label */}
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.xl,
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

      {/* Input */}
      <div style={{ position: "relative" }}>
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
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          style={{
            width: "100%",
            padding: tokens.space[4],
            fontFamily: tokens.font.family,
            fontSize: tokens.font.size.md,
            lineHeight: tokens.font.lineHeight.relaxed,
            color: tokens.color.neutral[900],
            backgroundColor: tokens.color.white,
            border: `1px solid ${
              isFocused
                ? tokens.color.neutral[400]
                : isHovered
                ? tokens.color.neutral[300]
                : tokens.color.neutral[200]
            }`,
            borderRadius: tokens.radius.lg,
            outline: "none",
            transition: `all ${tokens.transition.base}`,
            boxShadow: isFocused ? `0 0 0 3px ${tokens.color.neutral[100]}` : "none",
          }}
        />

        {/* Success indicator */}
        {showSuccess && (
          <div
            style={{
              position: "absolute",
              right: tokens.space[4],
              top: "50%",
              transform: "translateY(-50%)",
              color: tokens.color.success[600],
              display: "flex",
              alignItems: "center",
              animation: "fadeInScale 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Check size={18} strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Hint text */}
      {hint && (
        <p
          style={{
            margin: 0,
            marginTop: tokens.space[2],
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
    </div>
  );
}

TextField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func,
  placeholder: PropTypes.string,
  hint: PropTypes.string,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
  showSuccess: PropTypes.bool,
};

/**
 * SuggestionChip - Minimalist suggestion button
 * Features: Subtle hover states, smooth transitions
 */
function SuggestionChip({ text, onClick, disabled }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovered(false);
          setIsPressed(false);
        }
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${tokens.space[2]} ${tokens.space[4]}`,
        fontFamily: tokens.font.family,
        fontSize: tokens.font.size.sm,
        fontWeight: tokens.font.weight.medium,
        color: isHovered ? tokens.color.neutral[900] : tokens.color.neutral[700],
        backgroundColor: isHovered ? tokens.color.neutral[100] : tokens.color.neutral[50],
        border: `1px solid ${isHovered ? tokens.color.neutral[300] : tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.xl,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: `all ${tokens.transition.fast}`,
        outline: "none",
        transform: isPressed ? "scale(0.98)" : "scale(1)",
        opacity: disabled ? 0.5 : 1,
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
          e.currentTarget.style.outlineOffset = "2px";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      {text}
    </button>
  );
}

SuggestionChip.propTypes = {
  text: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

/**
 * Suggestions - Suggestion chips container
 */
function Suggestions({ suggestions = [], onSelect, disabled, label }) {
  if (!suggestions.length) return null;

  return (
    <div style={{ marginTop: tokens.space[4] }}>
      {label && (
        <p
          style={{
            margin: 0,
            marginBottom: tokens.space[3],
            fontFamily: tokens.font.family,
            fontSize: tokens.font.size.xs,
            fontWeight: tokens.font.weight.medium,
            color: tokens.color.neutral[500],
            textTransform: "uppercase",
            letterSpacing: tokens.font.letterSpacing.wide,
          }}
        >
          {label}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.space[2],
        }}
      >
        {suggestions.slice(0, 5).map((suggestion, index) => {
          const text = typeof suggestion === "string" ? suggestion : suggestion.text;
          return (
            <SuggestionChip
              key={`${text}-${index}`}
              text={text}
              onClick={() => onSelect?.(text)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
}

Suggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        text: PropTypes.string.isRequired,
        explanation: PropTypes.string,
      }),
    ])
  ),
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  label: PropTypes.string,
};

/**
 * SuccessMessage - Success state indicator
 */
function SuccessMessage({ message }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.space[3],
        padding: `${tokens.space[4]} ${tokens.space[5]}`,
        backgroundColor: tokens.color.success[50],
        border: `1px solid ${tokens.color.success[100]}`,
        borderRadius: tokens.radius.lg,
        animation: "slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
          color: tokens.color.success[600],
        }}
      >
        <Check size={18} strokeWidth={2.5} />
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.md,
          fontWeight: tokens.font.weight.medium,
          color: tokens.color.success[700],
          lineHeight: tokens.font.lineHeight.relaxed,
        }}
      >
        {message}
      </p>
    </div>
  );
}

SuccessMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

/**
 * PrimaryButton - Modern CTA button (matches PromptCanvas)
 */
function PrimaryButton({ children, onClick, disabled }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovered(false);
          setIsPressed(false);
        }
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      style={{
        width: "100%",
        padding: `${tokens.space[4]} ${tokens.space[6]}`,
        fontFamily: tokens.font.family,
        fontSize: tokens.font.size.lg,
        fontWeight: tokens.font.weight.semibold,
        color: tokens.color.white,
        backgroundColor: disabled
          ? tokens.color.neutral[300]
          : isPressed
          ? tokens.color.neutral[800]
          : isHovered
          ? tokens.color.neutral[800]
          : tokens.color.neutral[900],
        border: "none",
        borderRadius: tokens.radius.lg,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: `all ${tokens.transition.base}`,
        outline: "none",
        transform: isPressed ? "translateY(0)" : isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isPressed
          ? "none"
          : isHovered
          ? tokens.shadow.md
          : tokens.shadow.sm,
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
          e.currentTarget.style.outlineOffset = "2px";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      {children}
    </button>
  );
}

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CoreConceptAccordion - 2025 Redesigned Component
 *
 * Progressive disclosure form with:
 * - Clean minimalist design matching PromptCanvas
 * - Micro-interactions and smooth animations
 * - Accessibility-first approach
 * - Opacity-based progressive disclosure
 */
export function CoreConceptAccordion({
  formData,
  onChange,
  onNext,
  suggestions,
  onRequestSuggestions,
}) {
  // Validation states
  const isSubjectValid = validators.minLength(formData.subject, 3);
  const isActionValid = validators.minLength(formData.action, 3);
  const isLocationValid = validators.minLength(formData.location, 3);
  const allFieldsValid = isSubjectValid && isActionValid && isLocationValid;

  // Handle field changes
  const handleFieldChange = useCallback(
    (field, value) => {
      onChange?.(field, value);
    },
    [onChange]
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (field, text) => {
      onChange?.(field, text);
    },
    [onChange]
  );

  return (
    <>
      {/* Keyframe animations */}
      <style>
        {`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: translateY(-50%) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateY(-50%) scale(1);
            }
          }

          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

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
            alignItems: "center",
            gap: tokens.space[10],
            maxWidth: "600px",
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
              Let's start with the big idea
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
              Tell us about the core of your video. We'll guide you through it step by step.
            </p>
          </header>

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
                padding: tokens.space[12],
                width: "100%",
              }}
            >
              {/* Form Fields */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: tokens.space[8],
                }}
              >
                {/* Field 1: Subject */}
                <div>
                  <TextField
                    id="subject-input"
                    label="First, what's the main focus of your video?"
                    value={formData.subject}
                    onChange={(e) => handleFieldChange("subject", e.target.value)}
                    onFocus={() => onRequestSuggestions?.("subject", formData.subject || "")}
                    placeholder="e.g., an elderly violinist, a golden retriever, a vintage motorcycle"
                    hint="Be specific for better results"
                    autoFocus
                    showSuccess={isSubjectValid}
                  />

                  {/* Suggestions */}
                  <Suggestions
                    suggestions={suggestions?.subject}
                    onSelect={(text) => handleSuggestionSelect("subject", text)}
                    label="Try one of these"
                  />
                </div>

                {/* Field 2: Action */}
                <div>
                  <TextField
                    id="action-input"
                    label="Got it. What's the subject doing?"
                    value={formData.action}
                    onChange={(e) => handleFieldChange("action", e.target.value)}
                    onFocus={() =>
                      isSubjectValid && onRequestSuggestions?.("action", formData.action || "")
                    }
                    placeholder="e.g., running through, dancing with, transforming into"
                    hint="Describe the movement or activity"
                    disabled={!isSubjectValid}
                    showSuccess={isActionValid}
                  />

                  {/* Suggestions */}
                  {isSubjectValid && (
                    <Suggestions
                      suggestions={suggestions?.action}
                      onSelect={(text) => handleSuggestionSelect("action", text)}
                      label="Try one of these"
                    />
                  )}
                </div>

                {/* Field 3: Location */}
                <div>
                  <TextField
                    id="location-input"
                    label="And where is all this happening?"
                    value={formData.location}
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                    onFocus={() =>
                      isActionValid && onRequestSuggestions?.("location", formData.location || "")
                    }
                    placeholder="e.g., a sun-drenched beach, a futuristic city, an ancient forest"
                    hint="Describe the setting or environment"
                    disabled={!isActionValid}
                    showSuccess={isLocationValid}
                  />

                  {/* Suggestions */}
                  {isActionValid && (
                    <Suggestions
                      suggestions={suggestions?.location}
                      onSelect={(text) => handleSuggestionSelect("location", text)}
                      label="Try one of these"
                    />
                  )}
                </div>

                {/* Success Message */}
                {allFieldsValid && <SuccessMessage message="Great start! That's a solid foundation." />}

                {/* Continue Button */}
                <PrimaryButton onClick={onNext} disabled={!isLocationValid}>
                  Continue
                </PrimaryButton>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

CoreConceptAccordion.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func,
};

// ============================================================================
// PREVIEW/DEMO COMPONENT
// ============================================================================

/**
 * Preview component for development/testing
 */
export default function Preview() {
  const [formData, setFormData] = useState({
    subject: "",
    action: "",
    location: "",
  });

  const [suggestions] = useState({
    subject: [
      "Golden retriever",
      "Vintage roadster",
      "Street photographer",
      "Ballet dancer",
      "Hummingbird",
    ],
    action: [
      "running through",
      "dancing with",
      "transforming into",
      "leaping over",
      "gliding across",
    ],
    location: [
      "futuristic city",
      "ancient forest",
      "sun-drenched beach",
      "misty mountain peak",
      "neon-lit alleyway",
    ],
  });

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleRequestSuggestions = useCallback(() => {
    // Placeholder for suggestion loading
  }, []);

  const handleNext = useCallback(() => {
    alert("Proceeding to next step!");
  }, []);

  return (
    <CoreConceptAccordion
      formData={formData}
      onChange={handleChange}
      onNext={handleNext}
      suggestions={suggestions}
      onRequestSuggestions={handleRequestSuggestions}
    />
  );
}
