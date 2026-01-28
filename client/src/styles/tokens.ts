/**
 * Design Tokens
 *
 * Centralized design tokens for the application.
 * These values define the visual design system.
 */

export const spacing = {
  xxs: 'var(--ps-space-1)',
  xs: 'var(--ps-space-2)',
  sm: 'var(--ps-space-3)',
  md: 'var(--ps-space-4)',
  lg: 'var(--ps-space-6)',
  xl: 'var(--ps-space-7)',
} as const;

export const colors = {
  text: {
    primary: 'var(--ps-input-text)',
    secondary: 'var(--ps-brand-text-muted)',
  },
  feedback: {
    error: 'var(--ps-input-error-border)',
    success: 'var(--ps-input-success-border)',
  },
} as const;

export const typography = {
  bodySmall: {
    lineHeight: 'var(--ps-lh-normal)',
  },
  caption: {
    lineHeight: 'var(--ps-lh-snug)',
  },
} as const;

export const transitions = {
  base: 'var(--ps-dur-2) var(--ps-ease-out)',
} as const;

export const transitionProperties = {
  colors: 'color, background-color, border-color',
} as const;

export const inputPreset = {
  padding: {
    vertical: 'var(--ps-input-padding-y)',
    horizontal: 'var(--ps-input-padding-x)',
  },
  fontSize: 'var(--ps-input-font-size)',
  lineHeight: 'var(--ps-input-line-height)',
  borderRadius: 'var(--ps-input-radius)',
  borderWidth: 'var(--ps-input-border-width)',
  default: {
    border: 'var(--ps-input-border)',
    background: 'var(--ps-input-bg)',
    text: 'var(--ps-input-text)',
  },
  focus: {
    border: 'var(--ps-input-focus-border)',
    background: 'var(--ps-input-bg)',
    ring: 'var(--ps-input-focus-ring)',
  },
  success: {
    border: 'var(--ps-input-success-border)',
    background: 'var(--ps-input-success-bg)',
    ring: 'var(--ps-input-success-ring)',
  },
  error: {
    border: 'var(--ps-input-error-border)',
    background: 'var(--ps-input-error-bg)',
    ring: 'var(--ps-input-error-ring)',
  },
  disabled: {
    border: 'var(--ps-input-disabled-border)',
    background: 'var(--ps-input-disabled-bg)',
    text: 'var(--ps-input-disabled-text)',
  },
} as const;

export const formFieldPreset = {
  spacing: {
    fieldToField: spacing.lg,
    labelToInput: spacing.xs,
    inputToHint: spacing.xs,
    inputToError: spacing.xs,
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: colors.text.primary,
  },
  hint: {
    fontSize: '12px',
    color: colors.text.secondary,
  },
  error: {
    fontSize: '12px',
    color: colors.feedback.error,
  },
} as const;

/**
 * Icon Size Tokens
 *
 * Standard icon sizes used throughout the application.
 * These ensure consistent icon sizing across components.
 */
export const iconSizes = {
  xs: '12px',  // Extra small
  sm: '16px',  // Small (standard inline)
  md: '20px',  // Medium
  lg: '24px',  // Large (header icon)
  xl: '32px',  // Extra large
  xxl: '48px', // Extra extra large
} as const;
