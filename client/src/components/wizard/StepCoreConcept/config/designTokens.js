/**
 * Design Tokens - Airbnb DLS Implementation
 *
 * Complete design token system following Airbnb Design Language System principles:
 * - All spacing on 8px grid
 * - Semantic color naming
 * - Systematic typography with Inter font
 * - Viewport-aware spacing (generous horizontal, strategic vertical)
 *
 * @module designTokens
 */

/**
 * Complete design token system following Airbnb principles
 * All spacing on 8px grid, semantic color naming, systematic typography
 */
export const tokens = {
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

/**
 * Inject global styles for placeholder, scrollbars, and animations
 * SSR-safe - only runs in browser environment
 */
export function injectGlobalStyles() {
  if (typeof document === "undefined") return;

  const styleId = "core-concept-global-styles";
  if (document.getElementById(styleId)) return; // Already injected

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
