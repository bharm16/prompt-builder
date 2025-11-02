/**
 * TextField - Accessible form input with validation states
 *
 * Full-featured text input component with:
 * - Label with required indicator
 * - Description text (shown on focus)
 * - Character counter
 * - Validation states (success/error)
 * - Disabled state with lock icon and tooltip
 * - Hint and error messages
 * - ARIA attributes for accessibility
 * - Focus states with outline
 *
 * @module TextField
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Check, AlertCircle, Lock } from "lucide-react";
import { tokens } from "../config/designTokens";
import { validators } from "../utils/helpers";

/**
 * TextField component
 * @param {Object} props
 * @param {string} props.id - Input field ID
 * @param {string} props.label - Field label
 * @param {string} [props.value] - Current value
 * @param {Function} props.onChange - Change handler
 * @param {Function} [props.onFocus] - Focus handler
 * @param {Function} [props.onBlur] - Blur handler
 * @param {Function} [props.onKeyDown] - KeyDown handler
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.hint] - Hint text below input
 * @param {string} [props.error] - Error message
 * @param {boolean} [props.required] - Required field
 * @param {boolean} [props.disabled] - Disabled state
 * @param {boolean} [props.autoFocus] - Auto focus on mount
 * @param {string} [props.description] - Description text (shown on focus)
 * @param {number} [props.minLength] - Minimum length for validation
 * @param {number} [props.maxLength] - Maximum length
 * @param {boolean} [props.showCharCount] - Show character counter
 * @param {string} [props.disabledMessage] - Message shown when disabled
 */
export function TextField({
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
            {meetsMinLength ? `${charCount}` : `${charCount} (min ${minLength})`}
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
