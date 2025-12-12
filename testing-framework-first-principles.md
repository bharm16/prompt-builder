# Testing Framework: First Principles Analysis

## Current State Assessment

### What Exists
1. **RelaxedF1Evaluator** - Span position + category matching with IoU threshold
2. **Golden set** - 4 JSON files (core, technical, edge-cases, adversarial) 
3. **Diagnostic script** - One-off analysis, not CI-integrated
4. **Some unit tests** - Scattered, not comprehensive

### What's Missing
1. No regression testing on prompt changes
2. No suggestion quality measurement
3. No end-to-end pipeline validation
4. Golden sets are small (~5 prompts per category)
5. No automated baseline comparison

---

## The Wrong Questions

| Wrong Question | Why It's Wrong |
|----------------|----------------|
| "How do we test more?" | Volume doesn't equal coverage |
| "How do we mock the LLM?" | Mocking defeats the purpose - we need to test LLM behavior |
| "How do we make tests faster?" | Speed at the cost of accuracy is useless |
| "How do we test everything?" | Not everything is measurable or worth measuring |

## The Right Questions

1. **What defines "good" for each output type?**
2. **What can we actually measure objectively?**
3. **What changes should trigger re-evaluation?**
4. **What's the minimum set that catches real regressions?**

---

## First Principles: The Three Outputs

Your system produces three distinct outputs. Each needs different evaluation criteria.

### Output 1: Span Labeling
**What it is:** Identifying visual control points in a video prompt
**Ground truth exists:** Yes (human-annotated golden sets)
**Measurement:** Precision, Recall, F1 + Category Accuracy

