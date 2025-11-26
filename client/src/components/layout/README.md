# Radix UI Themes Layout Components

## Quick Start

```tsx
import { Box, Flex, Grid, Container, Section } from '@/components/layout';
```

## Examples

### Basic Box
```tsx
<Box p="polaris-400" m="polaris-200">
  Content with Polaris spacing
</Box>
```

### Flex Layout
```tsx
<Flex direction="row" align="center" justify="between" gap="polaris-200">
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>
```

### Grid Layout
```tsx
<Grid columns="repeat(3, 1fr)" gap="polaris-400">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Grid>
```

### Container
```tsx
<Container size="xl">
  <h1>Page Content</h1>
</Container>
```

### Section Spacing
```tsx
<Section size="md">
  <h2>Section Title</h2>
  <p>Section content...</p>
</Section>
```

## Integration

These components work seamlessly with:
- ✅ Polaris spacing tokens (`polaris-400`, etc.)
- ✅ Geist typography classes
- ✅ Tailwind CSS utilities
- ✅ Responsive props

See [Radix Layout Integration Guide](../../../docs/design/radix-layout-integration.md) for full documentation.

