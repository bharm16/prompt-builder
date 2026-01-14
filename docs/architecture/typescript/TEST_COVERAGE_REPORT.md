# Test Coverage Report

**Generated:** 2026-01-14  
**Method:** Static import analysis + test guideline audit + observed test failures  
**Coverage Tool:** Vitest v8 (attempted; artifacts blocked by .gitignore)

---

## Executive Summary

This report documents:
1. **Files with no unit test coverage** (based on static import analysis)
2. **Tests that violate TypeScript testing guidelines** (definitive violations)
3. **Test failures observed during coverage run** (definitive)

**Note:** Runtime coverage percentages could not be extracted because coverage artifacts are ignored by `.gitignore` and `.cursorignore`. This report uses static analysis (import-based) to identify untested files, which is a reliable approximation.

---

## 1. Test Guideline Violations (Definitive)

These tests violate patterns defined in [`TEST_PATTERNS.md`](./TEST_PATTERNS.md):

### 1.1 Testing a Copy Instead of Production Code

**File:** `tests/unit/enhancement-suggestions-api.test.ts`

**Issue:** Contains an inline reimplementation of `fetchEnhancementSuggestions` instead of importing the real function.

**Evidence:**
```typescript
/**
 * Inline implementation of fetchEnhancementSuggestions for testing
 * This avoids import resolution issues with path aliases
 */
async function fetchEnhancementSuggestions({...}) {
  // ... inline implementation
}
```

**Impact:** 
- The real `client/src/features/prompt-optimizer/api/enhancementSuggestionsApi.ts` is **not actually tested**
- Tests won't fail when production code breaks
- Creates false confidence

**Fix:** Import the real function and fix path alias resolution in test config.

---

### 1.2 Type-Safety Loss (`as unknown as`)

**File:** `tests/unit/veo-json-schema.property.test.ts`

**Issue:** Repeated use of `as unknown as VeoPromptSchema` (11 instances), violating the "type-safe mocking" principle.

**Evidence:**
```typescript
const schema = result.prompt as unknown as VeoPromptSchema;
// Repeated 11 times throughout the test file
```

**Impact:** Loses type safety - TypeScript can't catch type mismatches.

**Fix:** Use proper type guards or Zod schema validation instead of unsafe casts.

---

**File:** `tests/unit/span-labeling-legacy-migration.test.ts`

**Issue:** Uses `as unknown as boolean` and `as unknown as number`.

**Evidence:**
```typescript
const policy = sanitizePolicy({ nonTechnicalWordLimit: -1, allowOverlap: 'yes' as unknown as boolean });
expect(clamp01('x' as unknown as number)).toBe(DEFAULT_CONFIDENCE);
```

**Fix:** Use proper type guards or test with correct types.

---

### 1.3 Use of `any` in Tests

**File:** `tests/unit/cross-model-translation-isolation.property.test.ts`

**Issue:** Uses `as any` in a filter predicate.

**Evidence:**
```typescript
.filter((s) => !EXPECTED_MODEL_IDS.includes(s as any))
```

**Impact:** Violates the "no `any`" rule from `STYLE_RULES.md`.

**Fix:** Use proper type narrowing or a type guard.

---

### 1.4 Deep Relative Imports in Tests

**Files:**
- `tests/unit/strategy-pipeline-validity.property.test.ts`: `../../server/src/services/video-prompt-analysis/strategies`
- `tests/unit/suggestion-flow.test.tsx`: `../../client/src/utils/canonicalText`

**Issue:** Violates path alias guidelines from [`PATH_ALIASES.md`](./PATH_ALIASES.md).

**Fix:** Use path aliases (`@services/...`, `@utils/...`) instead of relative imports.

---

## 2. Files with No Unit Test Coverage (Static Import-Based Analysis)

A file is considered "covered" if it is **directly imported** by a `*.test.*` file. This is not runtime coverage, but a reliable approximation.

### 2.1 Client: `client/src/features/prompt-optimizer/`

**Currently Tested (directly imported):**
- `utils/signalUtils.ts` ✅
- `utils/SuggestionCache.ts` ✅
- `utils/SuggestionRequestManager.ts` ✅
- `PromptCanvas/hooks/useTextSelection.ts` ✅
- `PromptOptimizerContainer/hooks/useSuggestionFetch.ts` ✅
- `api/enhancementSuggestionsApi.ts` ⚠️ (tested via inline copy, not real implementation)

