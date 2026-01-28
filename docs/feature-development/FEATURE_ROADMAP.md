# PromptCanvas: Feature Roadmap

> **Last Updated:** December 2024  
> **Companion Doc:** `CURRENT_CAPABILITIES.md` (what already exists)

---

## Prioritization Criteria

Features ranked by:
1. **Value** - User impact and differentiation potential
2. **Complexity** - Implementation effort given current codebase
3. **Dependencies** - What must exist first

Complexity scale:
- ★☆☆☆☆ = Days (leverages existing code)
- ★★☆☆☆ = 1 week
- ★★★☆☆ = 2-3 weeks
- ★★★★☆ = 1 month
- ★★★★★ = 1+ months

---

## Tier 1: High Value, Low Complexity

These leverage existing backend services that just need UI exposure.

### 1. Model-Specific Export Profiles

**Value:** ★★★★★ | **Complexity:** ★★☆☆☆

Surface `ModelDetectionService` to users with one-click export optimization.

**What exists:**
- `ModelDetectionService` with full capabilities for 5 models
- `getModelSpecificGuidance(model, category)` returns actionable tips
- `formatModelContext(model)` generates prompt context

**What to build:**
- Export dropdown UI component
- Transformation pass that applies model guidance
- Optional: diff view showing changes made

**Implementation:**
```
1. Add model selector dropdown to export UI
2. On export, call ModelDetectionService.getModelOptimalParams()
3. Apply transformations based on model strengths/weaknesses
4. Show user what was adjusted
```

**Why first:** Unique differentiator. "The only tool that optimizes per-model."

---

### 2. LLM Quality Scoring in UI

**Value:** ★★★★☆ | **Complexity:** ★★☆☆☆

Wire existing `LLMJudgeService` to replace heuristic scoring.

**What exists:**
- `LLMJudgeService` with rubric-based evaluation
- Video-specific and general rubrics
- Multi-criteria breakdown

**What to build:**
- API endpoint to expose LLM judge (or use existing if present)
- Update `QualityScore.tsx` to fetch real scores
- Loading state while LLM evaluates
- Detailed breakdown modal

**Considerations:**
- LLM calls add latency—make this optional or async
- Cache results aggressively
- Consider free tier vs paid tier access

---

### 3. Physics/Forces Vocabulary Suggestions

**Value:** ★★★★★ | **Complexity:** ★★☆☆☆

Enhance suggestion engine with physics-focused alternatives.

**What exists:**
- Suggestion generation pipeline
- Category-aware context

**What to build:**
- Physics vocabulary reference (forces, materials, motion)
- Detection of "static" descriptions
- Transformation suggestions: appearance → forces

**Examples:**
```
"fast car" → "chassis compressing under braking, tires gripping asphalt"
"flowing dress" → "silk catching wind resistance, fabric weight pulling downward"
"falling leaves" → "leaves tumbling with air resistance, spiraling descent"
```

**Why important:** 2025 video models are physics simulators. This aligns prompts with how models actually work.

---

### 4. Negative Prompt Support

**Value:** ★★★★☆ | **Complexity:** ★★☆☆☆

Add negative prompt fields for models that support them (Kling, SD-based).

**What to build:**
- Add `negative_prompt` to `VideoPromptSlots` type
- UI field for negative prompts
- Auto-generation based on subject (e.g., "hands" → "malformed fingers")
- Model-specific negative prompt templates

**Schema addition:**
```typescript
interface VideoPromptSlots {
  // ... existing fields
  negative_visual?: string;
  negative_motion?: string;
  negative_audio?: string;
}
```

---

## Tier 2: High Value, Medium Complexity

Require new UI components or significant integration work.

### 5. A/B Variation Generator

**Value:** ★★★★★ | **Complexity:** ★★★☆☆

Generate controlled variations by systematically swapping categories.

**What exists:**
- Span labeling identifies replaceable elements
- Category-aware suggestions

**What to build:**
- Variation generation logic (swap one category at a time)
- Side-by-side comparison UI
- Optional: tracking which variation performs best

**Approach:**
```
Original: "Golden hour lighting on a beach"

Generate variations by category:
- Lighting: "Overcast diffused lighting on a beach"
- Lighting: "Blue hour twilight on a beach"
- Environment: "Golden hour lighting in a forest"
```

**Monetization:** Free tier = 3 variations, Paid = unlimited

---

### 6. Version History with Diff View

**Value:** ★★★☆☆ | **Complexity:** ★★☆☆☆

Add visual diff between prompt versions.

**What exists:**
- `usePromptHistory` stores full version history
- Timestamps and metadata

**What to build:**
- Diff algorithm (word-level or span-level)
- Diff visualization component
- Navigation between versions

**Libraries to consider:**
- `diff` npm package for text diffing
- Custom span-aware diff for category changes

---

### 7. Span Keyboard Navigation

**Value:** ★★★☆☆ | **Complexity:** ★★☆☆☆

