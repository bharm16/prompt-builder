# Design System Quick Start Guide 🎨

## 🚀 TL;DR

Your Video Wizard now has a **complete, production-ready design system** inspired by Airbnb's Design Language System. Here's what you need to know:

---

## 📦 What Changed

### 655 lines added, 419 lines improved
- ✅ **7 files** updated with new design system
- ✅ **Complete color palette** (primary, accent, semantic)
- ✅ **Typography system** (Inter font, proper scale)
- ✅ **Spacing & shadows** (consistent elevation)
- ✅ **Animations** (smooth, purposeful)
- ✅ **Component patterns** (buttons, inputs, cards)

---

## 🎨 Core Colors (Copy & Paste Ready)

### Primary Actions
```jsx
className="bg-accent-600 text-white"          // Primary button
className="border-accent-500 text-accent-600" // Primary outline
className="text-accent-600 hover:text-accent-700" // Primary link
```

### Text
```jsx
className="text-neutral-900"  // Headlines
className="text-neutral-700"  // Body text
className="text-neutral-500"  // Secondary text
```

### States
```jsx
className="bg-success-50 border-success-500"  // Success
className="bg-error-50 border-error-500"      // Error
className="bg-warning-50 border-warning-500"  // Warning
className="bg-info-50 border-info-500"        // Info
```

---

## 🔧 Ready-to-Use Components

### Button (Primary CTA)
```jsx
<button className="btn-primary">
  Continue
</button>
```
→ Gradient background, lift on hover, press animation

### Button (Secondary)
```jsx
<button className="btn-secondary">
  Go Back
</button>
```
→ White with border, subtle hover

### Input Field
```jsx
<input 
  type="text" 
  className="input"
  placeholder="Enter text..."
/>
```
→ Automatic hover, focus, validation states

### Card
```jsx
<div className="card p-6">
  Content here
</div>
```
→ Modern shadow, ring, rounded corners

### Interactive Card
```jsx
<div className="card-interactive p-6">
  Clickable content
</div>
```
→ Lifts on hover, scales on click

---

## 📐 Common Patterns

### Page Layout
```jsx
<div className="max-w-5xl mx-auto px-8 py-12">
  <h1 className="text-display-md font-bold text-neutral-900 mb-4">
    Page Title
  </h1>
  <p className="text-lg text-neutral-600 mb-8">
    Description text
  </p>
  {/* Content */}
</div>
```

### Form Field
```jsx
<div className="space-y-2">
  <label className="block text-base font-medium text-neutral-800">
    Field Label
  </label>
  <input type="text" className="input" />
  <p className="text-sm text-neutral-500">
    Helper text
  </p>
</div>
```

### Section Header
```jsx
<div className="border-l-4 border-accent-500 pl-4 mb-6">
  <h2 className="text-xl font-semibold text-neutral-900 mb-2">
    Section Title
  </h2>
  <p className="text-sm text-neutral-600">
    Section description
  </p>
</div>
```

---

## 🎯 Spacing Quick Reference

```jsx
gap-2   // 8px   - Tight (icon + text)
gap-4   // 16px  - Default (buttons, cards)
gap-6   // 24px  - Generous (form fields)
gap-8   // 32px  - Sections
gap-12  // 48px  - Major sections
```

---

## ✨ Animations

### Fade In
```jsx
className="animate-fade-in"
```

### Slide Up
```jsx
className="animate-slide-up"
```

### Scale In
```jsx
className="animate-scale-in"
```

### Hover Lift
```jsx
className="hover:-translate-y-0.5 transition-transform duration-150"
```

---

## 🎨 Shadow Scale

```jsx
shadow-sm   // Subtle (inputs)
shadow      // Default (cards) ⭐
shadow-md   // Hover state
shadow-lg   // Elevated (modals)
shadow-xl   // Maximum
```

---

## 🔤 Typography

### Headlines
```jsx
<h1 className="text-display-md font-bold text-neutral-900">
  Main Headline
</h1>
```

### Subheadlines
```jsx
<h2 className="text-xl font-semibold text-neutral-800">
  Section Header
</h2>
```

### Body Text
```jsx
<p className="text-base text-neutral-600">
  Regular paragraph text
</p>
```

### Small Text
```jsx
<span className="text-sm text-neutral-500">
  Helper or secondary text
</span>
```

---

## 🎨 Validation States

### Success
```jsx
className="border-success-500 bg-success-50"
```

### Error
```jsx
className="border-error-500 bg-error-50"
```

### Focus (Inputs)
```jsx
// Automatic with .input class
focus:border-accent-500 focus:ring-4 focus:ring-accent-100
```

---

## 📱 Responsive

### Mobile First
```jsx
// Mobile default
className="px-4 py-3"

// Tablet and up
className="px-4 py-3 md:px-6 md:py-4"

// Desktop
className="px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-6"
```

### Hide/Show by Breakpoint
```jsx
className="hidden md:block"    // Show on tablet+
className="block md:hidden"    // Show on mobile only
```

---

## ♿ Accessibility Checklist

✅ **Always include:**
- `aria-label` on icon-only buttons
- Focus states (automatic with utility classes)
- Sufficient color contrast (built-in)
- Touch targets 44px+ on mobile

✅ **Focus indicators:**
```jsx
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500
```

---

## 🚨 Don'ts

❌ Don't use arbitrary values:
```jsx
className="text-[#123456]"     // Wrong
className="shadow-[0_2px_4px]" // Wrong
className="p-[23px]"           // Wrong
```

✅ Use design tokens:
```jsx
className="text-neutral-600"   // Correct
className="shadow-md"          // Correct
className="p-6"                // Correct
```

---

## 📚 Full Documentation

See `DESIGN_SYSTEM_IMPLEMENTATION.md` for:
- Complete color palette
- Full typography scale
- All shadow variations
- Animation keyframes
- Accessibility guidelines
- WCAG compliance details

---

## 🎯 Pro Tips

1. **Buttons**: Always use `btn-primary` or `btn-secondary` classes
2. **Inputs**: Always use `input` base class for consistency
3. **Cards**: Use `card` for containers, `card-interactive` for clickable
4. **Spacing**: Stick to the 4px scale (gap-2, gap-4, gap-6, etc.)
5. **Colors**: Use semantic names (success, error) not arbitrary values

---

## ✅ Quick Test

To verify everything works:

```jsx
<div className="max-w-5xl mx-auto p-8">
  <div className="card p-6 space-y-4">
    <h2 className="text-2xl font-bold text-neutral-900">
      Test Card
    </h2>
    <input type="text" className="input" placeholder="Test input" />
    <button className="btn-primary">
      Test Button
    </button>
  </div>
</div>
```

Should render:
- ✅ Modern card with shadow and rounded corners
- ✅ Bold black headline
- ✅ Clean input with focus states
- ✅ Gradient button with hover effect

---

**Need help?** Check the full documentation or examine the updated component files for real-world examples.

🎨 **Design system is live and ready to use!**
