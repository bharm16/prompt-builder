/**
 * CoreConceptAccordion - Airbnb UX/UI Compliant Redesign
 * 
 * A gated, progressive disclosure accordion for video prompt creation.
 * Follows Airbnb's Design Language System principles with:
 * - Strict 8px grid spacing
 * - Design token-based styling
 * - Clear visual hierarchy
 * - Accessible interactions
 * - Progressive disclosure pattern
 * 
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import {
  ChevronRight,
  ChevronDown,
  User,
  Zap,
  MapPin,
  Lock,
  Check,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// DESIGN TOKENS - Airbnb DLS Implementation
// ============================================================================

/**
 * Complete design token system following Airbnb principles
 * All spacing on 8px grid, semantic color naming, systematic typography
 */
const tokens = {
  // Spacing (8px base unit system)
  space: {
    xxs: "4px",   // 0.5 × 8px
    xs: "8px",    // 1 × 8px
    sm: "12px",   // 1.5 × 8px
    md: "16px",   // 2 × 8px
    lg: "24px",   // 3 × 8px
    xl: "32px",   // 4 × 8px
    xxl: "48px",  // 6 × 8px
    xxxl: "64px", // 8 × 8px
  },

  // Typography system
  font: {
    family: {
      primary: '"Circular", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"Roboto Mono", "SF Mono", monospace',
    },
    size: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      md: "18px",
      lg: "20px",
      xl: "24px",
      xxl: "32px",
      xxxl: "48px",
      display: "56px",
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 1.75,
    },
    letterSpacing: {
      tight: "-0.02em",
      snug: "-0.01em",
      normal: "0",
      wide: "0.02em",
    },
  },

  // Color system (Airbnb palette)
  color: {
    // Brand colors
    brand: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#FF5A5F",  // Airbnb brand red
      600: "#E14D52",  // Hover state
      700: "#C13E43",
      800: "#A13437",
      900: "#7F2A2D",
    },

    // Ink (grayscale)
    ink: {
      50: "#FBFBFB",
      100: "#F7F7F7",
      200: "#EDEDED",
      300: "#D6D6D6",
      400: "#A3A3A3",
      500: "#888888",
      600: "#6A6A6A",
      700: "#484848",
      800: "#333333",
      900: "#222222",
    },

    // Semantic colors
    success: {
      base: "#008489",
      light: "#E0F7F7",
      dark: "#005C5F",
    },
    error: {
      base: "#C13515",
      light: "#FDEAE5",
      dark: "#8A1F0F",
    },
    warning: {
      base: "#FFB400",
      light: "#FFF9E6",
      dark: "#CC9000",
    },
    info: {
      base: "#005C5F",
      light: "#E6F6F7",
      dark: "#003D40",
    },

    // White (for clarity)
    white: "#FFFFFF",
  },

  // Border radius
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    pill: "9999px",
  },

  // Elevation (shadows)
  elevation: {
    none: "none",
    sm: "0 1px 3px 0 rgba(0, 0, 0, 0.08)",
    md: "0 4px 12px 0 rgba(0, 0, 0, 0.08)",
    lg: "0 8px 24px 0 rgba(0, 0, 0, 0.10)",
    xl: "0 16px 32px 0 rgba(0, 0, 0, 0.12)",
    card: "0 6px 16px rgba(0, 0, 0, 0.06)",
  },

  // Transitions
  transition: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // Focus indicators
  focus: {
    outline: "2px solid #008489",
    outlineOffset: "3px",
    ring: "0 0 0 4px rgba(0, 133, 137, 0.12)",
  },

  // Touch targets (minimum 44px for accessibility)
  touchTarget: {
    min: "44px",
    comfortable: "48px",
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert number to px string
 */
const px = (n) => (typeof n === "number" ? `${n}px` : n);

/**
 * Validation helpers
 */
const validators = {
  minLength: (value, min = 3) => {
    const trimmed = value?.trim() || "";
    return trimmed.length >= min;
  },
};

// ============================================================================
// PRIMITIVE COMPONENTS (Atoms)
// ============================================================================

/**
 * PrimaryButton - Airbnb-style CTA button
 * Features: Brand color, pill shape, shadow, smooth interactions
 */
function PrimaryButton({ children, onClick, disabled, ariaLabel, fullWidth = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const baseStyles = {
    appearance: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.xs,
    width: fullWidth ? "100%" : "auto",
    minHeight: tokens.touchTarget.comfortable, // 48px for accessibility
    padding: `${tokens.space.sm} ${tokens.space.lg}`,
    fontFamily: tokens.font.family.primary,
    fontSize: tokens.font.size.base,
    fontWeight: tokens.font.weight.semibold,
    border: "none",
    borderRadius: tokens.radius.pill,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${tokens.transition.base}`,
    outline: "none",
  };

  const stateStyles = disabled
    ? {
        backgroundColor: tokens.color.ink[200],
        color: tokens.color.ink[500],
        boxShadow: "none",
      }
    : {
        backgroundColor: isPressed
          ? tokens.color.brand[700]
          : isHovered
          ? tokens.color.brand[600]
          : tokens.color.brand[500],
        color: tokens.color.white,
        boxShadow: isPressed ? "none" : tokens.elevation.card,
        transform: isPressed ? "scale(0.98)" : "scale(1)",
      };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyles, ...stateStyles }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovered(false);
          setIsPressed(false);
        }
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = tokens.focus.outline;
          e.currentTarget.style.outlineOffset = tokens.focus.outlineOffset;
        }
      }}
      onBlur={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = "none";
        }
      }}
    >
      {children}
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  fullWidth: PropTypes.bool,
};

/**
 * TextField - Accessible form input with validation states
 * Features: Labels, hints, errors, focus states, ARIA attributes
 */
function TextField({
  id,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder,
  hint,
  error,
  required,
  disabled,
  autoFocus,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const hasError = Boolean(error);
  const showSuccess = !hasError && value && validators.minLength(value);

  return (
    <div style={{ marginBottom: "32px" }}>
      {/* Label - Changed from tokens.space.lg (24px) to 32px to match space-y-8 */}
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontFamily: tokens.font.family.primary,
          fontSize: "16px", // Changed from sm (14px) to base (16px) to match StepCreativeBrief
          fontWeight: tokens.font.weight.semibold,
          color: tokens.color.ink[900],
          marginBottom: "10px", // mb-2.5 = 10px to match StepCreativeBrief
          lineHeight: tokens.font.lineHeight.normal,
        }}
      >
        {label}
        {required && (
          <span
            aria-label="required"
            style={{
              marginLeft: tokens.space.xxs,
              color: tokens.color.error.base,
            }}
          >
            *
          </span>
        )}
      </label>

      {/* Input container (for icon positioning) */}
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={id}
          type="text"
          value={value ?? ""}
          onChange={onChange}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          aria-required={required || undefined}
          aria-describedby={describedBy || undefined}
          aria-invalid={hasError || undefined}
          style={{
            width: "100%",
            minHeight: tokens.touchTarget.comfortable, // 48px
            padding: "12px 20px", // py-3 px-5 to match StepCreativeBrief
            paddingRight: showSuccess || hasError ? tokens.space.xxl : "20px",
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.base,
            lineHeight: tokens.font.lineHeight.normal,
            color: tokens.color.ink[900],
            backgroundColor: tokens.color.white,
            border: `2px solid ${
              hasError
                ? tokens.color.error.base
                : isFocused
                ? tokens.color.brand[500]
                : tokens.color.ink[300]
            }`,
            borderRadius: tokens.radius.lg,
            outline: "none",
            transition: `all ${tokens.transition.base}`,
            boxShadow: isFocused ? tokens.focus.ring : "none",
            ...(disabled && {
              backgroundColor: tokens.color.ink[100],
              color: tokens.color.ink[500],
              cursor: "not-allowed",
            }),
          }}
        />

        {/* Success indicator */}
        {showSuccess && (
          <div
            style={{
              position: "absolute",
              right: tokens.space.md,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <Check
              size={20}
              color={tokens.color.success.base}
              aria-label="Valid input"
            />
          </div>
        )}

        {/* Error indicator */}
        {hasError && (
          <div
            style={{
              position: "absolute",
              right: tokens.space.md,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <AlertCircle
              size={20}
              color={tokens.color.error.base}
              aria-label="Invalid input"
            />
          </div>
        )}
      </div>

      {/* Hint text */}
      {hint && !error && (
        <p
          id={hintId}
          style={{
            margin: 0,
            marginTop: "14px", // mb-3.5 = 14px to match StepCreativeBrief
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.sm,
            color: tokens.color.ink[600],
            lineHeight: "1.625", // leading-relaxed
          }}
        >
          {hint}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            margin: 0,
            marginTop: "10px", // mt-2.5 = 10px to match StepCreativeBrief
            display: "flex",
            alignItems: "center",
            gap: tokens.space.xs,
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.sm,
            color: tokens.color.error.base,
            lineHeight: tokens.font.lineHeight.normal,
          }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          {error}
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
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,
  placeholder: PropTypes.string,
  hint: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
};

/**
 * InlineSuggestions - Chip-style suggestion buttons
 * Features: Loading state, hover effects, accessible buttons
 * Handles both string and object {text, explanation} formats
 */
function InlineSuggestions({ suggestions = [], isLoading, onSelect }) {
  if (isLoading) {
    return (
      <div
        style={{
          padding: `${tokens.space.sm} 0`,
          fontFamily: tokens.font.family.primary,
          fontSize: tokens.font.size.sm,
          color: tokens.color.ink[600],
        }}
      >
        Loading suggestions…
      </div>
    );
  }

  if (!suggestions.length) return null;

  return (
    <div
      role="list"
      aria-label="Suggestions"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.space.xs,
        marginTop: "14px", // mt-3.5 = 14px to match StepCreativeBrief
      }}
    >
      {suggestions.map((suggestion, index) => {
        // Handle both string and object formats
        const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
        const explanation = typeof suggestion === 'object' ? suggestion.explanation : null;
        
        return (
          <SuggestionChip
            key={`${text}-${index}`}
            text={text}
            explanation={explanation}
            onClick={() => onSelect?.(text)}
          />
        );
      })}
    </div>
  );
}

InlineSuggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        text: PropTypes.string.isRequired,
        explanation: PropTypes.string,
      })
    ])
  ),
  isLoading: PropTypes.bool,
  onSelect: PropTypes.func,
};

/**
 * SuggestionChip - Individual suggestion button
 * Features: Hover states, optional tooltip for explanation
 */
function SuggestionChip({ text, explanation, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={explanation || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${tokens.space.xs} ${tokens.space.md}`,
        fontFamily: tokens.font.family.primary,
        fontSize: tokens.font.size.sm,
        fontWeight: tokens.font.weight.medium,
        color: tokens.color.ink[700],
        backgroundColor: isHovered ? tokens.color.ink[100] : tokens.color.white,
        border: `1px solid ${tokens.color.ink[300]}`,
        borderRadius: tokens.radius.pill,
        cursor: "pointer",
        transition: `all ${tokens.transition.fast}`,
        outline: "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = tokens.focus.outline;
        e.currentTarget.style.outlineOffset = tokens.focus.outlineOffset;
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
  explanation: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};

// ============================================================================
// ORGANISM COMPONENTS
// ============================================================================

/**
 * SectionCard - Collapsible accordion panel
 * Features: Lock states, smooth animations, accessible disclosure
 */
function SectionCard({
  icon,
  title,
  description,
  open,
  onToggle,
  locked,
  completed,
  children,
  cta,
}) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Calculate content height for smooth animation
  useEffect(() => {
    if (open && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [open, children]);

  const handleHeaderClick = () => {
    if (!locked) {
      onToggle?.();
    }
  };

  const handleHeaderKeyDown = (e) => {
    if (!locked && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggle?.();
    }
  };

  return (
    <div
      style={{
        backgroundColor: tokens.color.white,
        borderRadius: tokens.radius.xl,
        boxShadow: tokens.elevation.card,
        overflow: "hidden",
        transition: `box-shadow ${tokens.transition.base}`,
        ...(open && {
          boxShadow: tokens.elevation.md,
        }),
      }}
    >
      {/* Card Header */}
      <div
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-expanded={open}
        aria-disabled={locked}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.space.md,
          padding: "28px 32px",
          cursor: locked ? "not-allowed" : "pointer",
          backgroundColor: open ? tokens.color.ink[50] : tokens.color.white,
          transition: `background-color ${tokens.transition.base}`,
          outline: "none",
        }}
        onFocus={(e) => {
          if (!locked) {
            e.currentTarget.style.outline = tokens.focus.outline;
            e.currentTarget.style.outlineOffset = `-${tokens.space.xxs}`;
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        {/* Icon container */}
        <div
          style={{
            width: tokens.space.xxl, // 48px
            height: tokens.space.xxl,
            borderRadius: tokens.radius.pill,
            backgroundColor: completed
              ? tokens.color.success.light
              : locked
              ? tokens.color.ink[200]
              : tokens.color.brand[50],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {completed ? (
            <Check size={24} color={tokens.color.success.base} />
          ) : locked ? (
            <Lock size={20} color={tokens.color.ink[500]} />
          ) : (
            icon
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            flex: 1,
            margin: 0,
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.lg,
            fontWeight: tokens.font.weight.semibold,
            color: locked ? tokens.color.ink[500] : tokens.color.ink[900],
            lineHeight: tokens.font.lineHeight.snug,
          }}
        >
          {title}
        </h3>

        {/* Expand/collapse indicator */}
        {!locked && (
          <div
            style={{
              transition: `transform ${tokens.transition.base}`,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDown size={24} color={tokens.color.ink[700]} />
          </div>
        )}
      </div>

      {/* Card Content (animated) */}
      <div
        ref={contentRef}
        style={{
          height: px(height),
          overflow: "hidden",
          transition: `height ${tokens.transition.slow}`,
        }}
      >
        <div style={{ padding: "32px" }}>
          {/* Description - mb-3.5 */}
          {description && (
            <div style={{ marginBottom: "20px" }}>{description}</div>
          )}

          {/* Form fields and suggestions */}
          {children}

          {/* CTA button - mt-8 */}
          {cta && <div style={{ marginTop: "40px" }}>{cta}</div>}
        </div>
      </div>
    </div>
  );
}

SectionCard.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  open: PropTypes.bool,
  onToggle: PropTypes.func,
  locked: PropTypes.bool,
  completed: PropTypes.bool,
  children: PropTypes.node,
  cta: PropTypes.node,
};

// ============================================================================
// MAIN COMPONENT - CoreConceptAccordion
// ============================================================================

/**
 * CoreConceptAccordion - Main gated accordion component
 * 
 * Progressive disclosure pattern with three gated sections:
 * 1. Subject (always accessible)
 * 2. Action (unlocks when subject is valid)
 * 3. Location (unlocks when action is valid)
 * 
 * Features:
 * - Auto-focus management
 * - Keyboard navigation
 * - Accessibility (ARIA, focus management)
 * - Responsive layout
 */
export function CoreConceptAccordion({
  formData,
  onChange,
  onNext,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
}) {
  // Validation states
  const isSubjectValid = validators.minLength(formData.subject, 3);
  const isActionValid = validators.minLength(formData.action, 3);
  const isLocationValid = validators.minLength(formData.location, 3);

  // Accordion open/closed state
  const [openSections, setOpenSections] = useState({
    subject: true,
    action: false,
    location: false,
  });

  // Toggle accordion section
  const toggleSection = useCallback((section) => {
    setOpenSections((prev) => ({
      subject: section === "subject" ? !prev.subject : false,
      action: section === "action" ? !prev.action : false,
      location: section === "location" ? !prev.location : false,
    }));
  }, []);

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

  // Auto-advance to next section when field is valid
  const handleSectionAdvance = useCallback(
    (currentSection, nextSection) => {
      setOpenSections((prev) => ({
        ...prev,
        [currentSection]: false,
        [nextSection]: true,
      }));
    },
    []
  );

  return (
    <main
      style={{
        flex: "1",
        width: "100%",
        maxWidth: "1920px",
        margin: "0 auto",
        padding: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 4px)", // Full viewport height minus progress bar
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: "64px",
        }}
      >
        {/* Left Column - Heading */}
        <section
          style={{
            flex: "1",
            maxWidth: "568px",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: "24px",
              fontFamily: tokens.font.family.primary,
              fontSize: "56px",
              lineHeight: "64px",
              letterSpacing: "-0.02em",
              fontWeight: tokens.font.weight.semibold,
              color: "#222",
            }}
          >
            Let's start with the big idea
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.family.primary,
              fontSize: "16px",
              lineHeight: "24px",
              color: "#6B7280",
            }}
          >
            Tell us about the core of your video. We'll guide you through it step by step.
          </p>
        </section>

        {/* Right Column - Accordion sections */}
        <section
          style={{
            flex: "1",
            maxWidth: "568px",
          }}
        >
          {/* Big card container */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              padding: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
            {/* Section 1: Subject */}
            <SectionCard
              icon={<User size={22} color={tokens.color.brand[500]} />}
              title="Subject"
              description={
                <p
                  style={{
                    margin: 0,
                    fontFamily: tokens.font.family.primary,
                    fontSize: tokens.font.size.base,
                    color: tokens.color.ink[700],
                    lineHeight: tokens.font.lineHeight.normal,
                  }}
                >
                  What is the main focus? (person, object, animal, etc.)
                </p>
              }
              open={openSections.subject}
              onToggle={() => toggleSection("subject")}
              locked={false}
              completed={isSubjectValid && !openSections.subject}
            >
              <TextField
                id="subject-input"
                label="Subject"
                value={formData.subject}
                onChange={(e) => handleFieldChange("subject", e.target.value)}
                onFocus={() =>
                  onRequestSuggestions?.("subject", formData.subject || "")
                }
                placeholder="e.g., a professional athlete, a vintage car, a golden retriever"
                hint="Be specific for better results"
                error={
                  formData.subject && !isSubjectValid
                    ? "Please enter at least 3 characters"
                    : ""
                }
                required
                autoFocus
              />

              <InlineSuggestions
                suggestions={suggestions?.subject || []}
                isLoading={Boolean(isLoadingSuggestions?.subject)}
                onSelect={(text) => handleSuggestionSelect("subject", text)}
              />

              <PrimaryButton
                disabled={!isSubjectValid}
                onClick={() => handleSectionAdvance("subject", "action")}
                ariaLabel="Continue to Action section"
                fullWidth
              >
                Save & Continue
              </PrimaryButton>
            </SectionCard>

            {/* Section 2: Action */}
            <SectionCard
              icon={<Zap size={22} color={tokens.color.brand[500]} />}
              title="Action"
              description={
                <p
                  style={{
                    margin: 0,
                    fontFamily: tokens.font.family.primary,
                    fontSize: tokens.font.size.base,
                    color: tokens.color.ink[700],
                    lineHeight: tokens.font.lineHeight.normal,
                  }}
                >
                  What is happening? (movement, activity, transformation)
                </p>
              }
              open={openSections.action}
              onToggle={() => toggleSection("action")}
              locked={!isSubjectValid}
              completed={isActionValid && !openSections.action}
            >
              <TextField
                id="action-input"
                label="Action"
                value={formData.action}
                onChange={(e) => handleFieldChange("action", e.target.value)}
                onFocus={() =>
                  isSubjectValid &&
                  onRequestSuggestions?.("action", formData.action || "")
                }
                placeholder="e.g., running through, transforming into, dancing with"
                hint="Describe the movement or activity"
                error={
                  formData.action && !isActionValid
                    ? "Please enter at least 3 characters"
                    : ""
                }
                required
                disabled={!isSubjectValid}
              />

              <InlineSuggestions
                suggestions={suggestions?.action || []}
                isLoading={Boolean(isLoadingSuggestions?.action)}
                onSelect={(text) => handleSuggestionSelect("action", text)}
              />

              <PrimaryButton
                disabled={!isActionValid}
                onClick={() => handleSectionAdvance("action", "location")}
                ariaLabel="Continue to Location section"
                fullWidth
              >
                Save & Continue
              </PrimaryButton>
            </SectionCard>

            {/* Section 3: Location */}
            <SectionCard
              icon={<MapPin size={22} color={tokens.color.brand[500]} />}
              title="Location"
              description={
                <p
                  style={{
                    margin: 0,
                    fontFamily: tokens.font.family.primary,
                    fontSize: tokens.font.size.base,
                    color: tokens.color.ink[700],
                    lineHeight: tokens.font.lineHeight.normal,
                  }}
                >
                  Where does it take place? (setting, environment)
                </p>
              }
              open={openSections.location}
              onToggle={() => toggleSection("location")}
              locked={!isActionValid}
              completed={isLocationValid && !openSections.location}
            >
              <TextField
                id="location-input"
                label="Location"
                value={formData.location}
                onChange={(e) => handleFieldChange("location", e.target.value)}
                onFocus={() =>
                  isActionValid &&
                  onRequestSuggestions?.("location", formData.location || "")
                }
                placeholder="e.g., a sun-drenched beach, a futuristic city, an ancient forest"
                hint="Describe the setting or environment"
                error={
                  formData.location && !isLocationValid
                    ? "Please enter at least 3 characters"
                    : ""
                }
                required
                disabled={!isActionValid}
              />

              <InlineSuggestions
                suggestions={suggestions?.location || []}
                isLoading={Boolean(isLoadingSuggestions?.location)}
                onSelect={(text) => handleSuggestionSelect("location", text)}
              />

              <PrimaryButton
                disabled={!isLocationValid}
                onClick={onNext}
                ariaLabel="Continue to next step"
                fullWidth
              >
                Continue to Atmosphere
              </PrimaryButton>
            </SectionCard>
            </div>
          </div>
        </section>
      </div>
    </main>
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
  isLoadingSuggestions: PropTypes.object,
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

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState({});

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

  const handleRequestSuggestions = useCallback((field) => {
    setIsLoadingSuggestions((prev) => ({ ...prev, [field]: true }));
    setTimeout(() => {
      setIsLoadingSuggestions((prev) => ({ ...prev, [field]: false }));
    }, 300);
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
      isLoadingSuggestions={isLoadingSuggestions}
      onRequestSuggestions={handleRequestSuggestions}
    />
  );
}
