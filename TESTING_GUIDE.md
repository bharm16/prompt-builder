# Testing the Context-Aware Feature

## Quick Start - Manual Testing

### Test 1: Basic Context Flow

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Select Video Prompt mode**

3. **Click "Creative Brainstorm" button**

4. **Fill out the form**:
   - Subject: `lone astronaut`
   - Action: `walking slowly`
   - Location: `abandoned space station`
   - Time: `golden hour`
   - Mood: `melancholic`
   - Style: `35mm film`
   - Event: `discovering a message`

5. **Click "Generate Template"**

6. **Wait for optimization to complete**

7. **Check the Prompt Editor**:
   - Should see highlighted phrases
   - Click the info icon (ⓘ) to open the legend
   - **VERIFY**: Should see green badge saying "Brainstorm Context Active"
   - **VERIFY**: Your exact inputs should be highlighted with highest priority

### Test 2: Verify User Input Prioritization

1. Look for these phrases in the optimized text:
   - `lone astronaut` (should be highlighted - from your input)
   - `abandoned space station` (should be highlighted - from your input)
   - `golden hour` (should be highlighted - from your input)

2. These should appear before other generic phrases in priority

### Test 3: Semantic Matching

1. Look for semantic variations that should also be highlighted:
   - If you see "warm light" or "sunset" → these match "golden hour"
   - If you see "panning" or "dolly" → these match camera movements
   - If you see "35mm" or "film grain" → these match "35mm film"

2. **Expected behavior**: Related terms get highlighted even if you didn't type them exactly

### Test 4: Without Context (Baseline)

1. **Select Video Prompt mode**

2. **Type a prompt directly** (skip Creative Brainstorm):
   ```
   A soldier walks through a battlefield at sunset
   ```

3. **Click Optimize**

4. **Check the legend**:
   - **VERIFY**: Should NOT see "Brainstorm Context Active" badge
   - **VERIFY**: Should still see some highlights (from NLP extraction)

5. **Expected behavior**: Works normally without context, just uses NLP

## Automated Tests

### Run Unit Tests

```bash
# Test PromptContext utility
npm test -- --run PromptContext.test.js

# Test phrase extractor
npm test -- --run phraseExtractor.test.js

# Run all tests
npm test
```

### Expected Results

```
✓ 27 PromptContext tests - all passing
✓ 21 phraseExtractor tests - all passing
```

## Visual Inspection Checklist

### ✅ Context Badge
- [ ] Badge appears when using Creative Brainstorm
- [ ] Badge does NOT appear when typing prompt directly
- [ ] Badge has green checkmark icon
- [ ] Badge says "Brainstorm Context Active"

### ✅ Phrase Highlighting
- [ ] User input phrases are highlighted
- [ ] 10-15 total highlights (not overwhelming)
- [ ] Highlights have colored underlines
- [ ] Clicking highlight shows suggestions panel

### ✅ Data Flow
- [ ] Creative Brainstorm → Optimization works
- [ ] Context persists through optimization
- [ ] Legend shows correct information
- [ ] No console errors

## Debug Mode

To see what's happening behind the scenes, open browser console and check:

```javascript
// The context should be available in PromptCanvas
console.log('Context:', promptContext);

// Should show:
{
  version: '1.0.0',
  elements: {
    subject: 'lone astronaut',
    action: 'walking slowly',
    // ...etc
  },
  keywordMaps: { ... },
  semanticGroups: { ... }
}
```

## Edge Cases to Test

### Edge Case 1: Partial Context
Fill out only 2-3 fields in Creative Brainstorm:
- Subject: `astronaut`
- Style: `35mm`
- Leave others empty

**Expected**: Should still work, just with less context

### Edge Case 2: Special Characters
Try input with special characters:
- Subject: `a soldier (weathered)`
- Style: `35mm @ 24fps`

**Expected**: Should handle gracefully, no errors

### Edge Case 3: Very Long Input
Try very long descriptions:
- Subject: (100+ words)

**Expected**: Should limit to top 15 highlights

### Edge Case 4: Create New
After using Creative Brainstorm:
1. Click "Create New" (+ button)
2. Start fresh prompt

**Expected**: Context should be cleared, badge should disappear

## Performance Testing

### Measure Render Time

```javascript
console.time('phrase-extraction');
const phrases = extractVideoPromptPhrases(text, context);
console.timeEnd('phrase-extraction');

// Should complete in < 100ms for typical prompts
```

### Check Memory Usage

Open Chrome DevTools → Memory → Take Heap Snapshot

**Expected**: No memory leaks when creating/clearing context multiple times

## Troubleshooting

### Problem: Badge doesn't show up

**Check:**
1. Did you use Creative Brainstorm? (not direct input)
2. Did you fill out at least one field?
3. Is the legend open? (click ⓘ icon)

### Problem: No highlights appear

**Check:**
1. Is this Video mode? (highlighting only works in video mode)
2. Has the typewriter animation completed?
3. Check console for errors

### Problem: Wrong phrases highlighted

**Check:**
1. Open console, log the context
2. Verify keyword maps were built correctly
3. Check if your input actually appears in the optimized text

### Problem: "Brainstorm Context Active" shows but no user phrases highlighted

**Possible causes:**
1. AI rewrote your input completely (rare but possible)
2. Your phrases don't appear in the optimized text
3. Phrases were de-duplicated by longer overlapping phrases

## Success Criteria

The implementation is working correctly if:

✅ **Context flows through pipeline**: Creative Brainstorm → Optimization → Highlighting
✅ **Visual feedback works**: Badge appears when appropriate
✅ **User input prioritized**: Your exact phrases get highlighted first
✅ **Semantic matching works**: Related terms also highlighted
✅ **No breaking changes**: Works without context (backwards compatible)
✅ **Tests pass**: All 48 tests passing
✅ **No errors**: Console clean, no warnings
✅ **Performance good**: < 100ms extraction time

## Reporting Issues

If you find bugs, please provide:

1. **Steps to reproduce**
2. **Expected vs actual behavior**
3. **Browser console output**
4. **Context object** (from console.log)
5. **Optimized prompt text**

Example bug report:
```
Steps:
1. Used Creative Brainstorm with subject="astronaut"
2. Generated prompt
3. No highlights appeared

Expected: "astronaut" should be highlighted
Actual: No highlights at all

Console: [paste errors]
Context: [paste context object]
```
