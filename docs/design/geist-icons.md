# Geist Icons Integration

This document describes the Geist icons integration in the design system.

## Overview

The design system now uses [Geist icons](https://vercel.com/geist/icons) from Vercel's design system via the `@geist-ui/icons` package. This provides a consistent icon set aligned with modern design principles.

## Installation

Geist icons are installed via npm:

```bash
npm install @geist-ui/icons
```

## Usage

### Direct Import

Import icons directly from `@geist-ui/icons`:

```tsx
import { User, Video, Settings, Zap } from '@geist-ui/icons';

function MyComponent() {
  return (
    <div>
      <User size={24} color="#5B5BD6" />
      <Video size={20} />
      <Settings size={16} />
    </div>
  );
}
```

### Icon Component Wrapper

Use the reusable `Icon` component for consistent styling:

```tsx
import { Icon } from '@/components/icons';

function MyComponent() {
  return (
    <div>
      <Icon name="User" size="lg" color="#5B5BD6" />
      <Icon name="Video" size="md" />
      <Icon name="Settings" size="sm" />
    </div>
  );
}
```

## Icon Props

Geist icons accept the following props:

- `size` (number): Icon size in pixels (default: 24)
- `color` (string): Icon color (default: "currentColor")
- `className` (string): Additional CSS classes
- `style` (object): Inline styles
- `aria-label` (string): Accessibility label
- `aria-hidden` (boolean): Hide from screen readers

## Icon Sizes

The design system defines standard icon sizes in `client/src/styles/tokens.ts`:

```typescript
export const iconSizes = {
  xs: '12px',  // Extra small
  sm: '16px',  // Small (standard inline)
  md: '20px',  // Medium
  lg: '24px',  // Large (header icon)
  xl: '32px',  // Extra large
  xxl: '48px', // Extra extra large
} as const;
```

## Migration from Lucide React

The codebase previously used `lucide-react` icons. Migration has been completed with the following mappings:

| Lucide Icon | Geist Icon | Notes |
|------------|------------|-------|
| `User` | `User` | Direct match |
| `Video` | `Video` | Direct match |
| `Settings` | `Settings` | Direct match |
| `Zap` | `Zap` | Direct match |
| `Ruler` | `Divider` | Alternative |
| `TreePine` | `Layers` | Alternative |
| `Lightbulb` | `Zap` | Alternative |
| `Sparkles` | `Star` | Alternative |
| `ChevronDown` | `ChevronDown` | Direct match |
| `ChevronRight` | `ChevronRight` | Direct match |

### Icon Mapping Utility

An icon mapping utility is available at `client/src/components/icons/iconMapping.ts` for reference:

```typescript
import { getGeistIcon, hasGeistIcon } from '@/components/icons';

// Check if a Geist equivalent exists
if (hasGeistIcon('User')) {
  const Icon = getGeistIcon('User');
  // Use Icon component
}
```

## Available Icons

Geist icons provides a comprehensive set of icons. Common icons used in the codebase include:

- **Navigation**: `ChevronDown`, `ChevronRight`, `ChevronLeft`, `ChevronUp`, `ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown`
- **UI Elements**: `Check`, `X`, `Plus`, `Minus`, `Search`, `Filter`, `Menu`, `MoreHorizontal`, `MoreVertical`
- **Media**: `Video`, `Film`, `Image`, `Camera`, `Mic`, `Volume2`
- **Content**: `File`, `FileText`, `Folder`, `Code`, `Terminal`
- **Status**: `CheckCircle`, `XCircle`, `AlertCircle`, `Info`, `Warning`
- **Actions**: `Edit`, `Trash`, `Copy`, `Download`, `Upload`, `Share`, `Save`
- **Users**: `User`, `Users`, `UserPlus`, `UserMinus`
- **Settings**: `Settings`, `Gear`
- **Other**: `Home`, `Star`, `Heart`, `Bookmark`, `Clock`, `Bell`, `Mail`, `Lock`, `Globe`

For a complete list, see the [Geist Icons documentation](https://vercel.com/geist/icons).

## Best Practices

### 1. Use Consistent Sizing

Always use the standard icon sizes from the design system:

```tsx
// ✅ Good
<User size={16} />
<Video size={24} />

// ❌ Avoid
<User size={17} />
<Video size={23} />
```

###2. Provide Accessibility Labels

Always include `aria-label` for icon-only buttons:

```tsx
// ✅ Good
<button aria-label="Close">
  <X size={16} aria-hidden="true" />
</button>

// ❌ Avoid
<button>
  <X size={16} />
</button>
```

### 3. Use Semantic Colors

Use design system colors for icons:

```tsx
// ✅ Good
<CheckCircle size={16} color="#10b981" /> // Success green
<AlertCircle size={16} color="#f59e0b" /> // Warning amber
<XCircle size={16} color="#dc2626" />     // Error red

// ❌ Avoid
<CheckCircle size={16} color="#00ff00" />
```

### 4. Maintain Visual Hierarchy

Use larger icons for primary actions and smaller icons for secondary actions:

```tsx
// Primary action
<button>
  <Save size={24} />
  Save
</button>

// Secondary action
<button>
  <Edit size={16} />
  Edit
</button>
```

## Component Examples

### Icon Button

```tsx
import { Settings } from '@geist-ui/icons';

function SettingsButton() {
  return (
    <button
      className="p-2 rounded-lg hover:bg-neutral-100"
      aria-label="Open settings"
    >
      <Settings size={20} aria-hidden="true" />
    </button>
  );
}
```

### Icon with Text

```tsx
import { User } from '@geist-ui/icons';

function UserProfile() {
  return (
    <div className="flex items-center gap-2">
      <User size={20} color="#5B5BD6" />
      <span>John Doe</span>
    </div>
  );
}
```

### Status Icon

```tsx
import { CheckCircle, AlertCircle, Info } from '@geist-ui/icons';

function StatusIndicator({ status }: { status: 'success' | 'warning' | 'info' }) {
  const icons = {
    success: <CheckCircle size={16} color="#10b981" />,
    warning: <AlertCircle size={16} color="#f59e0b" />,
    info: <Info size={16} color="#3b82f6" />,
  };
  
  return icons[status];
}
```

## File Structure

```
client/src/components/icons/
├── Icon.tsx              # Reusable Icon component wrapper
├── iconMapping.ts        # Lucide to Geist icon mapping utility
└── index.ts              # Public exports
```

## References

- [Geist Icons Documentation](https://vercel.com/geist/icons)
- [@geist-ui/icons npm package](https://www.npmjs.com/package/@geist-ui/icons)
- Design System Tokens: `client/src/styles/tokens.ts`

