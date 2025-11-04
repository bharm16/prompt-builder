# VideoConceptBuilder Architecture

## Before vs After Comparison

### BEFORE: God Component Anti-Pattern 🔴

```
VideoConceptBuilder.jsx (1,924 lines)
├─ 17+ useState calls
├─ 9+ useRef for state tracking
├─ 7 scattered fetch() calls
├─ 200+ lines of configuration
├─ 150+ lines of business logic
├─ 1,000+ lines of JSX rendering
└─ 0% testability
```

**Problems:**
- ❌ Single 1,924-line file
- ❌ Everything tightly coupled
- ❌ Impossible to test
- ❌ Impossible to reuse
- ❌ Difficult to understand
- ❌ Difficult to modify
- ❌ Poor performance (massive re-renders)

### AFTER: Clean Architecture ✅

```
VideoConceptBuilder/
│
├── VideoConceptBuilder.jsx (519 lines)
│   └─ Orchestration only
│
├── hooks/ (Isolated Concerns)
│   ├── useVideoConceptState.js ─────── State management (useReducer)
│   ├── useElementSuggestions.js ────── AI suggestions logic
│   ├── useConflictDetection.js ─────── Conflict detection
│   ├── useRefinements.js ───────────── Refinement suggestions
│   ├── useTechnicalParams.js ───────── Technical parameters
│   ├── useCompatibilityScores.js ───── Compatibility checking
│   └── useKeyboardShortcuts.js ─────── Keyboard navigation
│
├── api/ (Data Layer)
│   └── videoConceptApi.js ──────────── All API calls centralized
│
├── utils/ (Business Logic)
│   ├── subjectDescriptors.js ───────── Pure descriptor functions
│   ├── validation.js ───────────────── Pure validation functions
│   └── formatting.js ───────────────── Pure formatting functions
│
├── config/ (Configuration)
│   ├── elementConfig.js ────────────── Element definitions
│   ├── templates.js ────────────────── Template library
│   └── constants.js ────────────────── All constants
│
└── components/ (Presentation)
    ├── ProgressHeader.jsx ──────────── Progress display
    ├── ConceptPreview.jsx ──────────── Concept preview
    ├── ElementCard.jsx ─────────────── Element input card
    ├── ConflictsAlert.jsx ──────────── Conflicts display
    ├── RefinementSuggestions.jsx ───── Refinement suggestions
    ├── TechnicalBlueprint.jsx ──────── Technical parameters
    ├── VideoGuidancePanel.jsx ──────── Guidance panel
    └── TemplateSelector.jsx ────────── Template selector
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ 100% testable (every piece)
- ✅ Reusable hooks and components
- ✅ Easy to understand (semantic naming)
- ✅ Easy to modify (localized changes)
- ✅ Better performance (granular re-renders)
- ✅ Better developer experience

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VideoConceptBuilder.jsx                      │
│                    (Orchestration Layer)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│   State       │    │   Custom     │    │   API        │
│   Management  │    │   Hooks      │    │   Layer      │
│               │    │              │    │              │
│ useReducer    │◄───│ - Suggestions│◄───│ VideoApi     │
│   ├─elements  │    │ - Conflicts  │    │   ├─validate │
│   ├─concept   │    │ - Refinements│    │   ├─suggest  │
│   ├─ui state  │    │ - Technical  │    │   ├─complete │
│   └─scores    │    │ - Compat.    │    │   └─parse    │
└───────┬───────┘    └──────────────┘    └──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        UI Components                            │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ Progress   │  │ Element    │  │ Conflicts  │               │
│  │ Header     │  │ Card       │  │ Alert      │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ Refinement │  │ Technical  │  │ Guidance   │               │
│  │ Suggestion │  │ Blueprint  │  │ Panel      │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. **Main Component** (`VideoConceptBuilder.jsx`)
- Orchestrates all child components
- Handles high-level event routing
- Manages component composition
- **Does NOT:** Contain business logic, API calls, or complex state management

### 2. **State Management** (`hooks/useVideoConceptState.js`)
- Centralizes all state with useReducer
- Provides predictable state transitions
- Includes memoized derived state
- **Does NOT:** Contain UI logic or API calls

### 3. **Custom Hooks** (`hooks/*.js`)
- Each hook manages ONE concern
- Encapsulates side effects (API calls, timers, etc.)
- Returns clean interface for component
- **Does NOT:** Directly manipulate DOM or handle events

### 4. **API Layer** (`api/videoConceptApi.js`)
- Centralizes all API calls
- Handles request/response formatting
- Provides consistent error handling
- **Does NOT:** Contain business logic or state

### 5. **Business Logic** (`utils/*.js`)
- Pure functions (input → output)
- Zero side effects
- 100% testable
- **Does NOT:** Access DOM, state, or make API calls

### 6. **Configuration** (`config/*.js`)
- Data-only files
- No logic, just definitions
- Easy to modify without touching code
- **Does NOT:** Contain functions or side effects

### 7. **UI Components** (`components/*.jsx`)
- Pure presentation components
- Receive data via props
- Emit events via callbacks
- **Does NOT:** Contain business logic or API calls

## Testing Strategy

### Unit Tests
```javascript
// Test business logic
utils/subjectDescriptors.test.js
utils/validation.test.js
utils/formatting.test.js

// Test hooks (with @testing-library/react-hooks)
hooks/useVideoConceptState.test.js
hooks/useElementSuggestions.test.js
hooks/useConflictDetection.test.js
```

### Component Tests
```javascript
// Test individual components
components/ElementCard.test.jsx
components/ProgressHeader.test.jsx
components/ConflictsAlert.test.jsx
```

### Integration Tests
```javascript
// Test main orchestration
VideoConceptBuilder.integration.test.jsx
```

## Performance Optimization Opportunities

### 1. **React.memo**
Wrap expensive components:
```javascript
export const ElementCard = React.memo(function ElementCard(props) {
  // Component logic
});
```

### 2. **useMemo**
Already implemented for derived state:
```javascript
const groupProgress = useMemo(
  () => calculateGroupProgress(elements),
  [elements]
);
```

### 3. **Code Splitting**
Lazy load heavy components:
```javascript
const TechnicalBlueprint = lazy(() => import('./components/TechnicalBlueprint'));
```

### 4. **Virtual Scrolling**
If element list grows, use react-window:
```javascript
import { FixedSizeList } from 'react-window';
```

## Scalability

### Adding a New Element Type

**BEFORE:** Would need to modify 10+ places in 1,924-line file
**AFTER:** Only modify 2 files:

1. **config/elementConfig.js**
```javascript
export const ELEMENT_CONFIG = {
  // ... existing
  cameraAngle: {
    icon: Camera,
    label: 'Camera Angle',
    placeholder: 'Specify camera perspective...',
    examples: ['bird\'s eye view', 'dutch angle', 'over-the-shoulder'],
    group: 'technical',
  },
};
```

2. **config/constants.js**
```javascript
export const PRIMARY_ELEMENT_KEYS = [
  'subject',
  'action',
  'location',
  'time',
  'mood',
  'style',
  'event',
  'cameraAngle', // ← Add here
];
```

**That's it!** The component automatically renders the new element.

## Conclusion

This refactoring is a **textbook example** of how to transform a God Component into a maintainable, scalable architecture using:

- ✅ **Single Responsibility Principle** - Each file has one clear job
- ✅ **Separation of Concerns** - Data, logic, and UI are separate
- ✅ **DRY (Don't Repeat Yourself)** - Shared logic in reusable hooks
- ✅ **Pure Functions** - Business logic with no side effects
- ✅ **Composition over Inheritance** - Small components compose into larger ones
- ✅ **Dependency Injection** - Components receive data via props
- ✅ **Centralized State** - useReducer for predictable state management
- ✅ **Clean Architecture** - Clear boundaries between layers

The result is code that is **easier to understand, easier to test, easier to modify, and easier to scale.**
