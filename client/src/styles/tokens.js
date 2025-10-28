/**
 * Design Tokens
 *
 * Based on Airbnb's Design Language System (DLS) principles:
 * - 8px base unit grid system
 * - Systematic spacing, typography, and color scales
 * - Semantic token naming for maintainability
 * - Component-specific presets for consistency
 *
 * @module tokens
 */

// ============================================================================
// SPACING TOKENS (8px Grid System)
// ============================================================================

export const spacing = {
  xxs: '4px',    // Half unit - micro adjustments
  xs: '8px',     // Base unit - tight spacing
  sm: '12px',    // 1.5x base - input vertical padding
  md: '16px',    // 2x base - standard padding, input horizontal
  lg: '24px',    // 3x base - component gaps (most common)
  xl: '32px',    // 4x base - section spacing
  xxl: '48px',   // 6x base - major divisions
  xxxl: '64px',  // 8x base - hero sections
};

// Numeric values for calculations (in px)
export const spacingScale = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const typography = {
  // Display - Hero sections
  display: {
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },

  // H1 - Page titles
  h1: {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },

  // H2 - Section headers
  h2: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },

  // H3 - Subsection headers
  h3: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 600,
    letterSpacing: '-0.005em',
  },

  // H4 - Component headers
  h4: {
    fontSize: '18px',
    lineHeight: '24px',
    fontWeight: 600,
    letterSpacing: '0',
  },

  // Body - Standard content
  body: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
    letterSpacing: '0',
  },

  // Body Small - Secondary content
  bodySmall: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 600,
    letterSpacing: '0',
  },

  // Caption - Hints, supporting text
  caption: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 400,
    letterSpacing: '0.01em',
  },

  // Overline - Labels, tags
  overline: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
};

// ============================================================================
// COLOR TOKENS
// ============================================================================

// Primary Brand Color (Rausch Pink - Airbnb inspired)
export const primary = {
  50: '#FFF5F7',
  100: '#FFE3EA',
  200: '#FFC0CC',
  300: '#FF98AF',
  400: '#FF6D8C',
  500: '#FF385C',  // Main Rausch pink
  600: '#E03252',
  700: '#C12745',
  800: '#971E36',
  900: '#711628',
};

// Accent alias for clarity in wizard context
export const accent = primary;

// Success States
export const success = {
  50: '#F0FDF4',
  100: '#DCFCE7',
  200: '#BBF7D0',
  300: '#86EFAC',
  400: '#4ADE80',
  500: '#22C55E',
  600: '#16A34A',  // Main success color
  700: '#15803D',
  800: '#166534',
  900: '#14532D',
};

// Error States
export const error = {
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  300: '#FCA5A5',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',  // Main error color
  700: '#B91C1C',
  800: '#991B1B',
  900: '#7F1D1D',
};

// Warning States
export const warning = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',  // Main warning color
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
};

// Info States
export const info = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',  // Main info color
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
};

// Grayscale - Text and UI elements
export const gray = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',  // Tertiary text
  600: '#4B5563',  // Secondary text
  700: '#374151',
  800: '#1F2937',
  900: '#111827',  // Primary text
};

// Semantic Color Mappings
export const colors = {
  // Text
  text: {
    primary: gray[900],
    secondary: gray[600],
    tertiary: gray[500],
    disabled: gray[400],
    inverse: '#FFFFFF',
  },

  // Backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: gray[50],
    tertiary: gray[100],
    inverse: gray[900],
  },

  // Borders
  border: {
    default: gray[300],
    hover: gray[400],
    focus: primary[600],
    error: error[600],
    success: success[600],
  },

  // Interactive States
  interactive: {
    primary: primary[600],
    primaryHover: primary[700],
    primaryActive: primary[800],
    primaryDisabled: gray[300],
  },

  // Feedback
  feedback: {
    success: success[600],
    successBg: success[50],
    successBorder: success[500],
    error: error[600],
    errorBg: error[50],
    errorBorder: error[500],
    warning: warning[600],
    warningBg: warning[50],
    warningBorder: warning[500],
    info: info[600],
    infoBg: info[50],
    infoBorder: info[200],
  },
};

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',    // Standard input/button radius
  lg: '12px',   // Card radius
  xl: '16px',   // Large card radius
  xxl: '24px',  // Hero card radius
  full: '9999px', // Pills, avatars
};

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',

  // Focus rings
  focusRing: `0 0 0 4px ${primary[100]}`,
  focusRingError: `0 0 0 4px ${error[100]}`,
  focusRingSuccess: `0 0 0 4px ${success[100]}`,
};

