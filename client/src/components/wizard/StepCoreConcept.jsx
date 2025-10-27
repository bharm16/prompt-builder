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

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  ChevronRight,
  Check,
  AlertCircle,
  Lock,
  HelpCircle,
} from "lucide-react";

// ============================================================================
// GLOBAL STYLES (Placeholder styling)
// ============================================================================

// Inject global styles for placeholder and scrollbars
if (typeof document !== "undefined") {
  const styleId = "core-concept-global-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Placeholder styling */
      input::placeholder {
        color: #B9B9B9;
        opacity: 1;
        font-size: 17px;
        font-weight: 400;
      }

      /* Webkit scrollbar styling for suggestion pills */
      [role="list"]::-webkit-scrollbar {
        height: 6px;
      }

      [role="list"]::-webkit-scrollbar-track {
        background: #F7F7F7;
        border-radius: 3px;
      }

      [role="list"]::-webkit-scrollbar-thumb {
        background: #E3E3E3;
        border-radius: 3px;
      }

      [role="list"]::-webkit-scrollbar-thumb:hover {
        background: #CFCFCF;
      }

      /* Animations */
      @keyframes fadeSlideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================================
// DESIGN TOKENS - Airbnb DLS Implementation
// ============================================================================

/**
 * Complete design token system following Airbnb principles
 * All spacing on 8px grid, semantic color naming, systematic typography
 */
const tokens = {
  // Spacing - Generous horizontal, strategic vertical (viewport-aware)
  space: {
    // Vertical spacing (affects scrolling - use strategically)
    vertical: {
      xxs: "6px",
      xs: "8px",
      sm: "12px",
      md: "20px",    // Between input fields
      lg: "24px",    // Between major sections
      xl: "32px",    // Action → Button
      xxl: "40px",   // Page top/bottom
    },
    // Horizontal spacing (generous - doesn't affect scrolling)
    horizontal: {
      sm: "16px",
      md: "20px",    // Input field padding
      lg: "28px",    // Pill padding
      xl: "32px",
      xxl: "48px",   // Container padding
    },
    // Legacy/compatibility
    xxs: "4px",
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
    xxxl: "64px",
  },

  // Typography system - Exact sizes per specifications (using Inter font)
  font: {
    family: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"Roboto Mono", "SF Mono", monospace',
    },
    size: {
      // Specification-driven sizes
      heading: "42px",        // Page heading
      subheading: "18px",     // Page subheading
      label: "15px",          // Field labels
      input: "17px",          // Input field text
      hint: "14px",           // Hint text
      pill: "15px",           // Suggestion pills
      button: "17px",         // Button text
      caption: "13px",        // Character count, keyboard shortcuts
      tiny: "12px",           // Keyboard badges
      // Legacy/compatibility
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
      tight: 1.1,      // Heading
      snug: 1.3,       // Pills, buttons
      normal: 1.4,     // Labels, hints
      relaxed: 1.5,    // Subheading, inputs
      loose: 1.75,
    },
    letterSpacing: {
      tight: "-0.02em",   // Heading (42px)
      snug: "-0.01em",    // Labels, inputs, pills (15px+)
      normal: "0",
      wide: "0.02em",
    },
  },

  // Color system - Sophisticated grayscale + single accent (Rausch Pink)
  color: {
    // PRIMARY ACCENT - Rausch Pink (Airbnb-inspired)
    accent: {
      base: "#FF385C",         // Primary accent color (Rausch)
      hover: "#E03252",        // Slightly darker for hover
      light: "rgba(255, 56, 92, 0.1)",   // 10% opacity for shadows/focus
      lighter: "rgba(255, 56, 92, 0.2)", // 20% opacity
      lightest: "rgba(255, 56, 92, 0.3)",// 30% opacity
    },

    // GRAYSCALE BASE (Tailwind neutral scale)
    gray: {
      50: "#FFFFFF",      // White background
      100: "#F7F7F7",     // Hover background
      200: "#EFEFEF",    // Borders default
      300: "#E3E3E3",    // Borders hover
      400: "#CFCFCF",    // Placeholder, hint text, icons
      500: "#B9B9B9",    // Subheading, secondary text
      600: "#989898",    //
      700: "#787878",    // Labels, body text, pill text
      800: "#575757",    //
      900: "#373737",    // Heading, input text (almost black)
    },

    // SEMANTIC COLORS (consistent with design system)
    success: {
      base: "#00B88F",    // Teal for valid states
      light: "#E8FFF8",
    },
    error: {
      base: "#F44366",    // Rosé for errors
      light: "#FFF2F4",
    },

    // BACKGROUNDS
    page: "linear-gradient(to bottom right, #FAFAFA, #F7F7F7)", // Gradient background
    white: "#FFFFFF",     // Card/container background

    // LEGACY/COMPATIBILITY (Airbnb palette - keeping for other components)
    brand: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#FF5A5F",
      600: "#E14D52",
      700: "#C13E43",
      800: "#A13437",
      900: "#7F2A2D",
    },
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
 * ProgressIndicator - Shows completion status of required fields
 */
function ProgressIndicator({ completed, total }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "10px 12px",
        backgroundColor: tokens.color.gray[50],
        border: `1px solid ${tokens.color.gray[200]}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.hint,
            fontWeight: tokens.font.weight.semibold,
            color: tokens.color.gray[700],
          }}
        >
          Progress
        </span>
        <span
          style={{
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.hint,
            fontWeight: tokens.font.weight.medium,
            color: completed === total ? tokens.color.success.base : tokens.color.gray[600],
          }}
        >
          {completed} of {total} required
        </span>
      </div>
      
      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: "4px",
          backgroundColor: tokens.color.gray[200],
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: completed === total 
              ? `linear-gradient(90deg, ${tokens.color.success.base} 0%, #00A87F 100%)`
              : `linear-gradient(90deg, ${tokens.color.accent.base} 0%, ${tokens.color.accent.hover} 100%)`,
            transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            borderRadius: "2px",
          }}
        />
      </div>
    </div>
  );
}

