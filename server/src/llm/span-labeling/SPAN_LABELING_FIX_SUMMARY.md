# Span Labeling Quality Fix Summary

## Date: Session continuation

## Round 1 Fixes

Initial fixes addressed:
- Function words being labeled ("a", "through")
- Composite phrases not split ("detective's weathered hands")
- Camera movements fragmented

**Results after Round 1:**
| Metric | Before | After Round 1 | Change |
|--------|--------|---------------|--------|
| Wrong Categories | 40% | 20% | ✅ -50% |
| Fragmentation | 40% | 20% | ✅ -50% |
| Function Words | 40% | 0% | ✅ -100% |
| Composite Splitting | 40% | 0% | ✅ -100% |
| JSON Parse Failures | 0% | 20% | ❌ +20% |

## Round 2 Fixes (This Session)

### Remaining Issues After Round 1
1. **Parent category usage:** Model using `camera` instead of `camera.movement`
2. **Adverb fragmentation:** "slowly" labeled as `action.movement` separately from camera verb
3. **Direction word fragmentation:** "across" labeled as `environment.location` instead of part of action
4. **Weather fragmentation:** Still splitting weather descriptions

### Root Cause
The prompt said "use parent category if unsure" but never explicitly stated that camera verbs should ALWAYS use `camera.movement`. The model was technically following instructions but producing suboptimal results.

### Fix Applied

**File:** `templates/span-labeling-prompt.md`

Added new section "CRITICAL: Always Use Specific Attributes (Read Fourth)" immediately after the other CRITICAL sections:

```markdown
## CRITICAL: Always Use Specific Attributes (Read Fourth)

**USE ATTRIBUTES, NOT PARENT CATEGORIES when the meaning is clear:**

1. **Camera movements MUST use `camera.movement`** - NEVER just `camera`
   - ✅ "The camera pans left" → `camera.movement`
   - ❌ "The camera pans left" → `camera` (WRONG - too generic)
   - If ANY camera verb is present (pan, dolly, track, zoom, crane, tilt), use `camera.movement`

2. **Subject actions MUST use `action.movement`** - NEVER just `action`
   - ✅ "walks across the room" → `action.movement`

3. **Shot types MUST use `shot.type`** - NEVER just `shot`

4. **Adverbs belong with their verbs - include in the span:**
   - ✅ "slowly pans left" → ONE span `camera.movement`
   - ❌ "slowly" → `action.movement` + "pans left" → `camera.movement` (WRONG)

5. **Direction words in subject actions stay with the action:**
   - ✅ "walks across the room" → ONE span `action.movement`
   - ❌ "walks" + "across" → (WRONG - "across" is part of action)
```

Also updated RULE 1 in Disambiguation Rules:
```markdown
- **Critical: Camera verbs ALWAYS take precedence AND always use `camera.movement`, never just `camera`**
```

## Expected Results After Round 2

| Metric | Round 1 | Expected Round 2 |
|--------|---------|------------------|
| Wrong Categories | 20% | ~5% |
| Fragmentation | 20% | ~5% |
| Function Words | 0% | 0% |
| Composite Splitting | 0% | 0% |
| JSON Parse Failures | 20% | ~0% |

## Testing Recommendations

Run same 5 test cases and check specifically:

1. **Camera movements use `camera.movement`** - NOT `camera`
   - "The camera pans" → `camera.movement`
   - "camera slowly tracks" → `camera.movement`

2. **Adverbs stay with verbs**
   - "slowly pans" = ONE span
   - "quickly zooms" = ONE span

3. **Direction words stay with actions**
   - "walks across" = ONE span
   - "runs through" = ONE span

4. **Weather phrases unified**
   - "fallen leaves swirl around him in the brisk wind" = ONE span

## Files Modified

### Round 1
- `utils/promptBuilder.ts` - Disabled broken SemanticRouter example injection
- `templates/span-labeling-prompt.md` - Added CRITICAL sections for function words, phrase boundaries, composite splitting

### Round 2
- `templates/span-labeling-prompt.md` - Added "CRITICAL: Always Use Specific Attributes" section
- `templates/span-labeling-prompt.md` - Updated RULE 1 disambiguation guidance

## Rollback Plan

If issues occur:
1. Revert `templates/span-labeling-prompt.md` to previous version
2. Revert `utils/promptBuilder.ts` to previous version

## Future Work

### Priority 1: Fix Example Banks
Files to fix with valid taxonomy IDs:
- `routing/examples/creative.js`
- `routing/examples/technical.js`
- `routing/examples/academic.js`
- `routing/examples/conversational.js`

Then re-enable SemanticRouter in `promptBuilder.ts`.

### Priority 2: Validation-Side Improvements
Consider adding:
- Auto-upgrade parent categories to attributes when context is clear (e.g., `camera` → `camera.movement` if camera verb detected)
- Pre-merge check for function words (auto-remove "a", "the", etc.)
- More aggressive merge heuristics for weather/camera phrases
