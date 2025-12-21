# LLM Directory SRP/SOC Analysis

## Analysis Summary

**Directory:** `server/src/llm/`
**Analysis Date:** December 20, 2025

## Files Analyzed

### Files Meeting Size Threshold (>150 lines)

| File | Lines | Status |
|------|-------|--------|
| `roleClassifier.ts` | 250 | Analyzed |
| `span-labeling/SpanLabelingService.ts` | 288 | Analyzed |
| `span-labeling/nlp/NlpSpanService.ts` | 1567 | Analyzed |
| `span-labeling/services/RobustLlmClient.ts` | 613 | Analyzed |
| `span-labeling/evaluation/RelaxedF1Evaluator.ts` | 593 | Analyzed |
| `span-labeling/schemas/GroqSchema.ts` | 552 | Analyzed |
| `span-labeling/schemas/SpanLabelingSchema.ts` | 466 | Analyzed |
| `span-labeling/strategies/NlpSpanStrategy.ts` | 465 | Analyzed |
| `span-labeling/cache/SubstringPositionCache.ts` | 341 | Analyzed |
| `span-labeling/utils/chunkingUtils.ts` | 276 | Analyzed |
| `span-labeling/config/SpanLabelingConfig.ts` | 276 | Configuration - Excluded |
| `span-labeling/utils/promptBuilder.ts` | 266 | Analyzed |
| `span-labeling/schemas/DescriptionEnrichedSchema.ts` | 255 | Analyzed |
| `span-labeling/schemas/OpenAISchema.ts` | 189 | Analyzed |
| `span-labeling/validation/normalizeAndCorrectSpans.ts` | 182 | Analyzed |
| `span-labeling/processing/AdjacentSpanMerger.ts` | 172 | Analyzed |
| `span-labeling/validation/SpanValidator.ts` | 165 | Analyzed |
| `span-labeling/services/GroqLlmClient.ts` | 160 | Analyzed |

### Files Excluded

| File | Lines | Reason |
|------|-------|--------|
| `types.ts` | 33 | Type definition file |
| `span-labeling/types.ts` | 101 | Type definition file |
| `span-labeling/config/SpanLabelingConfig.ts` | 276 | Configuration file |

---

## Detailed Analysis

### File: `server/src/llm/roleClassifier.ts`
**Lines:** 250

#### Responsibilities Found:
1. **Configuration/Constants** (lines 1-70): System prompt definition, cache setup, cache version
2. **Business Logic** (lines 72-115): Role normalization and validation against taxonomy
3. **Business Logic** (lines 117-140): JSON parsing with error recovery
4. **API/Data Fetching** (lines 142-190): LLM API call orchestration
5. **Business Logic** (lines 192-250): Span validation and deduplication

#### Assessment:
**NOT A VIOLATION** - This file has a single cohesive responsibility: classifying spans with roles using an LLM. While it contains multiple helper functions, they all serve the same purpose and would change together. The system prompt, validation, and API call are tightly coupled - changing the taxonomy would require changes to all of them simultaneously.

**Reasons NOT to split:**
- All functions serve the single purpose of role classification
- The system prompt, validation, and API call are inherently coupled
- Splitting would create artificial boundaries between tightly related code
- A single stakeholder (the span labeling team) owns all changes

---

### File: `server/src/llm/span-labeling/SpanLabelingService.ts`
**Lines:** 288

#### Responsibilities Found:
1. **Orchestration** (lines 1-70): Main `labelSpans` function coordinating the pipeline
2. **Business Logic** (lines 72-150): Single-pass span labeling with NLP fast-path
3. **Business Logic** (lines 152-288): Chunked processing for large texts

#### Assessment:
**NOT A VIOLATION** - This is already a well-designed orchestrator service. It delegates to:
- `NlpSpanStrategy` for NLP fast-path
- `LlmClientFactory` for provider-specific clients
- `SpanValidator` for validation
- `OverlapResolver` for processing

The file coordinates work but doesn't implement the actual logic. This is the correct pattern for a service orchestrator.

---

### File: `server/src/llm/span-labeling/nlp/NlpSpanService.ts`
**Lines:** 1567

#### Responsibilities Found:
1. **Configuration/Constants** (lines 1-50): Setup, vocabulary loading, logger initialization
2. **Business Logic - Tier 1** (lines 52-350): Aho-Corasick automaton building and closed vocabulary extraction
3. **Business Logic - Tier 1** (lines 352-550): Pattern definitions and regex-based extraction
4. **Business Logic - Tier 1** (lines 552-750): Action verb extraction with heuristics
5. **Business Logic - Tier 2** (lines 752-1050): GLiNER initialization and open vocabulary extraction
6. **Business Logic - Tier 2** (lines 1052-1200): GLiNER worker thread management
7. **Business Logic** (lines 1202-1350): Span merging and deduplication
8. **API/Public Interface** (lines 1352-1567): Public API functions (extractSemanticSpans, warmupGliner, etc.)

#### Assessment:
**POTENTIAL VIOLATION** - This file has multiple distinct responsibilities that could change independently:

**Reasons to Change:**
1. **Aho-Corasick/Closed Vocabulary** - Changes when vocabulary terms are added/modified
2. **GLiNER Integration** - Changes when GLiNER library updates or model changes
3. **Worker Thread Management** - Changes for performance tuning or concurrency issues
4. **Merge Strategy** - Changes when overlap resolution rules change

**Different Stakeholders:**
- NLP/ML team for GLiNER integration
- Domain experts for vocabulary updates
- Platform team for worker thread management

**However**, the file is already in a refactored structure (`nlp/NlpSpanService.ts`) and the responsibilities are all part of the same "neuro-symbolic extraction" concern. The complexity comes from the multi-tier architecture, not from mixing unrelated concerns.

