/**
 * Synthetic-harness helpers — direct in-process emission, no HTTP.
 *
 * The harness constructs the SAME PostHogClient + telemetry services the
 * server uses, then runs each emission inside an AsyncLocalStorage frame
 * with `source: "synthetic"`. PR 1's PostHogClient wrapper auto-stamps
 * the source onto every event — so the emitted records are structurally
 * identical to what real requests produce, minus the HTTP layer.
 *
 * Why direct emission vs HTTP:
 * - Production endpoints require Firebase auth; anonymous calls 401.
 * - The harness's job is to validate the telemetry pipeline + dashboards
 *   pre-launch, not to exercise auth or the network boundary.
 * - Direct emission lets the harness produce realistic events using the
 *   actual production routing config (see server/src/config/modelConfig.ts).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";

import {
  createPostHogClient,
  type IPostHogClient,
} from "../../../server/src/infrastructure/PostHogClient.js";
import { runWithRequestContext } from "../../../server/src/infrastructure/requestContext.js";

export interface HarnessPrompt {
  id: string;
  text: string;
  tags: string[];
}

export async function loadPrompts(): Promise<HarnessPrompt[]> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", "fixtures", "prompts.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as HarnessPrompt[];
}

/** Per-driver counts returned to the run-harness summary. */
export interface DriverSummary {
  surface: string;
  promptCount: number;
  surfaceEventsEmitted: number;
  llmEventsEmitted: number;
}

/**
 * Constructs the same PostHogClient the server uses. Reads POSTHOG_API_KEY
 * from process.env — returns a no-op stub when unset (mirrors server behavior).
 */
export function createSyntheticEmitter(): IPostHogClient {
  return createPostHogClient();
}

/**
 * Runs `fn` inside an ALS frame with source="synthetic". PR 1's
 * PostHogClient.capture() wrapper reads source from this frame and stamps
 * it onto every event emitted within. A stable requestId is provided so
 * downstream events from the same prompt run can be correlated.
 */
export function runInSyntheticContext<T>(requestId: string, fn: () => T): T {
  return runWithRequestContext({ requestId, source: "synthetic" }, fn);
}

/**
 * Stable distinctId for the entire harness run. Matches the convention from
 * the eval scripts (#0): "synthetic-<GITHUB_RUN_ID>" in CI, otherwise
 * "synthetic-local-<username>". Used to filter harness traffic on dashboards
 * via `distinctId LIKE 'synthetic-%'`.
 */
export function syntheticDistinctId(): string {
  const runId = process.env.GITHUB_RUN_ID;
  if (runId) return `synthetic-${runId}`;
  try {
    const username = userInfo().username;
    if (username) return `synthetic-local-${username}`;
  } catch {
    // fall through
  }
  return `synthetic-${randomUUID()}`;
}

/**
 * Deterministic small variance based on prompt index — makes dashboard
 * traces look like real traffic (not perfectly flat) while staying
 * reproducible across runs.
 */
export function jitter(baseMs: number, promptIndex: number): number {
  // Mix index into a pseudo-random factor in [0.7, 1.3].
  const seed = (promptIndex * 2654435761) >>> 0;
  const factor = 0.7 + ((seed % 1000) / 1000) * 0.6;
  return Math.round(baseMs * factor);
}
