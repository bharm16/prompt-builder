# Geist Typography

Rules of typesetting throughout the system.

**Source**: [vercel.com/geist/typography](https://vercel.com/geist/typography)

## Usage

Our typography styles can be consumed as Tailwind classes. The classes below pre-set a combination of `font-size`, `line-height`, `letter-spacing`, and `font-weight` for you based on the Geist Core Figma system.

To make use of the **Subtle** and **Strong** modifiers, all you have to do is use the `<strong>` element nested as the descendant of a given typography class:

```tsx
<p className="text-copy-16">
  Copy 16 <strong>with Strong</strong>
</p>
```

## Headings

Used to introduce pages or sections.

| Example                    | Class name      | Usage                                                      |
| -------------------------- | --------------- | ---------------------------------------------------------- |
| Heading 72                 | `text-heading-72` | Marketing heroes.                                          |
| Heading 64                 | `text-heading-64` | —                                                          |
| Heading 56                 | `text-heading-56` | —                                                          |
| Heading 48                 | `text-heading-48` | —                                                          |
| Heading 40                 | `text-heading-40` | —                                                          |
| Heading 32 **with Subtle** | `text-heading-32` | Marketing subheadings, paragraphs, and dashboard headings. |
| Heading 24 **with Subtle** | `text-heading-24` | —                                                          |
| Heading 20 **with Subtle** | `text-heading-20` | —                                                          |
| Heading 16 **with Subtle** | `text-heading-16` | —                                                          |
| Heading 14                 | `text-heading-14` | —                                                          |

### Examples

```tsx
<h1 className="text-heading-72">Hero Title</h1>
<h2 className="text-heading-48">Section Title</h2>
<h3 className="text-heading-32">
  Subsection <strong>with Subtle</strong>
</h3>
<h4 className="text-heading-20">Component Title</h4>
```

## Buttons

Only to be used within components that render buttons.

| Example   | Class name     | Usage                                                         |
| --------- | -------------- | ------------------------------------------------------------- |
| Button 16 | `text-button-16` | Largest button.                                               |
| Button 14 | `text-button-14` | Default button.                                               |
| Button 12 | `text-button-12` | Only used when a tiny button is placed inside an input field. |

### Examples

```tsx
<button className="text-button-16">Primary Action</button>
<button className="text-button-14">Default Button</button>
<button className="text-button-12">Tiny Button</button>
```

## Label

Designed for single-lines, and given ample line-height for highlighting & marrying up with icons.

| Example                                     | Class name         | Usage                                                                                                         |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Label 20                                    | `text-label-20`      | Marketing text.                                                                                               |
| Label 18                                    | `text-label-18`      | —                                                                                                             |
| Label 16 **with Strong**                    | `text-label-16`      | Used in titles to help differentiate from regular                                                             |
| Label 14 **with Strong**                    | `text-label-14`      | Most common text style of all. Used in many menus.                                                            |
| Label 14 Mono                               | `text-label-14-mono` | Largest form of mono, to pair with larger (>14) text.                                                         |
| Label 13 **with Strong, and Tabular (123)** | `text-label-13`      | Used as a secondary line next to other labels. Tabular is used when conveying numbers for consistent spacing. |
| Label 13 Mono                               | `text-label-13-mono` | Used to pair with Label 14, as the smaller mono size looks better in that pairing.                            |
| Label 12 **with Strong**, AND CAPS          | `text-label-12`      | Used for tertiary level text in busy views, like Comments, Show More and the capitals in Calendars.           |
| Label 12 Mono                               | `text-label-12-mono` | —                                                                                                             |

### Examples

```tsx
<label className="text-label-20">Marketing Label</label>
<span className="text-label-16">
  Title Label <strong>with Strong</strong>
</span>
<span className="text-label-14">
  Menu Item <strong>with Strong</strong>
</span>
<code className="text-label-14-mono">mono code</code>
<span className="text-label-13">
  Secondary <strong>with Strong</strong>
</span>
<span className="text-label-13-mono font-tabular">123</span>
<span className="text-label-12 uppercase">
  TERTIARY <strong>with Strong</strong>
</span>
```

## Copy

Designed for multiple lines of text, having a higher line height than Label.

| Example                 | Class name        | Usage                                                             |
| ----------------------- | ----------------- | ----------------------------------------------------------------- |
| Copy 24 **with Strong** | `text-copy-24`      | For hero areas on marketing pages.                                |
| Copy 20 **with Strong** | `text-copy-20`      | For hero areas on marketing pages.                                |
| Copy 18 **with Strong** | `text-copy-18`      | Mainly for marketing, big quotes.                                 |
| Copy 16 **with Strong** | `text-copy-16`      | Used in simpler, larger views like Modals where text can breathe. |
| Copy 14 **with Strong** | `text-copy-14`      | Most commonly used text style.                                    |
| Copy 13                 | `text-copy-13`      | For secondary text and views where space is a premium.            |
| Copy 13 Mono            | `text-copy-13-mono` | Used for inline code mentions.                                    |

### Examples

```tsx
<p className="text-copy-24">
  Hero text <strong>with Strong</strong>
</p>
<p className="text-copy-20">
  Large body text <strong>with Strong</strong>
</p>
<p className="text-copy-16">
  Standard body text <strong>with Strong</strong>
</p>
<p className="text-copy-14">
  Most common text style <strong>with Strong</strong>
</p>
<p className="text-copy-13">Secondary text</p>
<code className="text-copy-13-mono">inline code</code>
```

## Typography Modifiers

### Strong Modifier

Use the `<strong>` element nested within any typography class to apply the Strong modifier:

```tsx
<p className="text-copy-16">
  Regular text <strong>Strong text</strong>
</p>
```

### Subtle Modifier

Some typography classes support a Subtle variant. This is typically achieved through color or opacity adjustments:

```tsx
<h2 className="text-heading-32 text-geist-accents-5">
  Heading with Subtle
</h2>
```

### Tabular Numbers

For consistent number spacing, use the `font-tabular` utility class:

```tsx
<span className="text-label-13 font-tabular">123</span>
```

## Complete Example

```tsx
import React from 'react';

export function TypographyExample() {
  return (
    <div className="space-y-8 p-geist-8">
      {/* Headings */}
      <section>
        <h1 className="text-heading-72">Hero Title</h1>
        <h2 className="text-heading-48">Section Title</h2>
        <h3 className="text-heading-32">
          Subsection <strong>with Subtle</strong>
        </h3>
        <h4 className="text-heading-20">Component Title</h4>
      </section>

      {/* Buttons */}
      <section>
        <button className="text-button-16 px-geist-4 py-geist-2">
          Primary Action
        </button>
        <button className="text-button-14 px-geist-4 py-geist-2">
          Default Button
        </button>
        <button className="text-button-12 px-geist-2 py-geist-1">
          Tiny Button
        </button>
      </section>

      {/* Labels */}
      <section>
        <label className="text-label-20">Marketing Label</label>
        <span className="text-label-16">
          Title Label <strong>with Strong</strong>
        </span>
        <span className="text-label-14">
          Menu Item <strong>with Strong</strong>
        </span>
        <code className="text-label-14-mono">mono code</code>
        <span className="text-label-13">
          Secondary <strong>with Strong</strong>
        </span>
        <span className="text-label-13-mono font-tabular">123</span>
        <span className="text-label-12 uppercase">
          TERTIARY <strong>with Strong</strong>
        </span>
      </section>

      {/* Copy */}
      <section>
        <p className="text-copy-24">
          Hero text <strong>with Strong</strong>
        </p>
        <p className="text-copy-20">
          Large body text <strong>with Strong</strong>
        </p>
        <p className="text-copy-16">
          Standard body text <strong>with Strong</strong>
        </p>
        <p className="text-copy-14">
          Most common text style <strong>with Strong</strong>
        </p>
        <p className="text-copy-13">Secondary text</p>
        <code className="text-copy-13-mono">inline code</code>
      </section>
    </div>
  );
}
```

## Implementation Details

All typography classes are configured in `config/build/tailwind.config.js` and automatically include:

- **Font size**: Predefined pixel sizes
- **Line height**: Optimized for readability
- **Letter spacing**: Adjusted for visual harmony
- **Font weight**: Appropriate weight for each style

The Geist font family is automatically applied via Tailwind's `font-sans` and `font-mono` classes, which use the CSS variables `--font-geist-sans` and `--font-geist-mono` defined in `client/src/index.css`.

## Quick Reference

### Headings
- `text-heading-72` - Hero titles (72px)
- `text-heading-64` - Large hero titles (64px)
- `text-heading-56` - Hero titles (56px)
- `text-heading-48` - Section titles (48px)
- `text-heading-40` - Large sections (40px)
- `text-heading-32` - Subsections (32px)
- `text-heading-24` - Component titles (24px)
- `text-heading-20` - Small headings (20px)
- `text-heading-16` - Tiny headings (16px)
- `text-heading-14` - Smallest headings (14px)

### Buttons
- `text-button-16` - Largest buttons (16px)
- `text-button-14` - Default buttons (14px)
- `text-button-12` - Tiny buttons (12px)

### Labels
- `text-label-20` - Marketing labels (20px)
- `text-label-18` - Large labels (18px)
- `text-label-16` - Title labels (16px)
- `text-label-14` - Menu items (14px) - **Most common**
- `text-label-14-mono` - Mono labels (14px)
- `text-label-13` - Secondary labels (13px)
- `text-label-13-mono` - Mono labels (13px)
- `text-label-12` - Tertiary labels (12px)
- `text-label-12-mono` - Mono labels (12px)

### Copy
- `text-copy-24` - Hero text (24px)
- `text-copy-20` - Large body (20px)
- `text-copy-18` - Marketing quotes (18px)
- `text-copy-16` - Standard body (16px)
- `text-copy-14` - Common text (14px) - **Most common**
- `text-copy-13` - Secondary text (13px)
- `text-copy-13-mono` - Inline code (13px)

## Notes

- Typography classes automatically include proper `line-height`, `letter-spacing`, and `font-weight`
- No need to add `font-semibold`, `font-bold`, etc. when using Geist typography classes
- Use `<strong>` element for Strong modifier within typography classes
- Mono variants are available for labels and copy where code or technical content is displayed
- Tabular numbers can be applied using `font-tabular` utility class for consistent number spacing

