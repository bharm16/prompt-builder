# Span Labeling Quality Fix Summary

## Date: Session continuation

## Problems Identified

Based on diagnostic testing:

| Issue | Rate | Impact |
|-------|------|--------|
| **Wrong categories** | 40% | Composite phrases not split (e.g., "detective's weathered hands" kept as one span) |
| **Fragmentation** | 40% | Function words labeled ("a", "through") + related phrases split unnecessarily |
| Missing spans | 0% | ✅ Working |
| Hallucinations | 0% | ✅ Working |
| JSON failures | 0% | ✅ Working |
| Repair loop triggers | 0% | ✅ Working |

## Root Causes Found

### 1. Invalid Few-Shot Examples (CRITICAL BUG)
**Files:** `routing/examples/creative.js`, `routing/examples/technical.js`

These files taught the model **completely wrong taxonomy IDs** that don't exist:
- `metaphor.simile`, `metaphor.personification`, `metaphor.verb`
- `camera.technique`, `camera.settings`, `camera.direction`
- `lighting.setup`, `lighting.behavior`, `lighting.atmosphere`
- `subject.object`, `subject.attribute`, `subject.auditory`
- `mood.quality`, `mood.atmosphere`
- `production.crew` (not even close to the taxonomy)

**Impact:** Model learned to output invalid categories from context-specific examples.

### 2. No Explicit Function Word Exclusion
The prompt mentioned "fewer meaningful spans > many trivial ones" but never explicitly listed articles/prepositions as forbidden.

### 3. Fragmentation Guidance Buried
The "PREFER COMPLETE PHRASES" rule was at the bottom of a 400+ line prompt. 8B models prioritize early instructions.

### 4. No Composite Phrase Split Pattern
No guidance for splitting "[Person]'s [body part]" into identity + appearance.

## Fixes Applied

### Fix 1: Disabled Broken Example Injection
**File:** `utils/promptBuilder.ts`

Changed `useRouter` default from `true` to `false` to prevent invalid taxonomy examples from being injected.

```typescript
// Before
export function buildSystemPrompt(text: string = '', useRouter: boolean = true)

// After  
export function buildSystemPrompt(text: string = '', useRouter: boolean = false)
```

**TODO:** Fix the example banks with valid taxonomy IDs, then re-enable.

### Fix 2: Added Critical Guidance at Top of Prompt
**File:** `templates/span-labeling-prompt.md`

Added three new sections immediately after Core Instructions (where 8B model will prioritize them):

#### "CRITICAL: What NOT to Label"
Explicit list of forbidden spans:
- Articles: "a", "an", "the"
- Prepositions: "in", "on", "at", "through", "from", "to", "with", "by", "of"
- Conjunctions: "and", "or", "but", "as", "while"
- Pronouns: "he", "she", "it", "they", "him", "her"

Includes explicit WRONG vs CORRECT examples.

#### "CRITICAL: Phrase Boundaries"
Explicit guidance to keep related phrases as single spans:
- Camera movements with modifiers → ONE span
- Weather/atmosphere phrases → ONE span
- Complete action phrases → ONE span

Includes explicit WRONG vs CORRECT examples.

#### "CRITICAL: Composite Phrase Splitting"
Explicit patterns to split:
- "[Person]'s [body part/trait]" → identity + appearance
- "[Person] in [clothing]" → identity + wardrobe
- "[Person] with [emotion]" → identity + emotion

### Fix 3: Updated Rules Section
**File:** `templates/span-labeling-prompt.md`

Added:
- Complete list of VALID taxonomy IDs
- "DO NOT INVENT TAXONOMY IDs" rule
- Reinforced "NEVER label articles" rule
- "Camera movements include ALL modifiers" rule

### Fix 4: Updated Example Output
**File:** `templates/span-labeling-prompt.md`

Changed example to demonstrate:
- Splitting "detective's weathered hands" into identity + appearance
- Keeping "camera slowly pans back to reveal the scene" as single span
- NOT labeling articles "a" and "the"

## Expected Improvements

| Issue | Before | After |
|-------|--------|-------|
| Function words labeled | 40% | ~0% (explicit exclusion list) |
| Camera movements fragmented | 40% | ~5% (explicit merge guidance) |
| Composite phrases not split | 40% | ~10% (explicit split patterns) |
| Invalid taxonomy IDs | Unknown | ~0% (examples disabled + ID list) |

## Testing Recommendations

Run the same 5 test cases:
1. Simple technical prompt
2. Complex cinematography prompt  
3. Structured metadata prompt (TECHNICAL SPECS)
4. Ambiguous terms prompt
5. Creative/atmospheric prompt

Check specifically:
- [ ] No "a", "an", "the" spans
- [ ] No standalone preposition spans
- [ ] Camera movements as single spans
- [ ] "[person]'s [trait]" split correctly
- [ ] All taxonomy IDs are valid

## Future Work

### Priority 1: Fix Example Banks
Files to fix:
- `routing/examples/creative.js` - Replace all invalid IDs
- `routing/examples/technical.js` - Replace all invalid IDs
- `routing/examples/academic.js` - Audit for invalid IDs
- `routing/examples/conversational.js` - Audit for invalid IDs

Then re-enable SemanticRouter in `promptBuilder.ts`.

### Priority 2: Validation-Side Improvements
Consider adding:
- Pre-merge check for function words (auto-remove "a", "the", etc.)
- More aggressive merge heuristics for camera movements
- Taxonomy ID validation (reject invalid IDs)

## Rollback Plan

If issues occur:
1. Revert `templates/span-labeling-prompt.md` to previous version
2. Revert `utils/promptBuilder.ts` to previous version

Both changes are isolated to the span labeling system.