Power user mode: Tab between spans, arrows cycle suggestions.

**What exists:**
- Keyboard shortcut infrastructure
- Span selection state

**What to build:**
- Tab handler to move between spans
- Arrow key handlers within suggestion panel
- Enter to apply selected suggestion
- Visual focus indicators

**Shortcuts to add:**
```
Tab / Shift+Tab - Next/previous span
↑ / ↓ - Cycle suggestions
Enter - Apply suggestion
Esc - Deselect span
```

---

### 8. Expanded Template Library

**Value:** ★★★★☆ | **Complexity:** ★★★☆☆

Grow from 3 templates to 20+ with categories.

**What exists:**
- Template infrastructure (`templates.ts`, `VideoTemplateRepository.ts`)
- Template selector UI

**What to build:**
- 15-20 new templates across categories
- Category organization (Product, Nature, Action, Portrait, Abstract, etc.)
- Search/filter by category
- Preview thumbnails (optional)

**Template categories:**
1. Product demos (tech, fashion, food)
2. Nature/wildlife
3. Urban/action
4. Portrait/character
5. Abstract/experimental
6. Transitions/morphs

---

## Tier 3: Medium Value, Variable Complexity

Nice-to-haves that improve experience but aren't differentiators.

### 9. Side-by-Side Prompt Comparison

**Value:** ★★★☆☆ | **Complexity:** ★★☆☆☆

Compare two prompts with category-aware highlighting.

**Use cases:**
- Compare before/after optimization
- Compare two saved prompts
- Learn from differences

---

### 10. Batch Optimization (User-Facing)

**Value:** ★★★☆☆ | **Complexity:** ★★★☆☆

Upload multiple prompts, optimize all at once.

**What exists:**
- Internal request batching middleware

**What to build:**
- Multi-prompt upload UI
- Progress tracking
- Bulk export (CSV, JSON)

**Target users:** Agencies processing many prompts

---

### 11. Browser Extension

**Value:** ★★★☆☆ | **Complexity:** ★★★☆☆

Right-click any text → "Optimize in PromptCanvas"

**What to build:**
- Chrome extension (manifest v3)
- Context menu integration
- Open PromptCanvas with pre-filled text

**Acquisition channel potential:** Capture prompts from Reddit, Discord, Twitter

---

## Tier 4: Deprioritize

Features that sound good but have poor ROI.

### ❌ Real-time Collaboration

**Why skip:** Prompt editing is solo activity. WebSocket/CRDT complexity not justified. UUID sharing handles async collaboration.

### ❌ Mobile App

**Why skip:** Focus on mobile-optimized web. Native app adds maintenance burden without clear demand.

### ❌ Direct Video Generation API

**Why skip:** Wrong abstraction level. You'd own generation costs and failures. Stay as the "prompt layer."

### ❌ Voice/Audio Input

**Why skip:** Users are text-first. Adds complexity without proven demand.

---

## Technical Debt (Address Before New Features)

These issues compound if not addressed:

### 1. Span Labeling Accuracy

**Priority:** Critical

The "visual control point" reframe from `span-labeling-first-principles-analysis.md` is correct. Ensure spans represent **what users can change to affect video output**, not just "interesting phrases."

### 2. TypeScript Migration

**Priority:** High

Mixed `.js` and `.ts` files create maintenance burden. Complete migration before adding complexity.

### 3. Test Coverage

**Priority:** High

Use the test templates in `CLAUDE_CODE_TEST_TEMPLATES.md`. Focus on:
- Span labeling accuracy tests
- Model detection tests
- Suggestion quality tests

---

## Suggested Implementation Order

### Phase 1: Quick Wins (Weeks 1-2)
1. Model-Specific Export Profiles (surfaces existing backend)
2. Negative Prompt Support (simple schema + UI addition)

### Phase 2: Core Differentiators (Weeks 3-6)
3. Physics/Forces Vocabulary (suggestion enhancement)
4. LLM Quality Scoring in UI (wire existing service)
5. A/B Variation Generator (basic version)

### Phase 3: Polish (Weeks 7-10)
6. Span Keyboard Navigation
7. Version History with Diff
8. Expanded Template Library (10+ new templates)

### Phase 4: Growth (Weeks 11+)
9. Browser Extension
10. Batch Optimization
11. Community template submissions

---

## Success Metrics

| Feature | Key Metric |
|---------|------------|
| Model Export | % of exports using model-specific |
| Quality Score | Avg score improvement after viewing breakdown |
| A/B Variations | % of users generating variations |
| Templates | Template usage in new prompts |
| Keyboard Nav | Power user session length |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2024 | Prioritize Model Export over Gap Analysis | Gap analysis is redundant—optimization already fills missing categories |
| Dec 2024 | Skip real-time collaboration | Solo activity, async sharing sufficient |
| Dec 2024 | Focus on physics vocabulary | Aligns with 2025 model architecture (physics simulators) |
