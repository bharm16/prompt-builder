# Video Generation SRP Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 7 SRP/SoC violations in `server/src/services/video-generation/` — split the VideoJobStore god class, deduplicate availability logic, remove redundant circuit breaker, extract image preprocessing, make heartbeat injectable, derive provider lists from config, and fix a DI fallback.

**Architecture:** All changes are internal extractions and refactors — no public API changes, no new routes, no shared type changes. Each task produces a self-contained commit. The refactor order (8→7→5→2→4→6→1) goes from lowest risk to highest.

**Tech Stack:** TypeScript, Vitest, Firestore, opossum (removal from one file only)

**Spec:** `docs/superpowers/specs/2026-04-13-video-generation-srp-refactor-design.md`

---

### Task 1: Fix DI Fallback in ConsistentVideoService (Issue 8)

**Files:**

- Modify: `server/src/services/video-generation/ConsistentVideoService.ts:35-36`
- Modify: `server/src/services/video-generation/__tests__/ConsistentVideoService.test.ts`

- [ ] **Step 1: Add a failing test for the missing keyframeService guard**

In `server/src/services/video-generation/__tests__/ConsistentVideoService.test.ts`, add a new test after the existing "throws when VideoGenerationService is not provided" test:

```typescript
it("throws when KeyframeGenerationService is not provided", () => {
  expect(
    () =>
      new ConsistentVideoService({
        videoGenerationService: createVideoGenerationService(),
        assetService: createAssetService(),
      }),
  ).toThrow("KeyframeGenerationService is required");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/services/video-generation/__tests__/ConsistentVideoService.test.ts --reporter=verbose`

Expected: FAIL — currently the constructor silently creates a default `KeyframeGenerationService` instead of throwing.

- [ ] **Step 3: Make keyframeService required in the constructor**

In `server/src/services/video-generation/ConsistentVideoService.ts`, replace lines 35-36:

```typescript
// BEFORE
this.keyframeService =
  options.keyframeService || new KeyframeGenerationService();
```

With:

```typescript
// AFTER
if (!options.keyframeService) {
  throw new Error("KeyframeGenerationService is required");
}
this.keyframeService = options.keyframeService;
```

Also remove the now-unused default import of `KeyframeGenerationService` at the top of the file — change:

```typescript
import KeyframeGenerationService, {
  type KeyframeResult,
} from "./KeyframeGenerationService";
```

To:

```typescript
import type KeyframeGenerationService from "./KeyframeGenerationService";
import type { KeyframeResult } from "./KeyframeGenerationService";
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run server/src/services/video-generation/__tests__/ConsistentVideoService.test.ts --reporter=verbose`

