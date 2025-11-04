# PromptInputSection Test Suite Documentation

## Overview
This test suite contains **27 comprehensive behavioral tests** for `PromptInputSection.jsx`. Each test verifies actual component behavior and would fail if specific bugs are introduced.

**✅ All 27 tests passing**

## Test Categories

### 1. Conditional Rendering Logic (3 tests)
Tests that verify the component correctly switches between `PromptInput` and `LoadingSkeleton` based on `isProcessing` state.

#### Test: "renders PromptInput when isProcessing is false"
**What it catches:**
- If someone accidentally swaps the conditional (e.g., `if (!isProcessing)` → `if (isProcessing)`)
- If the component renders the wrong component for the given state
- If PromptInput is not rendered when it should be

**How it fails:**
- Will not find `data-testid="prompt-input"` in the DOM
- Will fail assertion: `expect(screen.getByTestId('prompt-input')).toBeInTheDocument()`

#### Test: "renders LoadingSkeleton when isProcessing is true"
**What it catches:**
- If the conditional logic is broken or removed
- If both components render simultaneously
- If neither component renders

**How it fails:**
- Will not find element with `animate-pulse` class
- Will find PromptInput when it shouldn't exist
- Will fail assertions checking for skeleton presence and PromptInput absence

#### Test: "does not render PromptInput when LoadingSkeleton is shown"
**What it catches:**
- If mutual exclusivity is broken (both components rendering)
- If the if/else structure is removed
- If PromptInput is accidentally rendered during processing

**How it fails:**
- `PromptInput` mock will be called when it shouldn't
- Will fail assertion: `expect(PromptInput).not.toHaveBeenCalled()`

---

### 2. Prop Passing to PromptInput (7 tests)
Tests that verify ALL props are passed to PromptInput with exact, correct values.

#### Test: "passes all required props to PromptInput with correct values"
**What it catches:**
- Missing props
- Props passed with wrong values
- Props passed with wrong variable reference
- Typos in prop names (e.g., `inputprompt` instead of `inputPrompt`)

**How it fails:**
- Will fail if any expected prop is missing or has wrong value
- Uses `expect.objectContaining()` to verify all props match expected values

#### Test: "passes onOptimize callback correctly"
**What it catches:**
- If `onOptimize` is not passed through
- If `onOptimize` is undefined
- If wrong function reference is passed

**How it fails:**
- Will fail if `passedProps.onOptimize !== mockOnOptimize`
- Will fail if type is not 'function'
- Will fail if prop is undefined

#### Test: "passes onShowBrainstorm callback correctly"
**What it catches:**
- If `onShowBrainstorm` is not passed through
- If `onShowBrainstorm` is undefined
- If wrong function reference is passed

**How it fails:**
- Will fail if `passedProps.onShowBrainstorm !== mockOnShowBrainstorm`
- Will fail if type is not 'function'

#### Test: "passes context values from usePromptState correctly"
**What it catches:**
- If context values are not extracted correctly
- If wrong properties are accessed (e.g., `state.selectedMode` instead of destructured `selectedMode`)
- If context values are hardcoded

**How it fails:**
- Will fail if any context value doesn't match expected value
- Checks `selectedMode`, `onModeChange`, `modes`, `currentAIIndex`, `inputPrompt`, `onInputChange`

#### Test: "passes isProcessing as false to PromptInput when not processing"
**What it catches:**
- If `isProcessing` is hardcoded
- If `isProcessing` is not passed from context
- If wrong boolean value is passed

**How it fails:**
- Will fail if `passedProps.isProcessing !== false`

#### Test: "passes aiNames prop through to PromptInput"
**What it catches:**
- If `aiNames` is forgotten
- If wrong array reference is passed
- If `aiNames` is modified before passing

**How it fails:**
- Will fail if `passedProps.aiNames !== customAiNames` (reference check)
- Will fail if length doesn't match expected

---

### 3. Mode-Specific Skeleton Rendering (7 tests)
Tests that verify the correct skeleton variant renders for each mode.

#### Test: "renders VideoModeSkeleton when selectedMode is 'video'"
**What it catches:**
- If mode check uses wrong comparison (e.g., `=== 'standard'` instead of `=== 'video'`)
- If wrong skeleton component is rendered
- If VideoModeSkeleton structure changes accidentally

**How it fails:**
- VideoModeSkeleton has exactly 7 skeleton lines in first `.space-y-2` div
- Will fail if count !== 7