### Output 2: Suggestions  
**What it is:** Alternative phrases for a highlighted span
**Ground truth exists:** Partially (there's no single "right" suggestion)
**Measurement:** Quality dimensions (diversity, relevance, category coherence)

### Output 3: Optimized Prompts
**What it is:** Enhanced full prompts for video generation
**Ground truth exists:** No (there's no "correct" optimization)
**Measurement:** Proxy metrics (structure, completeness, constraint adherence)

---

## Output 1: Span Labeling Quality

### The Test
> "Given a video prompt, does the system identify the same visual control points a human expert would?"

### Why RelaxedF1 Is Correct
Your existing evaluator is actually well-designed. Exact match is too harsh because:
- "soft highlights on the contours" vs "soft highlights" - both acceptable
- Position drift of 1-2 characters shouldn't matter
- The CATEGORY matters more than exact boundaries

### What's Missing from Current Implementation

#### 1. Coverage by Category
You need to know: "Are we bad at detecting lighting, or actions?"

```
Category Breakdown:
- subject.identity:    F1=0.92 ✓
- subject.wardrobe:    F1=0.78 ⚠️
- action.movement:     F1=0.85 ✓
- lighting:            F1=0.65 ✗  ← Problem area
- camera.movement:     F1=0.71 ⚠️
```

#### 2. Confusion Matrix
Which categories get mixed up?

```
Predicted →    subject.id  subject.app  action.mov
Ground Truth ↓
subject.id        45           8            2
subject.app       12          31            0
action.mov         1           0           52
```

This reveals: "subject.identity and subject.appearance are confused 20% of the time"

#### 3. Fragmentation Rate
Not in your evaluator. From your diagnostic: "40% fragmentation rate"

```javascript
// Fragmentation = when one ground truth span becomes multiple predicted spans
function calculateFragmentationRate(predicted, groundTruth) {
  let fragmentedCount = 0;
  
  for (const gt of groundTruth) {
    const overlapping = predicted.filter(p => hasOverlap(p, gt));
    if (overlapping.length > 1) fragmentedCount++;
  }
  
  return fragmentedCount / groundTruth.length;
}
```

#### 4. Over-extraction Rate
Not in your evaluator. Opposite of missing spans.

```javascript
// Over-extraction = spans that don't match any ground truth
function calculateOverExtractionRate(predicted, groundTruth) {
  const spurious = predicted.filter(p => 
    !groundTruth.some(gt => hasSignificantOverlap(p, gt))
  );
  return spurious.length / predicted.length;
}
```

### Golden Set Requirements

**Current:** ~20 prompts total
**Needed:** ~100+ prompts for statistical significance

**Distribution:**
- 40% Core (subject + action + setting) - the common case
- 20% Technical (specs, camera, lighting) - precision matters
- 20% Complex (multi-subject, long narrative) - stress test
- 10% Edge cases (minimal prompts, unusual formats)
- 10% Adversarial (injection attempts, broken prompts)

---

## Output 2: Suggestion Quality

### The Fundamental Challenge

**There is no "correct" suggestion.**

Given: "golden hour lighting"
These are ALL valid:
- "soft morning light" (different time)
- "dramatic sunset glow" (intensified)  
- "harsh midday sun" (contrasting)
- "neon city lights" (complete change)

### The Test
> "Given a span, are the suggestions (a) diverse, (b) category-coherent, (c) usable, and (d) not repeating what the user already wrote?"

### Measurable Quality Dimensions

#### Dimension 1: Category Coherence
**Question:** Does the suggestion stay in the same visual category?

```javascript
// If original span is "lighting", suggestion should also be lighting
function categoryCoherence(originalCategory, suggestion, classifier) {
  const suggestedCategory = classifier.categorize(suggestion);
  return isSameParentCategory(originalCategory, suggestedCategory);
}
```

**Target:** >90% coherence

#### Dimension 2: Semantic Diversity  
**Question:** Are the suggestions different from each other?

```javascript
// Calculate pairwise semantic similarity
function measureDiversity(suggestions) {
  const embeddings = suggestions.map(s => embed(s));
  let totalSimilarity = 0;
  let pairs = 0;
  
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      totalSimilarity += cosineSimilarity(embeddings[i], embeddings[j]);
      pairs++;
    }
  }
  
  // Lower average similarity = more diverse
  return 1 - (totalSimilarity / pairs);
}
```

**Target:** >0.5 diversity score (suggestions should be <50% similar on average)

#### Dimension 3: Non-Repetition
**Question:** Are suggestions different from the original?

```javascript
function nonRepetition(original, suggestion) {
  // Exact match check
  if (normalize(original) === normalize(suggestion)) return 0;
  
  // Semantic similarity check
  const similarity = cosineSimilarity(embed(original), embed(suggestion));
  return 1 - similarity;
}
```

**Target:** >0.6 non-repetition (suggestions should be <40% similar to original)

#### Dimension 4: Syntactic Validity
**Question:** Can the suggestion drop into the prompt without breaking grammar?

```javascript
function syntacticValidity(fullPrompt, spanStart, spanEnd, suggestion) {
  const modified = fullPrompt.slice(0, spanStart) + suggestion + fullPrompt.slice(spanEnd);
  return grammarCheck(modified).score;
}
```

**Target:** >95% syntactic validity

#### Dimension 5: Length Appropriateness  
**Question:** Is the suggestion a reasonable length relative to original?

```javascript
function lengthAppropriateness(original, suggestion) {
  const ratio = suggestion.length / original.length;
  // Ideal: 0.5x to 2x the original length
  if (ratio >= 0.5 && ratio <= 2.0) return 1.0;
  if (ratio >= 0.3 && ratio <= 3.0) return 0.7;
  return 0.3;
}
```

**Target:** >80% within 0.5x-2x range

### Suggestion Test Set Structure

You don't need "correct answers" - you need test inputs with expected quality ranges:

```json
{
  "id": "sugg-001",
  "prompt": "A woman in a red dress walking through a misty forest at dawn",
  "span": { "text": "red dress", "category": "subject.wardrobe" },
  "expectedQualities": {
    "categoryCoherence": { "min": 0.9 },
    "diversity": { "min": 0.5 },
    "nonRepetition": { "min": 0.6 },
    "syntacticValidity": { "min": 0.95 }
  },
  "forbiddenOutputs": ["red dress", "dress", "red"], // Too similar
  "allowedCategories": ["subject.wardrobe", "subject.appearance"]
}
```

---

## Output 3: Prompt Optimization Quality

### The Fundamental Challenge

**There is no "correct" optimized prompt.**

Given: "dog running in park"
These are ALL valid optimizations:
- "A golden retriever sprinting through Central Park, morning light, handheld camera" (elaborated)
- "Medium shot of a dog running through a sunlit park, shallow depth of field" (technical)
- "Energetic canine bounding across green grass, dynamic motion blur" (stylized)

### The Test
> "Given an input prompt, does the optimization (a) preserve intent, (b) add useful detail, (c) follow video prompt best practices?"

### Measurable Quality Dimensions

#### Dimension 1: Intent Preservation
**Question:** Does the optimized prompt still describe the same video?

```javascript
function intentPreservation(original, optimized) {
  // Extract core semantic elements from both
  const originalSubjects = extractSubjects(original);
  const optimizedSubjects = extractSubjects(optimized);
  
  // All original subjects should appear in optimized
  const preserved = originalSubjects.every(s => 
    optimizedSubjects.some(os => semanticMatch(s, os))
  );
  
  return preserved ? 1.0 : 0.0;
}
```

**Target:** 100% intent preservation (non-negotiable)

#### Dimension 2: Structural Completeness
**Question:** Does the optimized prompt have all key elements?

```javascript
function structuralCompleteness(optimized) {
  const elements = {
    hasSubject: detectSubject(optimized),
    hasAction: detectAction(optimized),
    hasEnvironment: detectEnvironment(optimized),
    hasCameraOrLighting: detectCameraOrLighting(optimized)
  };
  
  return Object.values(elements).filter(Boolean).length / 4;
}
```

**Target:** >75% completeness (at least 3/4 elements)

#### Dimension 3: Word Count Compliance
**Question:** Is the prompt within optimal range?

```javascript
function wordCountCompliance(optimized) {
  const words = optimized.split(/\s+/).length;
  // Your research says 75-125 words is optimal
  if (words >= 75 && words <= 125) return 1.0;
  if (words >= 50 && words <= 150) return 0.8;
  if (words >= 30 && words <= 200) return 0.5;
  return 0.2;
}
```

**Target:** >80% in optimal range

#### Dimension 4: Technical Term Density
**Question:** Does the prompt include cinematographic vocabulary?

```javascript
const TECHNICAL_TERMS = [
  'close-up', 'medium shot', 'wide shot', 'tracking', 'pan', 'dolly',
  'depth of field', 'bokeh', 'golden hour', 'high-key', 'low-key',
  'handheld', 'steady', 'rack focus', 'chiaroscuro', /* etc */
];

function technicalDensity(optimized) {
  const words = optimized.toLowerCase().split(/\s+/);
  const technicalCount = TECHNICAL_TERMS.filter(term => 
    optimized.toLowerCase().includes(term)
  ).length;
  
  // Target: 2-5 technical terms per prompt
  if (technicalCount >= 2 && technicalCount <= 5) return 1.0;
  if (technicalCount >= 1 && technicalCount <= 7) return 0.7;
  return 0.3;
}
```

**Target:** >70% have 2+ technical terms

#### Dimension 5: Model-Specific Compliance
**Question:** Does the prompt follow target model's conventions?

```javascript
function modelCompliance(optimized, targetModel) {
  const rules = MODEL_RULES[targetModel];
  let score = 1.0;
  
  // Example: Sora doesn't like explicit durations in text
  if (targetModel === 'sora' && /\d+\s*(seconds?|s)\b/.test(optimized)) {
    score -= 0.2;
  }
  
  // Example: Veo3 works better with technical camera terms
  if (targetModel === 'veo3' && !hasCameraTerms(optimized)) {
    score -= 0.1;
  }
  
  return Math.max(0, score);
}
```

**Target:** >85% model compliance

### Optimization Test Set Structure

```json
{
  "id": "opt-001",
  "input": "dog running in park",
  "expectedQualities": {
    "intentPreservation": { "min": 1.0 },
    "structuralCompleteness": { "min": 0.75 },
    "wordCountCompliance": { "min": 0.8 },
    "technicalDensity": { "min": 0.7 }
  },
  "requiredElements": ["dog", "running", "park"],
  "forbiddenPatterns": ["violence", "explicit"],
  "targetModel": "sora"
}
```

---

## Implementation Architecture

### Testing Hierarchy

```
tests/
├── evaluation/
│   ├── span-labeling/
│   │   ├── SpanLabelingEvaluator.ts       # Your RelaxedF1Evaluator + extensions
│   │   ├── golden-sets/
│   │   │   ├── core.json                   # 40 prompts
│   │   │   ├── technical.json              # 20 prompts
│   │   │   ├── complex.json                # 20 prompts
│   │   │   ├── edge-cases.json             # 10 prompts
│   │   │   └── adversarial.json            # 10 prompts
│   │   └── SpanLabelingBenchmark.ts        # Runs all, outputs report
│   │
│   ├── suggestions/
│   │   ├── SuggestionQualityEvaluator.ts   # 5 quality dimensions
│   │   ├── test-cases/
│   │   │   ├── wardrobe.json               # Test cases by category
│   │   │   ├── lighting.json
│   │   │   ├── camera.json
│   │   │   └── action.json
│   │   └── SuggestionBenchmark.ts
│   │
│   └── optimization/
│       ├── OptimizationQualityEvaluator.ts # 5 quality dimensions
│       ├── test-cases/
│       │   ├── minimal-prompts.json        # "dog in park" → full prompt
│       │   ├── partial-prompts.json        # Already has some detail
│       │   └── complex-prompts.json        # Long narratives
│       └── OptimizationBenchmark.ts
│
├── regression/
│   ├── baselines/
│   │   ├── span-labeling-baseline.json     # Last known good metrics
│   │   ├── suggestions-baseline.json
│   │   └── optimization-baseline.json
│   └── RegressionRunner.ts                 # Compare current vs baseline
│
└── ci/
    └── quality-gate.ts                     # Pass/fail for CI
```

### Quality Gate Thresholds

```typescript
// ci/quality-gate.ts
export const QUALITY_THRESHOLDS = {
  spanLabeling: {
    relaxedF1: 0.85,           // Current target
    taxonomyAccuracy: 0.90,
    fragmentationRate: 0.20,   // Max 20% fragmentation
    overExtractionRate: 0.15,  // Max 15% spurious spans
    regressionTolerance: 0.02  // Don't drop more than 2% from baseline
  },
  
  suggestions: {
    categoryCoherence: 0.90,
    diversity: 0.50,
    nonRepetition: 0.60,
    syntacticValidity: 0.95,
    regressionTolerance: 0.05
  },
  
  optimization: {
    intentPreservation: 1.00,  // Non-negotiable
    structuralCompleteness: 0.75,
    wordCountCompliance: 0.80,
    technicalDensity: 0.70,
    regressionTolerance: 0.05
  }
};
```

---

## Critical Implementation Notes

### 1. LLM Calls Are Required
You cannot mock the LLM for quality evaluation. The whole point is testing LLM behavior.

**Solution:** Dedicated evaluation environment with rate limiting:
```typescript
const EVAL_RATE_LIMIT = {
  spanLabeling: 10,      // prompts/minute
  suggestions: 20,       // spans/minute  
  optimization: 5        // prompts/minute
};
```

### 2. Non-Determinism Is Expected
LLMs don't return identical outputs. Run evaluations multiple times.

```typescript
async function evaluateWithConfidence(input, runs = 3) {
  const results = await Promise.all(
    Array(runs).fill(null).map(() => evaluate(input))
  );
  
  return {
    mean: mean(results),
    stdDev: stdDev(results),
    min: Math.min(...results),
    max: Math.max(...results)
  };
}
```

### 3. Baseline Comparison Is Essential
Absolute metrics are less useful than relative changes.

```typescript
// Did we get better or worse?
function compareToBaseline(current, baseline) {
  return {
    relaxedF1: {
      current: current.relaxedF1,
      baseline: baseline.relaxedF1,
      delta: current.relaxedF1 - baseline.relaxedF1,
      regression: current.relaxedF1 < baseline.relaxedF1 - TOLERANCE
    }
  };
}
```

### 4. Category-Specific Analysis Is Required
Overall F1 can hide category-specific problems.

```typescript
// Don't just report: "F1 = 0.85"
// Report: "F1 = 0.85 overall, but lighting = 0.65 (problem)"
function analyzeByCategory(results) {
  const byCategory = groupBy(results, 'groundTruthCategory');
  
  const problemCategories = Object.entries(byCategory)
    .filter(([cat, data]) => data.f1 < THRESHOLD)
    .map(([cat, data]) => ({ category: cat, f1: data.f1 }));
    
  return { overall: results.f1, problemCategories };
}
```

---

## What To Build First

### Phase 1: Span Labeling (Week 1)
You already have RelaxedF1Evaluator. Extend it:
1. Add fragmentation rate metric
2. Add over-extraction rate metric  
3. Add confusion matrix generation
4. Expand golden set to 100 prompts
5. Create baseline and regression runner

### Phase 2: Suggestion Quality (Week 2)
New evaluator needed:
1. Build SuggestionQualityEvaluator with 5 dimensions
2. Create test case format (span + context + expected qualities)
3. Build 50 test cases across categories
4. Create baseline

### Phase 3: Optimization Quality (Week 3)
New evaluator needed:
1. Build OptimizationQualityEvaluator with 5 dimensions
2. Create test case format (input + expected qualities)
3. Build 30 test cases
4. Create baseline

### Phase 4: CI Integration (Week 4)
1. Quality gate script
2. GitHub Actions workflow
3. Baseline auto-update mechanism
4. Regression alerting

---

## Summary

| Output | Ground Truth | Primary Metric | Secondary Metrics |
|--------|--------------|----------------|-------------------|
| Span Labeling | Yes (golden set) | Relaxed F1 | Category accuracy, fragmentation, over-extraction |
| Suggestions | No (quality dimensions) | Category coherence | Diversity, non-repetition, syntax, length |
| Optimization | No (quality dimensions) | Intent preservation | Completeness, word count, technical density, model compliance |

**Key Insight:** You can't test suggestion/optimization with "right answers" - you test with quality dimensions and regression from baseline.

---

## Files To Create

1. `server/src/llm/span-labeling/evaluation/SpanLabelingEvaluator.ts` - Extended evaluator
2. `server/src/services/enhancement/evaluation/SuggestionQualityEvaluator.ts` - New
3. `server/src/services/prompt-optimization/evaluation/OptimizationQualityEvaluator.ts` - New
4. `tests/evaluation/baselines/` - Baseline JSON files
5. `tests/ci/quality-gate.ts` - CI script
6. Expanded golden sets (100 span labeling, 50 suggestions, 30 optimization)
