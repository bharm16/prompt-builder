# Wizard Video Builder - Implementation Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Integration Steps](#integration-steps)
5. [Customization](#customization)
6. [Troubleshooting](#troubleshooting)
7. [Testing Checklist](#testing-checklist)

## Prerequisites

Before implementing the Wizard Video Builder, ensure your environment meets these requirements:

### Required Dependencies
- React 18.2.0 or higher
- React DOM 18.2.0 or higher
- Tailwind CSS 3.3.6 or higher
- lucide-react 0.294.0 or higher
- Node.js 16+ for build process

### Optional Dependencies
- PropTypes for type checking (recommended)
- ESLint for code quality
- Testing libraries (@testing-library/react)

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+
- Chrome Mobile 90+

## Installation

### Step 1: Copy Component Files

Copy the wizard component files to your project:

```bash
# Create directories
mkdir -p client/src/components/wizard
mkdir -p client/src/services
mkdir -p docs/wizard

# Copy component files (from the implementation)
cp -r src/components/wizard/* client/src/components/wizard/
cp src/services/aiWizardService.js client/src/services/
```

### Step 2: Verify File Structure

Ensure your file structure matches:

```
client/src/
├── components/
│   └── wizard/
│       ├── WizardVideoBuilder.jsx       (480 lines)
│       ├── MobileFieldView.jsx          (280 lines)
│       ├── StepCoreConcept.jsx          (220 lines)
│       ├── StepAtmosphere.jsx           (220 lines)
│       ├── StepTechnical.jsx            (240 lines)
│       ├── SummaryReview.jsx            (200 lines)
│       ├── InlineSuggestions.jsx        (80 lines)
│       └── WizardProgress.jsx           (120 lines)
└── services/
    └── aiWizardService.js               (285 lines)

docs/wizard/
├── IMPLEMENTATION_GUIDE.md
├── RESPONSIVE_REFERENCE.md
└── README.md
```

### Step 3: Install Dependencies

If not already installed:

```bash
npm install react react-dom
npm install tailwindcss autoprefixer postcss
npm install lucide-react
npm install prop-types  # Optional but recommended
```

### Step 4: Configure Tailwind CSS

Ensure Tailwind is configured in your `tailwind.config.js`:

```javascript
module.exports = {
  content: [
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      // Wizard-specific colors (optional customization)
      colors: {
        wizard: {
          primary: '#4f46e5',    // indigo-600
          secondary: '#9333ea',  // purple-600
          success: '#16a34a',    // green-600
          danger: '#dc2626'      // red-600
        }
      }
    }
  },
  plugins: []
}
```

## Configuration

### Environment Variables

Create or update your `.env` file:

```bash
# API Configuration
VITE_API_URL=http://localhost:3001

# Optional: Feature Flags
VITE_WIZARD_ENABLE_AUTOSAVE=true
VITE_WIZARD_AUTOSAVE_INTERVAL=2000
VITE_WIZARD_ENABLE_SUGGESTIONS=true
```

### AI Service Configuration

Update `client/src/services/aiWizardService.js` if needed:

```javascript
// Customize these constants
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MIN_CALL_INTERVAL = 500; // ms between API calls
const CACHE_TTL = 300000;      // 5 minutes
```

### Customizing Field Configuration

Edit the mobile fields in `WizardVideoBuilder.jsx`:

```javascript
const mobileFields = [
  {
    name: 'subject',
    label: 'What is the subject?',
    description: 'The main focus of your video',
    placeholder: 'e.g., A professional athlete',
    required: true
  },
  // Add or modify fields as needed
];
```

## Integration Steps

### Basic Integration

#### 1. Import the Wizard

```javascript
import WizardVideoBuilder from './components/wizard/WizardVideoBuilder';
```

#### 2. Add to Your Component

```javascript
function App() {
  const handleComplete = (result) => {
    console.log('Wizard completed!', result);
    // result contains:
    // - formData: all field values
    // - generatedPrompt: final prompt text
    // - completionScore: 0-100 percentage

    // Do something with the generated prompt
    // e.g., send to video generation API
  };

  const handleSave = (formData) => {
    console.log('Auto-saved:', formData);
    // Optional: sync to backend
  };

  return (
    <WizardVideoBuilder
      onComplete={handleComplete}
      onSave={handleSave}
      initialData={null} // or load saved data
    />
  );
}
```

### Advanced Integration

#### With React Router

```javascript
import { useNavigate } from 'react-router-dom';

function WizardPage() {
  const navigate = useNavigate();

  const handleComplete = (result) => {
    // Save to state management (Redux, Context, etc.)
    localStorage.setItem('generated_prompt', result.generatedPrompt);

    // Navigate to results page
    navigate('/results', { state: result });
  };

  return <WizardVideoBuilder onComplete={handleComplete} />;
}
```

#### With State Management (Redux)

```javascript
import { useDispatch } from 'react-redux';
import { savePrompt } from './store/promptSlice';

function WizardContainer() {
  const dispatch = useDispatch();

  const handleComplete = (result) => {
    dispatch(savePrompt(result));
  };

  return <WizardVideoBuilder onComplete={handleComplete} />;
}
```

#### With Backend Synchronization

```javascript
function WizardWithBackend() {
  const [userId] = useState('user-123');

  const handleSave = async (formData) => {
    try {
      await fetch('/api/wizard/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, formData })
      });
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleComplete = async (result) => {
    try {
      const response = await fetch('/api/prompts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt: result.generatedPrompt,
          metadata: result.formData
        })
      });

      const { id } = await response.json();
      window.location.href = `/prompts/${id}`;
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  return (
    <WizardVideoBuilder
      onComplete={handleComplete}
      onSave={handleSave}
    />
  );
}
```

## Customization

### Styling Customization

#### Override Colors

```javascript
// In your CSS or Tailwind config
.wizard-primary {
  @apply bg-blue-600 text-white;
}

.wizard-secondary {
  @apply bg-purple-600 text-white;
}
```

#### Custom Themes

Create a theme wrapper:

```javascript
function ThemedWizard({ theme = 'default' }) {
  const themeClasses = {
    default: 'bg-gray-50',
    dark: 'bg-gray-900 text-white',
    ocean: 'bg-blue-50'
  };

  return (
    <div className={themeClasses[theme]}>
      <WizardVideoBuilder onComplete={handleComplete} />
    </div>
  );
}
```

### Adding Custom Fields

1. **Update FormData Structure** in `WizardVideoBuilder.jsx`:

```javascript
const [formData, setFormData] = useState({
  // ... existing fields
  customField: '' // Add your custom field
});
```

2. **Add Field to Mobile Configuration**:

```javascript
const mobileFields = [
  // ... existing fields
  {
    name: 'customField',
    label: 'Your Custom Question?',
    description: 'Description here',
    placeholder: 'e.g., Example value',
    required: false
  }
];
```

3. **Add Field to Desktop Step**:

Edit the appropriate step component (e.g., `StepAtmosphere.jsx`) to include your field.

### Customizing AI Suggestions

Override the suggestion fetching in `aiWizardService.js`:

```javascript
async getSuggestions(fieldName, currentValue, context) {
  // Add custom logic here
  if (fieldName === 'customField') {
    return [
      { text: 'Custom suggestion 1', explanation: 'Why this works' },
      { text: 'Custom suggestion 2', explanation: 'Another option' }
    ];
  }

  // Fall back to default behavior
  return this._fetchSuggestions(fieldName, currentValue, context);
}
```

### Customizing Validation

Add custom validation rules in `WizardVideoBuilder.jsx`:

```javascript
const validateStep = (step) => {
  const errors = {};

  if (step === 0) {
    // Custom validation
    if (formData.subject && formData.subject.includes('banned-word')) {
      errors.subject = 'This word is not allowed';
    }

    // Length validation
    if (formData.subject && formData.subject.length > 200) {
      errors.subject = 'Subject must be under 200 characters';
    }
  }

  setValidationErrors(errors);
  return Object.keys(errors).length === 0;
};
```

## Troubleshooting

### Common Issues

#### 1. Wizard Not Rendering

**Problem**: Blank screen or errors on load

**Solutions**:
- Check that all dependencies are installed: `npm install`
- Verify Tailwind CSS is configured and built
- Check browser console for import errors
- Ensure React version is 18.2.0+

#### 2. Suggestions Not Loading

**Problem**: AI suggestions don't appear

**Solutions**:
- Verify `VITE_API_URL` environment variable is set
- Check backend API is running and accessible
- Open Network tab and check for failed API calls
- Verify CORS is configured on backend
- Check `aiWizardService.js` API endpoints match your backend

**Debug**:
```javascript
// Add to aiWizardService.js
console.log('API URL:', API_BASE_URL);
console.log('Fetching suggestions for:', fieldName);
```

#### 3. Mobile View Not Detecting

**Problem**: Desktop view shows on mobile devices

**Solutions**:
- Check viewport meta tag in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
- Test with Chrome DevTools device emulation
- Clear browser cache and reload

#### 4. Auto-save Not Working

**Problem**: Data not persisting on refresh

**Solutions**:
- Check localStorage is enabled in browser
- Verify localStorage quota (5-10MB limit)
- Check for localStorage errors in console
- Test in incognito/private mode (localStorage may be disabled)

**Debug**:
```javascript
// In browser console
localStorage.getItem('wizard_video_builder_draft');
```

#### 5. Touch Gestures Not Working

**Problem**: Swipe gestures don't work on mobile

**Solutions**:
- Test on actual mobile device (not simulator)
- Check touch events aren't being prevented by parent elements
- Verify minimum swipe distance is reasonable (50px default)
- Disable browser pull-to-refresh if interfering

#### 6. Performance Issues

**Problem**: Slow rendering or laggy interactions

**Solutions**:
- Enable React DevTools Profiler to find bottlenecks
- Reduce suggestion fetch frequency
- Implement debouncing for suggestion requests:

```javascript
import { useCallback } from 'react';
import debounce from 'lodash/debounce';

const debouncedFetch = useCallback(
  debounce((fieldName, value) => {
    onRequestSuggestions(fieldName, value);
  }, 300),
  []
);
```

## Testing Checklist

### Manual Testing

#### Mobile Testing (< 768px)

- [ ] All 7 fields display one at a time
- [ ] Swipe left advances to next field
- [ ] Swipe right returns to previous field
- [ ] Touch targets are minimum 56px
- [ ] Keyboard appears automatically on field focus
- [ ] Progress bar shows correct percentage
- [ ] Required fields block advancement when empty
- [ ] Optional fields can be skipped
- [ ] Suggestions appear below active field
- [ ] Number keys (1-9) select suggestions
- [ ] Auto-save works (check after 2 seconds)
- [ ] Restore prompt appears on reload

#### Tablet Testing (768px - 1023px)

- [ ] Desktop step view renders
- [ ] All fields in each step are visible
- [ ] Navigation buttons work correctly
- [ ] Touch interactions work smoothly

#### Desktop Testing (>= 1024px)

- [ ] All 4 steps render correctly
- [ ] Step indicator shows at top
- [ ] Can click completed steps to navigate back
- [ ] Tab key moves between fields
- [ ] Enter key advances through fields
- [ ] Escape key goes to previous step
- [ ] Suggestions appear inline below fields
- [ ] Validation shows in real-time
- [ ] Technical parameters collapse/expand
- [ ] Preset buttons apply configurations
- [ ] Summary review shows all data
- [ ] Edit buttons navigate to correct steps

#### Cross-Step Testing

- [ ] Data persists when navigating between steps
- [ ] Validation errors clear when fixed
- [ ] Completed steps show checkmarks
- [ ] Progress percentage updates correctly
- [ ] Context preview shows in Step 2

#### Summary Review Testing

- [ ] All entered values display correctly
- [ ] Generated prompt preview is accurate
- [ ] Word count calculates correctly
- [ ] Copy to clipboard works
- [ ] Download as text file works
- [ ] Edit links navigate to correct steps
- [ ] Missing required fields highlighted
- [ ] Generate button disabled when incomplete

#### Auto-save Testing

- [ ] Data saves after 2 seconds of inactivity
- [ ] Restore prompt appears on reload
- [ ] Choosing "Continue" restores all data
- [ ] Choosing "Cancel" clears saved data
- [ ] Saved data expires after 24 hours

### Automated Testing

#### Unit Tests Example

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import WizardVideoBuilder from './WizardVideoBuilder';

test('renders wizard with initial step', () => {
  render(<WizardVideoBuilder onComplete={jest.fn()} />);
  expect(screen.getByText(/Core Concept/i)).toBeInTheDocument();
});

test('advances to next step when fields valid', () => {
  const { getByPlaceholderText, getByText } = render(
    <WizardVideoBuilder onComplete={jest.fn()} />
  );

  fireEvent.change(getByPlaceholderText(/subject/i), {
    target: { value: 'Test subject' }
  });
  fireEvent.change(getByPlaceholderText(/action/i), {
    target: { value: 'Test action' }
  });
  fireEvent.change(getByPlaceholderText(/location/i), {
    target: { value: 'Test location' }
  });

  fireEvent.click(getByText(/Continue/i));

  expect(screen.getByText(/Atmosphere/i)).toBeInTheDocument();
});
```

#### Integration Tests

Test with real API:

```javascript
test('fetches suggestions from API', async () => {
  const { getByPlaceholderText } = render(
    <WizardVideoBuilder onComplete={jest.fn()} />
  );

  const input = getByPlaceholderText(/subject/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'athlete' } });

  // Wait for suggestions to load
  await waitFor(() => {
    expect(screen.getByText(/suggestion/i)).toBeInTheDocument();
  });
});
```

### Accessibility Testing

- [ ] All form inputs have labels
- [ ] ARIA attributes are correct
- [ ] Keyboard navigation works throughout
- [ ] Focus indicators are visible
- [ ] Error messages are announced
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader can navigate wizard
- [ ] All interactive elements have accessible names

### Performance Testing

- [ ] Initial load < 2 seconds
- [ ] Field render < 100ms
- [ ] Auto-save < 50ms (non-blocking)
- [ ] Suggestion fetch < 1 second
- [ ] No memory leaks on repeated navigation
- [ ] Smooth animations (60fps)

## Next Steps

After successful implementation:

1. Monitor user analytics for completion rates
2. A/B test different field ordering
3. Gather user feedback on UX
4. Optimize suggestion relevance
5. Add advanced features (templates, favorites, sharing)

For more details, see:
- [RESPONSIVE_REFERENCE.md](./RESPONSIVE_REFERENCE.md) - Detailed responsive behavior
- [README.md](./README.md) - Quick start and overview