#### Test: "renders ResearchModeSkeleton when selectedMode is 'research'"
**What it catches:**
- If wrong skeleton is rendered for research mode
- If ResearchModeSkeleton structure changes

**How it fails:**
- ResearchModeSkeleton has exactly 6 lines in its `.ml-2` section
- Will fail if count !== 6

#### Test: "renders SocraticModeSkeleton when selectedMode is 'socratic'"
**What it catches:**
- If wrong skeleton is rendered for socratic mode
- If SocraticModeSkeleton structure changes
- If the mapped array `[3, 4, 5]` is modified

**How it fails:**
- SocraticModeSkeleton has 3 `.ml-2.space-y-1.5` sections
- Section 1 must have 3 lines, section 2 must have 4 lines, section 3 must have 5 lines
- Will fail if any count is wrong

#### Test: "renders ReasoningModeSkeleton when selectedMode is 'reasoning'"
**What it catches:**
- If wrong skeleton is rendered for reasoning mode
- If ReasoningModeSkeleton structure changes

**How it fails:**
- ReasoningModeSkeleton's last `.ml-2` section has exactly 4 lines
- Will fail if count !== 4

#### Test: "renders StandardModeSkeleton when selectedMode is 'optimize' (default)"
**What it catches:**
- If default case is broken
- If wrong skeleton renders for standard mode
- If StandardModeSkeleton structure changes

**How it fails:**
- StandardModeSkeleton has exactly 4 lines in its `.ml-2` section
- Will fail if count !== 4

#### Test: "renders StandardModeSkeleton for unknown mode (fallback)"
**What it catches:**
- If the fallback case (else clause) is removed
- If component crashes on unknown mode
- If unknown modes don't gracefully degrade

**How it fails:**
- Should render StandardModeSkeleton (4 lines) for any unrecognized mode
- Will fail if structure doesn't match StandardModeSkeleton

---

### 4. Context Integration (7 tests)
Tests that verify the component correctly uses and responds to context values.

#### Test: "calls usePromptState hook on render"
**What it catches:**
- If `usePromptState` hook is not called
- If hook is called conditionally (which would break React rules)
- If hook is accidentally removed

**How it fails:**
- Will fail if `usePromptState` mock was not called

#### Test: "uses selectedMode from context for rendering decision"
**What it catches:**
- If `selectedMode` is not read from context
- If `selectedMode` is hardcoded
- If component doesn't respond to context changes

**How it fails:**
- Changes context and rerenders
- Will fail if passed prop doesn't match context value after change
- Verifies initial pass of 'optimize' and changed pass of 'video'

#### Test: "uses isProcessing from context.promptOptimizer for conditional rendering"
**What it catches:**
- If `isProcessing` is not read from context
- If read from wrong path (e.g., `context.isProcessing` instead of `context.promptOptimizer.isProcessing`)
- If component doesn't switch between PromptInput and LoadingSkeleton on state change

**How it fails:**
- Initially expects PromptInput to be present
- After context change, expects LoadingSkeleton and no PromptInput
- Will fail if either condition is not met

#### Test: "uses inputPrompt from context.promptOptimizer"
**What it catches:**
- If `inputPrompt` is not extracted from correct path
- If wrong property is used
- If inputPrompt is hardcoded

**How it fails:**
- Will fail if passed `inputPrompt` doesn't match context value

#### Test: "uses setInputPrompt from context.promptOptimizer"
**What it catches:**
- If `setInputPrompt` is not extracted from `context.promptOptimizer`
- If wrong function is passed
- If function reference is copied instead of passed directly

**How it fails:**
- Will fail if `onInputChange` !== `mockSetInputPrompt` (reference check)

#### Test: "passes all context values without modification"
**What it catches:**
- If context values are accidentally transformed
- If values are hardcoded
- If values are replaced with different values
- If reference equality is broken (e.g., creating new objects instead of passing through)

**How it fails:**
- Uses strict reference equality checks (`toBe()` not `toEqual()`)
- Will fail if any reference or value doesn't match exactly

---

### 5. Animation and Styling (6 tests)
Tests that verify loading animations and styling classes are correctly applied.

#### Test: "applies animate-pulse class to LoadingSkeleton"
**What it catches:**
- If `animate-pulse` class is removed
- If class is renamed or misspelled
- If animation is accidentally removed

**How it fails:**
- Will not find element with `.animate-pulse` class
- Will fail if found element doesn't contain the class

#### Test: "includes shimmer animation element in LoadingSkeleton"
**What it catches:**
- If shimmer effect div is removed
- If shimmer classes are changed
- If shimmer animation is broken

