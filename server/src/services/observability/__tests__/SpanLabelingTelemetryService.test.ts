import { describe, it, expect, vi } from "vitest";
import { SpanLabelingTelemetryService } from "../SpanLabelingTelemetryService";
import type {
  IPostHogClient,
  CaptureArgs,
} from "@infrastructure/PostHogClient";

function makeClient(captures: CaptureArgs[]): IPostHogClient {
  return {
    capture: vi.fn((args: CaptureArgs) => {
      captures.push(args);
    }),
    shutdown: vi.fn(async () => {}),
  };
}

describe("SpanLabelingTelemetryService", () => {
  it("emits label-spans.completed on success", () => {
    const captures: CaptureArgs[] = [];
    const service = new SpanLabelingTelemetryService(makeClient(captures));
    const trace = service.startSpanLabelingTrace("req-1", "user-1");

    trace.recordCacheHit();
    trace.complete({
      outcome: "success",
      promptLength: 42,
      spanCount: 6,
      provider: "groq",
      model: "llama-3.1-70b-versatile",
    });

    expect(captures).toHaveLength(1);
    const c = captures[0]!;
    expect(c.event).toBe("label-spans.completed");
    expect(c.distinctId).toBe("user-1");
    const p = c.properties as Record<string, unknown>;
    expect(p.requestId).toBe("req-1");
    expect(p.userId).toBe("user-1");
    expect(p.outcome).toBe("success");
    expect(p.cacheHit).toBe(true);
    expect(p.spanCount).toBe(6);
    expect(p.provider).toBe("groq");
    expect(p.model).toBe("llama-3.1-70b-versatile");
    expect(typeof p.durationMs).toBe("number");
  });

  it("emits label-spans.completed on error with errorStage", () => {
    const captures: CaptureArgs[] = [];
    const service = new SpanLabelingTelemetryService(makeClient(captures));
    const trace = service.startSpanLabelingTrace("req-2", null);

    trace.recordError("llm_call", new Error("provider 500"));
    trace.complete({
      outcome: "error",
      promptLength: 100,
      spanCount: 0,
      provider: "openai",
      model: null,
    });

    const p = captures[0]!.properties as Record<string, unknown>;
    expect(p.outcome).toBe("error");
    expect(p.errorMessage).toBe("provider 500");
    expect(p.errorStage).toBe("llm_call");
    expect(captures[0]!.distinctId).toMatch(/^anon-/);
  });

  it("idempotent — second complete() is a no-op", () => {
    const captures: CaptureArgs[] = [];
    const service = new SpanLabelingTelemetryService(makeClient(captures));
    const trace = service.startSpanLabelingTrace("req-3", "u");
    trace.complete({
      outcome: "success",
      promptLength: 10,
      spanCount: 1,
      provider: "groq",
      model: "m",
    });
    trace.complete({
      outcome: "success",
      promptLength: 10,
      spanCount: 1,
      provider: "groq",
      model: "m",
    });
    expect(captures).toHaveLength(1);
  });
});
