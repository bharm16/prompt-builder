import React, { forwardRef, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { inputPreset, transitions, transitionProperties } from '../../styles/tokens';

interface BaseInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onFocus' | 'onBlur' | 'onKeyDown'> {
  value?: string | undefined;
  onChange?: ((e: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onFocus?: ((e: FocusEvent<HTMLInputElement>) => void) | undefined;
  onBlur?: ((e: FocusEvent<HTMLInputElement>) => void) | undefined;
  onKeyDown?: ((e: KeyboardEvent<HTMLInputElement>) => void) | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  isValid?: boolean | undefined;
  isInvalid?: boolean | undefined;
  isActive?: boolean | undefined;
  type?: string | undefined;
  id?: string | undefined;
  name?: string | undefined;
  autoComplete?: string | undefined;
  ariaRequired?: boolean | undefined;
  ariaInvalid?: boolean | undefined;
  ariaDescribedBy?: string | undefined;
  className?: string | undefined;
}

/**
 * BaseInput Component (Atomic Design - Atom)
 *
 * Base + Variant Pattern:
 * - Immutable base styles (width, padding, font, border-radius)
 * - State-based variants (isValid, isInvalid, isActive, disabled)
 * - All spacing uses design tokens (8px grid system)
 * - Variants are boolean props, not style overrides
 *
 * Design Principles:
 * - 12px vertical × 16px horizontal padding (8px grid)
 * - 2px borders, 8px border-radius
 * - Smooth transitions on state changes
 * - Accessibility-first with proper ARIA support
 * - Forward ref support for parent components
 */
const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(
  (
    {
      value = '',
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      placeholder = '',
      disabled = false,
      isValid = false,
      isInvalid = false,
      isActive = false,
      type = 'text',
      id,
      name,
      autoComplete = 'off',
      ariaRequired = false,
      ariaInvalid = false,
      ariaDescribedBy,
      className = '',
      ...rest
    },
    ref
  ) => {
    /**
     * Compute dynamic styles based on state variants
     * Priority: disabled > isInvalid > isValid > isActive > default
     */
    const computeStyles = (): React.CSSProperties => {
      const baseStyles: React.CSSProperties = {
        // Immutable base styles - NEVER changes
        width: '100%',
        padding: `${inputPreset.padding.vertical} ${inputPreset.padding.horizontal}`,
        fontSize: inputPreset.fontSize,
        lineHeight: inputPreset.lineHeight,
        borderRadius: inputPreset.borderRadius,
        borderWidth: inputPreset.borderWidth,
        borderStyle: 'solid',
        outline: 'none',
        fontFamily: 'inherit',

        // Smooth transitions
        transition: `${transitionProperties.colors} ${transitions.base}, box-shadow ${transitions.base}`,
      };

      // Disabled state (highest priority)
      if (disabled) {
        return {
          ...baseStyles,
          borderColor: inputPreset.disabled.border,
          backgroundColor: inputPreset.disabled.background,
          color: inputPreset.disabled.text,
          cursor: 'not-allowed',
          boxShadow: 'none',
        };
      }

      // Invalid state
      if (isInvalid) {
        return {
          ...baseStyles,
          borderColor: inputPreset.error.border,
          backgroundColor: inputPreset.error.background,
          color: inputPreset.default.text,
          boxShadow: isActive ? inputPreset.error.ring : 'none',
        };
      }

      // Valid state
      if (isValid) {
        return {
          ...baseStyles,
          borderColor: inputPreset.success.border,
          backgroundColor: inputPreset.success.background,
          color: inputPreset.default.text,
          boxShadow: isActive ? inputPreset.success.ring : 'none',
        };
      }

      // Active/Focus state
      if (isActive) {
        return {
          ...baseStyles,
          borderColor: inputPreset.focus.border,
          backgroundColor: inputPreset.focus.background,
          color: inputPreset.default.text,
          boxShadow: inputPreset.focus.ring,
        };
      }

      // Default state
      return {
        ...baseStyles,
        borderColor: inputPreset.default.border,
        backgroundColor: inputPreset.default.background,
        color: inputPreset.default.text,
        boxShadow: 'none',
      };
    };

    const styles = computeStyles();

    return (
      <input
        ref={ref}
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        style={styles}
        className={className}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        {...rest}
      />
    );
  }
);

BaseInput.displayName = 'BaseInput';

export default BaseInput;

