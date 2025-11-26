# CSS Linting Guide

This guide explains how to configure and use linting for hardcoded spacing and formatting values in the project.

## Overview

The project uses two linting tools to detect hardcoded spacing and formatting values:

1. **Stylelint** - For CSS files (`.css`)
2. **ESLint Custom Plugin** - For inline styles in JSX/TSX files (`style={{ ... }}`)

**Focus**: Spacing and formatting values (padding, margin, gap, width, height, etc.), not colors.

## Configuration Files

- **Stylelint**: `config/lint/stylelint.config.js`
- **ESLint Plugin**: `config/lint/eslint-plugin-no-hardcoded-css.js`
- **ESLint Config**: `config/lint/eslint.config.js`

## What Gets Detected

### Stylelint (CSS Files)
- **Spacing properties**: Hardcoded pixel values in `padding`, `margin`, `gap` and their variants
- **Sizing properties**: Hardcoded pixel values in `width`, `height`, `min-width`, `max-width`, etc.
- **Position properties**: Hardcoded pixel values in `top`, `bottom`, `left`, `right`, `inset`
- **Border radius**: Hardcoded pixel values in `border-radius`
- **Font size**: Hardcoded pixel values in `font-size` (allows rem/em)
- Note: CSS custom properties (`var(--...)`), `calc()`, percentages, and viewport units are allowed

### ESLint Plugin (Inline Styles)
- **Spacing properties**: Hardcoded pixel values in `padding`, `margin`, `gap`, etc.
- **Sizing properties**: Hardcoded pixel values in `width`, `height`, `minWidth`, `maxWidth`, etc.
- **Position properties**: Hardcoded pixel values in `top`, `bottom`, `left`, `right`, `inset`
- Small values (0px, 1px, 2px) are allowed by default for borders and fine-tuning

## Usage

### Run CSS Linting
```bash
# Lint all CSS files
npm run lint:css

# Fix auto-fixable issues
npm run lint:css:fix
```

### Run ESLint (includes inline style checking)
```bash
# Lint all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Lint specific files
npm run lint -- "client/src/**/*.tsx"
```

### Run Both
```bash
npm run lint:all
```

## Examples

### ❌ Bad - Hardcoded Spacing/Formatting Values

**CSS File:**
```css
.button {
  padding: 16px;
  margin: 24px;
  gap: 12px;
  width: 200px;
  height: 48px;
  border-radius: 8px;
}
```

**Inline Styles:**
```tsx
<div style={{
  padding: '16px',
  margin: '24px',
  gap: '12px',
  width: '200px',
  height: '48px',
}} />
```

### ✅ Good - Using Design Tokens

**CSS File:**
```css
.button {
  padding: var(--spacing-md);  /* 16px */
  margin: var(--spacing-lg);    /* 24px */
  gap: var(--spacing-sm);       /* 12px */
  width: 200px;                 /* OK if specific size needed */
  height: var(--spacing-xxxl);  /* 64px */
  border-radius: var(--border-radius-md);
}
```

**Inline Styles:**
```tsx
import { spacing, borderRadius } from '@/styles/tokens';

<div style={{
  padding: spacing.md,        // 16px
  margin: spacing.lg,          // 24px
  gap: spacing.sm,             // 12px
  width: '200px',              // OK if specific size needed
  height: spacing.xxxl,        // 64px
  borderRadius: borderRadius.md,
}} />
```

Or using CSS variables:
```tsx
<div style={{
  padding: 'var(--spacing-md)',
  margin: 'var(--spacing-lg)',
  gap: 'var(--spacing-sm)',
}} />
```

### ✅ Allowed - Small Values

Small pixel values are allowed for borders and fine-tuning:
```tsx
<div style={{
  borderWidth: '1px',    // ✅ Allowed
  borderWidth: '2px',    // ✅ Allowed
  padding: '0px',        // ✅ Allowed
  margin: '1px',         // ✅ Allowed
  padding: '3px',        // ⚠️ Warning (use spacing.xxs = 4px)
}} />
```

## Design Tokens

Design tokens are available in `client/src/styles/tokens.ts`:

- **Colors**: `colors`, `primary`, `accent`, `success`, `error`, etc.
- **Spacing**: `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, etc.
- **Typography**: `typography.display`, `typography.heading`, etc.
- **Shadows**: `shadows.sm`, `shadows.md`, `shadows.lg`
- **Border Radius**: `borderRadius.sm`, `borderRadius.md`, etc.

## Allowed Exceptions

Some hardcoded values are allowed:

- **CSS Custom Properties**: `var(--...)` values are always allowed
- **Tailwind Classes**: Using Tailwind utility classes is fine (they use tokens internally)
- **Small Pixel Values**: `0px`, `1px`, and `2px` are allowed by default (common for borders and fine-tuning)
- **Relative Units**: `rem`, `em`, `%`, `vh`, `vw` are allowed
- **Calc Functions**: `calc()` expressions are allowed
- **Specific Properties**: `zIndex`, `opacity`, `borderWidth` can use hardcoded values if needed
- **Common Keywords**: `auto`, `inherit`, `initial`, `unset`, `none`, `100%` are allowed

## Configuration

### Stylelint Configuration

Edit `config/lint/stylelint.config.js` to adjust rules:

```javascript
rules: {
  // Disallow hardcoded rgb/rgba values
  'declaration-property-value-disallowed-list': {
    '/^color$/': [/^rgba?\((?!.*\/\s*var\(--tw-)/],
    '/^background(-color)?$/': [/^rgba?\((?!.*\/\s*var\(--tw-)/],
    '/^border(-color)?$/': [/^rgba?\((?!.*\/\s*var\(--tw-)/],
  },
  
  // Disallow named colors
  'color-named': 'never',
}
```

### ESLint Plugin Configuration

Edit `config/lint/eslint.config.js` to adjust the plugin options:

```javascript
'no-hardcoded-css/no-hardcoded-css': ['warn', {
  allowPixelValues: false,      // Set to true to allow all pixel values
  allowSmallValues: true,        // Allow 0px, 1px, 2px (for borders, etc.)
  allowedProperties: ['zIndex', 'opacity', 'borderWidth'], // Properties that can use hardcoded values
}],
```

## Troubleshooting

### Stylelint errors on Tailwind-generated CSS

If you see errors from generated CSS files, make sure `dist/` and `build/` are in the `ignoreFiles` array in `stylelint.config.js`.

### ESLint plugin not detecting inline styles

Make sure:
1. The plugin is imported in `eslint.config.js`
2. The rule is enabled in the rules section
3. Files are included in the `files` pattern (e.g., `**/*.{js,jsx,ts,tsx}`)

### False positives

If you need to use a hardcoded value temporarily:
1. Add a comment explaining why: `// eslint-disable-next-line no-hardcoded-css/no-hardcoded-css`
2. Or add the property to `allowedProperties` in the ESLint config

## Best Practices

1. **Always use spacing tokens** for padding, margin, and gap values
2. **Use design tokens** for border-radius, font-size, and other formatting values
3. **Use CSS custom properties** (`var(--...)`) when you need dynamic values
4. **Prefer Tailwind classes** over inline styles when possible
5. **Use relative units** (`rem`, `em`, `%`) for responsive sizing when tokens aren't appropriate
6. **Keep hardcoded pixel values minimal** - only when absolutely necessary (e.g., specific component dimensions)
7. **Document exceptions** - if you must use a hardcoded value, explain why

## Related Files

- Design Tokens: `client/src/styles/tokens.ts`
- Tailwind Config: `config/build/tailwind.config.js`
- Main CSS: `client/src/index.css`