**Untested (high priority):**

#### API Layer
- `api/enhancementSuggestionsApi.ts` (real implementation not tested)

#### Core Hooks
- `PromptOptimizerContainer/hooks/usePromptOptimization.ts`
- `PromptOptimizerContainer/hooks/usePromptLoader.ts`
- `PromptOptimizerContainer/hooks/useSuggestionApply.ts`
- `PromptOptimizerContainer/hooks/useHighlightsPersistence.ts`
- `PromptOptimizerContainer/hooks/useConceptBrainstorm.ts`
- `PromptOptimizerContainer/hooks/useUndoRedo.ts`
- `PromptOptimizerContainer/hooks/useImprovementFlow.ts`
- `PromptOptimizerContainer/hooks/useEnhancementSuggestions.ts`

#### PromptCanvas Hooks
- `PromptCanvas/hooks/useLockedSpanInteractions.ts`
- `PromptCanvas/hooks/usePromptVersioning.ts`
- `PromptCanvas/hooks/useSpanSelectionEffects.ts`
- `PromptCanvas/hooks/useSuggestionSelection.ts`
- `PromptCanvas/hooks/usePromptCanvasState.ts`
- `PromptCanvas/hooks/useParseResult.ts`
- `PromptCanvas/hooks/usePromptExport.ts`
- `PromptCanvas/hooks/useSuggestionFeedback.ts`
- `PromptCanvas/hooks/usePromptStatus.ts`
- `PromptCanvas/hooks/useEditorContent.ts`
- `PromptCanvas/hooks/useSuggestionDetection.ts`
- `PromptCanvas/hooks/useSpanDataConversion.ts`
- `PromptCanvas/hooks/useKeyboardShortcuts.ts`

#### PromptCanvas Utils
- `PromptCanvas/utils/promptCanvasFormatters.ts`
- `PromptCanvas/utils/spanDataConversion.ts`
- `PromptCanvas/utils/exportFormatConversion.ts`

#### Top-Level Hooks
- `hooks/useClipboard.ts`
- `hooks/useModelRegistry.ts`
- `hooks/useCapabilities.ts`
- `hooks/useNormalizedCapabilityValues.ts`
- `hooks/useShareLink.ts`
- `hooks/useEditHistory.ts`

#### Utils
- `utils/textSelection.ts`
- `utils/applySuggestion.ts`
- `utils/debounce.ts`
- `utils/lockedSpans.ts`
- `utils/capabilities.ts`
- `utils/textFormatting.ts`
- `utils/enhancementSuggestionContext.ts`
- `utils/updateHighlightSnapshot.ts`
- `utils/highlightInteractionHelpers.ts`

---

### 2.2 Client: `client/src/features/span-highlighting/`

**Currently Tested:**
- `hooks/useSpanLabeling.ts` ✅
- `utils/cacheKey.ts` ✅
- `utils/hashing.ts` ✅

**Untested (high priority):**

#### API Layer
- `api/spanLabelingApi.ts`
- `api/spanLabelingStream.ts`
- `api/spanLabelingRequest.ts`
- `api/spanLabelingResponse.ts`
- `api/spanLabelingErrors.ts`

#### Services
- `services/SpanLabelingCache.ts`
- `services/storageAdapter.ts`

#### Hooks
- `hooks/useHighlightRendering.ts`
- `hooks/useHighlightSourceSelection.ts`
- `hooks/useSpanLabelingCache.ts`
- `hooks/useProgressiveSpanRendering.ts`
- `hooks/useHighlightFingerprint.ts`
- `hooks/useDebouncedValidation.ts`
- `hooks/useAsyncScheduler.ts`

#### Utils
- `utils/domManipulation.ts`
- `utils/categoryValidators.ts`
- `utils/highlightConversion.ts`
- `utils/spanLabelingErrorHandler.ts`
- `utils/textMatching.ts`
- `utils/anchorRanges.ts`
- `utils/spanLabelingScheduler.ts`
- `utils/spanRenderingUtils.ts`
- `utils/spanValidation.ts`
- `utils/tokenBoundaries.ts`
- `utils/spanProcessing.ts`
- `utils/textUtils.ts`
- `utils/spanLabelingResultEmitter.ts`
- `utils/coverageTracking.ts`

---

### 2.3 Client: `client/src/components/SuggestionsPanel/`

**Currently Tested:**
- `components/SuggestionsList.tsx` ✅
- `hooks/useSuggestionsState.ts` ✅

