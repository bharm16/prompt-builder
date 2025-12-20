/**
 * Design Tokens
 *
 * Centralized design tokens for the application.
 * These values define the visual design system.
 */

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;

export const colors = {
  text: {
    primary: '#111827',
    secondary: '#6b7280',
  },
  feedback: {
    error: '#ef4444',
    success: '#10b981',
  },
} as const;

export const typography = {
  bodySmall: {
    lineHeight: '1.4',
  },
  caption: {
    lineHeight: '1.3',
  },
} as const;

export const transitions = {
  base: '150ms ease',
} as const;

export const transitionProperties = {
  colors: 'color, background-color, border-color',
} as const;

export const inputPreset = {
  padding: {
    vertical: '12px',
    horizontal: '16px',
  },
  fontSize: '14px',
  lineHeight: '1.5',
  borderRadius: '8px',
  borderWidth: '2px',
  default: {
    border: '#d1d5db',
    background: '#ffffff',
    text: '#111827',
  },
  focus: {
    border: '#3b82f6',
    background: '#ffffff',
    ring: '0 0 0 3px rgba(59, 130, 246, 0.2)',
  },
  success: {
    border: '#10b981',
    background: '#ecfdf3',
    ring: '0 0 0 3px rgba(16, 185, 129, 0.2)',
  },
  error: {
    border: '#ef4444',
    background: '#fef2f2',
    ring: '0 0 0 3px rgba(239, 68, 68, 0.2)',
  },
  disabled: {
    border: '#e5e7eb',
    background: '#f9fafb',
    text: '#9ca3af',
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
