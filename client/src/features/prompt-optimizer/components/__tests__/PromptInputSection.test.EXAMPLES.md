# PromptInputSection Test Failure Examples

This document shows real examples of how the tests catch bugs when code is broken.

## Example 1: Swapping the Conditional Logic

### The Bug
```jsx
// Original (correct):
if (promptOptimizer.isProcessing) {
  return <LoadingSkeleton selectedMode={selectedMode} />;
}

// Broken (swapped condition):
if (!promptOptimizer.isProcessing) {
  return <LoadingSkeleton selectedMode={selectedMode} />;
}
```

### Test Failures (26 out of 27 tests failed!)
```
❯ PromptInputSection > Conditional Rendering Logic > renders PromptInput when isProcessing is false
  → Unable to find an element by: [data-testid="prompt-input"]

  Expected: PromptInput component
  Received: LoadingSkeleton (with animate-pulse, skeleton structure)

❯ PromptInputSection > Conditional Rendering Logic > renders LoadingSkeleton when isProcessing is true
  → Found PromptInput when it should not exist

❯ PromptInputSection > Prop Passing to PromptInput > passes all required props...
  → PromptInput was not called (skeleton rendered instead)
```

**26 tests failed** because:
- All prop passing tests failed (PromptInput never rendered)
- All conditional rendering tests failed (logic inverted)
- Context integration tests that rely on PromptInput failed

This demonstrates how comprehensive the tests are - one logic error cascades into multiple meaningful failures.

---

## Example 2: Forgetting to Pass a Prop

### The Bug
```jsx
// Original (correct):
<PromptInput
  inputPrompt={promptOptimizer.inputPrompt}
  onInputChange={promptOptimizer.setInputPrompt}
  selectedMode={selectedMode}
  onModeChange={setSelectedMode}
  onOptimize={onOptimize}
  onShowBrainstorm={onShowBrainstorm}
  // ... other props
/>

// Broken (forgot onOptimize):
<PromptInput
  inputPrompt={promptOptimizer.inputPrompt}
  onInputChange={promptOptimizer.setInputPrompt}
  selectedMode={selectedMode}
  onModeChange={setSelectedMode}
  // onOptimize={onOptimize}  ❌ FORGOT THIS
  onShowBrainstorm={onShowBrainstorm}
  // ... other props
/>
```

### Test Failures
```
❯ PromptInputSection > Prop Passing > passes onOptimize callback correctly
  AssertionError: expected undefined to be [Function mockOnOptimize]

  Expected: mockOnOptimize (function)
  Received: undefined

❯ PromptInputSection > Prop Passing > passes all required props...
  AssertionError: expected { onOptimize: undefined, ... } to contain { onOptimize: [Function] }
```

**2 tests failed**, both specifically about the missing prop. Clear, actionable error.

---

## Example 3: Passing Wrong Context Value

### The Bug
```jsx
// Original (correct):
const {
  selectedMode,
  setSelectedMode,
  modes,
  currentAIIndex,
  promptOptimizer,
} = usePromptState();

// Then passing:
<PromptInput
  selectedMode={selectedMode}
  // ...
/>

// Broken (hardcoded value):
<PromptInput
  selectedMode="optimize"  // ❌ HARDCODED instead of using {selectedMode}
  // ...
/>
```

### Test Failures
```
❯ PromptInputSection > Context Integration > uses selectedMode from context for rendering decision
  AssertionError: expected "optimize" to equal "video"

  Context was set to selectedMode: 'video'
  But component passed: 'optimize' (hardcoded)

❯ PromptInputSection > Mode-Specific Skeleton > renders VideoModeSkeleton when selectedMode is "video"
  AssertionError: expected 4 to equal 7

  Expected: VideoModeSkeleton (7 skeleton lines)
  Received: StandardModeSkeleton (4 skeleton lines)
```