**Untested:**
- `api/customSuggestionsApi.ts`
- `api/schemas.ts`
- `hooks/useCustomRequest.ts`
- `utils/suggestionHelpers.tsx`

---

### 2.4 Server: `server/src/services/video-prompt-analysis/`

**Currently Tested:**
- Strategies: `KlingStrategy.ts`, `LumaStrategy.ts`, `RunwayStrategy.ts`, `SoraStrategy.ts`, `VeoStrategy.ts` ✅
- `services/detection/ModelDetectionService.ts` ✅
- `utils/SafetySanitizer.ts` ✅
- `utils/TechStripper.ts` ✅
- `services/MultimodalAssetManager.ts` ✅
- `VideoPromptService.ts` ✅
- `services/rewriter/VideoPromptLLMRewriter.ts` ✅

**Untested (high priority):**

#### Analysis Services
- `services/analysis/VideoPromptAnalyzer.ts`
- `services/analysis/IrEnricher.ts`
- `services/analysis/HeuristicIrExtractor.ts`
- `services/analysis/SpanToIrMapper.ts`
- `services/analysis/InputStructureParser.ts`
- `services/analysis/LlmIrExtractor.ts`
- `services/analysis/IrFactory.ts`
- `services/analysis/ConstraintGenerationService.ts`
- `services/analysis/PhraseRoleAnalysisService.ts`

#### Detection Services
- `services/detection/VideoPromptDetectionService.ts`
- `services/detection/SectionDetectionService.ts`

#### Guidance Services
- `services/guidance/CategoryGuidanceService.ts`
- `services/guidance/FallbackStrategyService.ts`

#### Strategy Infrastructure
- `strategies/StrategyRegistry.ts`
- `strategies/WanStrategy.ts`
- `strategies/BaseStrategy.ts` (partially tested via subclasses)

#### Utils
- `utils/textHelpers.ts`

---

### 2.5 Server: `server/src/middleware/`

**Currently Tested:**
- `requestId.ts` ✅
- `asyncHandler.ts` ✅
- `errorHandler.ts` ✅
- `performanceMonitor.ts` ✅

**Untested:**
- `enforceVideoMode.ts`
- `normalizeOptimizationRequest.ts`
- `validateRequest.ts`
- `apiAuth.js`
- `requestCoalescing.js`
- `requestBatching.js`
- `metricsAuth.js`

---

### 2.6 Server: `server/src/infrastructure/`

**Currently Tested:**
- `Logger.ts` ✅
- `requestContext.ts` ✅

**Untested:**
- `firebaseAdmin.ts`
- `CircuitBreakerAdapter.ts`
- `DIContainer.ts`
- `TracingService.ts`
- `MetricsService.ts`
- `DependencyContainer.ts`

---

### 2.7 Server: `server/src/routes/`

**Currently Tested:**
- `health.routes.ts` ✅
- `api.routes.ts` ✅
- `suggestions.ts` ✅

**Note:** Most route handlers are not unit-tested (likely intended for integration/e2e tests). All other route modules under `server/src/routes/**` appear untested via unit tests.

---

### 2.8 Server: `server/src/llm/span-labeling/`

**Currently Tested (subset):**
- `cache/SubstringPositionCache.ts` ✅
- `processing/AdjacentSpanMerger.ts` ✅
- `processing/ConfidenceFilter.ts` ✅
- `processing/OverlapResolver.ts` ✅
- `processing/SpanDeduplicator.ts` ✅
- `processing/SpanNormalizer.ts` ✅
- `processing/SpanTruncator.ts` ✅
- `utils/chunkingUtils.ts` ✅
- `utils/jsonUtils.ts` ✅
- `utils/policyUtils.ts` ✅
- `utils/textUtils.ts` ✅
- `validation/SchemaValidator.ts` ✅
- `validation/SpanValidator.ts` ✅
- `evaluation/RelaxedF1Evaluator.ts` ✅
- `config/SpanLabelingConfig.ts` ✅

