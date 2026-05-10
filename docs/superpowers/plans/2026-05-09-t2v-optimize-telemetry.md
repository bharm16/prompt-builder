# T2V Optimize Operational Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit one PostHog event (`optimize.completed`) per `/api/optimize` call with stage-level timing, LLM call count, cache hit, target model, and outcome. Telemetry is non-blocking and best-effort; a no-op stub kicks in when `POSTHOG_API_KEY` is unset so local dev works unchanged.

**Architecture:** Two new infrastructure files (`PostHogClient` + factory) plus one new domain service (`OptimizeTelemetryService` with an `OptimizeTrace` instance class) wired through the existing DI container. The trace is created in the optimize route handler from `req.id` + `req.user.uid`, threaded through `PromptOptimizationService.optimize()` into `runOptimizeFlow`, and emits the event in the success/error/abort paths via a `complete()` call. PostHog client `shutdown()` is wired into the existing `setupGracefulShutdown` to flush pending events on deploy.

**Tech Stack:** Node 20 + Express + tsx + TypeScript (server), `posthog-node` SDK (new dependency), Vitest (unit + integration), Pino (existing logger), existing `DIContainer` infrastructure.

**Source spec:** [`docs/superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md`](../specs/2026-05-09-t2v-optimize-telemetry-design.md)

---

## Phase 1 — PostHog dependency + infrastructure shim

**Goal:** Add `posthog-node` to the server, build the thin `PostHogClient` wrapper with a no-op stub for missing API keys, and confirm the indirection works in isolation before any consumer is wired.

### Task 1.1: Add `posthog-node` dependency

**Files:**

- Modify: `server/package.json`

- [ ] **Step 1: Install the package**

```bash
cd server && npm install posthog-node
```

Expected: `posthog-node` appears under `dependencies` in `server/package.json`.

- [ ] **Step 2: Verify the install**

```bash
cd server && node -e "console.log(require('posthog-node').PostHog ? 'ok' : 'missing')"
```

Expected: prints `ok`.

- [ ] **Step 3: Verify no other files changed unexpectedly**

```bash
git status
```

Expected: only `server/package.json` and `server/package-lock.json` (or `package-lock.json` at the root) modified.

- [ ] **Step 4: Commit**

```bash
git add server/package.json package-lock.json
git commit -m "chore(deps): add posthog-node for server-side telemetry"
```

### Task 1.2: Implement `IPostHogClient` interface, real client, no-op stub, factory

**Files:**

- Create: `server/src/infrastructure/PostHogClient.ts`
- Create: `server/src/infrastructure/__tests__/PostHogClient.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/infrastructure/__tests__/PostHogClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPostHogClient } from "../PostHogClient";

describe("createPostHogClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY;
    const client = createPostHogClient();
    expect(() =>
      client.capture({ distinctId: "u", event: "test.event" }),
    ).not.toThrow();
    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is empty string", async () => {
    process.env.POSTHOG_API_KEY = "   ";
    const client = createPostHogClient();
    expect(() =>
      client.capture({ distinctId: "u", event: "test.event" }),
    ).not.toThrow();
    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it("constructs a real client when POSTHOG_API_KEY is set", () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const client = createPostHogClient();
    expect(client).toBeDefined();
    expect(typeof client.capture).toBe("function");
    expect(typeof client.shutdown).toBe("function");
  });

  it("real client.capture swallows internal errors and does not throw", () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const client = createPostHogClient();
    expect(() =>
      client.capture({
        distinctId: "u",
        event: "test.event",
        properties: { foo: "bar" },
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
npx vitest run server/src/infrastructure/__tests__/PostHogClient.test.ts --config config/test/vitest.unit.config.js
```

Expected: FAIL with "Cannot find module '../PostHogClient'".

- [ ] **Step 3: Implement `PostHogClient.ts`**

Create `server/src/infrastructure/PostHogClient.ts`:

```ts
import { PostHog } from "posthog-node";

export interface CaptureArgs {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
}

export interface IPostHogClient {
  capture(args: CaptureArgs): void;
  shutdown(): Promise<void>;
}

class PostHogClientReal implements IPostHogClient {
  private readonly client: PostHog;

  constructor(apiKey: string, host?: string) {
    this.client = new PostHog(apiKey, {
      ...(host ? { host } : {}),
      flushAt: 20,
      flushInterval: 10000,
    });
  }

  capture(args: CaptureArgs): void {
    try {
      this.client.capture(args);
    } catch {
      // Telemetry must never throw upstream. posthog-node queues internally
      // and retries network failures itself; this catch covers misuse / OOM.
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.client.shutdown();
    } catch {
      // shutdown is best-effort; ignore failures on process exit.
    }
  }
}

class PostHogClientNoop implements IPostHogClient {
  capture(): void {
    // no-op
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}

/**
 * Factory: returns a real client when POSTHOG_API_KEY is set, otherwise a
 * silent no-op. Keeps local dev painless and gates production telemetry on
 * the env var alone — no application-level feature flag needed.
 */
export function createPostHogClient(): IPostHogClient {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return new PostHogClientNoop();
  }
  return new PostHogClientReal(apiKey, process.env.POSTHOG_HOST);
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
npx vitest run server/src/infrastructure/__tests__/PostHogClient.test.ts --config config/test/vitest.unit.config.js
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Type-check + lint the new files**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js \
  server/src/infrastructure/PostHogClient.ts \
  server/src/infrastructure/__tests__/PostHogClient.test.ts \
  --quiet
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/infrastructure/PostHogClient.ts \
        server/src/infrastructure/__tests__/PostHogClient.test.ts
git commit -m "feat(observability): IPostHogClient + factory with no-op stub"
```

