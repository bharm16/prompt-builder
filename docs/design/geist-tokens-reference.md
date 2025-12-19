# Geist Design Tokens Reference

This document provides a quick reference for using Geist design tokens in the project.

## Official Tokens (Documented)

### Font
- **Package**: `geist` (installed via npm)
- **Usage**: Automatically applied via Tailwind `font-sans` and `font-mono`
- **CSS Variables**: `--font-geist-sans`, `--font-geist-mono`

### Typography Hierarchy
**📖 Full Documentation**: See [Geist Typography](./geist-typography.md) for complete typography system documentation.

Available at: `vercel.com/geist/typography`

Vercel organizes typography into four distinct categories, each with predefined styles:

**Headings** - For page and section titles (10 sizes: 72, 64, 56, 48, 40, 32, 24, 20, 16, 14)
**Buttons** - For button components (3 sizes: 16, 14, 12)
**Labels** - For single-line text elements (9 sizes including mono variants: 20, 18, 16, 14, 14-mono, 13, 13-mono, 12, 12-mono)
**Copy** - For multi-line text content (8 sizes including mono variant: 24, 20, 18, 16, 14, 13, 13-mono, 12)

Each category specifies combinations of `font-size`, `line-height`, `letter-spacing`, and `font-weight` to maintain visual harmony.

**Quick Examples:**
```tsx
<h1 className="text-heading-72">Hero Title</h1>
<button className="text-button-14">Button</button>
<label className="text-label-14">Label</label>
<p className="text-copy-16">Body text</p>
<code className="text-label-14-mono">mono code</code>
<span className="text-label-13 font-tabular">123</span>
```

**Strong Modifier:** Use `<strong>` element nested within typography classes:
```tsx
<p className="text-copy-16">Regular text <strong>Strong text</strong></p>
```

### Colors (CSS Variables)
Available at: `vercel.com/geist/colors`

**Tailwind Classes:**
```tsx
<div className="bg-geist-accents-1">     {/* Lightest background */}
<div className="bg-geist-accents-2">     {/* Borders, dividers */}
<div className="text-geist-accents-3">    {/* Placeholder text */}
<div className="text-geist-accents-5">   {/* Secondary text */}
<div className="text-geist-accents-8">   {/* Primary text */}
<div className="bg-geist-background">    {/* White */}
<div className="text-geist-foreground"> {/* Black */}
```

**CSS Variables:**
```css
background: var(--accents-1);
color: var(--geist-foreground);
```

### Shadows (3 Levels)
**Tailwind Classes:**
```tsx
<div className="shadow-geist-small">   {/* Subtle elevation */}
<div className="shadow-geist-medium">  {/* Standard elevation */}
<div className="shadow-geist-large">   {/* Strong elevation */}
```

**CSS Variables:**
```css
box-shadow: var(--shadow-small);
box-shadow: var(--shadow-medium);
box-shadow: var(--shadow-large);
```

## Unofficial Tokens (Extracted from Vercel)

These tokens are extracted from Vercel's implementation but not officially documented. They're fully functional and ready to use.

### Spacing (pt units: 1pt = 1.333px)

**Tailwind Classes:**
```tsx
{/* Padding */}
<div className="p-geist-1">    {/* ~5px */}
<div className="p-geist-2">    {/* ~11px */}
<div className="p-geist-4">    {/* ~21px - primary spacing */}
<div className="p-geist-8">    {/* ~43px */}

{/* Margin */}
<div className="m-geist-2">    {/* ~11px */}
<div className="m-geist-4">    {/* ~21px */}

{/* Gap */}
<div className="gap-geist-4">  {/* ~21px - default gap */}
<div className="gap-geist-2">  {/* ~11px */}

{/* All spacing utilities work */}
<div className="px-geist-4 py-geist-2">  {/* Horizontal ~21px, Vertical ~11px */}
<div className="space-x-geist-4">      {/* Horizontal spacing between children */}
```

**Available Spacing Values:**
- `geist-0`: 0
- `geist-1`: 4pt (~5px)
- `geist-2`: 8pt (~11px)
- `geist-3`: 12pt (~16px)
- `geist-4`: 16pt (~21px) - **Primary spacing**
- `geist-5`: 20pt (~27px)
- `geist-6`: 24pt (~32px)
- `geist-8`: 32pt (~43px)
- `geist-12`: 48pt (~64px)

**CSS Variables:**
```css
gap: var(--geist-gap);              /* 16pt (~21px) */
gap: var(--geist-gap-half);         /* 8pt (~11px) */
gap: var(--geist-gap-quarter);      /* 4pt (~5px) */
padding: var(--geist-page-margin);   /* 16pt (~21px) */
```

### Border Radius (Tight, Subtle Rounding)

**Tailwind Classes:**
```tsx
<div className="rounded-geist">     {/* 5px - primary radius */}
<div className="rounded-geist-sm">  {/* 3px */}
<div className="rounded-geist-lg">  {/* 8px */}
```

**CSS Variables:**
```css
border-radius: var(--geist-radius);  /* 5px */
```

## Complete Example

```tsx
import React from 'react';

export function GeistCard() {
  return (
    <div className="
      p-geist-4                    {/* Unofficial: ~21px padding */}
      gap-geist-4                  {/* Unofficial: ~21px gap */}
      rounded-geist                {/* Unofficial: 5px radius */}
      shadow-geist-medium          {/* Official: medium shadow */}
      bg-geist-accents-1           {/* Official: lightest background */}
      text-geist-accents-8         {/* Official: primary text */}
      border border-geist-accents-2 {/* Official: border color */}
    ">
      <h2 className="font-sans text-xl">Geist Card</h2>
      <p className="text-geist-accents-5">
        Using both official and unofficial Geist tokens
      </p>
    </div>
  );
}
```

## TypeScript Tokens

You can also import tokens programmatically:

```typescript
import { geistSpacing, geistBorderRadius, geistShadows, geistAccents } from '@/styles/tokens';

// Use in inline styles or calculations
const style = {
  padding: geistSpacing.base,        // '16pt'
  borderRadius: geistBorderRadius.base, // '5px'
  boxShadow: geistShadows.medium,     // '0 8px 30px rgba(0, 0, 0, 0.12)'
  backgroundColor: geistAccents[1],    // '#fafafa'
};
```

## Notes

- **Official tokens** are documented at `vercel.com/geist` and guaranteed to be stable
- **Unofficial tokens** are extracted from Vercel's implementation and work perfectly, but may change if Vercel updates their design system
- All tokens are fully functional and ready to use in production
- The Geist font is automatically applied via Tailwind's `font-sans` and `font-mono` classes