Expected: All 6 tests PASS (5 existing + 1 new).

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`

Expected: Exit 0. The DI wiring in `generation.services.ts` already provides `keyframeService` — the null check at line 350 ensures it's only constructed when available.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/video-generation/ConsistentVideoService.ts server/src/services/video-generation/__tests__/ConsistentVideoService.test.ts
git commit -m "refactor: make keyframeService required in ConsistentVideoService constructor

Removes the silent fallback instantiation that violated Dependency Inversion.
The DI layer already provides keyframeService; this aligns the constructor
contract with the actual usage pattern.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Remove Hardcoded Provider List in VideoJobWorker (Issue 7)

**Files:**

- Modify: `server/src/services/video-generation/jobs/VideoJobWorker.ts:13-14,383-400`
- Modify: `server/src/config/services/generation.services.ts:420-442`

- [ ] **Step 1: Add `providerIds` to `VideoJobWorkerOptions`**

In `server/src/services/video-generation/jobs/VideoJobWorker.ts`, add to the `VideoJobWorkerOptions` interface (after `perProviderMaxConcurrent`):

```typescript
providerIds?: string[];
```

Add a new private field to the `VideoJobWorker` class (after `private readonly perProviderMaxConcurrent`):

```typescript
private readonly providerIds: string[];
```

In the constructor body, after the `this.perProviderMaxConcurrent = ...` assignment, add:

```typescript
this.providerIds = options.providerIds ?? [
  "replicate",
  "openai",
  "luma",
  "kling",
  "gemini",
];
```

- [ ] **Step 2: Replace the hardcoded array in `buildDispatchableProviders`**

In `server/src/services/video-generation/jobs/VideoJobWorker.ts`, change `buildDispatchableProviders()`:

```typescript
// BEFORE
private buildDispatchableProviders(): string[] {
  const allProviders = ["replicate", "openai", "luma", "kling", "gemini"];
  const dispatchable: string[] = [];

  for (const provider of allProviders) {
```

To:

```typescript
// AFTER
private buildDispatchableProviders(): string[] {
  const dispatchable: string[] = [];

  for (const provider of this.providerIds) {
```

- [ ] **Step 3: Pass `providerIds` from DI wiring**

In `server/src/config/services/generation.services.ts`, in the `videoJobWorker` registration (around line 421), add `providerIds` to the options object. Add it after the `metrics` line:

```typescript
return new VideoJobWorker(
  videoJobStore,
  videoGenerationService,
  creditService,
  storageService,
  {
    pollIntervalMs: wc.pollIntervalMs,
    leaseMs: wc.leaseSeconds * 1000,
    maxConcurrent: wc.maxConcurrent,
    heartbeatIntervalMs: wc.heartbeatIntervalMs,
    processRole: "worker",
    ...(config.videoJobs.hostname
      ? { hostname: config.videoJobs.hostname }
      : {}),
    providerCircuitManager,
    workerHeartbeatStore: videoWorkerHeartbeatStore,
    ...(wc.perProviderMaxConcurrent !== undefined
      ? { perProviderMaxConcurrent: wc.perProviderMaxConcurrent }
      : {}),
    metrics: metricsService,
    providerIds: ["replicate", "openai", "luma", "kling", "gemini"],
  },
);
```

- [ ] **Step 4: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/video-generation/jobs/__tests__/VideoJobWorker.test.ts --reporter=verbose`

Expected: Type check passes. Worker tests pass (behavior unchanged — same provider list, just sourced from options).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/video-generation/jobs/VideoJobWorker.ts server/src/config/services/generation.services.ts
git commit -m "refactor: derive provider list from VideoJobWorkerOptions

Replaces the hardcoded provider array in buildDispatchableProviders()
with a configurable providerIds option. The DI layer passes the same
list, but it's now a single source of truth instead of duplicated
knowledge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Extract Image Preprocessing from replicateProvider (Issue 5)

**Files:**

- Create: `server/src/services/video-generation/providers/imagePreprocessing.ts`
- Modify: `server/src/services/video-generation/providers/replicateProvider.ts`

- [ ] **Step 1: Create `imagePreprocessing.ts` with extracted helpers**

Create `server/src/services/video-generation/providers/imagePreprocessing.ts`:

```typescript
import { Blob as NodeBlob } from "node:buffer";

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const isBlobLike = (value: unknown): value is Blob =>
  (typeof Blob !== "undefined" && value instanceof Blob) ||
  value instanceof NodeBlob;

export function normalizeContentType(value: string | null): string {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function getUrlExtension(value: string): string | null {
  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf(".");
    if (lastDot < 0) {
      return null;
    }
    return pathname.slice(lastDot);
  } catch {
    return null;
  }
}

export function summarizeInputForLog(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isBlobLike(value)) {
      summary[key] = {
        type: "Blob",
        size: value.size,
        mime: value.type,
      };
      continue;
    }
    if (Buffer.isBuffer(value)) {
      summary[key] = {
        type: "Buffer",
        size: value.length,
      };
      continue;
    }
    if (typeof value === "string" && value.startsWith("data:")) {
      const mime = value.slice(5, value.indexOf(";")) || "unknown";
      summary[key] = {
        type: "data-uri",
        length: value.length,
        mime,
      };
      continue;
    }
    summary[key] = value;
  }
  return summary;
}

export async function resolveImageInput(
  imageUrl: string,
  log: LogSink,
  fieldName: "startImage" | "style_reference",
): Promise<string | Blob> {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const extension = getUrlExtension(imageUrl);
  if (extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return imageUrl;
  }

  log.info("Fetching image for Replicate input", {
    field: fieldName,
    hasExtension: Boolean(extension),
  });

  const response = await fetch(imageUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fieldName} (${response.status})`);
  }

  const contentType = normalizeContentType(
    response.headers.get("content-type"),
  );
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error(
      `Unsupported ${fieldName} format '${contentType || "unknown"}'. Supported formats: .jpg, .jpeg, .png, .webp`,
    );
  }

  const buffer = await response.arrayBuffer();
  const BlobCtor =
    typeof globalThis.Blob === "function"
      ? globalThis.Blob
      : (NodeBlob as unknown as typeof Blob);
  return new BlobCtor([buffer], { type: contentType });
}
```

- [ ] **Step 2: Update `replicateProvider.ts` to import from the new file**

In `server/src/services/video-generation/providers/replicateProvider.ts`:

Remove these declarations/functions (they now live in `imagePreprocessing.ts`):

- The `Blob as NodeBlob` import from `node:buffer`
- `SUPPORTED_IMAGE_EXTENSIONS`
- `SUPPORTED_IMAGE_MIME_TYPES`
- `isBlobLike`
- `normalizeContentType`
- `getUrlExtension`
- `summarizeInputForLog`
- `resolveReplicateImageInput`

Add this import at the top:

```typescript
import { resolveImageInput, summarizeInputForLog } from "./imagePreprocessing";
```

In `generateReplicateVideo`, update the two calls from `resolveReplicateImageInput` to `resolveImageInput`:

```typescript
// BEFORE
input.image = await resolveReplicateImageInput(input.image, log, "startImage");
// ...
input.style_reference = await resolveReplicateImageInput(
  input.style_reference,
  log,
  "style_reference",
);

// AFTER
input.image = await resolveImageInput(input.image, log, "startImage");
// ...
input.style_reference = await resolveImageInput(
  input.style_reference,
  log,
  "style_reference",
);
```

Keep `isRecord` in `replicateProvider.ts` — it's only used locally for output parsing.

- [ ] **Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/video-generation/providers/__tests__/replicateProvider.test.ts --reporter=verbose`

