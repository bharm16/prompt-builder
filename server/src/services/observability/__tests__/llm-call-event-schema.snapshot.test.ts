import { describe, it, expect, vi } from "vitest";
import { runWithRequestContext } from "@infrastructure/requestContext";
import { LlmCallTelemetryService } from "../LlmCallTelemetryService";
import type {
  IPostHogClient,
  CaptureArgs,
} from "@infrastructure/PostHogClient";
import type { LlmCallSummary } from "../types";

describe("llm.call.completed event schema (contract)", () => {
  it("emits a stable shape — change requires explicit review", () => {
    const captures: CaptureArgs[] = [];
    const client: IPostHogClient = {
      capture: vi.fn((args: CaptureArgs) => {
        captures.push(args);
      }),
      shutdown: vi.fn(async () => {}),
    };
    const service = new LlmCallTelemetryService(client);

    const summary: LlmCallSummary = {
      executionType: "image_observation",
      durationMs: 420.7,
      provider: "openai",
      model: "gpt-4o-mini-2024-07-18",
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      finishReason: "stop",
      outcome: "success",
      userId: "user-fixture",
    };

    runWithRequestContext({ requestId: "req-fixture" }, () => {
      service.record(summary);
    });

    expect(captures).toHaveLength(1);
    const capture = captures[0]!;

    const normalized = {
      distinctId: capture.distinctId,
      event: capture.event,
      propertyKeys: Object.keys(capture.properties || {}).sort(),
      sampleValues: {
        executionType: (capture.properties as { executionType?: string })
          ?.executionType,
        provider: (capture.properties as { provider?: string })?.provider,
        outcome: (capture.properties as { outcome?: string })?.outcome,
        durationMs: (capture.properties as { durationMs?: number })?.durationMs,
        userId: (capture.properties as { userId?: string | null })?.userId,
        requestId: (capture.properties as { requestId?: string })?.requestId,
      },
    };

    expect(normalized).toMatchInlineSnapshot(`
      {
        "distinctId": "user-fixture",
        "event": "llm.call.completed",
        "propertyKeys": [
          "completionTokens",
          "durationMs",
          "executionType",
          "finishReason",
          "model",
          "outcome",
          "promptTokens",
          "provider",
          "requestId",
          "totalTokens",
          "userId",
        ],
        "sampleValues": {
          "durationMs": 421,
          "executionType": "image_observation",
          "outcome": "success",
          "provider": "openai",
          "requestId": "req-fixture",
          "userId": "user-fixture",
        },
      }
    `);
  });
});
