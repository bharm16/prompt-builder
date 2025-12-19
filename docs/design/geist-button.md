# Geist Button Component

Implementation of the Vercel Geist button design system.

**Source**: [vercel.com/geist/button](https://vercel.com/geist/button)

## Usage

```tsx
import { Button, ButtonLink } from '@/components/Button';
```

## Basic Examples

### Primary Button (Default)

```tsx
<Button>Upload</Button>
```

### Secondary Button

```tsx
<Button variant="secondary">Cancel</Button>
```

### Tertiary Button

```tsx
<Button variant="tertiary">Learn More</Button>
```

### Ghost Button

```tsx
<Button variant="ghost">Skip</Button>
```

## Sizes

The default size is `medium`.

```tsx
<Button size="small">Small</Button>
<Button size="medium">Medium</Button>
<Button size="large">Large</Button>
```

## Shapes

### Default Shape

```tsx
<Button>Default</Button>
```

### Rounded Shape

```tsx
<Button shape="rounded">Rounded</Button>
```

## Icon Support

### Prefix Icon

```tsx
import { Upload } from 'lucide-react';

<Button prefix={<Upload className="h-4 w-4" />}>
  Upload
</Button>
```

### Suffix Icon

```tsx
import { ArrowRight } from 'lucide-react';

<Button suffix={<ArrowRight className="h-4 w-4" />}>
  Continue
</Button>
```

### Icon-Only Button

Icon-only buttons require an `aria-label` for accessibility:

```tsx
<Button
  svgOnly
  aria-label="Upload file"
  prefix={<Upload className="h-4 w-4" />}
/>
```

## States

### Loading State

```tsx
<Button loading>Uploading...</Button>
```

### Disabled State

```tsx
<Button disabled>Disabled</Button>
```

## Link Variant

Use `ButtonLink` for links that should look like buttons:

```tsx
<ButtonLink href="/signup">Sign Up</ButtonLink>
```

## Props

### Button Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary' \| 'ghost'` | `'primary'` | Button variant style |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Button size |
| `shape` | `'default' \| 'rounded'` | `'default'` | Button shape |
| `loading` | `boolean` | `false` | Show loading state |
| `svgOnly` | `boolean` | `false` | Icon-only button (requires aria-label) |
| `prefix` | `ReactNode` | - | Prefix icon (before text) |
| `suffix` | `ReactNode` | - | Suffix icon (after text) |
| `disabled` | `boolean` | `false` | Disable button |
| `children` | `ReactNode` | - | Button content |

### ButtonLink Props

Same as `Button` props, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | `string` | - | Link URL (required) |
| `target` | `string` | - | Link target |
| `rel` | `string` | - | Link rel attribute |

## Typography

Buttons use Geist typography classes:

- **Small**: `text-button-12` (12px)
- **Medium**: `text-button-14` (14px) - default
- **Large**: `text-button-16` (16px)

## Complete Example

```tsx
import { Button, ButtonLink } from '@/components/Button';
import { Upload, ArrowRight, Check } from 'lucide-react';

export function ButtonExamples() {
  return (
    <div className="space-y-4">
      {/* Sizes */}
      <div className="flex gap-2 items-center">
        <Button size="small">Small</Button>
        <Button size="medium">Medium</Button>
        <Button size="large">Large</Button>
      </div>

      {/* Variants */}
      <div className="flex gap-2 items-center">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      {/* With Icons */}
      <div className="flex gap-2 items-center">
        <Button prefix={<Upload className="h-4 w-4" />}>
          Upload
        </Button>
        <Button suffix={<ArrowRight className="h-4 w-4" />}>
          Continue
        </Button>
        <Button
          svgOnly
          aria-label="Upload"
          prefix={<Upload className="h-4 w-4" />}
        />
      </div>

      {/* States */}
      <div className="flex gap-2 items-center">
        <Button loading>Loading...</Button>
        <Button disabled>Disabled</Button>
      </div>

      {/* Rounded */}
      <div className="flex gap-2 items-center">
        <Button shape="rounded">Rounded</Button>
        <Button shape="rounded" variant="secondary">
          Rounded Secondary
        </Button>
      </div>

      {/* Link */}
      <ButtonLink href="/signup">Sign Up</ButtonLink>
    </div>
  );
}
```

## Implementation Details

- Uses Geist typography classes (`text-button-12`, `text-button-14`, `text-button-16`)
- Uses Geist spacing tokens (`geist-2`, `geist-3`, `geist-4`, `geist-6`)
- Uses Geist colors (`geist-foreground`, `geist-background`, `geist-accents-*`)
- Uses Geist border radius (`rounded-geist`, `rounded-full`)
- Fully accessible with proper ARIA attributes
- Supports keyboard navigation
- Loading state shows spinner and disables interaction
- Icon-only buttons require `aria-label` for accessibility

## Notes

- The default size is `medium` (matching Geist design system)
- Icon-only buttons automatically adjust padding
- Loading state shows a spinner and prevents interaction
- All buttons have proper focus states for accessibility
- ButtonLink automatically adds `rel="noopener noreferrer"` when `target="_blank"`