Expected: Type check passes. Replicate provider tests pass (behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add server/src/services/video-generation/providers/imagePreprocessing.ts server/src/services/video-generation/providers/replicateProvider.ts
git commit -m "refactor: extract image preprocessing helpers from replicateProvider

Moves resolveImageInput, summarizeInputForLog, and supporting helpers
(getUrlExtension, normalizeContentType, isBlobLike) into a dedicated
imagePreprocessing.ts module. replicateProvider imports from the new file.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Deduplicate getModelAvailability (Issue 2)

**Files:**

- Modify: `server/src/services/video-generation/availability.ts:89-296`

- [ ] **Step 1: Run existing availability tests to confirm baseline**

Run: `npx vitest run server/src/services/video-generation/__tests__/availabilityReport.test.ts --reporter=verbose`

Expected: All tests PASS.

- [ ] **Step 2: Add data-driven lookup maps and rewrite `getModelAvailability`**

In `server/src/services/video-generation/availability.ts`, add these lookup maps after the existing imports and before `getModelCapabilities`:

```typescript
import type { VideoProviderAvailability } from "./types";

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

Then replace the entire `getModelAvailability` function body (lines 89-296) with:

```typescript
export function getModelAvailability(
  model: string | null | undefined,
  providers: VideoProviderAvailability,
  log: LogSink,
): VideoModelAvailability {
  const resolution = resolveModelSelection(model || undefined, log);
  const isAuto =
    !model ||
    (typeof model === "string" &&
      (model.trim().length === 0 || model.trim().toLowerCase() === "auto"));
  const autoModelId = isAuto ? resolveAutoModelId(providers) : null;
  const resolvedId = autoModelId || resolution.modelId;
  const capabilityInfo = getModelCapabilities(resolvedId);
  const requestedId =
    typeof model === "string" && model.trim().length > 0
      ? model.trim()
      : "auto";

  if (isAuto && !autoModelId) {
    return {
      id: "auto",
      requestedId: "auto",
      available: false,
      reason: "missing_credentials",
      statusCode: 424,
      message: "No video generation providers are configured.",
      supportsI2V: false,
      entitled: false,
      planTier: "unknown",
    };
  }

  const normalizedModel =
    typeof model === "string" ? model.trim().toLowerCase() : "";

  if (
    model &&
    normalizedModel !== "auto" &&
    resolution.resolvedBy === "default"
  ) {
    return {
      id: model,
      requestedId: model,
      available: false,
      reason: "unsupported_model",
      statusCode: 400,
      message: `Unknown video model: ${model}`,
      supportsI2V: false,
      entitled: false,
      planTier: "unknown",
    };
  }

  const providerKey = resolveProviderForModel(resolvedId);
  const isAvailable = providers[providerKey];

  const base = {
    id: model || resolvedId,
    requestedId,
    resolvedModelId: resolvedId,
    ...withCapabilityModelId(capabilityInfo.capabilityModelId),
    supportsImageInput: capabilityInfo.supportsImageInput,
    supportsI2V: capabilityInfo.supportsImageInput,
  };

  if (!isAvailable) {
    return {
      ...base,
      available: false,
      reason: "missing_credentials",
      requiredKey: PROVIDER_REQUIRED_KEYS[providerKey],
      statusCode: 424,
      message: PROVIDER_MISSING_MESSAGES[providerKey],
      entitled: false,
      planTier: "unknown",
    };
  }

  return {
    ...base,
    available: true,
    entitled: true,
    planTier: "unknown",
  };
}
```

Also remove the now-unused imports from `./modelResolver`:

```typescript
// BEFORE
import {
  resolveModelSelection,
  isKlingModel,
  isLumaModel,
  isOpenAISoraModel,
  isVeoModel,
} from "./modelResolver";

// AFTER
import { resolveModelSelection } from "./modelResolver";
```

Add the import for `resolveProviderForModel` if not already present (it's in `ProviderRegistry`):

```typescript
import {
  resolveAutoModelId,
  resolveProviderForModel,
} from "./providers/ProviderRegistry";
```

Note: `resolveAutoModelId` is already imported — just add `resolveProviderForModel` to the existing import.

- [ ] **Step 3: Run type check and availability tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/video-generation/__tests__/availabilityReport.test.ts --reporter=verbose`

Expected: All tests PASS. The behavioral contract is identical.

- [ ] **Step 4: Run the workflow test to catch any cascade**

Run: `npx vitest run server/src/services/video-generation/__tests__/generateVideoWorkflow.test.ts --reporter=verbose`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/video-generation/availability.ts
git commit -m "refactor: deduplicate getModelAvailability with data-driven provider lookup

Replaces 5 near-identical if/else branches (one per provider) with
lookup maps for required keys and error messages. The function resolves
the provider key once via resolveProviderForModel, then uses a single
branch for available vs unavailable.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Remove Kling Opossum Breaker + Deduplicate Polling (Issue 4)

**Files:**

- Modify: `server/src/services/video-generation/providers/klingProvider.ts`

- [ ] **Step 1: Run existing Kling tests to confirm baseline**

Run: `npx vitest run server/src/services/video-generation/providers/__tests__/klingProvider.test.ts --reporter=verbose`

Expected: All tests PASS.

- [ ] **Step 2: Remove opossum and simplify `klingFetch`**

In `server/src/services/video-generation/providers/klingProvider.ts`:

Remove the opossum import and breaker singleton (lines 2, 164-178):

```typescript
// DELETE this import
import CircuitBreaker from "opossum";

// DELETE these lines (breaker singleton + fallback)
const breaker = new CircuitBreaker(_rawKlingFetch, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  name: "KlingAPI",
});

breaker.fallback((error) => {
  if (error && error.message === "Breaker is open") {
    throw new Error("Kling API Circuit Breaker Open");
  }
  throw error;
});
```

Replace the `klingFetch` function:

```typescript
// BEFORE
async function klingFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  return breaker.fire(baseUrl, apiKey, path, init);
}

// AFTER
async function klingFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  return _rawKlingFetch(baseUrl, apiKey, path, init);
}
```

- [ ] **Step 3: Unify `waitForKlingVideo` and `waitForKlingImageToVideo` into `waitForKlingTask`**

Replace both functions with a single unified one:

```typescript
async function waitForKlingTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  endpoint: "text2video" | "image2video",
): Promise<string> {
  const timeoutMs = getProviderPollTimeoutMs();
  const start = Date.now();

  while (true) {
    const json = await klingFetch(
      baseUrl,
      apiKey,
      `/v1/videos/${endpoint}/${encodeURIComponent(taskId)}`,
      { method: "GET" },
    );
    const parsed = parseKlingResponse(
      KLING_TASK_RESULT_RESPONSE_SCHEMA,
      json,
      `${endpoint}/status`,
    );

    if (parsed.code !== 0) {
      throw new Error(
        `Kling error code=${parsed.code}: ${parsed.message ?? "unknown error"}`,
      );
    }

    const task = parsed.data;

    if (task.task_status === "succeed") {
      const url = task.task_result?.videos?.[0]?.url;
      if (!url) {
        throw new Error(
          `Kling ${endpoint} task succeeded but no video URL was returned.`,
        );
      }
      return url;
    }

    if (task.task_status === "failed") {
      throw new Error(
        `Kling ${endpoint} task failed: ${task.task_status_msg ?? "no reason provided"}`,
      );
    }

    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs) {
      throw new Error(`Timed out waiting for Kling ${endpoint} task ${taskId}`);
    }

    await sleep(pollingDelay(KLING_STATUS_POLL_INTERVAL_MS, elapsed));
  }
}
```

- [ ] **Step 4: Update callers to use `waitForKlingTask`**

In `generateKlingVideo`, change:

```typescript
// BEFORE
const url = await waitForKlingVideo(baseUrl, apiKey, taskId);

// AFTER
const url = await waitForKlingTask(baseUrl, apiKey, taskId, "text2video");
```

In `generateKlingImageToVideo`, change:

```typescript
// BEFORE
const url = await waitForKlingImageToVideo(baseUrl, apiKey, taskId);

// AFTER
const url = await waitForKlingTask(baseUrl, apiKey, taskId, "image2video");
```

Also remove the now-unused `getKlingTask` function (it was only used by the old `waitForKlingVideo`).

- [ ] **Step 5: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/video-generation/providers/__tests__/klingProvider.test.ts --reporter=verbose`

Expected: All tests PASS. The tests mock `fetch` globally, not opossum — so removing the breaker doesn't break them.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/video-generation/providers/klingProvider.ts
git commit -m "refactor: remove opossum circuit breaker and unify Kling polling

Removes the module-level opossum breaker from klingProvider — circuit
breaking is already handled by ProviderCircuitManager at the job level.
Merges waitForKlingVideo and waitForKlingImageToVideo into a single
waitForKlingTask function parameterized by endpoint.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Injectable Heartbeat in processVideoJob (Issue 6)

**Files:**

- Modify: `server/src/services/video-generation/jobs/processVideoJob.ts`
- Modify: `server/src/services/video-generation/jobs/VideoJobWorker.ts`

- [ ] **Step 1: Add the optional `heartbeat` field to `ProcessVideoJobDeps`**

In `server/src/services/video-generation/jobs/processVideoJob.ts`, add to the `ProcessVideoJobDeps` interface (after the `logPrefix` field):

```typescript
/** Optional heartbeat strategy. When provided, processVideoJob delegates
 *  heartbeat start/stop to this object instead of creating its own timer.
 *  The worker passes its own implementation with failure counting + abort;
 *  the inline processor omits this to use the default timer. */
heartbeat?: {
  start(): void;
  stop(): void;
};
```

- [ ] **Step 2: Update `processVideoJob` to use the injectable heartbeat**

In the `processVideoJob` function body, replace the heartbeat setup and teardown:

```typescript
// BEFORE (lines ~149-178)
let heartbeatTimer: NodeJS.Timeout | null = null;

const startHeartbeat = (): void => {
  heartbeatTimer = setInterval(() => {
    void jobStore
      .renewLease(job.id, workerId, leaseMs)
      .then((renewed) => {
        if (!renewed) {
          log.warn(`${logPrefix} heartbeat skipped (lease lost)`, {
            jobId: job.id,
            workerId,
          });
        }
      })
      .catch((err) => {
        log.warn(`${logPrefix} heartbeat failed`, {
          jobId: job.id,
          workerId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, heartbeatIntervalMs);
};

const stopHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// AFTER
const defaultHeartbeat = (() => {
  let heartbeatTimer: NodeJS.Timeout | null = null;
  return {
    start(): void {
      heartbeatTimer = setInterval(() => {
        void jobStore
          .renewLease(job.id, workerId, leaseMs)
          .then((renewed) => {
            if (!renewed) {
              log.warn(`${logPrefix} heartbeat skipped (lease lost)`, {
                jobId: job.id,
                workerId,
              });
            }
          })
          .catch((err) => {
            log.warn(`${logPrefix} heartbeat failed`, {
              jobId: job.id,
              workerId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }, heartbeatIntervalMs);
    },
    stop(): void {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  };
})();

const heartbeat = deps.heartbeat ?? defaultHeartbeat;
```

In the `try` block, replace `startHeartbeat()` with `heartbeat.start()`.

In the `finally` block, replace `stopHeartbeat()` with `heartbeat.stop()`.

- [ ] **Step 3: Update VideoJobWorker to pass its own heartbeat implementation**

In `server/src/services/video-generation/jobs/VideoJobWorker.ts`, in the `processJob` method, replace the heartbeat setup. The worker already creates its own `workerHeartbeatTimer` with failure counting + `heartbeatAbort`. Wrap that in the heartbeat interface and pass it to `processVideoJob`.

Before the `processVideoJob` call, after the `workerHeartbeatTimer` setup (around line 533), add:

```typescript
const workerHeartbeat = {
  start(): void {
    // Already started above — the worker manages its own heartbeat timer.
    // This is a no-op because the timer was started before processVideoJob.
  },
  stop(): void {
    clearInterval(workerHeartbeatTimer);
    this.heartbeatFailures.delete(job.id);
  },
};
```

Wait — the worker's heartbeat timer is already started before `processVideoJob` is called, and cleaned up in the `finally` block. The cleanest approach: move the timer start into the heartbeat's `start()`, and cleanup into `stop()`. Restructure the `processJob` method:

Replace the `processJob` method's heartbeat setup and `processVideoJob` call section. The key change is that we pass `heartbeat` and remove the `heartbeatIntervalMs: this.leaseMs * 10` hack:

Find this section in `processJob`:

```typescript
this.heartbeatFailures.set(job.id, 0);
const workerHeartbeatTimer = setInterval(() => {
  // ... ~70 lines of heartbeat logic ...
}, this.heartbeatIntervalMs);

try {
  await processVideoJob(job, {
    // ...
    heartbeatIntervalMs: this.leaseMs * 10,
    // ...
  });
} finally {
  clearInterval(workerHeartbeatTimer);
  this.heartbeatFailures.delete(job.id);
  this.activeJobs.delete(job.id);
}
```

Replace with:

```typescript
this.heartbeatFailures.set(job.id, 0);
let workerHeartbeatTimer: NodeJS.Timeout | null = null;

const workerHeartbeat = {
  start: (): void => {
    workerHeartbeatTimer = setInterval(() => {
      void this.jobStore
        .renewLease(job.id, this.workerId, this.leaseMs)
        .then((renewed) => {
          if (renewed) {
            this.heartbeatFailures.set(job.id, 0);
          } else {
            const consecutiveHbFails =
              (this.heartbeatFailures.get(job.id) ?? 0) + 1;
            this.heartbeatFailures.set(job.id, consecutiveHbFails);
            this.log.warn(
              "Video job lease heartbeat skipped (lease may have been reclaimed)",
              {
                jobId: job.id,
                workerId: this.workerId,
                consecutiveFailures: consecutiveHbFails,
              },
            );
            if (consecutiveHbFails >= VideoJobWorker.MAX_HEARTBEAT_FAILURES) {
              this.log.error(
                "Aborting job due to repeated heartbeat failures — lease likely expired",
                undefined,
                {
                  jobId: job.id,
                  workerId: this.workerId,
                  consecutiveFailures: consecutiveHbFails,
                },
              );
              this.metrics?.recordAlert("video_job_heartbeat_abort", {
                jobId: job.id,
                workerId: this.workerId,
                consecutiveFailures: consecutiveHbFails,
              });
              heartbeatAbort.abort(
                new Error(
                  "Lease heartbeat lost — aborting to prevent zombie job",
                ),
              );
            }
          }
        })
        .catch((error) => {
          const consecutiveHbFails =
            (this.heartbeatFailures.get(job.id) ?? 0) + 1;
          this.heartbeatFailures.set(job.id, consecutiveHbFails);
          this.log.warn("Video job heartbeat failed", {
            jobId: job.id,
            workerId: this.workerId,
            error: normalizeErrorMessage(error),
            consecutiveFailures: consecutiveHbFails,
          });
          if (consecutiveHbFails >= VideoJobWorker.MAX_HEARTBEAT_FAILURES) {
            this.log.error(
              "Aborting job due to repeated heartbeat errors — lease likely expired",
              undefined,
              {
                jobId: job.id,
                workerId: this.workerId,
                consecutiveFailures: consecutiveHbFails,
              },
            );
            this.metrics?.recordAlert("video_job_heartbeat_abort", {
              jobId: job.id,
              workerId: this.workerId,
              consecutiveFailures: consecutiveHbFails,
            });
            heartbeatAbort.abort(
              new Error(
                "Lease heartbeat lost — aborting to prevent zombie job",
              ),
            );
          }
        });
    }, this.heartbeatIntervalMs);
  },
  stop: (): void => {
    if (workerHeartbeatTimer) {
      clearInterval(workerHeartbeatTimer);
      workerHeartbeatTimer = null;
    }
    this.heartbeatFailures.delete(job.id);
  },
};

try {
  await processVideoJob(job, {
    jobStore: this.jobStore,
    videoGenerationService: this.videoGenerationService as never,
    storageService: this.storageService,
    userCreditService: this.userCreditService,
    workerId: this.workerId,
    leaseMs: this.leaseMs,
    signal: heartbeatAbort.signal,
    onProviderSuccess: this.providerCircuitManager
      ? (provider) => this.providerCircuitManager!.recordSuccess(provider)
      : undefined,
    onProviderFailure: this.providerCircuitManager
      ? (provider) => this.providerCircuitManager!.recordFailure(provider)
      : undefined,
    metrics: this.metrics,
    dlqSource: "worker-terminal",
    refundReason: "video job worker failed",
    logPrefix: "Video job",
    heartbeat: workerHeartbeat,
  });
} finally {
  workerHeartbeat.stop();
  this.activeJobs.delete(job.id);
}
```

Note: the `heartbeatIntervalMs: this.leaseMs * 10` hack is removed — the worker now passes its own heartbeat object instead.

- [ ] **Step 4: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/video-generation/jobs/__tests__/VideoJobWorker.test.ts --reporter=verbose`

Expected: Type check passes. Worker tests pass.

- [ ] **Step 5: Verify inline processor still works (no heartbeat passed = default)**

Run: `npx tsc --noEmit`

Expected: Exit 0. `inlineProcessor.ts` doesn't pass `heartbeat` — it gets the default timer, which is the backward-compatible behavior.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/video-generation/jobs/processVideoJob.ts server/src/services/video-generation/jobs/VideoJobWorker.ts
git commit -m "refactor: make heartbeat injectable in processVideoJob

Adds an optional heartbeat strategy to ProcessVideoJobDeps. When
provided, processVideoJob delegates start/stop to it. VideoJobWorker
now passes its own implementation with failure counting + abort,
eliminating the heartbeatIntervalMs hack that disabled the default
timer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Split VideoJobStore — Extract DeadLetterStore (Issue 1, Part A)

**Files:**

- Create: `server/src/services/video-generation/jobs/DeadLetterStore.ts`
- Modify: `server/src/services/video-generation/jobs/VideoJobStore.ts`
- Modify: `server/src/services/video-generation/jobs/index.ts`

- [ ] **Step 1: Create `dlqBackoff.ts` with the extracted backoff function**

Create `server/src/services/video-generation/jobs/dlqBackoff.ts`:

```typescript
export function computeDlqBackoff(attempt: number): number {
  return Math.min(300_000, 30_000 * Math.pow(2, attempt));
}
```

- [ ] **Step 2: Create `parseVideoJobRecord.ts` with the extracted parser**

Create `server/src/services/video-generation/jobs/parseVideoJobRecord.ts`:

```typescript
import type { DocumentData } from "firebase-admin/firestore";
import { VideoJobRecordSchema } from "./schemas";
import type { VideoJobError, VideoJobRecord, VideoJobRequest } from "./types";

function resolvePositiveInt(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isFinite(value) && (value as number) > 0
    ? Number.parseInt(String(value), 10)
    : fallback;
}

function toVideoJobError(error: VideoJobError | string): VideoJobError {
  if (typeof error === "string") {
    return { message: error };
  }
  return {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.category ? { category: error.category } : {}),
    ...(typeof error.retryable === "boolean"
      ? { retryable: error.retryable }
      : {}),
    ...(error.stage ? { stage: error.stage } : {}),
    ...(error.provider ? { provider: error.provider } : {}),
    ...(typeof error.attempt === "number" ? { attempt: error.attempt } : {}),
  };
}

export function parseVideoJobRecord(
  id: string,
  data: DocumentData | undefined,
  defaultMaxAttempts: number,
): VideoJobRecord {
  const parsed = VideoJobRecordSchema.parse(data || {});
  const normalizedOptions = Object.fromEntries(
    Object.entries(parsed.request.options ?? {}).filter(
      ([, value]) => value !== undefined,
    ),
  ) as VideoJobRequest["options"];
  const normalizedResult = parsed.result
    ? {
        assetId: parsed.result.assetId,
        videoUrl: parsed.result.videoUrl,
        contentType: parsed.result.contentType,
        ...(parsed.result.inputMode !== undefined
          ? { inputMode: parsed.result.inputMode }
          : {}),
        ...(parsed.result.startImageUrl !== undefined
          ? { startImageUrl: parsed.result.startImageUrl }
          : {}),
        ...(parsed.result.storagePath !== undefined
          ? { storagePath: parsed.result.storagePath }
          : {}),
        ...(parsed.result.viewUrl !== undefined
          ? { viewUrl: parsed.result.viewUrl }
          : {}),
        ...(parsed.result.viewUrlExpiresAt !== undefined
          ? { viewUrlExpiresAt: parsed.result.viewUrlExpiresAt }
          : {}),
        ...(parsed.result.sizeBytes !== undefined
          ? { sizeBytes: parsed.result.sizeBytes }
          : {}),
      }
    : undefined;

  const base: VideoJobRecord = {
    id,
    status: parsed.status,
    userId: parsed.userId,
    request: {
      ...parsed.request,
      options: normalizedOptions,
    },
    creditsReserved: parsed.creditsReserved,
    ...(typeof parsed.provider === "string"
      ? { provider: parsed.provider }
      : {}),
    attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
    maxAttempts: resolvePositiveInt(
      typeof parsed.maxAttempts === "number" ? parsed.maxAttempts : undefined,
      defaultMaxAttempts,
    ),
    createdAtMs: parsed.createdAtMs,
    updatedAtMs: parsed.updatedAtMs,
  };

  if (typeof parsed.completedAtMs === "number") {
    base.completedAtMs = parsed.completedAtMs;
  }
  if (normalizedResult) {
    base.result = normalizedResult;
  }
  if (parsed.error) {
    base.error = toVideoJobError(parsed.error);
  }
  if (typeof parsed.workerId === "string") {
    base.workerId = parsed.workerId;
  }
  if (typeof parsed.leaseExpiresAtMs === "number") {
    base.leaseExpiresAtMs = parsed.leaseExpiresAtMs;
  }
  if (typeof parsed.lastHeartbeatAtMs === "number") {
    base.lastHeartbeatAtMs = parsed.lastHeartbeatAtMs;
  }
  if (typeof parsed.releasedAtMs === "number") {
    base.releasedAtMs = parsed.releasedAtMs;
  }
  if (typeof parsed.releaseReason === "string") {
    base.releaseReason = parsed.releaseReason;
  }

  return base;
}
```

- [ ] **Step 3: Create `DeadLetterStore.ts`**

Create `server/src/services/video-generation/jobs/DeadLetterStore.ts`:

```typescript
import { admin, getFirestore } from "@infrastructure/firebaseAdmin";
import { logger } from "@infrastructure/Logger";
import type { FirestoreCircuitExecutor } from "@services/firestore/FirestoreCircuitExecutor";
import { computeDlqBackoff } from "./dlqBackoff";
import type {
  DlqEntry,
  VideoJobError,
  VideoJobRecord,
  VideoJobRequest,
} from "./types";

const SLOW_FIRESTORE_OPERATION_MS = 1_000;

type DeadLetterSource =
  | "worker-terminal"
  | "sweeper-stale"
  | "shutdown-release"
  | "manual-release"
  | "inline-terminal";

export class DeadLetterStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection("video_job_dlq");
  private readonly log = logger.child({ service: "DeadLetterStore" });
  private readonly firestoreCircuitExecutor: FirestoreCircuitExecutor;

  constructor(firestoreCircuitExecutor: FirestoreCircuitExecutor) {
    this.firestoreCircuitExecutor = firestoreCircuitExecutor;
  }

  private async withTiming<T>(
    operation: string,
    mode: "read" | "write",
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      if (mode === "write") {
        return await this.firestoreCircuitExecutor.executeWrite(
          `deadLetterStore.${operation}`,
          fn,
        );
      }
      return await this.firestoreCircuitExecutor.executeRead(
        `deadLetterStore.${operation}`,
        fn,
      );
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= SLOW_FIRESTORE_OPERATION_MS) {
        this.log.warn("Slow Firestore DLQ operation", {
          operation,
          durationMs,
        });
      } else {
        this.log.debug("Firestore DLQ operation completed", {
          operation,
          durationMs,
        });
      }
    }
  }

  async enqueueDeadLetter(
    job: VideoJobRecord,
    error: VideoJobError,
    source: DeadLetterSource | string,
    options?: { creditsRefunded?: boolean },
  ): Promise<void> {
    const now = Date.now();
    const isRetryable = error.retryable !== false;
    const initialBackoffMs = 30_000;
    const maxDlqAttempts = 3;

    await this.withTiming("enqueueDeadLetter", "write", async () => {
      await this.collection.doc(job.id).set(
        {
          jobId: job.id,
          userId: job.userId,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          request: job.request,
          creditsReserved: job.creditsReserved,
          creditsRefunded: options?.creditsRefunded ?? false,
          provider: job.provider ?? "unknown",
          error,
          source,
          dlqStatus: isRetryable ? "pending" : "escalated",
          dlqAttempt: 0,
          maxDlqAttempts,
          nextRetryAtMs: isRetryable ? now + initialBackoffMs : 0,
          lastDlqError: null,
          createdAtMs: now,
          updatedAtMs: now,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  async claimNextDlqEntry(nowMs: number): Promise<DlqEntry | null> {
    const query = this.collection
      .where("dlqStatus", "==", "pending")
      .where("nextRetryAtMs", "<=", nowMs)
      .orderBy("nextRetryAtMs", "asc")
      .limit(1);

    try {
      return await this.withTiming(
        "claimNextDlqEntry",
        "write",
        async () =>
          await this.db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(query);
            if (snapshot.empty) {
              return null;
            }

            const doc = snapshot.docs[0];
            if (!doc) {
              return null;
            }
            const data = doc.data();
            if (!data || data.dlqStatus !== "pending") {
              return null;
            }

            const now = Date.now();
            transaction.update(doc.ref, {
              dlqStatus: "processing",
              updatedAtMs: now,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
              id: doc.id,
              jobId: data.jobId as string,
              userId: data.userId as string,
              request: data.request as VideoJobRequest,
              creditsReserved:
                typeof data.creditsReserved === "number"
                  ? data.creditsReserved
                  : 0,
              creditsRefunded: data.creditsRefunded === true,
              provider:
                typeof data.provider === "string" ? data.provider : "unknown",
              error: data.error as VideoJobError,
              source: data.source as string,
              dlqAttempt:
                typeof data.dlqAttempt === "number" ? data.dlqAttempt : 0,
              maxDlqAttempts:
                typeof data.maxDlqAttempts === "number"
                  ? data.maxDlqAttempts
                  : 3,
            } satisfies DlqEntry;
          }),
      );
    } catch (error) {
      this.log.error("Failed to claim DLQ entry", error as Error);
      return null;
    }
  }

  async markDlqReprocessed(dlqId: string): Promise<void> {
    const now = Date.now();
    await this.withTiming("markDlqReprocessed", "write", async () => {
      await this.collection.doc(dlqId).update({
        dlqStatus: "reprocessed",
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  async markDlqFailed(
    dlqId: string,
    attempt: number,
    maxAttempts: number,
    errorMessage: string,
  ): Promise<boolean> {
    const now = Date.now();
    const escalate = attempt + 1 >= maxAttempts;
    const backoffMs = computeDlqBackoff(attempt);

    await this.withTiming("markDlqFailed", "write", async () => {
      await this.collection.doc(dlqId).update({
        dlqStatus: escalate ? "escalated" : "pending",
        dlqAttempt: attempt + 1,
        nextRetryAtMs: escalate ? 0 : now + backoffMs,
        lastDlqError: errorMessage,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (escalate) {
      this.log.error(
        "DLQ entry escalated — all retry attempts exhausted. Manual intervention required.",
        undefined,
        {
          dlqId,
          attempt: attempt + 1,
          maxAttempts,
          lastError: errorMessage,
        },
      );
    }

    return escalate;
  }

  async getDlqBacklogCount(): Promise<number> {
    const snapshot = await this.withTiming(
      "getDlqBacklogCount",
      "read",
      async () =>
        await this.collection.where("dlqStatus", "==", "pending").count().get(),
    );
    return snapshot.data().count;
  }
}
```

- [ ] **Step 4: Update `VideoJobStore` to delegate DLQ methods**

In `server/src/services/video-generation/jobs/VideoJobStore.ts`:

Add import:

```typescript
import { DeadLetterStore } from "./DeadLetterStore";
import { parseVideoJobRecord } from "./parseVideoJobRecord";
```

Add `dlq` property to the class:

```typescript
public readonly dlq: DeadLetterStore;
```

In the constructor, after `this.defaultMaxAttempts = defaultMaxAttempts;`:

```typescript
this.dlq = new DeadLetterStore(firestoreCircuitExecutor);
```

Remove the following from `VideoJobStore`:

- `private readonly deadLetterCollection = this.db.collection("video_job_dlq");`
- The entire `enqueueDeadLetter` method body — replace with delegation
- The entire `claimNextDlqEntry` method body — replace with delegation
- The entire `markDlqReprocessed` method body — replace with delegation
- The entire `markDlqFailed` method body — replace with delegation
- The entire `getDlqBacklogCount` method body — replace with delegation
- The entire `parseJob` method — replace with call to `parseVideoJobRecord`
- The module-level `toVideoJobError` function (move to `parseVideoJobRecord.ts` — already done)
- The module-level `resolvePositiveInt` function — keep a copy in `VideoJobStore` (it's also used for `maxAttempts` in claim methods)

Add delegation methods:

```typescript
async enqueueDeadLetter(
  job: VideoJobRecord,
  error: VideoJobError,
  source: string,
  options?: { creditsRefunded?: boolean },
): Promise<void> {
  return this.dlq.enqueueDeadLetter(job, error, source, options);
}

async claimNextDlqEntry(nowMs: number): Promise<DlqEntry | null> {
  return this.dlq.claimNextDlqEntry(nowMs);
}

async markDlqReprocessed(dlqId: string): Promise<void> {
  return this.dlq.markDlqReprocessed(dlqId);
}

async markDlqFailed(
  dlqId: string,
  attempt: number,
  maxAttempts: number,
  errorMessage: string,
): Promise<boolean> {
  return this.dlq.markDlqFailed(dlqId, attempt, maxAttempts, errorMessage);
}

async getDlqBacklogCount(): Promise<number> {
  return this.dlq.getDlqBacklogCount();
}
```

Replace the private `parseJob` method:

```typescript
private parseJob(id: string, data: DocumentData | undefined): VideoJobRecord {
  return parseVideoJobRecord(id, data, this.defaultMaxAttempts);
}
```

Keep `toVideoJobError` in `VideoJobStore` for use in `requeueForRetry`, `markFailed`, and `failFromQuery`. These methods normalize errors before writing to the job record (not the DLQ). The `DeadLetterStore` receives already-normalized errors.

- [ ] **Step 5: Update `jobs/index.ts` to re-export**

In `server/src/services/video-generation/jobs/index.ts`, add:

```typescript
export { DeadLetterStore } from "./DeadLetterStore";
export { parseVideoJobRecord } from "./parseVideoJobRecord";
export { computeDlqBackoff } from "./dlqBackoff";
```

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`

Expected: Exit 0. All consumers still call `jobStore.enqueueDeadLetter()` etc. — the delegation is transparent.

- [ ] **Step 7: Run all job-related tests**

Run: `npx vitest run server/src/services/video-generation/jobs/__tests__/ --reporter=verbose`

Expected: All tests PASS (VideoJobStore, VideoJobWorker, VideoJobSweeper, VideoJobReconciler, classifyError).

- [ ] **Step 8: Run full unit test suite**

Run: `npm run test:unit`

Expected: All shards PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/services/video-generation/jobs/DeadLetterStore.ts server/src/services/video-generation/jobs/parseVideoJobRecord.ts server/src/services/video-generation/jobs/dlqBackoff.ts server/src/services/video-generation/jobs/VideoJobStore.ts server/src/services/video-generation/jobs/index.ts
git commit -m "refactor: split VideoJobStore — extract DeadLetterStore, parseVideoJobRecord, dlqBackoff

Extracts the dead letter queue CRUD into its own DeadLetterStore class,
the Zod parsing/normalization into parseVideoJobRecord, and the backoff
computation into computeDlqBackoff. VideoJobStore delegates DLQ methods
for backward compatibility — no consumer changes required.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`

Expected: Exit 0.

- [ ] **Step 2: Run linter**

Run: `npx eslint --config config/lint/eslint.config.js . --quiet`

Expected: 0 errors.

- [ ] **Step 3: Run full unit tests**

Run: `npm run test:unit`

Expected: All shards PASS.

- [ ] **Step 4: Run integration test gate (since we're near DI config territory)**

Run: `PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js`

Expected: PASS. DI wiring unchanged for VideoJobStore — it's still constructed the same way.
