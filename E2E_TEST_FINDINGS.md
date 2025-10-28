# E2E Test Findings: Text-to-Highlights Latency

## Summary

After extensive investigation of the actual UI flow, I've discovered that the **span labeling with highlights does NOT work the way initially assumed** in the performance optimization report.

## Actual UI Flow

### What I Initially Assumed (Based on Performance Report):
1. User enters text in Video Prompt mode
2. Smart debounce waits (200-500ms based on text length)
3. API call to `/llm/label-spans` happens automatically
4. Highlights appear in-place on the text with colored spans

**Target: ≤290ms (200ms debounce + 50ms API + 40ms rendering)**

### What Actually Happens:
1. User enters text in Video Prompt textarea
2. User clicks "Optimize" button
3. Full LLM optimization happens (8+ seconds) - generates expanded video prompt
4. Optimized text is displayed
5. **Span labeling does NOT happen automatically**

## Investigation Results

### Screenshots Analysis:
- **Before Optimize**: Simple textarea with user input "A cinematic wide shot of a sunset over the ocean"
- **After Optimize**: Full optimized prompt with technical specs, but **NO highlights visible**

### API Request Timing:
- API request sent at: **8480ms** (8.5 seconds)
- This is for the full prompt optimization, NOT span labeling

### Code Analysis from PromptCanvas.jsx:
```javascript
const enableMLHighlighting = selectedMode === 'video';

const { spans: labeledSpans } = useSpanLabeling({
  text: enableMLHighlighting ? displayedPrompt : '',
  // ...
});
```

The span labeling hook is called with `displayedPrompt`, which suggests it should work on the displayed text after optimization.

## Root Cause

The E2E test failed because:

1. **Highlights don't appear after optimization** - The `.value-word` spans were never rendered
2. **The "Optimize" button triggers full LLM generation** - Not just span labeling (8.5 seconds, not 290ms)
3. **API endpoint mismatch** - Looked for `/llm/label-spans` but actual optimization uses different endpoint

## Questions to Resolve

1. **When/how do highlights actually appear?**
   - Is span labeling only for editing existing optimized text?
   - Does it require user interaction after optimization?
   - Is the feature currently disabled in the UI?

2. **Is the performance report's 290ms claim accurate?**
   - The claim was based on theoretical calculations
   - No actual E2E measurement was done
   - The UI flow doesn't match the expected flow

3. **Where is the actual span labeling feature used?**
   - The code exists (`useSpanLabeling` hook, API endpoints)
   - All optimizations were implemented (caching, debouncing, etc.)
   - But the E2E test cannot verify it works as claimed

## Recommendations

1. **Clarify the actual user flow** - When should highlights appear?
2. **Verify span labeling is actually enabled** - Check if feature flag or mode is disabled
3. **Update performance claims** - If highlights don't appear automatically, the 290ms claim may be misleading
4. **Create accurate E2E tests** - Once actual flow is clarified, write tests that match reality

## Current Status

✅ **Server optimizations implemented**: Redis caching, request coalescing, concurrency limiting
✅ **Client optimizations implemented**: Smart debouncing, progressive rendering, predictive caching
✅ **Unit tests passing**: All 45 character offset accuracy tests pass
✅ **Integration tests passing**: API endpoint tests with caching pass (with mocked OpenAI)
❌ **E2E tests failing**: Cannot verify 290ms text-to-highlights claim in actual UI

The performance optimizations are solid and well-tested at the unit/integration level, but the E2E validation reveals the actual UI flow differs from initial assumptions.