// ============================================================================
// TRANSITION TOKENS
// ============================================================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};

export const transitionProperties = {
  all: 'all',
  colors: 'color, background-color, border-color',
  transform: 'transform',
  opacity: 'opacity',
  shadow: 'box-shadow',
};

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
};

// ============================================================================
// BREAKPOINTS (Responsive)
// ============================================================================

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px',
};

// Media query helpers
export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  xxl: `@media (min-width: ${breakpoints.xxl})`,
};

// ============================================================================
// COMPONENT-SPECIFIC PRESETS
// ============================================================================

// Input Component Preset
export const inputPreset = {
  padding: {
    vertical: spacing.sm,    // 12px
    horizontal: spacing.md,  // 16px
  },
  fontSize: typography.body.fontSize,
  lineHeight: typography.body.lineHeight,
  borderWidth: '2px',
  borderRadius: borderRadius.md,
  transition: transitions.base,

  // State colors
  default: {
    border: colors.border.default,
    background: colors.background.primary,
    text: colors.text.primary,
  },
  focus: {
    border: colors.border.focus,
    background: colors.background.primary,
    ring: shadows.focusRing,
  },
  error: {
    border: colors.border.error,
    background: colors.feedback.errorBg,
    ring: shadows.focusRingError,
  },
  success: {
    border: colors.border.success,
    background: colors.feedback.successBg,
    ring: shadows.focusRingSuccess,
  },
  disabled: {
    border: colors.border.default,
    background: colors.background.tertiary,
    text: colors.text.disabled,
  },
};

// Button Component Preset
export const buttonPreset = {
  padding: {
    vertical: spacing.sm,    // 12px
    horizontal: spacing.lg,  // 24px
  },
  fontSize: typography.body.fontSize,
  fontWeight: typography.h4.fontWeight,
  borderRadius: borderRadius.md,
  transition: transitions.base,
  minHeight: '44px', // Accessibility - minimum touch target

  // Variants
  primary: {
    background: colors.interactive.primary,
    backgroundHover: colors.interactive.primaryHover,
    backgroundActive: colors.interactive.primaryActive,
    text: colors.text.inverse,
  },
  secondary: {
    background: 'transparent',
    backgroundHover: gray[100],
    border: colors.border.default,
    text: colors.text.primary,
  },
  disabled: {
    background: colors.interactive.primaryDisabled,
    text: colors.text.disabled,
  },
};

// Form Field Component Preset
export const formFieldPreset = {
  spacing: {
    labelToInput: spacing.xs,      // 8px
    inputToHint: spacing.xs,        // 8px
    inputToError: spacing.xs,       // 8px
    fieldToField: spacing.lg,       // 24px
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.bodySmall.fontWeight,
    color: colors.text.secondary,
  },
  hint: {
    fontSize: typography.caption.fontSize,
    color: colors.text.tertiary,
  },
  error: {
    fontSize: typography.caption.fontSize,
    color: colors.feedback.error,
  },
  icon: {
    size: spacing.md, // 16px x 16px
  },
};

// Card Component Preset
export const cardPreset = {
  padding: spacing.lg,           // 24px
  borderRadius: borderRadius.lg, // 12px
  shadow: shadows.md,
  border: `1px solid ${colors.border.default}`,
  background: colors.background.primary,
};

// Page Layout Preset
export const layoutPreset = {
  maxWidth: '1280px',
  padding: {
    mobile: spacing.md,   // 16px
    tablet: spacing.lg,   // 24px
    desktop: spacing.xl,  // 32px
  },
  section: {
    spacing: spacing.xxl,  // 48px between sections
  },
  header: {
    height: spacing.xxxl,  // 64px
  },
};

// ============================================================================
// ICON SIZES
// ============================================================================

export const iconSizes = {
  xs: '12px',
  sm: '16px',  // Standard inline icon
  md: '20px',
  lg: '24px',  // Header icon
  xl: '32px',
  xxl: '48px',
};

// ============================================================================
// ACCESSIBILITY CONSTANTS
// ============================================================================

export const a11y = {
  minTouchTarget: '44px',
  minContrastRatio: 4.5,  // WCAG AA
  focusRingWidth: '4px',
  focusRingColor: primary[100],
};

// ============================================================================
// WIZARD-SPECIFIC TOKENS
// ============================================================================

