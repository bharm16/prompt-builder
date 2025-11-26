# Geist Typography Migration Guide

This document tracks the migration to Geist typography hierarchy throughout the project.

## Migration Status

### ✅ Completed

1. **Core CSS Components** (`client/src/index.css`)
   - `.btn` - Updated to use `text-button-16` and Geist spacing/colors
   - `.btn-primary`, `.btn-secondary`, `.btn-ghost` - Updated with Geist tokens
   - `.btn-sm`, `.btn-lg`, `.btn-xl` - Updated with Geist button typography
   - `.input` - Updated to use `text-copy-16` and Geist spacing/colors
   - `.card` - Updated with Geist shadows and spacing
   - `.badge` - Updated to use `text-label-12` and Geist spacing
   - `.section-title` - Updated to `text-heading-24`
   - `.section-subtitle` - Updated to `text-copy-16`

2. **PromptInput Component**
   - Hero heading: `text-heading-72`
   - Buttons: `text-button-16`, `text-button-14`
   - Labels: `text-label-14`

3. **PromptCanvas Components**
   - All spacing updated to Geist spacing tokens
   - Colors updated to Geist accent colors
   - Shadows updated to Geist shadows
   - Border radius updated to Geist radius

4. **SuggestionsPanel Components**
   - PanelHeader: Updated headings and labels
   - SuggestionsList: Updated text sizes to Geist typography

5. **VideoConceptBuilder Components**
   - Main heading: `text-heading-32` / `text-heading-40`
   - ElementCard: Updated labels and buttons

## Typography Mapping

### Headings
- `text-5xl` → `text-heading-72` (Hero titles)
- `text-4xl` → `text-heading-56` or `text-heading-64`
- `text-3xl` → `text-heading-48` or `text-heading-40`
- `text-2xl` → `text-heading-32` or `text-heading-24`
- `text-xl` → `text-heading-20` or `text-heading-18`
- `text-lg` → `text-heading-16` or `text-heading-14`

### Buttons
- `text-base` + `font-medium` → `text-button-16`
- `text-sm` + `font-medium` → `text-button-14`
- `text-xs` + `font-medium` → `text-button-12`

### Labels
- `text-lg` + `font-medium` → `text-label-18` or `text-label-20`
- `text-base` + `font-medium` → `text-label-16`
- `text-sm` + `font-medium` → `text-label-14`
- `text-xs` + `font-medium` → `text-label-12`
- `text-[11px]` + `font-semibold` → `text-label-12`
- `text-[13px]` + `font-semibold` → `text-label-14`

### Copy (Body Text)
- `text-xl` → `text-copy-20` or `text-copy-24`
- `text-lg` → `text-copy-18`
- `text-base` → `text-copy-16`
- `text-sm` → `text-copy-14`
- `text-xs` → `text-copy-12`

## Remaining Components to Update

### High Priority
- [ ] All remaining `h1`, `h2`, `h3`, `h4` elements
- [ ] Form labels (`<label>` elements)
- [ ] All `text-[XXpx]` custom sizes
- [ ] Components with `font-semibold`, `font-bold` that should use Geist hierarchy

### Medium Priority
- [ ] VideoConceptBuilder sub-components
- [ ] Settings component
- [ ] Error boundaries
- [ ] Modal components
- [ ] Tooltip components

### Low Priority
- [ ] Utility components
- [ ] Test files (if needed)

## Patterns to Follow

### Before
```tsx
<h1 className="text-2xl font-semibold text-neutral-900">
<h2 className="text-xl font-bold text-neutral-800">
<button className="text-sm font-medium">
<label className="text-sm font-semibold">
<p className="text-base text-neutral-700">
```

### After
```tsx
<h1 className="text-heading-32 text-geist-foreground">
<h2 className="text-heading-24 text-geist-foreground">
<button className="text-button-14">
<label className="text-label-14">
<p className="text-copy-16 text-geist-accents-7">
```

## Quick Reference

| Old Pattern | New Geist Pattern |
|------------|-------------------|
| `text-5xl font-bold` | `text-heading-72` |
| `text-2xl font-semibold` | `text-heading-32` |
| `text-sm font-medium` (buttons) | `text-button-14` |
| `text-sm font-semibold` (labels) | `text-label-14` |
| `text-base` (body) | `text-copy-16` |
| `text-sm` (body) | `text-copy-14` |
| `text-xs` (labels) | `text-label-12` |
| `text-[13px]` | `text-label-14` |
| `text-[11px]` | `text-label-12` |

## Color Updates

All text colors should use Geist accent colors:
- `text-neutral-900` → `text-geist-foreground`
- `text-neutral-800` → `text-geist-accents-8`
- `text-neutral-700` → `text-geist-accents-7`
- `text-neutral-600` → `text-geist-accents-6`
- `text-neutral-500` → `text-geist-accents-5`
- `text-neutral-400` → `text-geist-accents-4`
- `text-neutral-300` → `text-geist-accents-3`

## Notes

- Geist typography classes automatically include proper `line-height`, `letter-spacing`, and `font-weight`
- No need to add `font-semibold`, `font-bold`, etc. when using Geist typography classes
- Use Geist spacing (`geist-1`, `geist-2`, etc.) for consistent spacing
- Use Geist colors (`geist-accents-*`) for consistent color scheme

