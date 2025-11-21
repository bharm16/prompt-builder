# Span Highlighting Performance Testing Guide

This document provides instructions for testing and verifying the performance improvements from the span highlighting optimizations.

## Overview of Optimizations

The following optimizations have been implemented:

1. **Trust Backend AI** - Removed semantic regex validation from frontend
2. **Diff-Based DOM Rendering** - Incremental updates instead of clear-all-rebuild
3. **Dynamic Taxonomy Generation** - Runtime prompt generation from taxonomy.js
4. **Memoization & Debouncing** - Optimized React rendering and validation
5. **Web Workers** - Background thread for heavy span processing

## Quick Test

### Generate Test Data

```javascript
import { generateTestSpans } from './utils/performanceTesting.js';

// Generate 60 test spans
const testSpans = generateTestSpans(60);
```

### Manual Testing

1. Open the application in Chrome DevTools
2. Navigate to Performance tab
3. Click "Record"
4. Paste test prompt with 50+ detectable elements
5. Wait for span highlighting to complete
6. Stop recording
7. Analyze flame graph for:
   - Layout thrashing (should be minimal)
   - Long tasks (should be < 50ms)
   - Frame drops (should be none)

### Using Performance Testing Utilities

```javascript
import { 
  generateTestSpans, 
  measureRenderPerformance, 
  comparePerformance,
  logPerformanceMetrics,
  testIncrementalUpdates 
} from './utils/performanceTesting.js';

// Test 1: Basic render performance
const spans = generateTestSpans(60);
const metrics = await measureRenderPerformance(spans, editorRef);
logPerformanceMetrics(metrics, 'Render 60 Spans');

// Test 2: Compare multiple iterations
const comparison = await comparePerformance(
  (spans) => renderSpans(spans), 
  generateTestSpans(60), 
  5
);
logPerformanceMetrics(comparison, 'Avg over 5 iterations');

// Test 3: Test incremental updates (diff-based rendering)
const incremental = await testIncrementalUpdates(
  generateTestSpans(50),
  (spans) => renderSpans(spans)
);
console.log('Incremental Update Times:', incremental);
```

## Expected Performance Metrics

### Before Optimizations (Baseline)
- **50 spans:** ~150-200ms render time
- **DOM operations:** Clear all + rebuild all = 100+ DOM mutations
- **Typing lag:** Noticeable delay with highlights enabled
- **Flickering:** Visible on re-render

### After Optimizations (Target)
- **50 spans:** ~50-80ms render time (60%+ improvement)
- **DOM operations:** Only changed spans = 1-10 mutations per update
- **Typing lag:** No perceptible delay
- **Flickering:** None (diff-based updates)

### Incremental Update Performance
- **Add 1 span to 50:** < 10ms (only 1 DOM insertion)
- **Remove 1 span from 50:** < 5ms (only 1 DOM removal)
- **Update 1 span in 50:** < 15ms (unwrap + rewrap 1 span)

## Test Cases

### Test Case 1: Large Span Count
```
Text: Long video prompt with 60+ detectable elements
Expected: Smooth rendering, no visible lag
Success Criteria: Render time < 100ms
```

### Test Case 2: Incremental Changes
```
Action: Type new text that adds 1 span
Expected: Only new span is highlighted, others unchanged
Success Criteria: Update time < 20ms, no full re-render
```

### Test Case 3: Category Filtering
```
Action: Change which categories are visible
Expected: Only affected spans are removed/added
Success Criteria: No full re-render, smooth transition
```

### Test Case 4: Typing Performance
```
Action: Type rapidly while 50+ spans are highlighted
Expected: No input lag, highlights update smoothly
Success Criteria: Input latency < 16ms (60fps)
```

## Browser DevTools Testing

### Chrome Performance Tab
1. Open DevTools → Performance
2. Enable "Screenshots" and "Memory"
3. Record while interacting with highlights
4. Look for:
   - Long tasks (red in timeline) - should be minimal
   - Layout/Recalculate Style - should not cascade
   - Forced reflows - should be none

### React DevTools Profiler
1. Open React DevTools → Profiler
2. Start recording
3. Interact with span highlighting
4. Stop recording
5. Analyze:
   - Which components re-render
   - Memo effectiveness
   - Wasted renders

## Performance Benchmarks

Run these benchmarks to verify improvements:

### Benchmark 1: Initial Render
```javascript
const spans = generateTestSpans(60);
console.time('initial-render');
// Render spans
console.timeEnd('initial-render');
// Target: < 80ms
```

### Benchmark 2: Diff Update (Add)
```javascript
const spans = generateTestSpans(50);
// Render initial
const updated = [...spans, generateTestSpans(1)[0]];
console.time('diff-add');
// Render updated
console.timeEnd('diff-add');
// Target: < 10ms
```

### Benchmark 3: Diff Update (Remove)
```javascript
const spans = generateTestSpans(50);
// Render initial
const updated = spans.slice(0, -1);
console.time('diff-remove');
// Render updated
console.timeEnd('diff-remove');
// Target: < 5ms
```

### Benchmark 4: Full Re-render (Fingerprint Change)
```javascript
const spans = generateTestSpans(50);
console.time('full-rerender');
// Render with different fingerprint
console.timeEnd('full-rerender');
// Target: < 80ms
```

## Visual Verification

### Check for Flickering
1. Enable highlights on a prompt with 50+ spans
2. Modify the prompt to trigger re-highlighting
3. Watch for visual flickering
4. Expected: No flickering (diff-based updates)

### Check for DOM Thrashing
1. Open Chrome DevTools → Performance → Rendering
2. Enable "Paint flashing"
3. Interact with highlights
4. Expected: Minimal green flashes (only changed areas)

## Automated Testing

Add to your test suite:

```javascript
describe('Span Highlighting Performance', () => {
  it('should render 60 spans in under 100ms', async () => {
    const spans = generateTestSpans(60);
    const start = performance.now();
    await render(<SpanHighlighter spans={spans} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should update incrementally when adding 1 span', async () => {
    const initial = generateTestSpans(50);
    const { rerender } = await render(<SpanHighlighter spans={initial} />);
    
    const updated = [...initial, generateTestSpans(1)[0]];
    const start = performance.now();
    rerender(<SpanHighlighter spans={updated} />);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(20);
  });
});
```

## Troubleshooting

### Slow Rendering
- Check browser console for errors
- Verify span IDs are stable (from backend)
- Ensure memoization is working (React DevTools)
- Check for unnecessary re-renders

### Flickering Persists
- Verify diff-based rendering is active
- Check fingerprint is stable
- Ensure span IDs don't change between renders

### High Memory Usage
- Check for memory leaks in spanMap
- Verify old highlights are properly unwrapped
- Monitor with Chrome DevTools → Memory

## Success Criteria Summary

✅ **60 spans render in < 100ms**  
✅ **Incremental updates < 20ms**  
✅ **No visible flickering**  
✅ **Smooth typing with highlights enabled**  
✅ **No layout thrashing in DevTools**  
✅ **Memoization prevents wasted renders**  

## Report Template

```
### Performance Test Results

**Environment:**
- Browser: Chrome X.X
- Device: [CPU, RAM]
- Span Count: 60

**Metrics:**
- Initial Render: XXms
- Add Span: XXms
- Remove Span: XXms
- Update Span: XXms

**Observations:**
- Flickering: Yes/No
- Typing Lag: Yes/No
- DevTools Issues: [List any]

**Conclusion:**
[Pass/Fail with reasoning]
```

