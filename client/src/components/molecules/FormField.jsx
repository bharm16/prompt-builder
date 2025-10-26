import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, Check } from 'lucide-react';
import BaseInput from '../atoms/BaseInput';
import {
  formFieldPreset,
  spacing,
  colors,
  typography,
  iconSizes,
} from '../../styles/tokens';

/**
 * FormField Component (Atomic Design - Molecule)
 *
 * Encapsulates complete form field behavior:
 * - Label with optional icon
 * - BaseInput integration
 * - Validation feedback (error messages with AlertCircle icon)
 * - Hint text (supporting information)
 * - Success indicator (Check icon)
 * - Proper ARIA attributes for accessibility
 *
 * Spacing (8px grid):
 * - 8px label-to-input margin
 * - 8px input-to-hint/error margin
 * - 24px field-to-field margin (applied by parent)
 * - Icons are 16px × 16px (2 × base unit)
 *
 * @component
 */
const FormField = ({
  id,
  name,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder,
  hint,
  error,
  isValid,
  isRequired,
  disabled,
  icon: Icon,
  type,
  autoComplete,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Generate IDs for ARIA relationships
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Handle focus with parent callback
  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  // Handle blur with parent callback
  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  // Determine if field is invalid
  const isInvalid = Boolean(error);

  return (
    <div style={{ marginBottom: formFieldPreset.spacing.fieldToField }}>
      {/* Label */}
      <label
        htmlFor={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: formFieldPreset.spacing.labelToInput,
          fontSize: formFieldPreset.label.fontSize,
          fontWeight: formFieldPreset.label.fontWeight,
          color: formFieldPreset.label.color,
          lineHeight: typography.bodySmall.lineHeight,
        }}
      >
        {Icon && (
          <Icon
            size={iconSizes.sm}
            style={{
              marginRight: spacing.xs,
              color: colors.text.secondary,
            }}
          />
        )}
        {label}
        {isRequired && (
          <span
            style={{
              marginLeft: spacing.xxs,
              color: colors.feedback.error,
            }}
          >
            *
          </span>
        )}
      </label>

      {/* Hint Text (above input) */}
      {hint && (
        <p
          id={hintId}
          style={{
            marginBottom: formFieldPreset.spacing.inputToHint,
            fontSize: formFieldPreset.hint.fontSize,
            color: formFieldPreset.hint.color,
            lineHeight: typography.caption.lineHeight,
          }}
        >
          {hint}
        </p>
      )}

      {/* Input with Success Icon */}
      <div style={{ position: 'relative' }}>
        <BaseInput
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          isValid={isValid && !isInvalid}
          isInvalid={isInvalid}
          isActive={isFocused}
          autoComplete={autoComplete}
          ariaRequired={isRequired}
          ariaInvalid={isInvalid}
          ariaDescribedBy={ariaDescribedBy}
          {...rest}
        />

        {/* Success Checkmark Icon */}
        {isValid && !isInvalid && (
          <div
            style={{
              position: 'absolute',
              right: spacing.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <Check
              size={iconSizes.md}
              color={colors.feedback.success}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: formFieldPreset.spacing.inputToError,
            fontSize: formFieldPreset.error.fontSize,
            color: formFieldPreset.error.color,
            lineHeight: typography.caption.lineHeight,
          }}
        >
          <AlertCircle
            size={iconSizes.sm}
            style={{ marginRight: spacing.xs }}
          />
          {error}
        </p>
      )}
    </div>
  );
};

FormField.propTypes = {
  // Input identification
  id: PropTypes.string.isRequired,
  name: PropTypes.string,

  // Label
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType, // Lucide React icon component

  // Value and handlers
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,

  // Input attributes
  placeholder: PropTypes.string,
  type: PropTypes.string,
  autoComplete: PropTypes.string,

  // Supporting text
  hint: PropTypes.string,

  // Validation
  error: PropTypes.string,
  isValid: PropTypes.bool,
  isRequired: PropTypes.bool,

  // State
  disabled: PropTypes.bool,
};

FormField.defaultProps = {
  name: undefined,
  value: '',
  onFocus: undefined,
  onBlur: undefined,
  onKeyDown: undefined,
  placeholder: '',
  type: 'text',
  autoComplete: 'off',
  hint: '',
  error: '',
  isValid: false,
  isRequired: false,
  disabled: false,
  icon: null,
};

export default FormField;