ProgressIndicator.propTypes = {
  completed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};

/**
 * SuccessBanner - Encouraging message when core fields complete
 */
function SuccessBanner({ message }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px",
        marginBottom: "16px",
        backgroundColor: tokens.color.success.light,
        border: `1px solid ${tokens.color.success.base}`,
        borderRadius: tokens.radius.md,
        animation: "fadeSlideIn 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Check
        size={18}
        color={tokens.color.success.base}
        style={{
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span
        style={{
          fontFamily: tokens.font.family.primary,
          fontSize: tokens.font.size.hint,
          fontWeight: tokens.font.weight.medium,
          color: tokens.color.gray[800],
          lineHeight: 1.3,
        }}
      >
        {message}
      </span>
    </div>
  );
}

SuccessBanner.propTypes = {
  message: PropTypes.string.isRequired,
};

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
    height: "52px",                              // Exact height
    padding: `14px 32px`,                        // Exact padding
    fontFamily: tokens.font.family.primary,
    fontSize: tokens.font.size.button,           // 17px
    fontWeight: tokens.font.weight.semibold,     // 600
    letterSpacing: tokens.font.letterSpacing.snug, // -0.01em
    lineHeight: tokens.font.lineHeight.snug,     // 1.3
    border: "none",
    borderRadius: tokens.radius.lg,              // 12px (not pill)
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${tokens.transition.base}`,
    outline: "none",
  };

  const stateStyles = disabled
    ? {
        backgroundColor: tokens.color.gray[200],
        color: tokens.color.gray[500],
        boxShadow: "none",
      }
    : {
        background: isPressed
          ? `linear-gradient(135deg, ${tokens.color.accent.hover} 0%, #C12745 100%)`
          : isHovered
          ? `linear-gradient(135deg, ${tokens.color.accent.hover} 0%, #C12745 100%)`
          : `linear-gradient(135deg, ${tokens.color.accent.base} 0%, #C12745 100%)`,
        color: tokens.color.white,
        boxShadow: isPressed
          ? `0 2px 8px rgba(255, 56, 92, 0.3), 0 0 0 0 rgba(255, 56, 92, 0.1)`
          : isHovered
          ? `0 6px 20px rgba(255, 56, 92, 0.4), 0 0 0 0 rgba(255, 56, 92, 0.1)`
          : `0 4px 12px rgba(255, 56, 92, 0.3), 0 0 0 0 rgba(255, 56, 92, 0.1)`,
        transform: isHovered && !isPressed ? "translateY(-2px)" : "translateY(0)",
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
  description,
  minLength,
  maxLength,
  showCharCount,
  disabledMessage,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const hasError = Boolean(error);
  const showSuccess = !hasError && value && validators.minLength(value, minLength || 3);
  const charCount = value?.length || 0;
  const meetsMinLength = minLength ? charCount >= minLength : true;

  return (
    <div style={{ marginBottom: "16px" }}> {/* 16px for tighter vertical spacing */}
      {/* Label with optional badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label
          htmlFor={id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.label,        // 15px
            fontWeight: tokens.font.weight.semibold, // 600
            letterSpacing: tokens.font.letterSpacing.snug, // -0.01em
            color: disabled ? tokens.color.gray[400] : tokens.color.gray[700],
            lineHeight: tokens.font.lineHeight.normal, // 1.4
          }}
        >
          {disabled && (
            <Lock size={14} color={tokens.color.gray[400]} aria-hidden="true" />
          )}
          {label}
          {required && (
            <span
              aria-label="required"
              style={{
                marginLeft: "2px",
                color: tokens.color.accent.base,      // Accent color for required
              }}
            >
              *
            </span>
          )}
        </label>
        
        {/* Character count */}
        {showCharCount && !disabled && (
          <span
            style={{
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.caption,    // 13px
              color: meetsMinLength ? tokens.color.gray[500] : tokens.color.accent.base,
              fontWeight: tokens.font.weight.medium,
            }}
          >
            {charCount}{minLength ? `/${minLength}` : ''}
          </span>
        )}
      </div>

      {/* Description text - Only show when focused */}
      {description && isFocused && (
        <p
          style={{
            margin: 0,
            marginBottom: "6px",
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.hint,         // 14px
            color: disabled ? tokens.color.gray[400] : tokens.color.gray[500],
            lineHeight: 1.3,
          }}
        >
          {description}
        </p>
      )}

      {/* Disabled message - Only show when hovered or focused */}
      {disabled && disabledMessage && (isHovered || isFocused) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            marginBottom: "6px",
            backgroundColor: tokens.color.gray[50],
            border: `1px solid ${tokens.color.gray[200]}`,
            borderRadius: tokens.radius.md,
          }}
        >
          <Lock size={14} color={tokens.color.gray[400]} aria-hidden="true" />
          <span
            style={{
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.hint,
              color: tokens.color.gray[600],
              lineHeight: 1.3,
            }}
          >
            {disabledMessage}
          </span>
        </div>
      )}

      {/* Input container (for icon positioning) */}
      <div 
        style={{ position: "relative" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
            height: "52px",                         // Exact height
            padding: `14px ${tokens.space.horizontal.md}`, // 14px 20px
            paddingRight: showSuccess || hasError ? "48px" : tokens.space.horizontal.md,
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.input,       // 17px
            fontWeight: tokens.font.weight.regular, // 400
            letterSpacing: tokens.font.letterSpacing.snug, // -0.01em
            lineHeight: tokens.font.lineHeight.relaxed, // 1.5
            color: tokens.color.gray[900],          // #373737
            backgroundColor: tokens.color.white,
            border: `2px solid ${
              hasError
                ? tokens.color.error.base
                : isFocused
                ? tokens.color.accent.base
                : tokens.color.gray[200]
            }`,
            borderRadius: tokens.radius.md,        // 8px
            outline: "none",
            transition: `all ${tokens.transition.base}`,
            boxShadow: isFocused && !hasError
              ? `0 0 0 4px ${tokens.color.accent.light}, 0 2px 8px ${tokens.color.accent.lighter}`
              : hasError
              ? `0 0 0 4px rgba(244, 67, 102, 0.1), 0 2px 8px rgba(244, 67, 102, 0.1)`
              : "none",
            ...(disabled && {
              backgroundColor: tokens.color.gray[50],
              color: tokens.color.gray[400],
              cursor: "not-allowed",
              opacity: 0.6,
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
            marginTop: "8px",
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.hint,         // 14px
            fontWeight: tokens.font.weight.regular,  // 400
          color: tokens.color.gray[500],           // #B9B9B9
          lineHeight: tokens.font.lineHeight.normal, // 1.4
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
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: tokens.space.xs,
            fontFamily: tokens.font.family.primary,
            fontSize: tokens.font.size.hint,         // 14px
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
  description: PropTypes.string,
  minLength: PropTypes.number,
  maxLength: PropTypes.number,
  showCharCount: PropTypes.bool,
  disabledMessage: PropTypes.string,
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
        gap: "8px",
        overflowX: "auto",
        overflowY: "hidden",
        marginTop: "16px",
        paddingBottom: "12px",
        // Custom scrollbar styling
        scrollbarWidth: "thin",
        scrollbarColor: `${tokens.color.gray[300]} ${tokens.color.gray[100]}`,
        WebkitOverflowScrolling: "touch",
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
        justifyContent: "center",
        padding: "8px 16px",                            // Reduced from 16px 28px
        height: "32px",                                 // Reduced from 48px
        whiteSpace: "nowrap",                           // Prevent wrapping for horizontal scroll
        flexShrink: 0,                                  // Don't shrink in flex container
        fontFamily: tokens.font.family.primary,
        fontSize: "14px",                               // Reduced from 15px
        fontWeight: tokens.font.weight.medium,          // 500
        letterSpacing: tokens.font.letterSpacing.snug,  // -0.01em
        lineHeight: 1,                                  // Tighter line height
        color: tokens.color.gray[700],                  // #787878
        backgroundColor: isHovered ? tokens.color.accent.lightest : tokens.color.gray[50],
        border: `1.5px solid ${isHovered ? tokens.color.accent.base : tokens.color.gray[200]}`,
        borderRadius: "16px",                           // Pill shape (half of height)
        cursor: "pointer",
        transition: `all ${tokens.transition.fast}`,
        outline: "none",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isHovered
          ? `0 2px 8px rgba(255, 56, 92, 0.2), 0 0 0 1px rgba(255, 56, 92, 0.1)`
          : "0 1px 2px rgba(0, 0, 0, 0.05)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.accent.base}`;
        e.currentTarget.style.outlineOffset = "2px";
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
// MAIN COMPONENT - CoreConceptAccordion
// ============================================================================

/**
 * CoreConceptAccordion - Core concept form with modern UI card
 *
 * Clean, flat form layout with field validation:
 * - Subject (required, min 3 chars)
 * - Descriptor 1-3 (optional, unlocked when subject valid)
 * - Action (required, min 3 chars, unlocked when subject valid)
 *
 * Features:
 * - Modern card-based UI
 * - AI-powered suggestion pills
 * - Progressive field unlocking
 * - Auto-focus management
 * - Accessibility (ARIA, focus management)
 * - Viewport-optimized (fits 1080p without scrolling)
 */
export function CoreConceptAccordion({
  formData,
  onChange,
  onNext,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
}) {
  // Responsive spacing state
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsTablet(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Validation states
  const isSubjectValid = validators.minLength(formData.subject, 3);
  const isActionValid = validators.minLength(formData.action, 3);

  // Progress tracking
  const requiredFieldsCompleted = [isSubjectValid, isActionValid].filter(Boolean).length;
  const totalRequiredFields = 2;
  const showSuccessBanner = isSubjectValid && isActionValid;

  // Active field tracking for showing only relevant suggestions
  const [activeField, setActiveField] = React.useState(null);

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

  // Responsive padding values
  const containerPadding = isDesktop
    ? "48px 40px"  // Desktop: 48px vertical, 40px horizontal
    : isTablet
    ? "40px 32px"  // Tablet: 40px vertical, 32px horizontal
    : "32px 24px"; // Mobile: 32px vertical, 24px horizontal

  const cardPadding = isDesktop
    ? "32px"  // Desktop: comfortable padding
    : isTablet
    ? "28px"  // Tablet: moderate padding
    : "24px"; // Mobile: efficient padding

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
        minHeight: "calc(100vh - 4px)", // Full viewport height minus progress bar
        background: "linear-gradient(to bottom right, #FAFAFA, #F7F7F7)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "32px",            // 32px between heading and card
          maxWidth: "600px",
          width: "100%",
        }}
      >
        {/* Heading Section */}
        <section
          style={{
            textAlign: "center",
            width: "100%",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: "16px",
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.heading,         // 42px
              fontWeight: tokens.font.weight.bold,        // 700
              lineHeight: tokens.font.lineHeight.tight,   // 1.1
              letterSpacing: tokens.font.letterSpacing.tight, // -0.02em
              background: `linear-gradient(135deg, ${tokens.color.gray[800]} 0%, ${tokens.color.gray[600]} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Let's start with the big idea
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.subheading,      // 18px
              fontWeight: tokens.font.weight.regular,     // 400
              lineHeight: tokens.font.lineHeight.relaxed, // 1.5
              color: tokens.color.gray[500],              // #B9B9B9
            }}
          >
            Tell us about the core of your video. We'll guide you through it step by step.
          </p>
        </section>

        {/* Form Card */}
        <section
          style={{
            width: "100%",
          }}
        >
          {/* UI Card container */}
          <div
            style={{
              backgroundColor: tokens.color.white,
              borderRadius: tokens.radius.xl,           // 16px for modern look
              border: `1px solid ${tokens.color.gray[200]}`,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              padding: cardPadding, // Responsive: 32px mobile, 36px tablet, 40px desktop
              width: "100%",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Progress Indicator */}
            <ProgressIndicator 
              completed={requiredFieldsCompleted} 
              total={totalRequiredFields} 
            />

            {/* Success Banner */}
            {showSuccessBanner && (
              <SuccessBanner message="Excellent! Your core concept is complete. Feel free to add descriptors for more detail." />
            )}

            {/* Subject Field */}
            <TextField
              id="subject-input"
              label="Subject"
              description="What's the main focus? (e.g., person, object, animal)"
              value={formData.subject}
              onChange={(e) => handleFieldChange("subject", e.target.value)}
              onFocus={() => {
                setActiveField("subject");
                onRequestSuggestions?.("subject", formData.subject || "");
              }}
              onBlur={() => setActiveField(null)}
              error={
                formData.subject && !isSubjectValid
                  ? "Please enter at least 3 characters"
                  : ""
              }
              required
              autoFocus
              minLength={3}
              showCharCount={true}
            />

            {activeField === "subject" && (
              <InlineSuggestions
                suggestions={suggestions?.subject || []}
                isLoading={Boolean(isLoadingSuggestions?.subject)}
                onSelect={(text) => handleSuggestionSelect("subject", text)}
              />
            )}

            {/* Descriptor 1: Physical appearance */}
            <TextField
              id="descriptor1-input"
              label="Descriptor 1"
              description="Physical appearance (e.g., muscular, sleek, colorful)"
              value={formData.descriptor1}
              onChange={(e) => handleFieldChange("descriptor1", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor1");
                onRequestSuggestions?.("descriptor1", formData.descriptor1 || "");
              }}
              onBlur={() => setActiveField(null)}
              disabled={!isSubjectValid}
              disabledMessage="Complete the Subject field to unlock"
            />

            {activeField === "descriptor1" && (
              <InlineSuggestions
                suggestions={suggestions?.descriptor1 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor1)}
                onSelect={(text) => handleSuggestionSelect("descriptor1", text)}
              />
            )}

            {/* Descriptor 2: Visual details */}
            <TextField
              id="descriptor2-input"
              label="Descriptor 2"
              description="Visual details (e.g., wearing a red jersey, with gleaming headlights)"
              value={formData.descriptor2}
              onChange={(e) => handleFieldChange("descriptor2", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor2");
                onRequestSuggestions?.("descriptor2", formData.descriptor2 || "");
              }}
              onBlur={() => setActiveField(null)}
              disabled={!isSubjectValid}
              disabledMessage="Complete the Subject field to unlock"
            />

            {activeField === "descriptor2" && (
              <InlineSuggestions
                suggestions={suggestions?.descriptor2 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor2)}
                onSelect={(text) => handleSuggestionSelect("descriptor2", text)}
              />
            )}

            {/* Descriptor 3: Physical state or condition */}
            <TextField
              id="descriptor3-input"
              label="Descriptor 3"
              description="Physical state or condition (e.g., in mid-stride, covered in dust)"
              value={formData.descriptor3}
              onChange={(e) => handleFieldChange("descriptor3", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor3");
                onRequestSuggestions?.("descriptor3", formData.descriptor3 || "");
              }}
              onBlur={() => setActiveField(null)}
              disabled={!isSubjectValid}
              disabledMessage="Complete the Subject field to unlock"
            />

            {activeField === "descriptor3" && (
              <InlineSuggestions
                suggestions={suggestions?.descriptor3 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor3)}
                onSelect={(text) => handleSuggestionSelect("descriptor3", text)}
              />
            )}

            {/* Action Field */}
            <TextField
              id="action-input"
              label="Action"
              description="What's happening? (e.g., running through, transforming into, leaping over)"
              value={formData.action}
              onChange={(e) => handleFieldChange("action", e.target.value)}
              onFocus={() => {
                setActiveField("action");
                if (isSubjectValid) {
                  onRequestSuggestions?.("action", formData.action || "");
                }
              }}
              onBlur={() => setActiveField(null)}
              error={
                formData.action && !isActionValid
                  ? "Please enter at least 3 characters"
                  : ""
              }
              required
              disabled={!isSubjectValid}
              disabledMessage="Complete the Subject field to unlock"
              minLength={3}
              showCharCount={true}
            />

            {activeField === "action" && (
              <InlineSuggestions
                suggestions={suggestions?.action || []}
                isLoading={Boolean(isLoadingSuggestions?.action)}
                onSelect={(text) => handleSuggestionSelect("action", text)}
              />
            )}

            {/* Button with top margin */}
            <div style={{ marginTop: "32px" }}>
              <PrimaryButton
                disabled={!isSubjectValid || !isActionValid}
                onClick={onNext}
                ariaLabel="Continue to Atmosphere"
                fullWidth
              >
                Continue to Atmosphere
              </PrimaryButton>
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
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    action: PropTypes.string,
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
    descriptor1: "",
    descriptor2: "",
    descriptor3: "",
    action: "",
  });

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState({});

  const [suggestions] = useState({
    subject: [
      "athlete",
      "car",
      "dog",
      "dancer",
      "bird",
    ],
    descriptor1: [
      "muscular and toned",
      "chrome-plated",
      "golden-furred",
      "wearing flowing white",
      "iridescent green",
    ],
    descriptor2: [
      "wearing a red jersey",
      "with gleaming headlights",
      "long-eared and alert",
      "in a tutu and pointe shoes",
      "with rapidly beating wings",
    ],
    descriptor3: [
      "in mid-stride",
      "covered in dust",
      "with wagging tail",
      "arms extended gracefully",
      "hovering in flight",
    ],
    action: [
      "running through",
      "dancing with",
      "transforming into",
      "leaping over",
      "gliding across",
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