**How it fails:**
- Looks for element with classes `.absolute.inset-0.-translate-x-full`
- Will fail if element is not found

#### Test: "applies gradient background to LoadingSkeleton"
**What it catches:**
- If gradient classes are removed
- If background styling changes
- If neutral color scheme is changed

**How it fails:**
- Looks for element with `.bg-gradient-to-r.from-neutral-100`
- Will fail if not found

#### Test: "applies custom animation duration to LoadingSkeleton"
**What it catches:**
- If `style={{ animationDuration: '1.5s' }}` is removed
- If duration value changes
- If inline style is removed in favor of class

**How it fails:**
- Uses `toHaveStyle()` to check for `animationDuration: '1.5s'`
- Will fail if style is not present or has different value

#### Test: "applies border and rounded styling to LoadingSkeleton"
**What it catches:**
- If border classes are removed
- If `border-neutral-200` or `rounded-xl` are changed
- If styling is simplified and loses these classes

**How it fails:**
- Looks for element with `.border.border-neutral-200.rounded-xl`
- Will fail if any class is missing

#### Test: "uses relative positioning for skeleton content"
**What it catches:**
- If `relative` class is removed from inner content div
- If positioning breaks shimmer effect layering
- If structure is refactored incorrectly

**How it fails:**
- Looks for element with `.relative.space-y-6`
- Will fail if not found (shimmer effect may break)

---

## How to Verify Tests Catch Bugs

### Example: Breaking the conditional rendering
```jsx
// Original code:
if (promptOptimizer.isProcessing) {
  return <LoadingSkeleton selectedMode={selectedMode} />;
}

// Break it:
if (!promptOptimizer.isProcessing) {  // Swapped condition
  return <LoadingSkeleton selectedMode={selectedMode} />;
}

// Result: Tests will fail with:
// ✗ renders PromptInput when isProcessing is false
// ✗ renders LoadingSkeleton when isProcessing is true
```

### Example: Forgetting to pass a prop
```jsx
// Original code:
<PromptInput
  onOptimize={onOptimize}
  onShowBrainstorm={onShowBrainstorm}
  // ... other props
/>

// Break it:
<PromptInput
  // onOptimize={onOptimize}  // Forgot this
  onShowBrainstorm={onShowBrainstorm}
  // ... other props
/>

// Result: Test will fail with:
// ✗ passes onOptimize callback correctly
//   Expected: mockOnOptimize function
//   Received: undefined
```

### Example: Wrong skeleton for mode
```jsx
// Original code:
{selectedMode === 'video' ? (
  <VideoModeSkeleton />
) : selectedMode === 'research' ? (
  <ResearchModeSkeleton />
// ...

// Break it:
{selectedMode === 'video' ? (
  <ResearchModeSkeleton />  // Wrong skeleton!
) : selectedMode === 'research' ? (
// ...

// Result: Test will fail with:
// ✗ renders VideoModeSkeleton when selectedMode is "video"
//   Expected: 7 skeleton lines
//   Received: 6 skeleton lines
```

## Running the Tests

```bash
# Run all tests
npm run test:unit -- client/src/features/prompt-optimizer/components/__tests__/PromptInputSection.test.jsx

# Run in watch mode
npm run test:watch -- client/src/features/prompt-optimizer/components/__tests__/PromptInputSection.test.jsx

# Run with UI
npm run test:ui
```

## Test Coverage

These tests provide comprehensive coverage of:
- ✅ Conditional rendering logic
- ✅ All prop passing scenarios
- ✅ All mode-specific skeleton variants
- ✅ Context integration and state changes
- ✅ Animation and styling classes
- ✅ Edge cases (unknown modes, fallbacks)
- ✅ Reference equality for callbacks and objects

## What These Tests DON'T Cover

These tests intentionally don't test:
- The internal implementation of `PromptInput` (it's mocked)
- The internal implementation of skeleton components (tested via structure)
- User interactions within PromptInput (that should be tested in PromptInput.test.jsx)
- The usePromptState hook itself (should be tested in PromptStateContext.test.jsx)

This is appropriate because:
1. We're testing PromptInputSection's behavior, not its dependencies
2. Dependencies should have their own tests
3. We care about the contract, not the implementation

## Maintenance

If you modify PromptInputSection, update tests if:
- You add/remove/rename props
- You change the conditional rendering logic
- You add/modify/remove skeleton modes
- You change skeleton structure significantly
- You change animation classes
- You change how context values are used

The tests are designed to fail fast when these changes occur, guiding you to update them appropriately.