### Task 1.3: Phase 1 verification

- [ ] **Step 1: Type check + lint + tests**

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
```

Expected: all pass.

---

## Phase 2 — Telemetry domain service

**Goal:** Build the `OptimizeTelemetryService` and its `OptimizeTrace` companion class. The service has no consumers yet — Phase 4 wires it in.

### Task 2.1: Define telemetry types

**Files:**

- Create: `server/src/services/observability/types.ts`

- [ ] **Step 1: Write the types**

Create `server/src/services/observability/types.ts`:

```ts
export type StageName =
  | "shot_interpreter"
  | "strategy"
  | "constitutional"
  | "intent_lock"
  | "compilation"
  | "prompt_lint"
  | "cache";

export type OptimizeOutcome = "success" | "error" | "aborted";

export interface OptimizeTraceCompleteSummary {
  outcome: OptimizeOutcome;
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  targetModel: string | null;
  mode: "video";
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
}

export interface OptimizeEventStages {
  shotInterpreterMs: number | null;
  strategyOptimizeMs: number | null;
  constitutionalMs: number | null;
  intentLockMs: number | null;
  compilationMs: number | null;
  promptLintMs: number | null;
}

export interface OptimizeEventProperties {
  requestId: string;
  userId: string | null;
  outcome: OptimizeOutcome;
  errorMessage?: string;
  errorStage?: StageName;
  durationMs: number;
  llmCallCount: number;
  cacheHit: boolean;
  targetModel: string | null;
  mode: "video";
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
  stages: OptimizeEventStages;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/observability/types.ts
git commit -m "feat(observability): types for OptimizeTelemetryService"
```

### Task 2.2: Write failing tests for `OptimizeTrace` + `OptimizeTelemetryService`

**Files:**

- Create: `server/src/services/observability/__tests__/OptimizeTelemetryService.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OptimizeTelemetryService } from "../OptimizeTelemetryService";
import type {
  IPostHogClient,
  CaptureArgs,
} from "@infrastructure/PostHogClient";

const makeMockClient = () => {
  const captures: CaptureArgs[] = [];
  const client: IPostHogClient = {
    capture: vi.fn((args: CaptureArgs) => {
      captures.push(args);
    }),
    shutdown: vi.fn(async () => {}),
  };
  return { client, captures };
};

