# Bento Grid Redesign - Quick Reference Card

## 🎨 Color Palette

```css
/* Surfaces */
--surface-base: #FAFAFA;
--surface-elevated: #FAFBFC;

/* Borders */
--border-subtle: #E8E8E8;
--border-default: #D0D0D0;
--border-required: rgba(91, 91, 214, 0.4);
--border-optional: rgba(0, 0, 0, 0.12);

/* Accents */
--indigo: #5B5BD6;
--green: #10B981;

/* Text */
--text-primary: #1A1A1A;
--text-secondary: #6B6B6B;
--text-placeholder: #9CA3AF;
```

## 📦 Shadows

```css
/* Resting */
box-shadow: 
  0 1px 3px rgba(0, 0, 0, 0.12),
  0 1px 2px rgba(0, 0, 0, 0.08);

/* Hover */
box-shadow: 
  0 12px 28px rgba(0, 0, 0, 0.12),
  0 4px 8px rgba(0, 0, 0, 0.08);

/* Filled (green-tinted) */
box-shadow: 
  0 1px 3px rgba(16, 185, 129, 0.15),
  0 1px 2px rgba(0, 0, 0, 0.08);
```

## 📐 Sizing (12-column grid)

```css
/* Hero (Subject) */
grid-column: span 7;  /* 58% width */
grid-row: span 2;
min-height: 280px;

/* Large (Action) */
grid-column: span 5;  /* 42% width */
grid-row: span 2;
min-height: 280px;

/* Medium (Location, Time, Mood, Style) */
grid-column: span 3;  /* 25% width */
grid-row: span 1;
min-height: 140px;

/* Wide (Descriptors) */
grid-column: span 8;  /* 67% width */
grid-row: span 1;
min-height: 140px;

/* Small (Event) */
grid-column: span 4;  /* 33% width */
grid-row: span 1;
min-height: 140px;
```

## 🔲 Corner Radii

```css
/* Hero & Large */
border-radius: 16px;

/* Medium & Wide */
border-radius: 12px;

/* Small */
border-radius: 8px;

/* Expanded state */
border-radius: 16px;
```

## 📏 Spacing

```css
/* Desktop grid gap */
gap: 36px;

/* Tablet grid gap */
gap: 24px;

/* Mobile grid gap */
gap: 12px;

/* Hero/Large padding */
padding: 40px 32px;

/* Medium/Wide padding */
padding: 32px 24px;

/* Small padding */
padding: 28px 20px;
```

## 🎯 Icons

```css
/* Hero icons */
width: 36px;
height: 36px;
stroke-width: 1.5px;
color: #5B5BD6;
filter: drop-shadow(0 2px 4px rgba(91, 91, 214, 0.15));

/* Large icons */
width: 32px;
height: 32px;
stroke-width: 1.5px;
color: #5B5BD6;
filter: drop-shadow(0 2px 4px rgba(91, 91, 214, 0.15));

/* Medium/Wide icons */
width: 28px;
height: 28px;
stroke-width: 1.5px;
color: #6B6B6B;

/* Small icons */
width: 24px;
height: 24px;
stroke-width: 1.5px;
color: #6B6B6B;
```

## 📝 Typography

```css
/* Labels */
font-size: 15px;
font-weight: 600;  /* Semibold */
color: #1A1A1A;
letter-spacing: -0.01em;

/* Preview text */
font-size: 13px;
font-weight: 400;
color: #6B6B6B;

/* Placeholder */
font-size: 13px;
font-weight: 400;
color: #9CA3AF;
font-style: italic;
```

## 🎭 Borders

```css
/* Required fields (hero/large) */
border: 2px solid rgba(91, 91, 214, 0.4);  /* Hero */
border: 1px solid rgba(91, 91, 214, 0.4);  /* Large */

/* Optional fields */
border: 1px solid rgba(0, 0, 0, 0.12);

/* Hover state */
border-color: #D0D0D0;  /* Optional */
border-color: rgba(91, 91, 214, 0.6);  /* Required */

/* Filled state */
border-color: #10B981;  /* Green */
```

## 🌊 Hover Effects

```css
.bento-field__collapsed:hover {
  transform: translateY(-2px) scale(1.02);
  transition: all 200ms ease-out;
}
```

## 📱 Responsive Breakpoints

```css
/* Desktop */
@media (min-width: 1024px) {
  grid-template-columns: repeat(12, 1fr);
  gap: 36px;
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

/* Medium Mobile */
@media (min-width: 481px) and (max-width: 767px) {
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* Small Mobile */
@media (max-width: 480px) {
  grid-template-columns: 1fr;
  gap: 12px;
}
```

## ✅ Grid Math Verification

```
Row 1: Hero (7) + Large (5) = 12 ✓
Row 2: Medium (3) × 4 = 12 ✓
Row 3: Wide (8) + Small (4) = 12 ✓
```

## 🎬 Animation Timing

```css
transition: all 200ms ease-out;
animation: expandIn 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

## 🎨 Background System

```css
/* Default (collapsed) */
background: #FAFBFC;

/* Expanded */
background: #FFFFFF;

/* Filled */
background: rgba(16, 185, 129, 0.03);
```

---

## Copy-Paste Ready Values

```css
/* QUICK COPY: Resting State Box */
background: #FAFBFC;
border: 1px solid rgba(0, 0, 0, 0.12);
border-radius: 12px;
padding: 32px 24px;
box-shadow: 
  0 1px 3px rgba(0, 0, 0, 0.12),
  0 1px 2px rgba(0, 0, 0, 0.08);

/* QUICK COPY: Hero Field (Required) */
background: #FAFBFC;
border: 2px solid rgba(91, 91, 214, 0.4);
border-radius: 16px;
padding: 40px 32px;
box-shadow: 
  0 1px 3px rgba(0, 0, 0, 0.12),
  0 1px 2px rgba(0, 0, 0, 0.08);

/* QUICK COPY: Hover State */
transform: translateY(-2px) scale(1.02);
box-shadow: 
  0 12px 28px rgba(0, 0, 0, 0.12),
  0 4px 8px rgba(0, 0, 0, 0.08);
border-color: #D0D0D0;

/* QUICK COPY: Filled State */
border-color: #10B981;
background: rgba(16, 185, 129, 0.03);
box-shadow: 
  0 1px 3px rgba(16, 185, 129, 0.15),
  0 1px 2px rgba(0, 0, 0, 0.08);
```

---

**Print this page and keep it handy for quick reference!**
