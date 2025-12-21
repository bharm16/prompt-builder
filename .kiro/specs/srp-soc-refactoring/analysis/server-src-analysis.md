# Server Source Analysis - SRP/SOC Violations

## Analysis Summary

Analyzed `server/src/` recursively for files >150 lines, excluding tests, types, configs, and index files.

**Total Files Analyzed:** 35+ files
**High Severity Violations (3+ responsibilities):** 2
**Medium Severity Violations (2 responsibilities):** 3
**No Violations (Single Responsibility):** 30+

---

## High Severity Violations (3+ responsibilities)

### 1. `server/src/routes/api.routes.ts`

**Lines:** 731
**Severity:** HIGH (3+ responsibilities)

**Responsibilities Found:**
1. **Route Definition** (throughout): Express route registration
2. **Request Handling Logic** (throughout): Business logic for each endpoint
3. **SSE Streaming** (lines 100-200): Server-Sent Events implementation for optimize-stream
4. **Logging/Metrics** (throughout): Extensive logging and timing for each route

**Reasons to Change:**
- New API endpoints
- Changes to request/response formats
- Streaming implementation changes
- Logging format changes

**Stakeholders:**
- Backend developers (new endpoints)
- Frontend developers (API contracts)
- DevOps (logging/monitoring)

**Recommended Split:**
- `routes/optimize.routes.ts`: Optimization endpoints
- `routes/video.routes.ts`: Video concept endpoints
- `routes/enhancement.routes.ts`: Enhancement suggestion endpoints
- `routes/api.routes.ts`: Route aggregator (imports and mounts sub-routers)

**Justification:**
The file contains 10+ distinct endpoints across different domains (optimization, video, enhancement, NLP). Each domain has different stakeholders and change frequencies. Splitting by domain improves maintainability and allows teams to work independently.

---

## Re-Evaluated: NOT Violations

### `server/src/llm/span-labeling/nlp/NlpSpanService.ts` (1567 lines)

**Initial Assessment:** HIGH (4+ responsibilities)
**Re-Evaluation:** ❌ NOT A VIOLATION

**Why it is NOT a violation:**
The file has ONE responsibility: **NLP-based span extraction**. The initially listed "responsibilities" (Aho-Corasick, regex, action verbs, GLiNER, merging) are all **implementation details of the same concern**.

**Reasons to change analysis:**
- If a linguist changes action verb patterns → they also touch the merge strategy (same concern)
- If an ML engineer changes GLiNER thresholds → they also touch label mappings (same concern)
- If NLP algorithm changes → all extraction tiers change together (same concern)

**All changes serve the same stakeholder:** "Make span extraction better/faster/more accurate"

**Conclusion:** Large but cohesive. Splitting would create artificial boundaries between tightly coupled extraction tiers that always change together.

---

## Re-Evaluated Medium Severity: NOT Violations

### `server/src/clients/adapters/GroqLlamaAdapter.ts` (955 lines)

**Initial Assessment:** MEDIUM (2 responsibilities)
**Re-Evaluation:** ❌ NOT A VIOLATION

**Why it is NOT a violation:**
The file has ONE responsibility: **Make Groq/Llama 3 API work well**. The "API communication" and "Llama 3 optimization" are inseparable.

**Reasons to change analysis:**
- If Groq API changes → message building changes too (same concern)
- If Llama 3 best practices update → you change how you call the API (same concern)
- Would you ever change message building WITHOUT changing API communication? **No.**

**Evidence from code:** The `_buildLlamaMessages()` method is tightly coupled to `_executeRequest()`. Sandwich prompting, prefill, XML wrapping are all part of "how to call Llama 3 correctly."

**Conclusion:** Extracting `LlamaMessageBuilder` would create coupling, not cohesion. These always change together.

---

### `server/src/clients/adapters/OpenAICompatibleAdapter.ts` (754 lines)

**Initial Assessment:** MEDIUM (2 responsibilities)
**Re-Evaluation:** ❌ NOT A VIOLATION

**Why it is NOT a violation:**
Same reasoning as GroqLlamaAdapter. ONE responsibility: **Make OpenAI API work well**.

