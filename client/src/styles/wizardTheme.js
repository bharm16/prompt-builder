/**
 * Wizard Theme
 *
 * Centralized theme configuration for wizard components
 * Combines base tokens with wizard-specific overrides for consistency
 *
 * @module wizardTheme
 */

import tokens, { wizard, wizardTypography, wizardColors, borderRadius, shadows, transitions } from './tokens';

/**
 * Complete Wizard Theme
 * Combines base tokens with wizard-specific overrides
 */
export const wizardTheme = {
  // Spacing
  spacing: wizard,
  
  // Typography
  typography: wizardTypography,
  
  // Colors
  colors: wizardColors,
  
  // Shadows
  shadows: shadows,
  
  // Transitions
  transitions: transitions,
  
  // Border Radius
  borderRadius: borderRadius,

  // Font Family
  fontFamily: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"Roboto Mono", "SF Mono", monospace',
  },

  // Component Presets
  components: {
    progressIndicator: {
      padding: `${wizard.progress.padding.vertical} ${wizard.progress.padding.horizontal}`,
      barHeight: wizard.progress.barHeight,
      gap: wizard.progress.gap,
      marginBottom: wizard.progress.marginBottom,
    },
    
    successBanner: {
      padding: wizard.banner.padding,
      gap: wizard.banner.gap,
      iconSize: wizard.banner.iconSize,
      marginBottom: wizard.banner.marginBottom,
    },
    
    textField: {
      marginBottom: wizard.field.marginBottom,
      height: wizard.input.height,
      padding: wizard.input.padding,
      minLength: wizard.input.minLength,
      labelGap: wizard.field.labelGap,
      descriptionGap: wizard.field.descriptionGap,
      hintGap: wizard.field.hintGap,
    },
    
    button: {
      marginTop: wizard.button.marginTop,
      height: wizard.button.height,
      padding: wizard.button.padding,
    },
    
    suggestionPill: {
      height: wizard.pill.height,
      padding: wizard.pill.padding,
      gap: wizard.pill.gap,
      marginTop: wizard.pill.marginTop,
      paddingBottom: wizard.pill.paddingBottom,
    },
  },

  // Responsive functions
  getCardPadding: (breakpoint) => {
    switch (breakpoint) {
      case 'desktop': return wizard.card.paddingDesktop;
      case 'tablet': return wizard.card.paddingTablet;
      default: return wizard.card.paddingMobile;
    }
  },

  getContainerPadding: (breakpoint) => {
    const padding = wizard.container[breakpoint] || wizard.container.mobile;
    return `${padding.vertical} ${padding.horizontal}`;
  },
};

export default wizardTheme;

