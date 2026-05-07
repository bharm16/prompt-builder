# Video Generation SRP Refactoring

**Date:** 2026-04-13
**Scope:** `server/src/services/video-generation/`
**Goal:** Resolve 7 SRP/SoC violations identified in the audit. All changes are internal refactors — same public APIs, same behavior, same test outcomes.

## Summary

| #   | Issue                                                 | Severity | Files Changed              | Approach                                                 |
| --- | ----------------------------------------------------- | -------- | -------------------------- | -------------------------------------------------------- |
| 1   | VideoJobStore god class (1002 lines)                  | High     | 5 new + 2 modified         | Extract DeadLetterStore, parseVideoJobRecord, dlqBackoff |
| 2   | availability.ts duplication (207-line function)       | Medium   | 1 modified                 | Data-driven provider lookup replaces 5 if/else branches  |
| 3   | Storage in VideoProvider.generate()                   | Medium   | —                          | **Deferred** (see Deferred section)                      |
| 4   | Kling duplicate circuit breaker + polling duplication | Medium   | 1 modified + 1 deleted dep | Remove opossum, unify waitForKlingTask                   |
| 5   | Image preprocessing in replicateProvider              | Low      | 1 new + 1 modified         | Extract to providers/imagePreprocessing.ts               |
| 6   | Duplicated heartbeat in processVideoJob               | Low      | 2 modified                 | Injectable heartbeat strategy                            |
| 7   | Hardcoded provider list in VideoJobWorker             | Low      | 1 modified                 | Derive from VideoJobWorkerOptions                        |
| 8   | DI fallback in ConsistentVideoService                 | Low      | 1 modified                 | Make keyframeService required                            |

## Issue 1: Split VideoJobStore

### Problem

`VideoJobStore` is a 1002-line class with 3 distinct reasons to change: job lifecycle, DLQ behavior, and Firestore access patterns. The DLQ is a separate collection (`video_job_dlq`) with its own schema and state machine, yet shares a class with the job collection (`video_jobs`).

### Design

**New file: `jobs/DeadLetterStore.ts`**

Receives all DLQ methods from `VideoJobStore`:

- `enqueueDeadLetter`
- `claimNextDlqEntry`
- `markDlqReprocessed`
- `markDlqFailed`
- `getDlqBacklogCount`