**Untested (high priority):**
- `SpanLabelingService.ts` (main orchestrator)
- `services/RobustLlmClient.ts`
- `services/GeminiLlmClient.ts`
- `services/OpenAILlmClient.ts`
- `services/GroqLlmClient.ts`
- `services/LlmClientFactory.ts`
- `services/ILlmClient.ts`
- `services/robust-llm-client/repair.ts`
- `services/robust-llm-client/twoPassExtraction.ts`
- `services/robust-llm-client/defensiveMeta.ts`
- `services/robust-llm-client/modelInvocation.ts`
- `nlp/NlpSpanService.ts`
- `nlp/tier2/gliner.ts`
- `nlp/merge.ts`
- `nlp/filters/sectionHeaders.ts`
- `nlp/tier1/closedVocabulary.ts`
- `nlp/tier1/patterns.ts`
- `nlp/VerbSemantics.ts`
- `nlp/LightingSemantics.ts`
- `nlp/LightingService.ts`
- `nlp/CompromiseService.ts`
- `strategies/NlpSpanStrategy.ts`
- `schemas/GeminiSchema.ts`
- `schemas/OpenAISchema.ts`
- `schemas/GroqSchema.ts`
- `schemas/SpanLabelingSchema.ts`
- `schemas/DescriptionEnrichedSchema.ts`
- `evaluation/SpanLabelingEvaluator.ts`
- `validation/normalizeAndCorrectSpans.ts`
- `processing/VisualOnlyFilter.ts`
- `processing/HeaderFilter.ts`

---

## 3. Test Failures Observed During Coverage Run

These failures were observed during the actual test run (definitive):

### 3.1 TypeScript Compilation Errors

**Test:** `tests/unit/typescript-config.test.ts`

**Failures:**
- **Server code:** 23 TypeScript errors
- **Client code:** 8 TypeScript errors (reduced from 5 in earlier run)
- **Root project:** 35 TypeScript errors

**Sample Errors:**
- `client/src/features/prompt-optimizer/components/VersionsPanel.tsx`: Type mismatch with `HighlightSnapshot | null`
- `client/src/features/prompt-optimizer/context/hooks/useDraftHistorySync.ts`: `updateEntryPersisted` is `unknown`
- `client/src/features/span-highlighting/hooks/useSpanLabeling.ts`: Type mismatch; `exactOptionalPropertyTypes` issue
- `client/src/pages/AccountPage.tsx`: `string | undefined` not assignable to `string`
- `server/src/llm/span-labeling/services/RobustLlmClient.ts`: `exactOptionalPropertyTypes` mismatch
- `server/src/routes/optimize/handlers/optimize.ts`: `unknown` not assignable to `CapabilityValues | null`
- `server/src/routes/payment/auth.ts`: Express request typing issue

**Impact:** These files cannot be properly type-checked, which may hide bugs.

---

### 3.2 Property Test Failures

**Test:** `tests/unit/sora-safety-filtering.property.test.ts`

**Failures:** 6 out of 10 property tests failed

**Impact:** SoraStrategy's celebrity name stripping may not be working correctly.

---

## 4. Recommendations

### Immediate Actions

1. **Fix test guideline violations:**
   - Replace inline `fetchEnhancementSuggestions` with real import
   - Replace `as unknown as` casts with type guards or Zod validation
   - Remove `as any` usage
   - Fix deep relative imports in tests

2. **Fix TypeScript compilation errors:**
   - Address the 35 compilation errors blocking proper type checking
   - Fix `exactOptionalPropertyTypes` mismatches
   - Fix Express request typing issues

3. **Add unit tests for high-priority untested files:**
   - Start with core hooks (`usePromptOptimization`, `useSuggestionApply`, etc.)
   - Add tests for API layers (`spanLabelingApi.ts`, `customSuggestionsApi.ts`)
   - Add tests for analysis services (`VideoPromptAnalyzer.ts`, `HeuristicIrExtractor.ts`)

### Long-Term Actions

1. **Enable runtime coverage reporting:**
   - Remove `coverage/` from `.cursorignore` (keep in `.gitignore` for git)
   - Or configure coverage to write to a non-ignored directory
   - Set up CI to generate and track coverage reports

2. **Fix property test failures:**
   - Investigate why SoraStrategy property tests are failing
   - Ensure celebrity name stripping works correctly

3. **Add integration tests for routes:**
   - Most route handlers are not unit-tested (likely by design)
   - Ensure they are covered by integration/e2e tests

---

## 5. Coverage Thresholds

According to `config/test/vitest.config.js`, the project aims for:
- **Lines:** 85%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 85%

**Note:** Actual coverage percentages could not be calculated due to coverage artifacts being ignored. This report uses static analysis as a proxy.

---

*Last Updated: 2026-01-14*  
*Report Method: Static import analysis + test guideline audit + observed test failures*
