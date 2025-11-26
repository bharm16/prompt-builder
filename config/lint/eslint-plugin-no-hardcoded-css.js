/**
 * ESLint Plugin: No Hardcoded CSS Values
 * 
 * Detects hardcoded spacing and formatting values in inline styles (style={{ ... }}) that should
 * use design tokens instead.
 * 
 * Focus: Spacing and formatting properties
 * Detects:
 * - Hardcoded pixel values in spacing properties (padding, margin, gap, etc.)
 * - Hardcoded pixel values in sizing properties (width, height, etc.)
 * - Hardcoded pixel values in positioning properties (top, bottom, left, right, etc.)
 */

export default {
  rules: {
    'no-hardcoded-css': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded CSS values in inline styles',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          hardcodedSpacingValue: 'Hardcoded spacing value "{{value}}" in {{property}} detected. Use spacing tokens from client/src/styles/tokens.ts (e.g., spacing.md, spacing.lg) or CSS variables instead.',
          hardcodedSizingValue: 'Hardcoded sizing value "{{value}}" in {{property}} detected. Consider using design tokens or relative units (rem, em, %) instead.',
          hardcodedPositionValue: 'Hardcoded position value "{{value}}" in {{property}} detected. Consider using spacing tokens or CSS variables instead.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              allowPixelValues: {
                type: 'boolean',
                default: false,
              },
              allowedProperties: {
                type: 'array',
                items: {
                  type: 'string',
                },
                default: [],
              },
              // Properties that commonly need hardcoded values
              allowSmallValues: {
                type: 'boolean',
                default: true, // Allow 0px, 1px, 2px for borders, etc.
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
    const options = context.options[0] || {};
    const {
      allowPixelValues = false,
      allowedProperties = [],
      allowSmallValues = true,
    } = options;

    // Spacing properties that should use spacing tokens
    const spacingProperties = [
      'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
      'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
      'gap', 'rowGap', 'columnGap',
    ];

    // Sizing properties
    const sizingProperties = [
      'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    ];

    // Position properties
    const positionProperties = [
      'top', 'bottom', 'left', 'right', 'inset',
    ];

    /**
     * Check if a string value contains hardcoded spacing/formatting values
     */
    function checkStringValue(value, node, propertyName) {
      if (typeof value !== 'string') return;

      // Skip if property is in allowed list
      if (allowedProperties.includes(propertyName)) return;

      // Skip CSS variables and calc()
      if (/^var\(|^calc\(/.test(value.trim())) return;

      // Check for pixel values
      const pxMatch = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
      if (!pxMatch) return; // Not a pixel value, skip

      const pixelValue = parseFloat(pxMatch[1]);

      // Allow small values if configured (0px, 1px, 2px for borders, etc.)
      if (allowSmallValues && pixelValue <= 2) return;

      // Skip if pixel values are allowed globally
      if (allowPixelValues) return;

      // Check spacing properties
      if (spacingProperties.includes(propertyName)) {
        context.report({
          node,
          messageId: 'hardcodedSpacingValue',
          data: { value: value.trim(), property: propertyName },
        });
        return;
      }

      // Check sizing properties
      if (sizingProperties.includes(propertyName)) {
        context.report({
          node,
          messageId: 'hardcodedSizingValue',
          data: { value: value.trim(), property: propertyName },
        });
        return;
      }

      // Check position properties
      if (positionProperties.includes(propertyName)) {
        context.report({
          node,
          messageId: 'hardcodedPositionValue',
          data: { value: value.trim(), property: propertyName },
        });
        return;
      }
    }

    /**
     * Traverse object expression (style={{ ... }})
     */
    function checkStyleObject(node) {
      if (!node.properties) return;

      node.properties.forEach((prop) => {
        if (prop.type === 'Property' || prop.type === 'ObjectProperty') {
          const key = prop.key;
          const value = prop.value;

          const propertyName = key.name || key.value;

          // Check string literal values
          if (value.type === 'Literal' && typeof value.value === 'string') {
            checkStringValue(value.value, value, propertyName);
          }

          // Check template literals
          if (value.type === 'TemplateLiteral') {
            // Check if template literal contains hardcoded values
            value.quasis.forEach((quasi) => {
              if (quasi.value && quasi.value.raw) {
                checkStringValue(quasi.value.raw, quasi, propertyName);
              }
            });
          }
        }
      });
    }

    return {
      JSXAttribute(node) {
        // Check style={{ ... }} attributes
        if (node.name.name === 'style' && node.value && node.value.expression) {
          const expression = node.value.expression;

          // Handle style={{ ... }}
          if (expression.type === 'ObjectExpression') {
            checkStyleObject(expression);
          }

          // Handle style={someVariable} where variable is an object
          // Note: This is harder to detect statically, so we focus on inline objects
        }
      },
    };
      },
    },
  },
};