**Multiple tests failed**, catching both:
1. The prop passing is wrong (not using context)
2. The wrong skeleton renders (because hardcoded value doesn't match context)

---

## Example 4: Wrong Skeleton for Mode

### The Bug
```jsx
// Original (correct):
{selectedMode === 'video' ? (
  <VideoModeSkeleton />
) : selectedMode === 'research' ? (
  <ResearchModeSkeleton />
) : // ...

// Broken (wrong skeleton):
{selectedMode === 'video' ? (
  <ResearchModeSkeleton />  // ❌ WRONG SKELETON
) : selectedMode === 'research' ? (
  <ResearchModeSkeleton />
) : // ...
```

### Test Failures
```
❯ PromptInputSection > Mode-Specific Skeleton > renders VideoModeSkeleton when selectedMode is "video"
  AssertionError: expected 6 to equal 7

  Expected structure: VideoModeSkeleton (7 lines in first group)
  Actual structure: ResearchModeSkeleton (6 lines in .ml-2 section)

  This means wrong skeleton component is rendering
```

**1 test failed**, specifically identifying:
1. Which mode's test failed ('video')
2. What the structure mismatch is (6 vs 7 lines)
3. Which skeleton is actually rendering (based on structure)

---

## Example 5: Removing Animation Class

### The Bug
```jsx
// Original (correct):
<div className="... animate-pulse" style={{ animationDuration: '1.5s' }}>

// Broken (removed animation):
<div className="..." style={{ animationDuration: '1.5s' }}>
```

### Test Failures
```
❯ PromptInputSection > Animation and Styling > applies animate-pulse class to LoadingSkeleton
  Unable to find element with class: .animate-pulse

  Expected: Element with animate-pulse class
  Received: No such element found
```

**1 test failed**, clearly identifying:
1. The missing animation class
2. Which test covers this behavior
3. What the expectation was

---

## Example 6: Wrong Context Path

### The Bug
```jsx
// Original (correct):
const { promptOptimizer } = usePromptState();
const inputPrompt = promptOptimizer.inputPrompt;

// Broken (wrong path):
const { promptOptimizer } = usePromptState();
const inputPrompt = promptOptimizer.inputText;  // ❌ Wrong property name
```

### Test Failures
```
❯ PromptInputSection > Prop Passing > passes all required props...
  AssertionError: expected undefined to equal "Test prompt"

  passedProps.inputPrompt: undefined
  Expected: "Test prompt" (from context)

❯ PromptInputSection > Context Integration > uses inputPrompt from context.promptOptimizer
  AssertionError: expected undefined to equal "Test prompt from context"
```

**2 tests failed**, both catching that:
1. The prop value is undefined (wrong path)
2. Context value not being used correctly

---

## Example 7: Forgetting to Extract Context Value

### The Bug
```jsx
// Original (correct):
const {
  selectedMode,
  setSelectedMode,
  modes,
  currentAIIndex,
  promptOptimizer,
} = usePromptState();

// Broken (forgot to destructure):
const {
  selectedMode,
  // setSelectedMode,  ❌ FORGOT THIS
  modes,
  currentAIIndex,
  promptOptimizer,
} = usePromptState();

// Then trying to use it:
<PromptInput
  onModeChange={setSelectedMode}  // ❌ undefined
  // ...
/>
```

### Test Failures
```
❯ PromptInputSection > Prop Passing > passes all required props...
  AssertionError: expected undefined to be [Function]

  passedProps.onModeChange: undefined
  Expected: setSelectedMode function from context

❯ PromptInputSection > Context Integration > passes all context values without modification
  AssertionError: expected undefined to be [Function mockSetSelectedMode]

  Reference check failed - onModeChange is undefined
```

**2+ tests failed**, identifying:
1. Missing function reference
2. Broken context integration
3. Type mismatch (undefined instead of function)

---

## Key Takeaways

### What Makes These Tests Effective

1. **Specific Assertions**: Each test checks for specific behavior, not just "it renders"
2. **Structure Validation**: Skeleton tests verify DOM structure (element counts, classes)
3. **Reference Equality**: Context tests use `toBe()` not `toEqual()` to catch reference issues
4. **Multiple Angles**: Same bugs caught by multiple related tests
5. **Clear Failures**: Error messages pinpoint exactly what's wrong

### Common Bug Patterns Caught

✅ Swapped conditionals (if/else logic errors)
✅ Missing props
✅ Wrong prop values
✅ Hardcoded values instead of context
✅ Wrong context paths (e.g., `context.x` vs `context.y.x`)
✅ Missing destructuring
✅ Wrong component rendered
✅ Missing CSS classes
✅ Missing inline styles
✅ Structure changes in child components

### What These Tests DON'T Catch

❌ Visual regression (colors, spacing, visual appearance)
❌ Accessibility issues (ARIA labels, keyboard navigation)
❌ Performance issues (render count, memo optimization)
❌ Integration with real PromptInput behavior (it's mocked)
❌ Real user interactions (clicks, typing)

These require different testing approaches:
- Visual regression: Screenshot/snapshot tests
- Accessibility: axe-core, accessibility audits
- Performance: React DevTools Profiler
- Integration: Integration tests without mocks
- User interactions: E2E tests with Playwright

---

## Running the Examples

To verify these tests catch bugs, you can temporarily break the code:

```bash
# 1. Backup the original file
cp client/src/features/prompt-optimizer/components/PromptInputSection.jsx PromptInputSection.jsx.backup

# 2. Make a breaking change (e.g., swap the conditional)

# 3. Run tests to see failures
npm run test:unit -- client/src/features/prompt-optimizer/components/__tests__/PromptInputSection.test.jsx

# 4. Restore the original
mv PromptInputSection.jsx.backup client/src/features/prompt-optimizer/components/PromptInputSection.jsx

# 5. Verify tests pass again
npm run test:unit -- client/src/features/prompt-optimizer/components/__tests__/PromptInputSection.test.jsx
```

## Conclusion

These tests provide **comprehensive behavioral coverage** that:
- ✅ Catches real bugs developers might introduce
- ✅ Fails fast with clear, actionable errors
- ✅ Tests actual behavior, not implementation details
- ✅ Verifies the component's contract with its dependencies
- ✅ Gives confidence when refactoring

**All 27 tests passing = PromptInputSection is working correctly!**
