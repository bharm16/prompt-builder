# Refactoring Analysis Summary

**Date:** Current Session
**Analyst:** Claude Code
**Methodology:** 3-Step Refactoring Process (Analyze → Review → Execute)

---

## Files Analyzed (Step 1 Complete)

### ✅ File 1: useSpanLabeling.js - **ALREADY REFACTORED** (Skip)
- **Status:** Has proper folder structure already
- **Lines:** 438 lines
- **Verdict:** Reference example of good architecture
- **Structure:** Already has api/, config/, services/, utils/, __tests__/
- **Action:** No refactoring needed

---

### ⚠️ File 2: WizardVideoBuilder.jsx - **NEEDS REFACTORING**
- **Status:** Multiple architectural problems
- **Lines:** 584 lines
- **Complexity:** MEDIUM

#### Architectural Problems:
1. **Multiple useState (should be useReducer):** 9 separate useState calls (lines 35-72)
2. **Business Logic in Orchestrator:**
   - LocalStorage logic (113-201) → extract to hooks/useWizardPersistence.js
   - Auto-save logic (138-163) → extract to hooks/useAutoSave.js  
   - Validation logic (267-292) → extract to hooks/useWizardValidation.js
3. **Inline Configuration:**
   - mobileFields array (88-96) → extract to config/fieldConfig.js
   - Constants (78-80, 99) → extract to config/constants.js

#### Proposed Structure:
```
WizardVideoBuilder/
├── WizardVideoBuilder.jsx (~350-400 lines)
├── hooks/
│   ├── useWizardState.js (~150 lines) - useReducer for all state
│   ├── useWizardPersistence.js (~100 lines)
│   ├── useAutoSave.js (~50 lines)
│   ├── useWizardValidation.js (~100 lines)
│   ├── useResponsive.js (~60 lines)
│   └── useKeyboardShortcuts.js (~40 lines)
├── config/
│   ├── fieldConfig.js (~80 lines)
│   ├── stepConfig.js (~30 lines)
│   └── constants.js (~20 lines)
└── utils/
    ├── promptGenerator.js (~40 lines)
    └── navigationHelpers.js (~30 lines)
```

#### Reference Patterns:
- Sibling components already refactored: StepCoreConcept/, StepQuickFill/
- VideoConceptBuilder/ - Original pattern source

---

### ✅ File 3: useVideoConceptState.js - **ALREADY WELL-ARCHITECTED** (Skip or Low Priority)
- **Status:** Uses correct useReducer pattern
- **Lines:** 291 lines
- **Verdict:** Skip or low priority

#### Why It's Good:
- ✅ Single useReducer pattern (not multiple useState)
- ✅ Clear action types (26 actions)
- ✅ Immutable state updates
- ✅ External utilities properly imported
- ✅ Memoized derived state
- ✅ Single responsibility

#### Optional Enhancement:
Could extract reducer to separate file for organization, but not critical. This file IS the reference pattern.

---

### ⚠️ File 4: useHighlightRendering.js - **NEEDS REFACTORING**
- **Status:** Mixed concerns in long effect
- **Lines:** 281 lines
- **Complexity:** MEDIUM

#### Architectural Problems:
1. **186-line effect** (59-245) with mixed concerns:
   - Validation logic
   - Span processing  
   - Text matching
   - DOM manipulation
   - Performance tracking
2. **Inline configuration:** Debug flag, hardcoded styles
3. **Complex logic in hook:** Should be pure functions

#### Proposed Structure:
```
useHighlightRendering/
├── useHighlightRendering.js (~80 lines)
├── hooks/
│   └── useHighlightFingerprint.js (~30 lines)
├── utils/
│   ├── spanProcessing.js (~60 lines)
│   ├── textMatching.js (~50 lines)
│   ├── domManipulation.js (~80 lines)
│   └── coverageTracking.js (~30 lines)
└── config/
    ├── constants.js (~40 lines)
    └── highlightStyles.js (~30 lines)
```

#### Benefits:
- Pure functions testable independently
- Span processing testable without DOM
- Text matching testable without React
- Better code organization

---

### ⚠️ File 5: PromptOptimizerContainer.jsx - **NEEDS REFACTORING**
- **Status:** Still too large despite previous refactoring
- **Lines:** 716 lines (reduced from 1,403)
- **Complexity:** MEDIUM-HIGH

#### Architectural Problems:
1. **Massive context destructuring:** 50+ values from usePromptState
2. **Long event handlers in component:**
   - handleOptimize (48 lines)
   - handleConceptComplete (53 lines)
   - handleSuggestionClick (38 lines)
   - fetchEnhancementSuggestions (84 lines)
3. **Business logic in component:** Should be in hooks

