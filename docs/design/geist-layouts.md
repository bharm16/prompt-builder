# Geist Layouts Integration

This document describes the Geist layout system integration in the design system.

## Overview

The layout components have been updated to use Geist design tokens and principles, providing a consistent layout system aligned with Vercel's Geist design language.

**Source**: [Vercel Geist Design System](https://vercel.com/geist)

## Layout Components

All layout components are located in `client/src/components/layout/`:

### Box

The most fundamental layout component. Supports Geist spacing tokens for padding and margin.

**Usage:**
```tsx
import { Box } from '@/components/layout';

// Geist spacing tokens
<Box p="geist-base" m="geist-half">
  Content with Geist spacing
</Box>

// Standard spacing (still supported)
<Box p="4" m="2">
  Content with standard spacing
</Box>
```

**Geist Spacing Tokens:**
- `geist-quarter` - 4pt (~5px) - Tight spacing
- `geist-half` - 8pt (~11px) - Small spacing
- `geist-base` - 16pt (~21px) - Standard spacing (primary)

### Flex

Organizes items along an axis using flexbox. Supports Geist gap tokens.

**Usage:**
```tsx
import { Flex } from '@/components/layout';

<Flex direction="row" align="center" justify="between" gap="geist-base">
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>

<Flex direction="column" gap="geist-half">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
</Flex>
```

### Grid

Organizes content in columns and rows. Supports Geist gap tokens.

**Usage:**
```tsx
import { Grid } from '@/components/layout';

<Grid columns="repeat(3, 1fr)" gap="geist-base">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Grid>
```

### Container

Provides consistent max-width using Geist content width standards.

**Usage:**
```tsx
import { Container } from '@/components/layout';

<Container size="lg">
  <h1>Page Content</h1>
</Container>
```

**Container Sizes:**
- `sm` - 640px - Small content
- `md` - 768px - Medium content
- `lg` - 1024px - Large content (common)
- `xl` - 1280px - Extra large
- `2xl` - 1536px - Maximum width
- `full` - 100% - Full width

### Section

Provides consistent vertical spacing using Geist spacing scale.

**Usage:**
```tsx
import { Section } from '@/components/layout';

<Section size="sm">
  <h2>Section Title</h2>
  <p>Section content...</p>
</Section>

<Section spacing="geist-base">
  <h2>Custom Spacing</h2>
</Section>
```

**Section Sizes:**
- `xs` - geist-half (8pt) - Tight spacing
- `sm` - geist-base (16pt) - Standard spacing
- `md` - 32pt - Medium spacing
- `lg` - 48pt - Large spacing
- `xl` - 64pt - Extra large spacing

## Geist Spacing Scale

Geist uses a spacing scale based on point units (pt), where 1pt = 1.333px:

| Token | Value | Pixels (approx) | Use Case |
|-------|-------|-----------------|----------|
| `geist-quarter` | 4pt | ~5px | Tight spacing, micro adjustments |
| `geist-half` | 8pt | ~11px | Small spacing, compact layouts |
| `geist-base` | 16pt | ~21px | Standard spacing, primary gaps |

## Design Principles

### 1. Consistent Spacing

Use Geist spacing tokens consistently throughout the application:

```tsx
// ✅ Good - Consistent Geist spacing
<Flex gap="geist-base">
  <Box p="geist-half">Item 1</Box>
  <Box p="geist-half">Item 2</Box>
</Flex>

// ❌ Avoid - Mixed spacing systems
<Flex gap="geist-base">
  <Box p="4">Item 1</Box>
  <Box p="geist-half">Item 2</Box>
</Flex>
```

### 2. Content Width Standards

Use Container with appropriate sizes for optimal readability:

```tsx
// ✅ Good - Appropriate container size
<Container size="lg">
  <article>
    <h1>Article Title</h1>
    <p>Content...</p>
  </article>
</Container>

// ❌ Avoid - Too wide for readability
<Container size="full">
  <article>
    <h1>Article Title</h1>
    <p>Content...</p>
  </article>
</Container>
```

### 3. Vertical Rhythm

Use Section components for consistent vertical spacing:

```tsx
// ✅ Good - Consistent section spacing
<Section size="md">
  <h2>Section 1</h2>
  <p>Content...</p>
</Section>

<Section size="md">
  <h2>Section 2</h2>
  <p>Content...</p>
</Section>
```

## Migration Guide

### From Polaris Spacing

If you're migrating from Polaris spacing tokens:

```tsx
// Before (Polaris)
<Box p="polaris-400" m="polaris-200">
  Content
</Box>

// After (Geist)
<Box p="geist-base" m="geist-half">
  Content
</Box>
```

### From Standard Spacing

If you're using standard spacing values:

```tsx
// Before
<Box p="16px" m="8px">
  Content
</Box>

// After (Geist tokens)
<Box p="geist-base" m="geist-half">
  Content
</Box>

// Or keep standard values (still supported)
<Box p="16px" m="8px">
  Content
</Box>
```

## Examples

### Page Layout

```tsx
import { Container, Section, Flex, Box } from '@/components/layout';

function PageLayout() {
  return (
    <Container size="lg">
      <Section size="md">
        <Flex direction="column" gap="geist-base">
          <Box>
            <h1>Page Title</h1>
          </Box>
          <Box>
            <p>Page content...</p>
          </Box>
        </Flex>
      </Section>
      
      <Section size="md">
        <Grid columns="repeat(3, 1fr)" gap="geist-base">
          <Box p="geist-half">Card 1</Box>
          <Box p="geist-half">Card 2</Box>
          <Box p="geist-half">Card 3</Box>
        </Grid>
      </Section>
    </Container>
  );
}
```

### Card Grid

```tsx
import { Grid, Box } from '@/components/layout';

function CardGrid() {
  return (
    <Grid columns="repeat(auto-fit, minmax(300px, 1fr))" gap="geist-base">
      <Box p="geist-base">Card 1</Box>
      <Box p="geist-base">Card 2</Box>
      <Box p="geist-base">Card 3</Box>
    </Grid>
  );
}
```

### Form Layout

```tsx
import { Flex, Box } from '@/components/layout';

function FormLayout() {
  return (
    <Flex direction="column" gap="geist-base">
      <Box>
        <label>Field 1</label>
        <input />
      </Box>
      <Box>
        <label>Field 2</label>
        <input />
      </Box>
      <Flex gap="geist-half">
        <Box>Cancel</Box>
        <Box>Submit</Box>
      </Flex>
    </Flex>
  );
}
```

## Integration with Other Systems

The Geist layout components work seamlessly with:

- ✅ **Geist Typography** - Use Geist typography classes with layout components
- ✅ **Geist Colors** - Use Geist color tokens for backgrounds and borders
- ✅ **Geist Icons** - Integrate Geist icons within layout components
- ✅ **Tailwind CSS** - All Tailwind utilities work alongside Geist layouts
- ✅ **Responsive Design** - Support for responsive props and breakpoints

## Best Practices

1. **Use Geist tokens consistently** - Prefer Geist spacing tokens over arbitrary values
2. **Maintain vertical rhythm** - Use Section components for consistent spacing between sections
3. **Choose appropriate container sizes** - Use Container sizes that match your content needs
4. **Combine with Geist typography** - Use Geist typography classes for consistent text styling
5. **Test responsive behavior** - Ensure layouts work well across all breakpoints

## References

- [Geist Design System](https://vercel.com/geist)
- [Layout Components Source](../../client/src/components/layout/)
- [Geist Design Tokens](../../client/src/styles/tokens.ts)