describe("OptimizeTelemetryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits one optimize.completed event on complete()", () => {
    const { client, captures } = makeMockClient();
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", "user-1");

    trace.recordStage("shot_interpreter", 480);
    trace.recordStage("strategy", 2200);
    trace.recordLlmCall();
    trace.recordLlmCall();

    trace.complete({
      outcome: "success",
      promptLength: 50,
      outputLength: 100,
      lockedSpanCount: 0,
      targetModel: "kling-2.5",
      mode: "video",
      hasContext: false,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures).toHaveLength(1);
    expect(captures[0].event).toBe("optimize.completed");
    expect(captures[0].distinctId).toBe("user-1");
    expect(captures[0].properties).toMatchObject({
      requestId: "req-1",
      userId: "user-1",
      outcome: "success",
      llmCallCount: 2,
      cacheHit: false,
      targetModel: "kling-2.5",
      stages: expect.objectContaining({
        shotInterpreterMs: 480,
        strategyOptimizeMs: 2200,
        constitutionalMs: null,
        intentLockMs: null,
        compilationMs: null,
        promptLintMs: null,
      }),
    });
  });

  it("uses anon-<uuid> distinctId when userId is null", () => {
    const { client, captures } = makeMockClient();
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", null);

    trace.complete({
      outcome: "success",
      promptLength: 0,
      outputLength: 0,
      lockedSpanCount: 0,
      targetModel: null,
      mode: "video",
      hasContext: false,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures[0].distinctId).toMatch(/^anon-/);
    expect(captures[0].properties).toMatchObject({ userId: null });
  });

  it("populates errorStage and errorMessage on recordError", () => {
    const { client, captures } = makeMockClient();
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", "user-1");

    trace.recordError("compilation", new Error("boom"));
    trace.complete({
      outcome: "error",
      promptLength: 50,
      outputLength: 0,
      lockedSpanCount: 0,
      targetModel: "kling-2.5",
      mode: "video",
      hasContext: false,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures[0].properties).toMatchObject({
      outcome: "error",
      errorStage: "compilation",
      errorMessage: "boom",
    });
  });

  it("sets cacheHit=true and leaves stages null when recordCacheHit is called", () => {
    const { client, captures } = makeMockClient();
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", "user-1");

    trace.recordCacheHit();
    trace.complete({
      outcome: "success",
      promptLength: 50,
      outputLength: 100,
      lockedSpanCount: 0,
      targetModel: null,
      mode: "video",
      hasContext: false,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures[0].properties).toMatchObject({
      cacheHit: true,
      stages: {
        shotInterpreterMs: null,
        strategyOptimizeMs: null,
        constitutionalMs: null,
        intentLockMs: null,
        compilationMs: null,
        promptLintMs: null,
      },
    });
  });

  it("durationMs is computed from startedAt to complete()", async () => {
    const { client, captures } = makeMockClient();
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", "user-1");

    await new Promise((resolve) => setTimeout(resolve, 10));

    trace.complete({
      outcome: "success",
      promptLength: 0,
      outputLength: 0,
      lockedSpanCount: 0,
      targetModel: null,
      mode: "video",
      hasContext: false,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures[0].properties?.durationMs).toBeGreaterThanOrEqual(10);
  });

  it("does not throw if the underlying client.capture throws", () => {
    const client: IPostHogClient = {
      capture: vi.fn(() => {
        throw new Error("posthog down");
      }),
      shutdown: vi.fn(async () => {}),
    };
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-1", "user-1");

    expect(() =>
      trace.complete({
        outcome: "success",
        promptLength: 0,
        outputLength: 0,
        lockedSpanCount: 0,
        targetModel: null,
        mode: "video",
        hasContext: false,
        hasBrainstormContext: false,
        hasShotPlan: false,
        useConstitutionalAI: false,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
npx vitest run server/src/services/observability/__tests__/OptimizeTelemetryService.test.ts --config config/test/vitest.unit.config.js
```

Expected: FAIL — "Cannot find module '../OptimizeTelemetryService'".

- [ ] **Step 3: Commit (test only)**

```bash
git add server/src/services/observability/__tests__/OptimizeTelemetryService.test.ts
git commit -m "test(observability): unit tests for OptimizeTelemetryService"
```

### Task 2.3: Implement `OptimizeTrace` + `OptimizeTelemetryService`

**Files:**

- Create: `server/src/services/observability/OptimizeTelemetryService.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { randomUUID } from "node:crypto";
import { logger } from "@infrastructure/Logger";
import type { IPostHogClient } from "@infrastructure/PostHogClient";
import type {
  OptimizeEventProperties,
  OptimizeEventStages,
  OptimizeTraceCompleteSummary,
  StageName,
} from "./types";

export class OptimizeTrace {
  private readonly startedAt = performance.now();
  private readonly stageMs: Record<StageName, number | null> = {
    shot_interpreter: null,
    strategy: null,
    constitutional: null,
    intent_lock: null,
    compilation: null,
    prompt_lint: null,
    cache: null,
  };
  private llmCallCount = 0;
  private cacheHit = false;
  private errorStage: StageName | null = null;
  private errorMessage: string | null = null;
  private completed = false;

  constructor(
    private readonly client: IPostHogClient,
    private readonly distinctId: string,
    private readonly requestId: string,
    private readonly userId: string | null,
  ) {}

  recordStage(name: StageName, durationMs: number): void {
    this.stageMs[name] = Math.round(durationMs);
  }

  recordLlmCall(): void {
    this.llmCallCount += 1;
  }

  recordCacheHit(): void {
    this.cacheHit = true;
  }

  recordError(stage: StageName, err: unknown): void {
    this.errorStage = stage;
    this.errorMessage = err instanceof Error ? err.message : String(err);
  }

  complete(summary: OptimizeTraceCompleteSummary): void {
    if (this.completed) {
      // Defensive: prevent double-emission if both success and finally paths
      // call complete().
      return;
    }
    this.completed = true;

    const durationMs = Math.round(performance.now() - this.startedAt);

    const stages: OptimizeEventStages = {
      shotInterpreterMs: this.stageMs.shot_interpreter,
      strategyOptimizeMs: this.stageMs.strategy,
      constitutionalMs: this.stageMs.constitutional,
      intentLockMs: this.stageMs.intent_lock,
      compilationMs: this.stageMs.compilation,
      promptLintMs: this.stageMs.prompt_lint,
    };

    const properties: OptimizeEventProperties = {
      requestId: this.requestId,
      userId: this.userId,
      outcome: summary.outcome,
      ...(this.errorMessage ? { errorMessage: this.errorMessage } : {}),
      ...(this.errorStage ? { errorStage: this.errorStage } : {}),
      durationMs,
      llmCallCount: this.llmCallCount,
      cacheHit: this.cacheHit,
      targetModel: summary.targetModel,
      mode: summary.mode,
      promptLength: summary.promptLength,
      outputLength: summary.outputLength,
      lockedSpanCount: summary.lockedSpanCount,
      hasContext: summary.hasContext,
      hasBrainstormContext: summary.hasBrainstormContext,
      hasShotPlan: summary.hasShotPlan,
      useConstitutionalAI: summary.useConstitutionalAI,
      stages,
    };

    try {
      this.client.capture({
        distinctId: this.distinctId,
        event: "optimize.completed",
        properties,
      });
    } catch (err) {
      logger.debug("Telemetry emission failed (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
        requestId: this.requestId,
      });
    }
  }
}

export class OptimizeTelemetryService {
  constructor(private readonly client: IPostHogClient) {}

  startOptimizeTrace(requestId: string, userId: string | null): OptimizeTrace {
    const distinctId =
      userId && userId.trim().length > 0 ? userId : `anon-${randomUUID()}`;
    return new OptimizeTrace(this.client, distinctId, requestId, userId);
  }
}
```

- [ ] **Step 2: Run the tests — expect pass**

```bash
npx vitest run server/src/services/observability/__tests__/OptimizeTelemetryService.test.ts --config config/test/vitest.unit.config.js
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js \
  server/src/services/observability/OptimizeTelemetryService.ts \
  server/src/services/observability/types.ts \
  --quiet
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/observability/OptimizeTelemetryService.ts
git commit -m "feat(observability): OptimizeTelemetryService implementation"
```

### Task 2.4: Schema snapshot contract test

**Files:**

- Create: `server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts`

- [ ] **Step 1: Write the snapshot test**

```ts
import { describe, it, expect, vi } from "vitest";
import { OptimizeTelemetryService } from "../OptimizeTelemetryService";
import type {
  IPostHogClient,
  CaptureArgs,
} from "@infrastructure/PostHogClient";

describe("optimize.completed event schema (contract)", () => {
  it("emits a stable shape — change requires explicit review", () => {
    const captures: CaptureArgs[] = [];
    const client: IPostHogClient = {
      capture: vi.fn((args: CaptureArgs) => {
        captures.push(args);
      }),
      shutdown: vi.fn(async () => {}),
    };
    const service = new OptimizeTelemetryService(client);
    const trace = service.startOptimizeTrace("req-fixture", "user-fixture");

    trace.recordStage("shot_interpreter", 100);
    trace.recordStage("strategy", 200);
    trace.recordStage("intent_lock", 5);
    trace.recordStage("compilation", 300);
    trace.recordStage("prompt_lint", 1);
    trace.recordLlmCall();
    trace.recordLlmCall();
    trace.recordLlmCall();

    trace.complete({
      outcome: "success",
      promptLength: 120,
      outputLength: 250,
      lockedSpanCount: 2,
      targetModel: "kling-2.5",
      mode: "video",
      hasContext: true,
      hasBrainstormContext: false,
      hasShotPlan: false,
      useConstitutionalAI: false,
    });

    expect(captures).toHaveLength(1);
    const capture = captures[0];

    // Replace dynamic fields so the snapshot is deterministic.
    const normalized = {
      distinctId: capture.distinctId,
      event: capture.event,
      propertyKeys: Object.keys(capture.properties || {}).sort(),
      stageKeys: Object.keys(
        (capture.properties as { stages?: object })?.stages || {},
      ).sort(),
      sampleValues: {
        outcome: (capture.properties as { outcome?: string })?.outcome,
        cacheHit: (capture.properties as { cacheHit?: boolean })?.cacheHit,
        llmCallCount: (capture.properties as { llmCallCount?: number })
          ?.llmCallCount,
        mode: (capture.properties as { mode?: string })?.mode,
      },
    };

    expect(normalized).toMatchInlineSnapshot();
  });
});
```

> **Note:** The empty inline snapshot above is intentional. On first run, vitest auto-fills it with the captured shape — commit the resulting snapshot as the contract. On subsequent runs, vitest matches against the saved snapshot; mismatches signal contract drift and should be reviewed deliberately rather than auto-updated. To force first-run population, run with `vitest --update` if vitest's default doesn't auto-fill.

- [ ] **Step 2: Run the test — first run records the snapshot**

```bash
npx vitest run server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts --config config/test/vitest.unit.config.js
```

Expected: PASS (snapshot written if first run; matches if subsequent).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts
git commit -m "test(observability): schema contract snapshot for optimize.completed"
```

---

## Phase 3 — DI registration

**Goal:** Wire `IPostHogClient` and `OptimizeTelemetryService` into the existing `DIContainer` so the route layer can resolve them.

### Task 3.1: Create `observability.services.ts`

**Files:**

- Create: `server/src/config/services/observability.services.ts`

- [ ] **Step 1: Inspect the existing pattern**

Read one existing domain registration file to confirm the canonical shape:

```bash
cat server/src/config/services/llm.services.ts | head -40
```

Note the `DIContainer.register(token, factory, dependencies[])` signature.

- [ ] **Step 2: Write the registration**

Create `server/src/config/services/observability.services.ts`:

```ts
import type { DIContainer } from "@infrastructure/DIContainer";
import {
  createPostHogClient,
  type IPostHogClient,
} from "@infrastructure/PostHogClient";
import { OptimizeTelemetryService } from "@services/observability/OptimizeTelemetryService";

export function registerObservabilityServices(container: DIContainer): void {
  container.register("postHogClient", () => createPostHogClient(), []);

  container.register(
    "optimizeTelemetryService",
    (postHogClient: IPostHogClient) =>
      new OptimizeTelemetryService(postHogClient),
    ["postHogClient"],
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js \
  server/src/config/services/observability.services.ts --quiet
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/config/services/observability.services.ts
git commit -m "feat(di): observability.services registration"
```

### Task 3.2: Wire into central DI config

**Files:**

- Modify: `server/src/config/services.config.ts`

- [ ] **Step 1: Identify the registration site**

```bash
grep -n "register.*Services\|registerLLMServices" server/src/config/services.config.ts
```

Note the order — observability must be registered after `core.services` and `llm.services` if it depends on tokens registered there. (It doesn't depend on either, but conventionally we group infrastructure-ish registrations together.)

- [ ] **Step 2: Add the registration call**

In `server/src/config/services.config.ts`:

1. Add the import alongside other domain registration imports:

```ts
import { registerObservabilityServices } from "./services/observability.services";
```

2. Inside the function that builds the container, add the call (place it after `registerCoreServices` if that exists, otherwise at a position that matches the existing convention):

```ts
registerObservabilityServices(container);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run the integration test gate (mandatory because DI config changed)**

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

Expected: all pass. The bootstrap test should construct the container successfully with the two new services resolvable.

- [ ] **Step 5: Commit**

```bash
git add server/src/config/services.config.ts
git commit -m "feat(di): wire registerObservabilityServices into central config"
```

---

## Phase 4 — Integration into the optimize flow

**Goal:** Thread an `OptimizeTrace` through the route handler → `PromptOptimizationService` → `runOptimizeFlow`, and instrument each stage of the flow with timing + LLM-call counting.

### Task 4.1: Add `telemetry` to `OptimizeFlowArgs` type

**Files:**

- Modify: `server/src/services/prompt-optimization/workflows/types.ts`

- [ ] **Step 1: Add the import + field**

In `server/src/services/prompt-optimization/workflows/types.ts`:

1. Add the import near the top:

```ts
import type { OptimizeTrace } from "@services/observability/OptimizeTelemetryService";
```

2. Add the field to `OptimizeFlowArgs`:

```ts
export interface OptimizeFlowArgs {
  request: OptimizationRequest;
  log: ILogger;
  optimizationCache: OptimizationCacheLike;
  shotInterpreter: ShotInterpreterLike;
  strategy: OptimizationStrategyLike;
  compilationService: CompilationServiceLike | null;
  applyConstitutionalAI: ConstitutionalReviewLike;
  logOptimizationMetrics: (
    originalPrompt: string,
    optimizedPrompt: string,
    mode: OptimizationMode,
  ) => void;
  intentLock: IntentLockLike;
  promptLint: PromptLintLike;
  /** Telemetry trace; created in the route handler from req.id + req.user.uid. */
  telemetry: OptimizeTrace;
}
```

- [ ] **Step 2: Type-check (errors expected)**

```bash
npx tsc --noEmit
```

Expected: errors at the call sites of `runOptimizeFlow` (in `PromptOptimizationService.optimize`) — the field is now required but not yet provided. We'll fix in Task 4.2.

- [ ] **Step 3: Don't commit yet** — leave the working tree dirty until 4.2 fills in the missing arg.

### Task 4.2: Modify `PromptOptimizationService` to accept and forward the trace

**Files:**

- Modify: `server/src/services/prompt-optimization/PromptOptimizationService.ts`
- Modify: `server/src/services/prompt-optimization/types.ts` (add a contract for the trace)

- [ ] **Step 1: Add `trace` to `OptimizationRequest` as an optional field**

In `server/src/services/prompt-optimization/types.ts`, locate the `OptimizationRequest` interface and add:

```ts
import type { OptimizeTrace } from "@services/observability/OptimizeTelemetryService";

// Inside OptimizationRequest:
  /**
   * Telemetry trace, created at the route layer. When omitted, optimization
   * proceeds with no telemetry (test paths and direct service consumers).
   */
  trace?: OptimizeTrace;
```

- [ ] **Step 2: Update `PromptOptimizationService.optimize` to thread the trace**

In `server/src/services/prompt-optimization/PromptOptimizationService.ts`, find the `runOptimizeFlow({...})` call and add a fallback no-op trace when none is provided:

```ts
import type { OptimizeTrace } from "@services/observability/OptimizeTelemetryService";

// Helper: build a discardable trace that's a structural duck-type for the
// real one. Used when callers don't pass a trace (tests, direct consumers).
const makeNoopTrace = (): OptimizeTrace =>
  ({
    recordStage: () => {},
    recordLlmCall: () => {},
    recordCacheHit: () => {},
    recordError: () => {},
    complete: () => {},
  }) as unknown as OptimizeTrace;
```

In the `optimize` method, just before `runOptimizeFlow({...})`:

```ts
const telemetry = request.trace ?? makeNoopTrace();
```

Pass `telemetry` into the `runOptimizeFlow({...})` call as a new field:

```ts
return runOptimizeFlow({
  request,
  log: this.log,
  optimizationCache: this.optimizationCache,
  shotInterpreter: this.shotInterpreter,
  strategy: this.videoStrategy,
  compilationService: this.compilationService,
  applyConstitutionalAI: (nextPrompt, mode, signal) =>
    this.applyConstitutionalAI(nextPrompt, mode, signal),
  logOptimizationMetrics: (originalPrompt, optimizedPrompt, mode) =>
    this.logOptimizationMetrics(originalPrompt, optimizedPrompt, mode),
  intentLock: this.intentLock,
  promptLint: this.promptLint,
  telemetry,
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean — the new `telemetry` arg is now provided.

- [ ] **Step 4: Run unit tests (no changes expected to behavior yet)**

```bash
npx vitest run server/src/services/prompt-optimization --config config/test/vitest.unit.config.js
```

Expected: all pass.

- [ ] **Step 5: Commit (bundles 4.1 + 4.2 since 4.1 was incomplete on its own)**

```bash
git add server/src/services/prompt-optimization/workflows/types.ts \
        server/src/services/prompt-optimization/types.ts \
        server/src/services/prompt-optimization/PromptOptimizationService.ts
git commit -m "feat(prompt-optimization): thread OptimizeTrace through service"
```

### Task 4.3: Instrument `optimizeFlow` stages with telemetry

**Files:**

- Modify: `server/src/services/prompt-optimization/workflows/optimizeFlow.ts`

- [ ] **Step 1: Read the current `optimizeFlow` to identify the 6 stage boundaries**

Stages to instrument:

1. **cache** — record hit and complete-with-success on the cache-hit branch
2. **shot_interpreter** — wraps `shotInterpreter.interpret(...)`
3. **strategy** — wraps `strategy.optimizeStructured` OR `strategy.optimize` (whichever path runs)
4. **constitutional** — wraps `applyConstitutionalAI(...)`
5. **intent_lock** — wraps `applyIntentLockPolicy({...})`
6. **compilation** — wraps `compilationService.compile({...})`
7. **prompt_lint** — wraps `promptLint.enforce({...})`

LLM call sites for `recordLlmCall()`:

- `shotInterpreter.interpret` (one call)
- `strategy.generateDomainContent` (one call, if present)
- `strategy.optimizeStructured` or `strategy.optimize` (one call)
- `applyConstitutionalAI` (one call, only if `useConstitutionalAI`)
- `compilationService.compile` (one call, only if `targetModel`)

Intent-lock repair internally may call the LLM, but it's encapsulated in `applyIntentLockPolicy`. We don't decompose it here; if the count drifts, the C extension (deferred) covers it.

- [ ] **Step 2: Modify `runOptimizeFlow` to use the trace**

The full modified function structure (apply the changes inline; the surrounding function body stays intact):

At the top of `runOptimizeFlow`, after destructuring `telemetry: t` from the args:

```ts
export const runOptimizeFlow = async ({
  request,
  log,
  optimizationCache,
  shotInterpreter,
  strategy,
  compilationService,
  applyConstitutionalAI,
  logOptimizationMetrics,
  intentLock,
  promptLint,
  telemetry: t,
}: OptimizeFlowArgs): Promise<OptimizationResponse> => {
  // ...existing setup unchanged...
```

Build a small `summary` object that's used for `t.complete()` calls:

Add near the top of the function (after the request is destructured):

```ts
const inputSummary = {
  promptLength: prompt.length,
  lockedSpanCount: lockedSpans.length,
  targetModel: targetModel ?? null,
  mode: mode as "video",
  hasContext: !!context,
  hasBrainstormContext: !!brainstormContext,
  hasShotPlan: !!shotPlan,
  useConstitutionalAI: !!useConstitutionalAI,
};
```

In the cache-hit branch, replace the existing return with:

```ts
if (cached) {
  if (onMetadata && cachedMetadata) {
    onMetadata(cachedMetadata);
  }
  log.debug("Returning cached optimization result", {
    operation,
    mode: mode,
    duration: Math.round(performance.now() - startTime),
  });
  t.recordCacheHit();
  t.complete({
    outcome: "success",
    outputLength: cached.length,
    ...inputSummary,
  });
  return {
    prompt: cached,
    ...(typeof cachedMetadata?.artifactKey === "string"
      ? { artifactKey: cachedMetadata.artifactKey }
      : {}),
    ...(cachedMetadata?.compilation &&
    typeof cachedMetadata.compilation === "object"
      ? { compilation: cachedMetadata.compilation as CompilationState }
      : {}),
    ...(cachedMetadata ? { metadata: cachedMetadata } : {}),
  };
}
```

In the shot-interpreter block, wrap with timing:

```ts
let interpretedShotPlan = shotPlan;
if (!interpretedShotPlan && !shotPlanAttempted) {
  const shotStart = performance.now();
  try {
    throwIfAborted(signal);
    interpretedShotPlan = await shotInterpreter.interpret(prompt, signal);
    t.recordLlmCall();
  } catch (interpError) {
    log.warn(
      "Shot interpretation (single-stage) failed, proceeding without plan",
      {
        operation,
        error: (interpError as Error).message,
      },
    );
  } finally {
    t.recordStage("shot_interpreter", performance.now() - shotStart);
  }
}
```

For the main strategy block (inside the existing `try`), wrap the strategy invocation:

```ts
const strategyStart = performance.now();
try {
  if (
    mode === "video" &&
    strategy.optimizeStructured &&
    strategy.renderStructuredPrompt
  ) {
    structuredArtifact = await strategy.optimizeStructured(strategyRequest);
    t.recordLlmCall();
    // ...existing artifactKey + cache write unchanged...
  }

  if (structuredArtifact && strategy.renderStructuredPrompt) {
    optimizedPrompt = strategy.renderStructuredPrompt(
      structuredArtifact.structuredPrompt,
    );
  } else {
    optimizedPrompt = await strategy.optimize({
      ...strategyRequest,
      onMetadata: handleMetadata,
    });
    t.recordLlmCall();
  }
} catch (err) {
  t.recordError("strategy", err);
  throw err;
} finally {
  t.recordStage("strategy", performance.now() - strategyStart);
}
```

(If `strategy.generateDomainContent` is called separately above this, also wrap with `t.recordLlmCall()` after each invocation — verify by reading the existing `generateDomainContent` call site.)

For constitutional AI:

```ts
if (useConstitutionalAI) {
  const constitutionalStart = performance.now();
  try {
    optimizedPrompt = await applyConstitutionalAI(
      optimizedPrompt,
      mode,
      signal,
    );
    t.recordLlmCall();
  } catch (err) {
    t.recordError("constitutional", err);
    throw err;
  } finally {
    t.recordStage("constitutional", performance.now() - constitutionalStart);
  }
}
```

For intent-lock:

```ts
const intentStart = performance.now();
const intentLocked = applyIntentLockPolicy({
  intentLock,
  originalPrompt: originalUserPrompt,
  optimizedPrompt,
  shotPlan: interpretedShotPlan,
});
t.recordStage("intent_lock", performance.now() - intentStart);
optimizedPrompt = intentLocked.prompt;
handleMetadata(intentLocked.legacyMetadata);
```

For compilation:

```ts
if (targetModel && mode === "video" && compilationService) {
  const compilationStart = performance.now();
  try {
    const compilation = await compilationService.compile({
      operation,
      mode: mode,
      ...(targetModel !== undefined ? { targetModel } : {}),
      source: structuredArtifact
        ? { kind: "artifact", artifact: structuredArtifact }
        : { kind: "prompt", prompt: optimizedPrompt },
      fallbackPrompt: optimizedPrompt,
      ...(artifactKey ? { artifactKey } : {}),
    });
    t.recordLlmCall();
    optimizedPrompt = compilation.prompt;
    compilationState = compilation.compilation;
    if (compilation.metadata) {
      handleMetadata(compilation.metadata);
    }
    // ...existing post-compile intent-lock validate-only check unchanged...
  } catch (err) {
    t.recordError("compilation", err);
    throw err;
  } finally {
    t.recordStage("compilation", performance.now() - compilationStart);
  }
}
```

For prompt lint:

```ts
const lintStart = performance.now();
const lintResult = promptLint.enforce({
  prompt: optimizedPrompt,
  modelId: targetModel ?? null,
});
t.recordStage("prompt_lint", performance.now() - lintStart);
optimizedPrompt = lintResult.prompt;
handleMetadata({
  promptLint: lintResult.lint,
  promptLintRepaired: lintResult.repaired,
});
```

In the success-return block, just before the return:

```ts
t.complete({
  outcome: "success",
  outputLength: optimizedPrompt.length,
  ...inputSummary,
});
return {
  prompt: optimizedPrompt,
  ...(artifactKey ? { artifactKey } : {}),
  ...(compilationState ? { compilation: compilationState } : {}),
  ...(optimizationMetadata ? { metadata: optimizationMetadata } : {}),
};
```

In the outer `catch (error)` block:

```ts
} catch (error) {
  if ((error as Error)?.name === "AbortError") {
    t.complete({
      outcome: "aborted",
      outputLength: 0,
      ...inputSummary,
    });
    log.info("Operation aborted.", { ... });
    throw error;
  }
  t.complete({
    outcome: "error",
    outputLength: 0,
    ...inputSummary,
  });
  log.error("Operation failed.", error as Error, { ... });
  throw error;
}
```

> **Note:** the `t.complete()` calls inside per-stage `catch` blocks (e.g., the strategy / constitutional / compilation `catch (err)` blocks) **only call `recordError` and rethrow** — they do NOT call `complete`. The outer error handler is the single point of complete-emission for failure paths. The `OptimizeTrace.complete()` is double-emission-guarded internally, but keeping the convention "stage-level catches record, outer catch completes" makes the flow easier to reason about.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run unit tests for prompt-optimization**

```bash
npx vitest run server/src/services/prompt-optimization --config config/test/vitest.unit.config.js
```

Expected: all pass. Existing tests don't pass a trace, so they hit the no-op-trace fallback added in Task 4.2.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/prompt-optimization/workflows/optimizeFlow.ts
git commit -m "feat(observability): instrument optimizeFlow stages with telemetry"
```

### Task 4.4: Update the optimize route handler to create + pass the trace

**Files:**

- Modify: `server/src/routes/optimize/handlers/optimize.ts`
- Modify: the route registration site that calls `createOptimizeHandler` (find via grep)

- [ ] **Step 1: Update the route handler factory to accept the telemetry service**

Edit `server/src/routes/optimize/handlers/optimize.ts`:

1. Add the import at the top:

```ts
import type { OptimizeTelemetryService } from "@services/observability/OptimizeTelemetryService";
```

2. Update the factory signature:

```ts
export const createOptimizeHandler =
  (
    promptOptimizationService: PromptOptimizationServiceContract,
    optimizeTelemetryService: OptimizeTelemetryService,
  ) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    // ...existing parsing unchanged...
```

3. After `requestId` and `userId` are determined (around line 19-20), create the trace:

```ts
const requestId = req.id || "unknown";
const userId = extractUserId(req);
const operation = "optimize";
const trace = optimizeTelemetryService.startOptimizeTrace(requestId, userId);
```

4. In the `optimizeRequest` object (around line 114), add the trace:

```ts
const optimizeRequest = {
  prompt,
  // ...existing fields...
  signal: requestAbortController.signal,
  trace,
};
```

- [ ] **Step 2: Find the route registration site**

```bash
git grep -n "createOptimizeHandler" server/src/
```

Expected: one or two matches — the implementation and the registration call site.

- [ ] **Step 3: Update the registration to inject `optimizeTelemetryService`**

In whatever file calls `createOptimizeHandler(promptOptimizationService)`, add the second argument:

```ts
const optimizeTelemetryService = container.resolve<OptimizeTelemetryService>(
  "optimizeTelemetryService",
);
const optimizeHandler = createOptimizeHandler(
  promptOptimizationService,
  optimizeTelemetryService,
);
```

(The exact resolution mechanism depends on the file's existing pattern — match it.)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Run unit tests + the integration test gate**

```bash
npx vitest run server/src/routes/optimize --config config/test/vitest.unit.config.js
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

Expected: all pass.

- [ ] **Step 6: If existing route tests broke**

If unit tests in `server/src/routes/optimize/` now fail because `createOptimizeHandler` requires a second argument, update those tests to pass a mock `OptimizeTelemetryService`:

```ts
const mockTelemetry = {
  startOptimizeTrace: vi.fn(() => ({
    recordStage: vi.fn(),
    recordLlmCall: vi.fn(),
    recordCacheHit: vi.fn(),
    recordError: vi.fn(),
    complete: vi.fn(),
  })),
} as unknown as OptimizeTelemetryService;
const handler = createOptimizeHandler(
  mockPromptOptimizationService,
  mockTelemetry,
);
```

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/optimize/handlers/optimize.ts
# add the registration-site file (specific path discovered in Step 2)
# add any test files updated in Step 6
git commit -m "feat(observability): create + pass OptimizeTrace from route handler"
```

---

## Phase 5 — Graceful shutdown

**Goal:** Ensure pending PostHog events flush before the process exits on SIGTERM/SIGINT.

### Task 5.1: Wire `PostHogClient.shutdown()` into `setupGracefulShutdown`

**Files:**

- Modify: `server/src/server.ts`

- [ ] **Step 1: Read the existing shutdown handler**

Read `server/src/server.ts` lines 220-300 to confirm the structure of `setupGracefulShutdown`.

- [ ] **Step 2: Add the PostHog shutdown call**

In `server/src/server.ts`, inside `setupGracefulShutdown`'s inner `try` block (around the existing `redisClient` shutdown), add:

```ts
// Flush pending telemetry events before exiting.
const postHogClient = resolveOptional<IPostHogClient>("postHogClient");
if (postHogClient) {
  try {
    await postHogClient.shutdown();
  } catch (err) {
    logger.warn("PostHog shutdown failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

Place it before `process.exit(0)` and after `closeRedisClient(...)` to maintain the existing "drain network resources before exit" ordering.

Add the import at the top of the file:

```ts
import type { IPostHogClient } from "@infrastructure/PostHogClient";
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run integration test gate**

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/server.ts
git commit -m "feat(observability): flush PostHog events on graceful shutdown"
```

---

## Phase 6 — Final verification

### Task 6.1: Full repo verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Unit tests**

```bash
npm run test:unit
```

Expected: all new tests pass; pre-existing failures (Firebase env, span-labeling versioning) are not regressions.

- [ ] **Step 4: Integration test gate**

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

Expected: all pass.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: succeeds.

### Task 6.2: Manual smoke test (optional, with real PostHog key)

- [ ] **Step 1: Set the env var locally**

```bash
export POSTHOG_API_KEY=phc_your_real_key_here
# optional: export POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 2: Start the server**

```bash
npm start
```

(Skip in worktree — this requires Firebase credentials and would conflict with shared dev ports.)

- [ ] **Step 3: Fire an Optimize request**

```bash
curl -X POST http://localhost:3001/api/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <test-token>" \
  -d '{"prompt": "a man walking through a forest at sunset", "mode": "video"}'
```

- [ ] **Step 4: Verify the event in PostHog**

In the PostHog UI (or via the MCP), find the most recent `optimize.completed` event. Confirm:

- `distinctId` matches the test user
- `properties.requestId` is set
- `properties.outcome === "success"`
- `properties.stages` has non-null values for the stages that ran
- `properties.llmCallCount > 0`

If any of these are missing, check server logs for telemetry-emission errors at `debug` level.

### Task 6.3: Build the first dashboard (within 1 week of merge)

This is **not a code task** but is a milestone per spec §7. After events have been flowing for 2-3 days:

- [ ] **Step 1: Use the PostHog MCP to build the "T2V Optimize Health" dashboard**

Via the `posthog:querying-posthog-data` skill or direct MCP calls, create insights for:

- Avg `durationMs` over time
- p50/p95 by stage
- Cache hit rate
- LLM call count distribution
- Outcome breakdown (success / error / aborted)
- Failure heatmap by `errorStage`

- [ ] **Step 2: Document the dashboard URL** in `docs/architecture/observability.md` (create if it doesn't exist) so future engineers can find it.

- [ ] **Step 3: Verify the dashboard answers the spec's success question**

"Where is the time going on the average Optimize click?" — the p50/p95-by-stage chart should answer this in seconds.

If it doesn't (e.g., a stage's timing is null in 100% of events), that's a signal of a bug in the instrumentation — fix and redeploy before declaring success.

---

## Summary

| Phase | Goal                                                       | Files touched                          |
| ----- | ---------------------------------------------------------- | -------------------------------------- |
| 1     | Add `posthog-node` + `PostHogClient` infrastructure        | 2 created, 1 modified (`package.json`) |
| 2     | Build `OptimizeTelemetryService` + tests + schema snapshot | 4 created                              |
| 3     | DI registration                                            | 1 created, 1 modified                  |
| 4     | Thread trace through service + flow + route handler        | 4-5 modified                           |
| 5     | Graceful shutdown integration                              | 1 modified                             |
| 6     | Final verification + dashboard milestone                   | none (verification only)               |

**Total new code:** ~400 lines (service + tests + types + DI registration). **Total modified code:** ~40-50 lines spread across `optimizeFlow`, `PromptOptimizationService`, route handler, and `server.ts`.

The plan is complete after Phase 6 Step 3 — the dashboard exists and answers the spec's success question. Until that step lands, the work is not done; emission alone is half the deliverable.