export const wizard = {
  // Field Spacing (optimized for viewport fit)
  field: {
    marginBottom: spacing.md,        // 16px between fields
    labelGap: spacing.xs,            // 8px label to input
    descriptionGap: '6px',           // 6px input to description (tighter)
    hintGap: spacing.xs,             // 8px input to hint/error
  },

  // Progress Indicator
  progress: {
    padding: {
      vertical: '10px',
      horizontal: '12px',
    },
    barHeight: '4px',
    gap: '6px',
    marginBottom: spacing.md,        // 16px
  },

  // Success Banner
  banner: {
    padding: '12px',
    gap: '10px',
    iconSize: '18px',
    marginBottom: spacing.md,        // 16px
  },

  // Card Padding (responsive)
  card: {
    paddingMobile: spacing.lg,       // 24px
    paddingTablet: '28px',
    paddingDesktop: spacing.xl,      // 32px
  },

  // Container Padding (responsive)
  container: {
    mobile: {
      vertical: spacing.xl,          // 32px
      horizontal: spacing.lg,        // 24px
    },
    tablet: {
      vertical: spacing.xxl,         // 48px
      horizontal: spacing.xl,        // 32px
    },
    desktop: {
      vertical: spacing.xxl,         // 48px
      horizontal: '40px',
    },
  },

  // Input Field Specific
  input: {
    height: '52px',
    padding: {
      vertical: '14px',
      horizontal: '20px',
    },
    minLength: 3,
    showCharCount: true,
  },

  // Button Spacing
  button: {
    marginTop: spacing.xl,           // 32px
    height: '52px',
    padding: {
      vertical: '14px',
      horizontal: spacing.xl,        // 32px
    },
  },

  // Suggestion Pills
  pill: {
    height: '32px',
    padding: {
      vertical: spacing.xs,          // 8px
      horizontal: spacing.md,        // 16px
    },
    gap: spacing.xs,                 // 8px between pills
    marginTop: spacing.md,           // 16px from input
    paddingBottom: '12px',           // for scrollbar
  },
};

// Wizard-specific typography
export const wizardTypography = {
  // Page Heading (42px)
  heading: {
    fontSize: '42px',
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },

  // Subheading (18px)
  subheading: {
    fontSize: '18px',
    lineHeight: 1.5,
    fontWeight: 400,
    letterSpacing: '0',
  },

  // Field Label (15px)
  label: {
    fontSize: '15px',
    lineHeight: 1.4,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },

  // Input Text (17px)
  input: {
    fontSize: '17px',
    lineHeight: 1.5,
    fontWeight: 400,
    letterSpacing: '-0.01em',
  },

  // Hint/Description (14px)
  hint: {
    fontSize: '14px',
    lineHeight: 1.3,
    fontWeight: 400,
    letterSpacing: '0',
  },

  // Pill Text (14px)
  pill: {
    fontSize: '14px',
    lineHeight: 1,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },

  // Button Text (17px)
  button: {
    fontSize: '17px',
    lineHeight: 1.3,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },

  // Character Count (13px)
  caption: {
    fontSize: '13px',
    lineHeight: 1,
    fontWeight: 500,
    letterSpacing: '0',
  },
};

// Wizard color variations
export const wizardColors = {
  // Accent (Rausch pink)
  accent: {
    base: primary[500],              // #FF385C
    hover: primary[600],             // #E03252
    light: 'rgba(255, 56, 92, 0.1)',
    lighter: 'rgba(255, 56, 92, 0.2)',
    lightest: 'rgba(255, 56, 92, 0.3)',
  },

  // Neutral (updated for new gray scale)
  neutral: {
    50: '#FFFFFF',
    100: '#F7F7F7',
    200: '#EFEFEF',
    300: '#E3E3E3',
    400: '#CFCFCF',
    500: '#B9B9B9',
    600: '#989898',
    700: '#787878',
    800: '#575757',
    900: '#373737',
  },

  // Success (teal-based)
  success: {
    base: '#00B88F',
    light: '#E8FFF8',
  },

  // Error (rosé)
  error: {
    base: '#F44366',
    light: '#FFF2F4',
  },

  // Page background
  background: {
    page: 'linear-gradient(to bottom right, #FAFAFA, #F7F7F7)',
    card: '#FFFFFF',
  },
};

// ============================================================================
// EXPORT DEFAULT TOKENS OBJECT
// ============================================================================

export default {
  spacing,
  spacingScale,
  typography,
  colors,
  primary,
  accent,
  success,
  error,
  warning,
  info,
  gray,
  borderRadius,
  shadows,
  transitions,
  transitionProperties,
  zIndex,
  breakpoints,
  mediaQueries,
  inputPreset,
  buttonPreset,
  formFieldPreset,
  cardPreset,
  layoutPreset,
  iconSizes,
  a11y,
  wizard,
  wizardTypography,
  wizardColors,
};
