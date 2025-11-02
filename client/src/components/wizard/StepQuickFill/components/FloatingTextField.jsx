/**
 * FloatingTextField - Material Design-style floating label input
 *
 * Features:
 * - Floating label that animates on focus/value
 * - Success checkmark when filled
 * - Description shown on focus
 * - Staggered entrance animation
 * - Hover states
 * - Required field indicator
 *
 * @module FloatingTextField
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Check } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';

/**
 * FloatingTextField component
 * @param {Object} props
 * @param {string} props.id - Input field ID
 * @param {string} props.label - Field label
 * @param {string} [props.description] - Helper text (shown on focus)
 * @param {string} props.value - Current value
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required] - Required field
 * @param {number} [props.delay=0] - Staggered animation delay (ms)
 * @param {Function} props.onChange - Change handler
 * @param {Function} [props.onFocus] - Focus handler
 * @param {Function} [props.onBlur] - Blur handler
 * @param {boolean} [props.mounted] - Mounted state for animation
 */
export function FloatingTextField({
  id,
  label,
  description,
  value,
  placeholder,
  required,
  delay = 0,
  onChange,
  onFocus,
  onBlur,
  mounted,
}) {
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
            transform: showFloatingLabel
              ? 'translateY(0) scale(0.85)'
              : 'translateY(-50%) scale(1)',
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
            background: showFloatingLabel
              ? 'linear-gradient(to bottom, transparent 50%, white 50%)'
              : 'none',
            padding: showFloatingLabel ? '0 4px' : '0',
            zIndex: 1,
          }}
        >
          {label}
          {required && (
            <span
              style={{ color: wizardTheme.colors.accent.base, marginLeft: '2px' }}
            >
              *
            </span>
          )}
        </label>

        {/* Input Field */}
        <input
          id={id}
          type="text"
          value={value || ''}
          onChange={onChange}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
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
            <Check
              size={20}
              color={wizardTheme.colors.success.base}
              strokeWidth={2.5}
            />
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
}

FloatingTextField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  value: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  delay: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  mounted: PropTypes.bool,
};
