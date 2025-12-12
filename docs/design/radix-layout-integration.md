# Radix UI Themes Layout Integration

## Overview

This project integrates Radix UI Themes layout principles without requiring the full `@radix-ui/themes` package. The layout system is built on top of Tailwind CSS and works seamlessly with our existing Polaris and Geist design tokens.

**Source:** [Radix UI Themes Layout Documentation](https://www.radix-ui.com/themes/docs/overview/layout)

## Installation

**No npm installation required!** This is a custom implementation using Tailwind CSS utilities.

## Layout Components

All components are located in `client/src/components/layout/`:

### Box

The most fundamental layout component. Used for:
- Providing spacing to child elements
- Imposing sizing constraints on content
- Controlling layout behaviour within flex and grid containers
- Hiding content based on screen size using responsive display prop

**Usage:**
```tsx
import { Box } from '@/components/layout';

<Box p="polaris-400" m="polaris-200" width="100%" backgroundColor="var(--polaris-color-bg-surface)">
  Content here
</Box>
```

**Props:**
- Padding: `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`
- Margin: `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`
- Width: `width`, `minWidth`, `maxWidth`
- Height: `height`, `minHeight`, `maxHeight`
- Positioning: `position`, `inset`, `top`, `right`, `bottom`, `left`
- Display: `display` (responsive)

### Flex

Organizes items along an axis using flexbox. Does everything Box can do, plus flex-specific props.

**Usage:**
```tsx
import { Flex } from '@/components/layout';

<Flex direction="row" align="center" justify="between" gap="polaris-200">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
</Flex>
```

**Props:**
- All Box props, plus:
- `direction`: 'row' | 'column' | 'row-reverse' | 'column-reverse'
- `align`: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
- `justify`: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
- `gap`: Spacing between flex items
- `wrap`: 'nowrap' | 'wrap' | 'wrap-reverse'
- `grow`, `shrink`, `basis`: Flex properties

### Grid

Organizes content in columns and rows using CSS Grid.

**Usage:**
```tsx
import { Grid } from '@/components/layout';

<Grid columns="repeat(3, 1fr)" gap="polaris-400" rows="auto">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Grid>
```

**Props:**
- All Box props, plus:
- `columns`: CSS grid-template-columns value (e.g., "1fr", "repeat(3, 1fr)")
- `rows`: CSS grid-template-rows value
- `gap`, `columnGap`, `rowGap`: Spacing between grid items
- `area`, `column`, `row`: Grid placement properties

### Container

Provides consistent max-width to content. Pre-defined sizes work well with common breakpoints.

**Usage:**
```tsx
import { Container } from '@/components/layout';

<Container size="xl" p="polaris-400">
  <h1>Page Title</h1>
  <p>Content here...</p>
</Container>
```

**Props:**
- All Box props, plus:
- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px (default)
  - `full`: 100%
- `maxWidth`: Custom max width (overrides size)

### Section

Provides consistent vertical spacing between larger page parts, creating hierarchy and separation.

**Usage:**
```tsx
import { Section } from '@/components/layout';

<Section size="md">
  <h2>Section Title</h2>
  <p>Section content...</p>
</Section>
```

**Props:**
- All Box props, plus:
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  - `xs`: 32px margin-bottom
  - `sm`: 48px margin-bottom
  - `md`: 64px margin-bottom (default)
  - `lg`: 96px margin-bottom
  - `xl`: 128px margin-bottom
- `spacing`: Custom spacing value (overrides size)

## Spacing Tokens

### Section Spacing

Added to Tailwind spacing scale:
- `section-xs`: 32px (2rem)
- `section-sm`: 48px (3rem)
- `section-md`: 64px (4rem)
- `section-lg`: 96px (6rem)
- `section-xl`: 128px (8rem)

**Usage in Tailwind:**
```tsx
<div className="mb-section-md">Content</div>
```

### CSS Variables

Available in CSS:
```css
--section-xs: 2rem;   /* 32px */
--section-sm: 3rem;   /* 48px */
--section-md: 4rem;   /* 64px */
--section-lg: 6rem;   /* 96px */
--section-xl: 8rem;   /* 128px */
```

## Container Configuration

Tailwind container is configured with Radix-inspired settings:

```javascript
container: {
  center: true,
  padding: {
    DEFAULT: '1rem',    // 16px
    sm: '1.5rem',      // 24px
    md: '2rem',        // 32px
    lg: '2.5rem',      // 40px
    xl: '3rem',        // 48px
  },
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1400px',
  },
}
```

## CSS Utilities

Layout utilities added to `index.css`:

### Section Utilities
- `.layout-section-xs` - 32px margin-bottom
- `.layout-section-sm` - 48px margin-bottom
- `.layout-section-md` - 64px margin-bottom
- `.layout-section-lg` - 96px margin-bottom
- `.layout-section-xl` - 128px margin-bottom

### Container Utilities
- `.layout-container` - Default max-width (1240px)
- `.layout-container-sm` - 640px max-width
- `.layout-container-md` - 768px max-width
- `.layout-container-lg` - 1024px max-width
- `.layout-container-xl` - 1280px max-width
- `.layout-container-full` - 100% max-width

## Integration with Existing Design Systems

### Polaris Spacing

All layout components support Polaris spacing tokens:

```tsx
<Box p="polaris-400" m="polaris-200">
  Content
</Box>
```

### Geist Typography

Layout components work seamlessly with Geist typography:

```tsx
<Section size="md">
  <h1 className="text-heading-32">Title</h1>
  <p className="text-copy-16">Content</p>
</Section>
```

## Responsive Props

All layout props support responsive object values:

```tsx
<Box 
  p={{ initial: 'polaris-200', md: 'polaris-400', lg: 'polaris-600' }}
  display={{ initial: 'block', md: 'flex' }}
>
  Responsive content
</Box>
```

## Examples

### Page Layout
```tsx
import { Container, Section, Flex, Box } from '@/components/layout';

function Page() {
  return (
    <Container size="xl">
      <Section size="lg">
        <h1>Page Title</h1>
      </Section>
      
      <Section size="md">
        <Flex direction="row" gap="polaris-400" align="start">
          <Box flex="1">
            <h2>Main Content</h2>
            <p>Content here...</p>
          </Box>
          <Box width="300px">
            <h3>Sidebar</h3>
            <p>Sidebar content...</p>
          </Box>
        </Flex>
      </Section>
    </Container>
  );
}
```

### Card Grid
```tsx
import { Grid, Box } from '@/components/layout';

<Grid columns="repeat(auto-fit, minmax(300px, 1fr))" gap="polaris-400">
  {items.map(item => (
    <Box key={item.id} p="polaris-400" className="card">
      {item.content}
    </Box>
  ))}
</Grid>
```

### Responsive Layout
```tsx
import { Flex, Box } from '@/components/layout';

<Flex 
  direction={{ initial: 'column', md: 'row' }}
  gap={{ initial: 'polaris-200', md: 'polaris-400' }}
  align={{ initial: 'stretch', md: 'start' }}
>
  <Box flex={{ md: '1' }}>Main</Box>
  <Box flex={{ md: '0 0 300px' }}>Sidebar</Box>
</Flex>
```

## Migration Guide

### Replacing divs with Box

**Before:**
```tsx
<div className="p-4 m-2">Content</div>
```

**After:**
```tsx
<Box p="polaris-400" m="polaris-200">Content</Box>
```

### Replacing flex containers

**Before:**
```tsx
<div className="flex items-center justify-between gap-2">Content</div>
```

**After:**
```tsx
<Flex align="center" justify="between" gap="polaris-200">Content</Flex>
```

### Replacing grid containers

**Before:**
```tsx
<div className="grid grid-cols-3 gap-4">Content</div>
```

**After:**
```tsx
<Grid columns="repeat(3, 1fr)" gap="polaris-400">Content</Grid>
```

## Benefits

1. **Separation of Concerns**: Layout logic separated from content
2. **Consistency**: Pre-defined spacing and sizing scales
3. **Type Safety**: Full TypeScript support
4. **Responsive**: Built-in responsive prop support
5. **Composable**: Works with existing Tailwind classes
6. **No Dependencies**: Pure Tailwind implementation
7. **Design System Integration**: Works with Polaris and Geist tokens

## References

- [Radix UI Themes Layout Docs](https://www.radix-ui.com/themes/docs/overview/layout)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Polaris Design System](./geist-tokens-reference.md)
- [Geist Typography](./geist-typography-migration-guide.md)






