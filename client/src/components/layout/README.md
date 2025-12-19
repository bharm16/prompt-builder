# Geist Layout Components

## Quick Start

```tsx
import { Box, Flex, Grid, Container, Section } from '@/components/layout';
```

## Geist Spacing Tokens

All layout components support Geist spacing tokens:

- `geist-quarter` - 4pt (~5px) - Tight spacing
- `geist-half` - 8pt (~11px) - Small spacing
- `geist-base` - 16pt (~21px) - Standard spacing (primary)

## Examples

### Basic Box with Geist Spacing
```tsx
<Box p="geist-base" m="geist-half">
  Content with Geist spacing
</Box>

<Box p="geist-quarter" gap="geist-base">
  Tight padding, standard gap
</Box>
```

### Flex Layout
```tsx
<Flex direction="row" align="center" justify="between" gap="geist-base">
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>

<Flex direction="column" gap="geist-half">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
</Flex>
```

### Grid Layout
```tsx
<Grid columns="repeat(3, 1fr)" gap="geist-base">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Grid>
```

### Container (Geist Content Widths)
```tsx
<Container size="lg">
  <h1>Page Content</h1>
</Container>

<Container size="xl">
  <h1>Wider Content</h1>
</Container>
```

### Section Spacing (Geist Spacing Scale)
```tsx
<Section size="sm">
  <h2>Section Title</h2>
  <p>Section content with Geist spacing...</p>
</Section>

<Section spacing="geist-base">
  <h2>Custom Spacing</h2>
</Section>
```

## Spacing Reference

| Token | Value | Use Case |
|-------|-------|----------|
| `geist-quarter` | 4pt (~5px) | Tight spacing, micro adjustments |
| `geist-half` | 8pt (~11px) | Small spacing, compact layouts |
| `geist-base` | 16pt (~21px) | Standard spacing, primary gaps |

## Integration

These components work seamlessly with:
- ✅ Geist spacing tokens (`geist-quarter`, `geist-half`, `geist-base`)
- ✅ Geist typography classes
- ✅ Geist color tokens
- ✅ Tailwind CSS utilities
- ✅ Responsive props

## Container Sizes

| Size | Max Width | Use Case |
|------|-----------|----------|
| `sm` | 640px | Small content |
| `md` | 768px | Medium content |
| `lg` | 1024px | Large content (common) |
| `xl` | 1280px | Extra large |
| `2xl` | 1536px | Maximum width |
| `full` | 100% | Full width |

## Section Sizes

| Size | Spacing | Use Case |
|------|---------|----------|
| `xs` | geist-half (8pt) | Tight spacing |
| `sm` | geist-base (16pt) | Standard spacing |
| `md` | 32pt | Medium spacing |
| `lg` | 48pt | Large spacing |
| `xl` | 64pt | Extra large spacing |

See [Geist Design System](https://vercel.com/geist) for more information.