**Reasons to change analysis:**
- If OpenAI API changes → message building changes too
- If GPT-4o best practices update → you change how you call the API
- Developer role, bookending, structured outputs are all part of "how to call GPT-4o correctly"

**Conclusion:** Single cohesive concern. No split needed.

---

### `server/src/services/ai-model/AIModelService.ts` (610 lines)

**Initial Assessment:** MEDIUM (2 responsibilities)
**Re-Evaluation:** ❌ NOT A VIOLATION

**Why it is NOT a violation:**
The file has ONE responsibility: **Route AI operations to the right client with the right options**.

**Reasons to change analysis:**
- "Operation routing" and "provider-specific optimization" are the SAME concern
- The service's job IS to apply the right optimizations when routing
- `_buildDefaultDeveloperMessage()` is part of routing logic, not a separate concern

**Evidence from code:** The `execute()` method detects provider capabilities and applies optimizations as part of routing. This is literally what a router does.

**Conclusion:** This is an orchestrator doing its single job well.

---

## Files Analyzed - No Violations

The following files were analyzed and found to have a single, well-defined responsibility:

| File | Lines | Responsibility |
|------|-------|----------------|
| `PromptOptimizationService.ts` | 797 | Orchestration (already refactored) |
| `MetricsService.ts` | 533 | Prometheus metrics collection |
| `SemanticCacheService.ts` | 516 | Semantic caching logic |
| `EnhancementService.ts` | 503 | Enhancement orchestration (already refactored) |
| `LLMClient.ts` | 470 | LLM client with circuit breaker |
| `RobustLlmClient.ts` | 613 | LLM span labeling with validation |
| `CategoryGuidanceService.ts` | 605 | Category-specific guidance generation |
| `RelaxedF1Evaluator.ts` | 593 | F1 evaluation metrics |
| `VideoStrategy.ts` | 559 | Video optimization strategy |
| `SchemaFactory.ts` | 530 | JSON schema generation |
| `SpanLabelingCacheService.ts` | 399 | Span labeling cache |
| `ConcurrencyService.ts` | 405 | Concurrency limiting |
| `VideoConceptService.ts` | 352 | Video concept orchestration |
| `TracingService.ts` | 329 | Distributed tracing |
| `CacheService.ts` | 312 | General caching |
| `ConstitutionalAI.ts` | 306 | Constitutional AI review |

**Why No Violations:**
- `PromptOptimizationService.ts`: Already refactored to orchestrator pattern, delegates to specialized services
- `EnhancementService.ts`: Already refactored, delegates to specialized services
- `MetricsService.ts`: Single responsibility (metrics collection), many methods but all serve same concern
- `LLMClient.ts`: Single responsibility (LLM communication with resilience), circuit breaker is cross-cutting concern
- `RobustLlmClient.ts`: Single responsibility (span labeling with validation), uses template method pattern
- `CategoryGuidanceService.ts`: Single responsibility (guidance generation), many helper methods but cohesive
- `RelaxedF1Evaluator.ts`: Single responsibility (evaluation metrics), pure calculation methods

---

## Exclusions

The following files were excluded from analysis per requirements:

- **Config files:** `modelConfig.ts`, `middleware.config.ts`, `services.config.ts`, `videoPromptTemplates.ts`
- **Type files:** `types.ts`, `*.d.ts`
- **Index files:** `index.ts`
- **Already refactored structures:** Files in `services/enhancement/services/`, `services/prompt-optimization/services/`, etc.
- **Files <150 lines:** Most middleware, utilities, and small services

---

## Summary

| Severity | Count | Files |
|----------|-------|-------|
| High (3+) | 1 | api.routes.ts |
| Re-evaluated (NOT violations) | 4 | NlpSpanService.ts, GroqLlamaAdapter.ts, OpenAICompatibleAdapter.ts, AIModelService.ts |
| No Violation | 30+ | See table above |

**Key Observations:**
1. Most services have already been refactored to follow the orchestrator pattern
2. The only confirmed violation is api.routes.ts (split by domain makes sense)
3. The adapter files and NlpSpanService are large but cohesive - they do ONE thing well
4. Many large files are large because they have many methods serving a single concern (e.g., MetricsService)
5. **Size ≠ Violation** - the "reasons to change" test is the key differentiator