#### Proposed Structure:
```
PromptOptimizerContainer/
├── PromptOptimizerContainer.jsx (~250-300 lines)
├── hooks/
│   ├── usePromptLoader.js (~100 lines)
│   ├── useHighlightsPersistence.js (~80 lines)
│   ├── usePromptHistory.js (~80 lines)
│   ├── usePromptOptimization.js (~100 lines)
│   ├── useConceptBrainstorm.js (~120 lines)
│   ├── useSuggestionApplication.js (~100 lines)
│   └── useEnhancementSuggestions.js (~150 lines)
├── utils/
│   ├── payloadBuilder.js (~80 lines)
│   └── promptHelpers.js (~40 lines)
└── config/
    └── constants.js (~20 lines)
```

#### Note:
Already partially refactored (UI components extracted). This refactoring focuses on extracting business logic to custom hooks.

---

## Files Analyzed (Continued)

### ⚠️ File 6: StepAtmosphere.jsx - **NEEDS REFACTORING**
- **Status:** Should follow sibling pattern
- **Lines:** 494 lines
- **Complexity:** LOW-MEDIUM
- **Issue:** Flat file with inline styles, should match StepCoreConcept/StepQuickFill pattern
- **Advantage:** Can reuse hooks/components from sibling wizard steps

### ⚠️ File 7: EnhancementService.js - **NEEDS REFACTORING**
- **Status:** One massive method (377 lines)
- **Lines:** 582 lines total
- **Complexity:** HIGH
- **Issue:** getEnhancementSuggestions method with 87-line while loop for fallback logic
- **Priority:** Extract FallbackRegenerationService

---

### ⚠️ File 8: QualityFeedbackSystem.js - **NEEDS REFACTORING**
- **Status:** Mixed responsibilities across single class
- **Lines:** 556 lines total
- **Complexity:** MEDIUM
- **Issue:** Feature extraction, quality assessment, model management, and data storage all in one class
- **Priority:** Extract to specialized services (FeatureExtractor, QualityAssessor, QualityModel, FeedbackRepository)

### ⚠️ File 9: VideoPromptService.js - **NEEDS REFACTORING**
- **Status:** ~45% configuration disguised as code
- **Lines:** 563 lines total
- **Complexity:** MEDIUM-HIGH
- **Issue:** 217-line method with 7 inline functions, ~250 lines of hardcoded configuration
- **Priority:** Extract all configuration to config files, create specialized services

---

## Misclassified Utils Analysis

### ❌ File 10: SemanticCacheEnhancer.js - **MISCLASSIFIED**
- **Status:** Should be a SERVICE, not util
- **Lines:** 366 lines
- **Issue:** Complex business logic with state management in utils/
- **Action:** Move to services/cache/SemanticCacheService.js
- **Complexity:** MEDIUM

### ❌ File 11: ConcurrencyLimiter.js - **MISCLASSIFIED**
- **Status:** Should be a SERVICE, not util
- **Lines:** 337 lines
- **Issue:** Stateful service with infrastructure dependencies in utils/
- **Action:** Move to services/concurrency/ConcurrencyService.js
- **Complexity:** LOW-MEDIUM

### ⚠️ File 12: validation.js - **MIXED**
- **Status:** Schema config mixed with validation logic
- **Lines:** 285 lines
- **Issue:** Joi schemas (config) mixed with validation functions
- **Action:** Split schemas to config/, validation logic to middleware/
- **Complexity:** LOW

---

## Refactoring Priority Ranking

Based on architectural debt severity:

1. **🔴 HIGH:** WizardVideoBuilder.jsx
   - Multiple useState anti-pattern
   - Business logic mixed in component
   - Sibling components already refactored (good reference)

2. **🔴 HIGH:** PromptOptimizerContainer.jsx
   - Large file with complex business logic
   - High-traffic file (many developers)
   - Would benefit from hook extraction

3. **🟡 MEDIUM:** useHighlightRendering.js
   - Long effect with mixed concerns
   - Pure functions extractable
   - Good testing opportunities

4. **🟡 MEDIUM:** StepAtmosphere.jsx
   - Similar to sibling components
   - Should follow StepCoreConcept/StepQuickFill pattern

5. **🟢 LOW:** useVideoConceptState.js
   - Already well-architected
   - Optional organizational improvements only

6. **⚪ SKIP:** useSpanLabeling.js
   - Already refactored properly
   - Reference example

---

## Next Steps

1. ✅ Complete Step 1 analyses for remaining files (6-12)
2. Present all analyses for **Step 2: Review & Approve**
3. Upon approval, proceed to **Step 3: Execute Refactoring** one file at a time
4. Create REFACTORING_SUMMARY.md for each completed refactoring
5. Run validation tests after each refactoring

---

## Validation Checklist (Per File)

After each refactoring:
- [ ] Main orchestrator ≤ 500 lines (guideline, not hard cap)
- [ ] Specialized modules ≤ 300 lines each (guideline, not hard cap)
- [ ] Hooks ≤ 150 lines each (guideline, not hard cap)
- [ ] Utils ≤ 100 lines each (guideline, not hard cap)
- [ ] Public API unchanged (no breaking changes)
- [ ] All tests pass
- [ ] REFACTORING_SUMMARY.md created
- [ ] Follows established pattern (VideoConceptBuilder or PromptOptimizationService)

**Note:** Line counts are guidelines focused on architectural quality, not hard caps.

