# PromptStudio Layout Components

## Quick Start

```tsx
import { Box, Flex, Grid, Container, Section } from '@/components/layout';
```

## PromptStudio Spacing Tokens

All layout components support PromptStudio spacing tokens:

- `ps-quarter` - 4pt (~5px) - Tight spacing
- `ps-half` - 8pt (~11px) - Small spacing
- `ps-base` - 16pt (~21px) - Standard spacing (primary)

## Examples

### Basic Box with PromptStudio Spacing
```tsx
<Box p="ps-base" m="ps-half">
  Content with PromptStudio spacing
</Box>

<Box p="ps-quarter" gap="ps-base">
  Tight padding, standard gap
</Box>
```

### Flex Layout
```tsx
<Flex direction="row" align="center" justify="between" gap="ps-base">
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>

<Flex direction="column" gap="ps-half">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
</Flex>
```

### Grid Layout
```tsx
<Grid columns="repeat(3, 1fr)" gap="ps-base">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Grid>
```

### Container (PromptStudio Content Widths)
```tsx
<Container size="lg">
  <h1>Page Content</h1>
</Container>

<Container size="xl">
  <h1>Wider Content</h1>
</Container>
```

### Section Spacing (PromptStudio Spacing Scale)
```tsx
<Section size="sm">
  <h2>Section Title</h2>
  <p>Section content with PromptStudio spacing...</p>
</Section>

<Section spacing="ps-base">
  <h2>Custom Spacing</h2>
</Section>
```

## Spacing Reference

| Token | Value | Use Case |
|-------|-------|----------|
| `ps-quarter` | 4pt (~5px) | Tight spacing, micro adjustments |
| `ps-half` | 8pt (~11px) | Small spacing, compact layouts |
| `ps-base` | 16pt (~21px) | Standard spacing, primary gaps |

## Integration

These components work seamlessly with:
- ✅ PromptStudio spacing tokens (`ps-quarter`, `ps-half`, `ps-base`)
- ✅ PromptStudio typography classes
- ✅ PromptStudio color tokens
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
| `xs` | ps-half (8pt) | Tight spacing |
| `sm` | ps-base (16pt) | Standard spacing |
| `md` | 32pt | Medium spacing |
| `lg` | 48pt | Large spacing |
| `xl` | 64pt | Extra large spacing |