Constructor takes `FirestoreCircuitExecutor` (same as `VideoJobStore`). `DeadLetterStore` has its own private `withTiming` method (duplicate the 20-line helper rather than extracting a shared module — it's too small to justify a shared file and the two stores may diverge on timing thresholds).

**Backward compatibility:** `VideoJobStore` keeps a `readonly dlq: DeadLetterStore` property and **re-exports all DLQ methods via delegation**:

```typescript
async enqueueDeadLetter(...args): Promise<void> {
  return this.dlq.enqueueDeadLetter(...args);
}
```

All existing consumers (`processVideoJob`, `VideoJobSweeper`, `DlqReprocessorWorker`, `VideoJobWorker`) continue calling `jobStore.enqueueDeadLetter()` unchanged. New code can use `jobStore.dlq` directly.

**New file: `jobs/parseVideoJobRecord.ts`**

Pure function extracted from `VideoJobStore.parseJob()` (lines 868-948):

```typescript
export function parseVideoJobRecord(
  id: string,
  data: DocumentData | undefined,
  defaultMaxAttempts: number,
): VideoJobRecord;
```

`VideoJobStore` imports and calls it. No API change.

**New file: `jobs/dlqBackoff.ts`**

Pure function extracted from `markDlqFailed` (line 756):

```typescript
export function computeDlqBackoff(attempt: number): number {
  return Math.min(300_000, 30_000 * Math.pow(2, attempt));
}
```

### Consumers

| Consumer                 | Change Required                                |
| ------------------------ | ---------------------------------------------- |
| `VideoJobWorker`         | None (calls via `jobStore`)                    |
| `VideoJobSweeper`        | None (calls via `jobStore`)                    |
| `DlqReprocessorWorker`   | None (calls via `jobStore`)                    |
| `processVideoJob`        | None (calls via `jobStore`)                    |
| `inlineProcessor.ts`     | None (calls via `videoJobStore`)               |
| `video-jobs.services.ts` | None (constructs `VideoJobStore` the same way) |
| `generation.services.ts` | None (passes `VideoJobStore` instance)         |
| `jobs/index.ts`          | Add re-export of `DeadLetterStore`             |

### Test Impact

Existing `VideoJobStore` tests continue to pass (delegation preserves behavior). New unit tests for `DeadLetterStore`, `parseVideoJobRecord`, and `computeDlqBackoff` test the extracted units in isolation.

---

## Issue 2: Deduplicate getModelAvailability

### Problem

`getModelAvailability()` in `availability.ts` is a 207-line function with 5 near-identical `if (isXxxModel) { if (!providers.xxx) { return unavailable } return available }` branches. The only differences are the provider key, the required env var name, and the error message.

### Design

Replace the 5 branches with a data-driven lookup:

```typescript
const PROVIDER_REQUIRED_KEYS: Record<keyof VideoProviderAvailability, string> =
  {
    openai: "OPENAI_API_KEY",
    luma: "LUMA_API_KEY",
    kling: "KLING_API_KEY",
    gemini: "GEMINI_API_KEY",
    replicate: "REPLICATE_API_TOKEN",
  };

const PROVIDER_MISSING_MESSAGES: Record<
  keyof VideoProviderAvailability,
  string
> = {
  openai: "Sora video generation requires OPENAI_API_KEY.",
  luma: "Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.",
  kling: "Kling video generation requires KLING_API_KEY.",
  gemini: "Veo video generation requires GEMINI_API_KEY.",
  replicate: "Replicate API token is required for the selected video model.",
};
```

The function body collapses to:

1. Early exits for `"auto"` with no providers and `"unsupported_model"` (unchanged)
2. `const providerKey = resolveProviderForModel(resolvedId)`
3. `const capabilities = getModelCapabilities(resolvedId)`
4. Single branch: `if (!providers[providerKey])` → unavailable response using lookup maps
5. Else → available response

The `resolveProviderForModel` function already exists in `ProviderRegistry.ts` and correctly maps all model IDs to provider keys.

### Consumers

| Consumer                     | Change Required                           |
| ---------------------------- | ----------------------------------------- |
| `VideoGenerationService`     | None (calls `getModelAvailability`)       |
| `workflows/generateVideo.ts` | None (calls `getModelAvailability`)       |
| `availabilityReport.test.ts` | None (tests behavior, not implementation) |

---

## Issue 3: Move Storage Out of VideoProvider.generate() — DEFERRED

### Why Deferred

The audit recommended moving `storeVideoFromUrl` from `VideoProviders.ts` into `generateVideoWorkflow`. Investigation revealed that Sora and Veo providers use **stream-based storage** (`assetStore.storeFromStream()`) rather than URL-based. This means:

- Replicate, Kling, Luma: return a URL → `storeVideoFromUrl` → `StoredVideoAsset`
- Sora: downloads via OpenAI SDK → pipes stream → `assetStore.storeFromStream`
- Veo: downloads via GCS → pipes stream → `assetStore.storeFromStream`

The `VideoProvider.generate()` interface returning `{ asset: StoredVideoAsset }` is actually the correct abstraction — it encapsulates the divergent storage mechanisms. Moving storage to the workflow would require either:

- A discriminated union return type (`{ url } | { stream, contentType }`) — adding complexity
- Making all providers return URLs — impossible for Sora (SDK streams, no public URL)

The current design is sound. No change.

---

## Issue 4: Remove Kling Opossum Breaker + Deduplicate Polling

### Problem

`klingProvider.ts` has a module-level `opossum` circuit breaker singleton (line 164) that duplicates the application-level `ProviderCircuitManager`. It also has two near-identical polling functions: `waitForKlingVideo` (lines 280-312) and `waitForKlingImageToVideo` (lines 314-366).

### Design

**Remove opossum:**

- Delete the `opossum` import, `breaker` singleton, and `fallback` handler
- `klingFetch` becomes a direct wrapper around `_rawKlingFetch` (or inline it entirely)
- The `ProviderCircuitManager` in `VideoJobWorker` already handles circuit breaking at the job level
- Remove `opossum` from `package.json` if no other file imports it

**Unify polling:**
Merge `waitForKlingVideo` and `waitForKlingImageToVideo` into:

```typescript
async function waitForKlingTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  endpoint: "text2video" | "image2video",
): Promise<string>;
```

The only difference between them is the poll endpoint path (`/v1/videos/text2video/${taskId}` vs `/v1/videos/image2video/${taskId}`). The response parsing, timeout, and error handling are identical.

### Consumers

| Consumer                | Change Required                                |
| ----------------------- | ---------------------------------------------- |
| `VideoProviders.ts`     | None (calls `generateKlingVideo`)              |
| `klingProvider.test.ts` | May need mock adjustments if it mocked opossum |

### Dependency Impact

Check if `opossum` is used elsewhere before removing from `package.json`:

```bash
grep -r "opossum" server/src/ --include="*.ts" -l
```

---

## Issue 5: Extract Image Preprocessing

### Problem

`replicateProvider.ts` contains `resolveReplicateImageInput` and supporting helpers (`getUrlExtension`, `normalizeContentType`, `SUPPORTED_IMAGE_EXTENSIONS`, `SUPPORTED_IMAGE_MIME_TYPES`, `isBlobLike`, `summarizeInputForLog`) that handle image format validation and fetching. This is preprocessing logic, not video generation.

### Design

**New file: `providers/imagePreprocessing.ts`**

Move the following from `replicateProvider.ts`:

- `SUPPORTED_IMAGE_EXTENSIONS`
- `SUPPORTED_IMAGE_MIME_TYPES`
- `getUrlExtension`
- `normalizeContentType`
- `isBlobLike`
- `resolveReplicateImageInput` (rename to `resolveImageInput`)
- `summarizeInputForLog`

`replicateProvider.ts` imports from `./imagePreprocessing`.

### Consumers

| Consumer                    | Change Required                                           |
| --------------------------- | --------------------------------------------------------- |
| `replicateProvider.ts`      | Import from new file                                      |
| `replicateProvider.test.ts` | None (tests the public `generateReplicateVideo` function) |

---

## Issue 6: Injectable Heartbeat in processVideoJob

### Problem

`processVideoJob` creates its own heartbeat timer (lines 150-178), but `VideoJobWorker.processJob()` starts a second independent heartbeat with failure counting and abort logic, then disables the first by setting `heartbeatIntervalMs: this.leaseMs * 10`. This works but the "trick" to disable one heartbeat is fragile.

### Design

Add an optional `heartbeat` field to `ProcessVideoJobDeps`:

```typescript
export interface ProcessVideoJobDeps {
  // ... existing fields ...
  heartbeat?: {
    start(): void;
    stop(): void;
  };
}
```

When `heartbeat` is provided, `processVideoJob` calls `heartbeat.start()` / `heartbeat.stop()` instead of creating its own `setInterval`. When not provided, the existing timer behavior is the default (backward compatible).

**VideoJobWorker change:** Passes its own heartbeat implementation that wraps the existing failure-counting logic. Removes the `heartbeatIntervalMs: this.leaseMs * 10` hack.

**inlineProcessor.ts change:** None — passes nothing, gets the default timer.

### Interface Compatibility

The `ProcessVideoJobDeps` type is exported from `jobs/index.ts` and consumed by `inlineProcessor.ts`. The new field is optional, so this is a non-breaking type change.

---

## Issue 7: Remove Hardcoded Provider List

### Problem

`VideoJobWorker.buildDispatchableProviders()` (line 383) contains `["replicate", "openai", "luma", "kling", "gemini"]` — duplicating knowledge from `VideoProviders.ts` and `ProviderRegistry`.

### Design

Add an optional `providerIds` field to `VideoJobWorkerOptions`:

```typescript
interface VideoJobWorkerOptions {
  // ... existing fields ...
  providerIds?: string[];
}
```

`buildDispatchableProviders()` uses `this.providerIds` instead of the hardcoded array. The DI layer in `video-jobs.services.ts` passes the list derived from `VideoProviderMap` keys (or from `ProviderRegistry` exports).

Default value if not provided: `["replicate", "openai", "luma", "kling", "gemini"]` — preserving current behavior as a fallback.

### Consumers

| Consumer                 | Change Required                                       |
| ------------------------ | ----------------------------------------------------- |
| `video-jobs.services.ts` | Pass `providerIds` when constructing `VideoJobWorker` |

---

## Issue 8: Fix DI Fallback in ConsistentVideoService

### Problem

Line 35-36 of `ConsistentVideoService.ts`: `this.keyframeService = options.keyframeService || new KeyframeGenerationService()` creates a fallback instance inside the constructor, violating Dependency Inversion. Every other service uses strict constructor injection.

### Design

Make `keyframeService` required — throw if not provided, matching the pattern used for `videoGenerationService` (line 37-39) and `assetService` (line 40-42):

```typescript
if (!options.keyframeService) {
  throw new Error("KeyframeGenerationService is required");
}
this.keyframeService = options.keyframeService;
```

### Consumers

| Consumer                         | Change Required                                       |
| -------------------------------- | ----------------------------------------------------- |
| `generation.services.ts`         | Already provides `keyframeService` — no change needed |
| `ConsistentVideoService.test.ts` | Must provide `keyframeService` in all test setups     |

---

## Refactor Order

Execute in this order to minimize risk and enable incremental verification:

1. **Issue 8** (ConsistentVideoService DI) — 1 file, trivial, verify with `tsc --noEmit`
2. **Issue 7** (hardcoded provider list) — 2 files, low risk
3. **Issue 5** (image preprocessing extraction) — 2 files, mechanical move
4. **Issue 2** (availability deduplication) — 1 file, medium risk, run existing tests
5. **Issue 4** (Kling opossum + polling dedup) — 1 file, medium risk
6. **Issue 6** (injectable heartbeat) — 2 files, medium risk, run processVideoJob tests
7. **Issue 1** (VideoJobStore split) — 5 new files + 2 modified, highest risk, run all job tests

Each issue is independently verifiable with `tsc --noEmit` + `npm run test:unit`.

## Non-Goals

- No changes to route handlers, DI registration files, or shared types
- No changes to the `VideoProvider` interface or `VideoProviderMap` type
- No new npm dependencies (opossum removal only)
- No behavioral changes — same error messages, same retry policies, same timing
