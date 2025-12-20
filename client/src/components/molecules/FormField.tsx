import React, { useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { AlertCircle, Check, type LucideIcon } from 'lucide-react';
import BaseInput from '../atoms/BaseInput';
import {
  formFieldPreset,
  spacing,
  colors,
  typography,
  iconSizes,
} from '@styles/tokens';

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  isValid?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: string;
  autoComplete?: string;
}

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
 */
const FormField = ({
  id,
  name,
  label,
  value = '',
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder = '',
  hint,
  error,
  isValid = false,
  isRequired = false,
  disabled = false,
  icon: Icon,
  type = 'text',
  autoComplete = 'off',
}: FormFieldProps): React.ReactElement => {
  const [isFocused, setIsFocused] = useState(false);

  // Generate IDs for ARIA relationships
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Handle focus with parent callback
  const handleFocus = (e: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  // Handle blur with parent callback
  const handleBlur = (e: FocusEvent<HTMLInputElement>): void => {
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
            <Check size={iconSizes.md} color={colors.feedback.success} />
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
          <AlertCircle size={iconSizes.sm} style={{ marginRight: spacing.xs }} />
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;

