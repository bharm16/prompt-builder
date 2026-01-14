# Test Coverage Report

**Generated:** 2026-01-14  
**Method:** Static import analysis + test guideline audit + observed test failures  
**Coverage Tool:** Vitest v8 (configured; no recent coverage artifacts found)

---

## Executive Summary

This report documents:
1. **Files with no unit test coverage** (based on static import analysis)
2. **Tests that violate TypeScript testing guidelines** (definitive violations)
3. **Test failures observed during coverage run** (definitive)

**Note:** Runtime coverage percentages were not extracted because no recent `coverage/` artifacts were found. `.gitignore` and `.cursorignore` do not prevent coverage generation; they only keep artifacts out of git and editor context.

---

## 1. Test Guideline Violations (Definitive)

No current violations found after updates on 2026-01-14.

Resolved:
- `tests/unit/enhancement-suggestions-api.test.ts` now imports the production `fetchEnhancementSuggestions`
- `tests/unit/veo-json-schema.property.test.ts` uses a schema guard helper instead of unsafe casts
- `tests/unit/span-labeling-legacy-migration.test.ts` and `tests/unit/cross-model-translation-isolation.property.test.ts` avoid `as unknown as` / `as any`
- `tests/unit/strategy-pipeline-validity.property.test.ts` and `tests/unit/suggestion-flow.test.tsx` use path aliases

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
- `api/enhancementSuggestionsApi.ts` ✅

**Untested (high priority):**

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
- `services/analysis/VideoPromptAnalyzer.ts` ⚠️ (imported via stub subclass; core logic not exercised)
- `services/detection/ModelDetectionService.ts` ✅
- `utils/SafetySanitizer.ts` ✅
- `utils/TechStripper.ts` ✅
- `services/MultimodalAssetManager.ts` ✅
- `VideoPromptService.ts` ✅
- `services/rewriter/VideoPromptLLMRewriter.ts` ⚠️ (imported via stub subclass; core logic not exercised)

**Untested (high priority):**

#### Analysis Services
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

## 3. Test Failures Observed During Verification

No current failures observed in the checks run on 2026-01-14.

### 3.1 TypeScript Compilation Errors

- `npx tsc --project server/tsconfig.json --noEmit`: pass
- `npx tsc --project client/tsconfig.json --noEmit`: pass
- `npx tsc --noEmit`: pass

### 3.2 Property Test Failures

- `tests/unit/sora-safety-filtering.property.test.ts`: pass (10/10)

---

## 4. Recommendations

### Immediate Actions

1. **Add unit tests for high-priority untested files:**
   - Start with core hooks (`usePromptOptimization`, `useSuggestionApply`, etc.)
   - Add tests for API layers (`spanLabelingApi.ts`, `customSuggestionsApi.ts`)
   - Add tests for analysis services (`VideoPromptAnalyzer.ts`, `HeuristicIrExtractor.ts`)

2. **Decide on coverage for `VideoPromptLLMRewriter.ts`:**
   - Add unit coverage if it should be directly tested
   - Otherwise keep it listed as untested (current state)

3. **Enable runtime coverage reporting:**
   - Generate coverage artifacts locally
   - Or configure coverage to write to a non-ignored directory

### Long-Term Actions

1. **Add integration tests for routes:**
   - Most route handlers are not unit-tested (likely by design)
   - Ensure they are covered by integration/e2e tests

2. **Set up CI coverage tracking:**
   - Generate coverage reports in CI
   - Track trends over time

---

## 5. Coverage Thresholds

According to `config/test/vitest.config.js`, the project aims for:
- **Lines:** 85%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 85%

**Note:** Actual coverage percentages were not calculated because no recent `coverage/` artifacts were found. This report uses static analysis as a proxy.

---

*Last Updated: 2026-01-14*  
*Report Method: Static import analysis + test guideline audit + tsc checks + targeted test run*
