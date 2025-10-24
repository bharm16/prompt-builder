# Debug Guide: Video Prompt Highlights

## Issue
Past video prompts don't show highlighting after backfill migration completed.

## Debug Logging Added

The following console logs have been added to trace the highlight data flow:

### 1. History Loading (`usePromptHistory.js`)
```
Prompts with highlights: X/Y
Sample video prompt with highlights: { id, mode, spansCount, hasSignature }
```
**What to check:**
- Are prompts being loaded with highlightCache?
- How many have highlights vs total?

### 2. Loading from History (`PromptOptimizerContainer.jsx`)
```
[History] Loading entry: { id, mode, hasHighlightCache, spansCount, hasSignature }
[History] Applying highlights: { spansCount, signature }
```
**What to check:**
- Does the entry have highlightCache when clicked?
- Are highlights being applied?

### 3. PromptCanvas Rendering (`PromptCanvas.jsx`)
```
[PromptCanvas] Memoizing initial highlights: { enableMLHighlighting, hasInitialHighlights, spansCount, version }
[PromptCanvas] Using initial highlights: { spansCount, signature }
```
**What to check:**
- Is `enableMLHighlighting` true (video mode)?
- Are initial highlights being received?
- Are they being used or returning null?

## How to Debug

1. **Open browser console** (F12 or Cmd+Option+I)

2. **Refresh the page** to trigger fresh Firestore load
   - Look for: `"Prompts with highlights: X/Y"`
   - If 0/Y, the backfill didn't work or data structure is wrong

3. **Click on a video prompt from history**
   - Look for: `"[History] Loading entry"` with `hasHighlightCache: true`
   - Look for: `"[History] Applying highlights"` with spans count
   - If false, localStorage cache is stale

4. **Check if PromptCanvas receives highlights**
   - Look for: `"[PromptCanvas] Using initial highlights"`
   - If you see "Not using initial highlights", mode is wrong or data is missing

## Common Issues & Fixes

### Issue 1: "Prompts with highlights: 0/X"
**Problem:** Firestore documents don't have highlightCache
**Solution:** Re-run migration or check Firestore directly

### Issue 2: "[History] Loading entry" shows `hasHighlightCache: false`
**Problem:** localStorage cache is stale
**Solution:** The app already clears localStorage on mount. Hard refresh (Cmd+Shift+R)

### Issue 3: "[PromptCanvas] Not using initial highlights"
**Possible causes:**
- `enableMLHighlighting` is false (not video mode)
- `initialHighlights` is null or empty
- `initialHighlights.spans` is not an array

**Solution:** Check the mode and data structure

### Issue 4: Highlights appear briefly then disappear
**Problem:** `useSpanLabeling` is fetching new highlights and overwriting
**Solution:** Check signature matching - initial highlights should be used if signature matches

## Verification Checklist

After refresh, you should see this sequence:

```
✓ "Cleared localStorage on mount"
✓ "Successfully loaded prompts from Firestore: X"
✓ "Prompts with highlights: X/X" (or close to it for video prompts)
✓ "Sample video prompt with highlights: { ... spansCount: 27 ... }"

Then when clicking a video prompt:
✓ "[History] Loading entry: { ... hasHighlightCache: true, spansCount: 27 ... }"
✓ "[History] Applying highlights: { spansCount: 27, signature: '3f7c2a8b' }"
✓ "[PromptCanvas] Using initial highlights: { spansCount: 27, signature: '3f7c2a8b' }"
```

If any of these are missing, trace back to find where the data is lost.

## Next Steps

1. Open app and check console logs
2. Share the logs if highlights still aren't showing
3. We can add more targeted logging based on what we find
