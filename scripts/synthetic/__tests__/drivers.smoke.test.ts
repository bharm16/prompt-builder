/**
 * Smoke test for the synthetic-harness drivers. Uses a fake IPostHogClient
 * to count captured events without firing real network calls or hitting
 * the production PostHog. Verifies that each driver emits the correct
 * surface + llm.call.completed events per prompt, using REAL production
 * provider/model values from server/src/config/modelConfig.ts.
 *
 * Source-discriminator stamping itself is covered by the PostHogClient
 * unit tests (PR 1) — this smoke test focuses on driver correctness.
 */

import { describe, it, expect, vi } from "vitest";
import { OptimizeTelemetryService } from "../../../server/src/services/observability/OptimizeTelemetryService";
import { SuggestionsTelemetryService } from "../../../server/src/services/observability/SuggestionsTelemetryService";
import { SpanLabelingTelemetryService } from "../../../server/src/services/observability/SpanLabelingTelemetryService";
import { LlmCallTelemetryService } from "../../../server/src/services/observability/LlmCallTelemetryService";
import type {
  IPostHogClient,
  CaptureArgs,
} from "../../../server/src/infrastructure/PostHogClient";

import { driveOptimize } from "../drivers/optimize.driver";
import { driveSuggestions } from "../drivers/suggestions.driver";
import { driveSpanLabels } from "../drivers/span-labeling.driver";
import type { HarnessPrompt } from "../utils/request-helper";

const PROMPTS: HarnessPrompt[] = [
  { id: "p1", text: "A young woman walks through a forest", tags: ["subject"] },
  {
    id: "p2",
    text: "Aerial shot of city skyline at dusk",
    tags: ["camera.movement"],
  },
];

function makeClient(): {
  client: IPostHogClient;
  captures: CaptureArgs[];
} {
  const captures: CaptureArgs[] = [];
  const client: IPostHogClient = {
    capture: vi.fn((args: CaptureArgs) => {
      captures.push(args);
    }),
    shutdown: vi.fn(async () => {}),
  };
  return { client, captures };
}

describe("synthetic harness drivers", () => {
  it("driveOptimize emits 1 surface + 4 llm events per prompt", async () => {
    const { client, captures } = makeClient();
    const summary = await driveOptimize(
      {
        optimize: new OptimizeTelemetryService(client),
        llm: new LlmCallTelemetryService(client),
      },
      PROMPTS,
    );
    expect(summary.surfaceEventsEmitted).toBe(PROMPTS.length);
    expect(summary.llmEventsEmitted).toBe(PROMPTS.length * 4);
    expect(captures).toHaveLength(PROMPTS.length * 5);

    const events = captures.map((c) => c.event);
    expect(events.filter((e) => e === "optimize.completed")).toHaveLength(
      PROMPTS.length,
    );
    expect(events.filter((e) => e === "llm.call.completed")).toHaveLength(
      PROMPTS.length * 4,
    );
  });

  it("driveSuggestions emits 1 surface + 1 llm event per prompt", async () => {
    const { client, captures } = makeClient();
    const summary = await driveSuggestions(
      {
        suggestions: new SuggestionsTelemetryService(client),
        llm: new LlmCallTelemetryService(client),
      },
      PROMPTS,
    );
    expect(summary.surfaceEventsEmitted).toBe(PROMPTS.length);
    expect(summary.llmEventsEmitted).toBe(PROMPTS.length);
    expect(captures).toHaveLength(PROMPTS.length * 2);

    const events = captures.map((c) => c.event);
    expect(events.filter((e) => e === "suggestions.completed")).toHaveLength(
      PROMPTS.length,
    );
    expect(events.filter((e) => e === "llm.call.completed")).toHaveLength(
      PROMPTS.length,
    );
  });

  it("driveSpanLabels emits 1 surface per prompt and skips llm on cache hits", async () => {
    const { client, captures } = makeClient();
    const summary = await driveSpanLabels(
      {
        spanLabels: new SpanLabelingTelemetryService(client),
        llm: new LlmCallTelemetryService(client),
      },
      PROMPTS,
    );
    expect(summary.surfaceEventsEmitted).toBe(PROMPTS.length);
    // First two prompts (indices 0, 1) are cache-hits per the driver's i%10<3 rule
    // → 0 llm events emitted for them.
    expect(summary.llmEventsEmitted).toBe(0);
    expect(captures).toHaveLength(PROMPTS.length);
    expect(captures.every((c) => c.event === "label-spans.completed")).toBe(
      true,
    );
  });

  it("uses real production provider/model values (no invented ones)", async () => {
    const { client, captures } = makeClient();
    await driveOptimize(
      {
        optimize: new OptimizeTelemetryService(client),
        llm: new LlmCallTelemetryService(client),
      },
      PROMPTS,
    );
    const llmEvents = captures
      .filter((c) => c.event === "llm.call.completed")
      .map((c) => c.properties as Record<string, unknown>);

    // All optimize LLM calls use openai per modelConfig.ts
    expect(llmEvents.every((p) => p.provider === "openai")).toBe(true);

    // Models from modelConfig.ts — never groq/llama (which the pipeline doesn't use)
    const models = new Set(llmEvents.map((p) => p.model));
    expect(models).toEqual(
      new Set(["gpt-4o-mini-2024-07-18", "gpt-4o-2024-08-06", "gpt-4o-mini"]),
    );
    expect([...models].some((m) => String(m).includes("llama"))).toBe(false);
    expect([...models].some((m) => String(m).includes("groq"))).toBe(false);
  });

  it("emits executionType values that match server/src/config/modelConfig.ts", async () => {
    const { client, captures } = makeClient();
    await driveOptimize(
      {
        optimize: new OptimizeTelemetryService(client),
        llm: new LlmCallTelemetryService(client),
      },
      PROMPTS,
    );
    const executionTypes = new Set(
      captures
        .filter((c) => c.event === "llm.call.completed")
        .map(
          (c) =>
            (c.properties as Record<string, unknown>).executionType as string,
        ),
    );
    expect(executionTypes).toEqual(
      new Set([
        "optimize_shot_interpreter",
        "optimize_standard",
        "optimize_quality_assessment",
        "optimize_intent_check",
      ]),
    );
  });
});
