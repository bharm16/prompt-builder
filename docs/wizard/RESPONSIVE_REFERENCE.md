# Wizard Video Builder - Responsive Design Reference

## Table of Contents
1. [Breakpoint Behavior Matrix](#breakpoint-behavior-matrix)
2. [Touch Gesture Implementation](#touch-gesture-implementation)
3. [Keyboard Shortcuts](#keyboard-shortcuts)
4. [Accessibility Features](#accessibility-features)
5. [Device-Specific Optimizations](#device-specific-optimizations)
6. [Testing Procedures](#testing-procedures)

## Breakpoint Behavior Matrix

### Overview

The wizard adapts its UI based on three breakpoints:

| Breakpoint | Width Range | View Mode | Primary Input |
|------------|-------------|-----------|---------------|
| Mobile | < 768px | Single field | Touch |
| Tablet | 768px - 1023px | Multi-field steps | Touch + Keyboard |
| Desktop | >= 1024px | Multi-field steps | Keyboard + Mouse |

### Mobile (< 768px)

**Layout Pattern**: One field at a time, full screen

**Characteristics**:
- Single field occupies entire viewport
- Large touch targets (minimum 56px height)
- Swipe gestures enabled
- Minimal UI chrome
- Auto-focus on field
- On-screen keyboard friendly

**Component Hierarchy**:
```
MobileFieldView
├── Progress Bar (compact)
├── Field Label + Description
├── Input (large, 56px min height)
├── InlineSuggestions (below input)
└── Navigation Buttons (bottom, sticky)
```

**Field Sequence** (7 screens):
1. Subject (required)
2. Action (required)
3. Location (required)
4. Time (optional)
5. Mood (optional)
6. Style (optional)
7. Event (optional)

**Navigation**:
- Swipe left = Next field
- Swipe right = Previous field
- Bottom buttons always visible
- "Skip" button for optional fields

**Auto-advance Logic**:
```javascript
// Required field with valid input
if (field.required && isValid && value.length >= 3) {
  autoAdvanceAfter(300ms);
}

// Optional field - never auto-advance
if (!field.required) {
  // User must manually advance or skip
}
```

### Tablet (768px - 1023px)

**Layout Pattern**: Multi-field steps, compact

**Characteristics**:
- Similar to desktop but more compact
- Touch-optimized spacing
- Larger touch targets than desktop
- Hybrid keyboard + touch input
- Collapsible sections

**Component Hierarchy**:
```
WizardVideoBuilder
├── WizardProgress (simplified)
├── Step Components (same as desktop)
└── Navigation (larger buttons)
```

**Differences from Desktop**:
- Increased padding/spacing
- Larger buttons (48px vs 40px)
- Less dense information
- Simpler animations

### Desktop (>= 1024px)

**Layout Pattern**: Multi-field steps, full featured

**Characteristics**:
- Multiple fields per step
- Keyboard shortcuts enabled
- Precise mouse interactions
- Rich visual feedback
- Click-to-navigate on progress indicator

**Component Hierarchy**:
```
WizardVideoBuilder
├── WizardProgress (full with labels)
├── Step 1: StepCoreConcept (3 fields)
├── Step 2: StepAtmosphere (4 fields)
├── Step 3: StepTechnical (collapsible categories)
└── Step 4: SummaryReview
```

**Step 1: Core Concept**
- 3 required fields visible simultaneously
- Tab navigation between fields
- Real-time inline suggestions
- Validation on blur

**Step 2: Atmosphere**
- 4 optional fields
- Context preview from Step 1
- Skip button available
- All suggestions visible

**Step 3: Technical**
- Collapsible categories (5 total)
- Preset buttons for quick config
- All fields optional
- Skip entire step option

**Step 4: Summary Review**
- All data grouped by step
- Edit buttons for each section
- Generated prompt preview
- Copy/download options

## Touch Gesture Implementation

### Swipe Gestures (Mobile Only)

#### Configuration

```javascript
const MIN_SWIPE_DISTANCE = 50; // pixels
const SWIPE_TIMEOUT = 300; // ms
```

#### Implementation Details

**1. Touch Event Handlers**:

```javascript
onTouchStart(e) {
  touchStart = e.targetTouches[0].clientX;
  touchEnd = null;
  startTime = Date.now();
}

onTouchMove(e) {
  touchEnd = e.targetTouches[0].clientX;

  // Visual feedback if swiping
  const distance = Math.abs(touchStart - touchEnd);
  if (distance > 10) {
    showSwipeIndicator();
  }
}

onTouchEnd() {
  const distance = touchStart - touchEnd;
  const duration = Date.now() - startTime;

  // Validate swipe
  if (Math.abs(distance) < MIN_SWIPE_DISTANCE) return;
  if (duration > SWIPE_TIMEOUT) return;

  // Left swipe = Next
  if (distance > 0 && canGoNext) {
    handleNext();
  }

  // Right swipe = Previous
  if (distance < 0 && canGoBack) {
    handlePrevious();
  }
}
```

**2. Swipe Prevention Zones**:

Swipes are disabled on:
- Suggestion pills (to allow scrolling)
- Input fields (to allow text selection)
- Navigation buttons

**3. Visual Feedback**:

```javascript
// During swipe
<div className="swipe-overlay opacity-10" />

// After swipe
<div className="transition-transform duration-300 ease-out" />
```

### Tap Gestures

**Large Touch Targets**:
- Minimum 56px × 56px per iOS HIG
- 48px recommended by Material Design
- Implemented: 56px on all primary actions

**Touch Target Mapping**:
```
Input fields: 56px height
Navigation buttons: 56px height
Suggestion pills: 48px height
Secondary buttons: 44px height
```

**Tap Feedback**:
```css
.touch-target {
  /* Immediate visual feedback */
  active:scale-95
  transition-transform duration-150
}
```

### Long Press (Future Enhancement)

Placeholder for edit/delete on long press:

```javascript
let pressTimer;

onTouchStart() {
  pressTimer = setTimeout(() => {
    handleLongPress();
  }, 500);
}

onTouchEnd() {
  clearTimeout(pressTimer);
}
```

## Keyboard Shortcuts

### Global Shortcuts (Desktop Only)

| Key | Action | Context |
|-----|--------|---------|
| `Escape` | Go to previous step | Any step except first |
| `Tab` | Navigate to next field | Within step |
| `Shift + Tab` | Navigate to previous field | Within step |
| `Enter` | Advance to next field/step | On any field |
| `1-9` | Select suggestion | When suggestions visible |

### Implementation

```javascript
useEffect(() => {
  if (isMobile) return; // Disabled on mobile

  const handleKeyDown = (e) => {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch(e.key) {
      case 'Escape':
        e.preventDefault();
        if (currentStep > 0) handlePreviousStep();
        break;

      case 'Enter':
        // Handle in field-level handlers
        break;

      default:
        // Number keys for suggestions
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && suggestions[num - 1]) {
          e.preventDefault();
          selectSuggestion(suggestions[num - 1]);
        }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isMobile, currentStep, suggestions]);
```

### Field-Level Shortcuts

**Enter Key Behavior**:

```javascript
onKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();

    if (isLastFieldInStep && isStepValid) {
      advanceToNextStep();
    } else if (!isLastField) {
      focusNextField();
    }
  }
}
```

**Suggestion Selection**:

```javascript
// Press 1-9 to select suggestion
onKeyPress(e) {
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    const suggestion = suggestions[num - 1];
    if (suggestion) {
      e.preventDefault();
      insertSuggestion(suggestion.text);
    }
  }
}
```

## Accessibility Features

### WCAG 2.1 AA Compliance

#### Perceivable

**1.1 Text Alternatives**:
- All icons have `aria-label`
- Images have alt text
- Icon-only buttons have labels

**1.3 Adaptable**:
- Semantic HTML structure
- Proper heading hierarchy (h1, h2, h3)
- Form labels associated with inputs
- ARIA landmarks used

**1.4 Distinguishable**:
- Color contrast ratio >= 4.5:1 for text
- Color contrast ratio >= 3:1 for UI components
- Focus indicators visible (4px outline)
- Text can be resized 200% without loss

#### Operable

**2.1 Keyboard Accessible**:
- All functionality via keyboard
- No keyboard traps
- Focus order follows visual order

**2.4 Navigable**:
- Skip links to main content
- Descriptive page titles
- Focus visible at all times
- Multiple ways to navigate (steps, edit buttons)

#### Understandable

**3.1 Readable**:
- Language declared in HTML
- Clear, simple instructions

**3.2 Predictable**:
- Consistent navigation
- Consistent identification
- No auto-submit on input

**3.3 Input Assistance**:
- Error identification
- Labels and instructions
- Error suggestions
- Error prevention on submit

#### Robust

**4.1 Compatible**:
- Valid HTML
- ARIA used correctly
- Works with assistive technologies

### ARIA Implementation

**Form Fields**:
```jsx
<input
  id="subject-input"
  aria-label="Video subject"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby="subject-error subject-help"
/>

{hasError && (
  <p id="subject-error" role="alert">
    {errorMessage}
  </p>
)}

<p id="subject-help">
  Enter the main focus of your video
</p>
```

**Progress Indicator**:
```jsx
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Wizard progress"
>
  {progress}%
</div>
```

**Step Navigation**:
```jsx
<nav aria-label="Wizard steps">
  <ol>
    <li aria-current={isCurrentStep ? 'step' : undefined}>
      <button aria-label={`${label}${isCompleted ? ' (completed)' : ''}`}>
        {label}
      </button>
    </li>
  </ol>
</nav>
```

**Live Regions**:
```jsx
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Screen Reader Support

**Announcement Strategy**:

```javascript
// On step change
announceToScreenReader(`Navigated to ${stepLabel}. ${stepDescription}`);

// On validation error
announceToScreenReader(`Error: ${errorMessage}`);

// On suggestion load
announceToScreenReader(`${suggestions.length} suggestions loaded`);

// On completion
announceToScreenReader(`Wizard completed. Score: ${score}%`);
```

**Implementation**:
```jsx
function LiveRegion({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

### Focus Management

**Focus Trap in Modal**:
```javascript
useEffect(() => {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function trapFocus(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  modal.addEventListener('keydown', trapFocus);
  return () => modal.removeEventListener('keydown', trapFocus);
}, []);
```

**Auto-focus Management**:
```javascript
useEffect(() => {
  // Focus first field when step changes
  if (inputRef.current) {
    setTimeout(() => {
      inputRef.current.focus();
    }, 300); // After transition
  }
}, [currentStep]);
```

## Device-Specific Optimizations

### iOS Safari

**Viewport Handling**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

**Safe Area Insets**:
```css
.navigation-bottom {
  padding-bottom: env(safe-area-inset-bottom);
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0-11.2 */
}
```

**Input Zoom Prevention**:
```css
input, textarea, select {
  font-size: 16px; /* Prevents zoom on focus */
}
```

**Keyboard Avoidance**:
```javascript
useEffect(() => {
  // Scroll field into view when keyboard appears
  const handleFocus = () => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 300); // Wait for keyboard animation
  };

  inputRef.current?.addEventListener('focus', handleFocus);
  return () => inputRef.current?.removeEventListener('focus', handleFocus);
}, []);
```

### Android Chrome

**Viewport Units Fix**:
```css
/* Avoid using vh on mobile due to URL bar */
.mobile-screen {
  height: 100vh;
  height: -webkit-fill-available; /* Chrome Android */
}
```

**Pull-to-Refresh Disable**:
```css
body {
  overscroll-behavior-y: contain;
}
```

### Desktop Browser Optimizations

**Hover States**:
```css
@media (hover: hover) {
  .button:hover {
    /* Only show hover on devices that support it */
    transform: scale(1.05);
  }
}
```

**Smooth Scrolling**:
```css
html {
  scroll-behavior: smooth;
}
```

## Testing Procedures

### Responsive Testing

#### Manual Testing Matrix

| Device | Viewport | Orientation | Test Cases |
|--------|----------|-------------|------------|
| iPhone SE | 375×667 | Portrait | Mobile flow, gestures |
| iPhone 12 Pro | 390×844 | Portrait | Mobile flow, safe areas |
| iPad Mini | 768×1024 | Portrait | Tablet layout |
| iPad Pro | 1024×1366 | Landscape | Desktop layout |
| Desktop | 1920×1080 | Landscape | Full desktop features |

#### Automated Responsive Tests

```javascript
describe('Responsive Behavior', () => {
  test('shows mobile view on small screens', () => {
    // Set viewport
    global.innerWidth = 375;
    global.innerHeight = 667;
    global.dispatchEvent(new Event('resize'));

    render(<WizardVideoBuilder onComplete={jest.fn()} />);

    // Assert mobile view
    expect(screen.getByText(/Question 1 of 7/)).toBeInTheDocument();
  });

  test('shows desktop view on large screens', () => {
    global.innerWidth = 1920;
    global.innerHeight = 1080;
    global.dispatchEvent(new Event('resize'));

    render(<WizardVideoBuilder onComplete={jest.fn()} />);

    // Assert desktop view
    expect(screen.getByText(/Core Concept/)).toBeInTheDocument();
  });
});
```

### Touch Gesture Testing

**Test on Real Devices**:
- iOS devices (iPhone, iPad)
- Android phones (various manufacturers)
- Android tablets

**Test Cases**:
1. Swipe left to next field
2. Swipe right to previous field
3. Swipe with different speeds
4. Swipe shorter than minimum distance (should not advance)
5. Swipe while typing (should not advance)
6. Tap suggestion pills (should not trigger swipe)

**Automated Tests**:
```javascript
import { fireEvent } from '@testing-library/react';

test('swipe left advances field', () => {
  const { container } = render(<MobileFieldView {...props} />);

  fireEvent.touchStart(container, {
    targetTouches: [{ clientX: 200 }]
  });

  fireEvent.touchMove(container, {
    targetTouches: [{ clientX: 100 }]
  });

  fireEvent.touchEnd(container);

  expect(props.onNext).toHaveBeenCalled();
});
```

### Keyboard Testing

**Manual Test Cases**:
1. Tab through all fields in order
2. Shift+Tab to go backwards
3. Enter to advance
4. Escape to go back
5. Number keys (1-9) to select suggestions
6. No keyboard traps

**Automated Tests**:
```javascript
test('enter key advances to next field', () => {
  const { getByPlaceholderText } = render(<StepCoreConcept {...props} />);

  const subjectInput = getByPlaceholderText(/subject/i);
  fireEvent.change(subjectInput, { target: { value: 'Test' } });

  fireEvent.keyDown(subjectInput, {
    key: 'Enter',
    code: 'Enter'
  });

  // Assert focus moved to action field
  const actionInput = getByPlaceholderText(/action/i);
  expect(document.activeElement).toBe(actionInput);
});
```

### Accessibility Testing

**Automated Tools**:
- axe DevTools
- WAVE browser extension
- Lighthouse accessibility audit

**Manual Screen Reader Testing**:
- macOS VoiceOver
- Windows NVDA
- iOS VoiceOver
- Android TalkBack

**Test Cases**:
1. Navigate through wizard with keyboard only
2. Use screen reader to complete wizard
3. Verify all error messages are announced
4. Check focus indicators are visible
5. Verify color contrast with tools
6. Test with 200% zoom

**Automated Accessibility Tests**:
```javascript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<WizardVideoBuilder onComplete={jest.fn()} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Performance Testing

**Metrics to Monitor**:
- Initial render: < 2 seconds
- Field transition: < 100ms
- Suggestion load: < 1 second
- Auto-save: < 50ms (non-blocking)

**Tools**:
- Chrome DevTools Performance tab
- Lighthouse performance audit
- React DevTools Profiler

**Performance Tests**:
```javascript
test('renders within performance budget', () => {
  const startTime = performance.now();

  render(<WizardVideoBuilder onComplete={jest.fn()} />);

  const endTime = performance.now();
  const renderTime = endTime - startTime;

  expect(renderTime).toBeLessThan(2000); // 2 seconds
});
```

## Summary

This responsive wizard system provides:

- **Adaptive UI** that changes based on screen size
- **Touch-optimized** mobile experience
- **Keyboard-friendly** desktop experience
- **Accessible** to all users (WCAG 2.1 AA)
- **Performant** across all devices
- **Well-tested** for reliability

For implementation details, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).