**Recommendation:** **SKIP REFACTORING** - While large, this file represents a cohesive "NLP extraction engine" with tightly coupled tiers. Splitting would create artificial boundaries:
- Tier 1 and Tier 2 share the same span format and merge strategy
- GLiNER worker management is specific to this service
- The public API is a thin wrapper over the internal tiers

The file would benefit from internal documentation/comments rather than splitting.

---

### File: `server/src/llm/span-labeling/services/RobustLlmClient.ts`
**Lines:** 613

#### Responsibilities Found:
1. **API/Data Fetching** (lines 1-130): `callModel` function for LLM API calls
2. **Orchestration** (lines 132-350): `getSpans` method coordinating validation and repair
3. **Business Logic** (lines 352-450): Two-pass extraction for complex schemas
4. **Business Logic** (lines 452-550): Defensive metadata injection
5. **Business Logic** (lines 552-613): Repair attempt logic

#### Assessment:
**NOT A VIOLATION** - This is a well-designed base class implementing the Template Method pattern. The responsibilities are:
- Core LLM interaction logic (shared across providers)
- Hook methods for provider-specific customization

The class is designed for extension (GroqLlmClient, OpenAILlmClient inherit from it). All methods serve the single purpose of "robust LLM-based span extraction with validation and repair."

---

### File: `server/src/llm/span-labeling/evaluation/RelaxedF1Evaluator.ts`
**Lines:** 593

#### Responsibilities Found:
1. **Business Logic** (lines 1-100): IoU calculation and span matching
2. **Business Logic** (lines 102-250): Fragmentation and over-extraction rate calculation
3. **Business Logic** (lines 252-400): Confusion matrix generation
4. **Business Logic** (lines 402-500): F1 score and taxonomy accuracy calculation
5. **Business Logic** (lines 502-593): Report generation and threshold checking

#### Assessment:
**NOT A VIOLATION** - This is a cohesive evaluation utility class. All methods serve the single purpose of "evaluating span labeling quality." The different metrics (F1, fragmentation, confusion matrix) are all part of the same evaluation concern and would change together when evaluation criteria change.

---

### File: `server/src/llm/span-labeling/schemas/GroqSchema.ts`
**Lines:** 552

#### Responsibilities Found:
1. **Configuration/Constants** (lines 1-100): Schema definitions for Groq/Llama 3
2. **Configuration/Constants** (lines 102-300): TypeScript interface and category tables
3. **Configuration/Constants** (lines 302-500): Full system prompt with examples
4. **Configuration/Constants** (lines 502-552): Few-shot examples and helper functions

#### Assessment:
**NOT A VIOLATION** - This is a configuration/constants file containing Groq-specific schema definitions and prompts. While large, it has a single responsibility: defining the Groq/Llama 3 schema and prompts. All content would change together when Groq integration is updated.

---

### File: `server/src/llm/span-labeling/strategies/NlpSpanStrategy.ts`
**Lines:** 465

#### Responsibilities Found:
1. **Business Logic** (lines 1-150): Coverage and assessment calculations
2. **Orchestration** (lines 152-465): `extractSpans` method coordinating NLP extraction

#### Assessment:
**NOT A VIOLATION** - This is a strategy class with a single responsibility: determining whether NLP fast-path can be used and executing it. The helper methods all support the main `extractSpans` decision logic.

---

### Files in Already-Refactored Structure

The following files are already part of a well-organized modular structure:

| File | Assessment |
|------|------------|
| `cache/SubstringPositionCache.ts` | Single responsibility: position caching |
| `utils/chunkingUtils.ts` | Single responsibility: text chunking |
| `utils/promptBuilder.ts` | Single responsibility: prompt construction |
| `schemas/SpanLabelingSchema.ts` | Single responsibility: schema definitions |
| `schemas/DescriptionEnrichedSchema.ts` | Single responsibility: enriched schema |
| `schemas/OpenAISchema.ts` | Single responsibility: OpenAI schema |
| `validation/normalizeAndCorrectSpans.ts` | Single responsibility: span normalization |
| `validation/SpanValidator.ts` | Single responsibility: span validation |
| `processing/AdjacentSpanMerger.ts` | Single responsibility: span merging |
| `services/GroqLlmClient.ts` | Single responsibility: Groq-specific client |

---

## Violations Summary

### Files with SRP/SOC Violations: **NONE**

The `server/src/llm/` directory is well-organized with clear separation of concerns:

1. **Top-level files** (`roleClassifier.ts`, `types.ts`) handle role classification
2. **span-labeling/** subdirectory is already modularized:
   - `cache/` - Caching utilities
   - `config/` - Configuration
   - `data/` - Data files
   - `evaluation/` - Evaluation metrics
   - `nlp/` - NLP extraction
   - `processing/` - Span processing
   - `schemas/` - Schema definitions
   - `services/` - LLM clients
   - `strategies/` - Extraction strategies
   - `templates/` - Prompt templates
   - `utils/` - Utility functions
   - `validation/` - Validation logic

### Recommendation

**No refactoring needed.** The LLM directory follows good architectural patterns:

1. **Orchestrator Pattern**: `SpanLabelingService.ts` coordinates without implementing
2. **Strategy Pattern**: `NlpSpanStrategy.ts` encapsulates NLP fast-path logic
3. **Template Method Pattern**: `RobustLlmClient.ts` provides hooks for provider customization
4. **Single Responsibility**: Each subdirectory handles one concern

The largest file (`NlpSpanService.ts` at 1567 lines) is large due to the complexity of the neuro-symbolic extraction pipeline, not due to mixing unrelated concerns. The multi-tier architecture (Aho-Corasick + GLiNER + merge) is inherently complex but cohesive.
