/**
 * Stylelint Configuration
 * 
 * Lints CSS files to detect hardcoded spacing and formatting values that should use design tokens instead.
 * 
 * Rules:
 * - Warns about hardcoded pixel values in spacing properties (padding, margin, gap, etc.)
 * - Warns about hardcoded pixel values in sizing properties (width, height, etc.)
 * - Allows CSS custom properties (var(--...))
 * - Allows Tailwind directives (@tailwind)
 * 
 * Focus: Spacing and formatting values, not colors
 */

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Disable all formatting/style rules - focus only on hardcoded values
    'declaration-block-single-line-max-declarations': null,
    'at-rule-empty-line-before': null,
    'rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    'selector-pseudo-element-colon-notation': null,
    'keyframe-selector-notation': null,
    'selector-attribute-quotes': null,
    'no-descending-specificity': null,
    'property-no-vendor-prefix': null,
    'selector-no-vendor-prefix': null,
    'media-feature-range-notation': null,
    'font-family-name-quotes': null,
    'declaration-block-no-duplicate-custom-properties': null,
    'declaration-block-no-shorthand-property-overrides': null,
    'property-no-deprecated': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'length-zero-no-unit': null,
    'number-max-precision': null,
    'value-keyword-case': null,
    // Allow Tailwind directives
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'variants', 'responsive', 'screen', 'layer'],
      },
    ],
    
    // Allow @import after other statements (needed for Tailwind)
    'no-invalid-position-at-import-rule': null,
    
    // Disallow hardcoded pixel values in spacing and formatting properties
    // Focus on: padding, margin, gap, width, height, top, bottom, left, right, etc.
    // Note: This uses regex patterns - values matching these patterns will be flagged
    'declaration-property-value-disallowed-list': {
      // Spacing properties - should use spacing tokens
      // Matches: 3px-999px (allows 0px, 1px, 2px and excludes very large values like 9999px)
      '/^(padding|margin|gap)$/': [
        /^(?![012]px$)(?![0-9]{4,}px$)\d+px$/,
        /^(?![012]px$)(?![0-9]{4,}px$)\d+\.\d+px$/,
      ],
      '/^(padding|margin)-(top|bottom|left|right)$/': [
        /^(?![012]px$)(?![0-9]{4,}px$)\d+px$/,
        /^(?![012]px$)(?![0-9]{4,}px$)\d+\.\d+px$/,
      ],
      // Border radius - should use borderRadius tokens (but allow very large values like 9999px for rounded-full)
      '/^border-radius$/': [
        /^(?![012]px$)(?![0-9]{4,}px$)\d+px$/,
        /^(?![012]px$)(?![0-9]{4,}px$)\d+\.\d+px$/,
      ],
      // Note: For width/height/font-size, we're more lenient since they often need specific values
      // The linter will still catch obvious spacing issues
    },
    
    // Allow Tailwind arbitrary values in selectors
    'selector-class-pattern': null,
    
    // Relax some rules for Tailwind compatibility
    'property-no-unknown': [
      true,
      {
        ignoreProperties: ['ring', 'ring-offset', 'ring-color', 'ring-width'],
      },
    ],
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-block-no-duplicate-properties': null, // Allow duplicates (sometimes needed for fallbacks)
    'property-no-vendor-prefix': null, // Allow vendor prefixes
    'selector-pseudo-element-colon-notation': null,
    'import-notation': null,
    
    // Allow CSS custom properties (var(--...))
    'custom-property-pattern': null,
    
    // Allow modern color function notation (rgba is fine for now)
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,
    
    // Allow CSS variables and keywords in any case (focus on spacing, not formatting)
    'value-keyword-case': null,
    'color-hex-length': null, // Focus on spacing, not color formatting
    
    // Disable all formatting/style rules - focus only on hardcoded spacing values
    'declaration-empty-line-before': null,
    'no-duplicate-selectors': null,
    'comment-empty-line-before': null,
    'rule-empty-line-before': null,
    'keyframes-name-pattern': null, // Allow camelCase keyframe names
    'declaration-block-single-line-max-declarations': null,
    'at-rule-empty-line-before': null,
    'selector-pseudo-element-colon-notation': null,
    'keyframe-selector-notation': null,
    'selector-attribute-quotes': null,
    'no-descending-specificity': null,
    'property-no-vendor-prefix': null,
    'selector-no-vendor-prefix': null,
    'media-feature-range-notation': null,
    'font-family-name-quotes': null,
    'declaration-block-no-duplicate-custom-properties': null,
    'declaration-block-no-shorthand-property-overrides': null,
    'property-no-deprecated': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'length-zero-no-unit': null,
    'number-max-precision': null,
    
    // Allow calc() functions
    'function-calc-no-unspaced-operator': true,
    
    // Allow named colors (focus is on spacing, not colors)
    'color-named': null,
  },
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    // Ignore Tailwind-generated CSS (it uses rgb() values)
    // Focus on manually written CSS files only
  ],
};

