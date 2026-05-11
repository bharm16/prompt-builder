import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { driveOptimize } from "../drivers/optimize.driver";
import { driveSuggestions } from "../drivers/suggestions.driver";
import { driveSpanLabels } from "../drivers/span-labeling.driver";
import type { HarnessPrompt } from "../utils/request-helper";

const PROMPTS: HarnessPrompt[] = [
  { id: "p1", text: "a young woman walks through a forest", tags: ["subject"] },
  { id: "p2", text: "aerial shot of city skyline", tags: ["camera.movement"] },
];

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("synthetic harness drivers — smoke", () => {
  it("driveOptimize fires N requests with X-Telemetry-Source: synthetic", async () => {
    const summary = await driveOptimize("http://localhost:3001", PROMPTS);
    expect(fetchSpy).toHaveBeenCalledTimes(PROMPTS.length);
    for (const call of fetchSpy.mock.calls) {
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toBe("http://localhost:3001/api/optimize");
      expect(
        (init.headers as Record<string, string>)["X-Telemetry-Source"],
      ).toBe("synthetic");
      expect(
        (init.headers as Record<string, string>)["Authorization"],
      ).toBeUndefined();
    }
    expect(summary.totalCalls).toBe(PROMPTS.length);
    expect(summary.successCount).toBe(PROMPTS.length);
  });

  it("driveSuggestions hits /api/get-enhancement-suggestions with the right header", async () => {
    await driveSuggestions("http://localhost:3001", PROMPTS);
    expect(fetchSpy).toHaveBeenCalledTimes(PROMPTS.length);
    for (const call of fetchSpy.mock.calls) {
      expect(call[0]).toBe(
        "http://localhost:3001/api/get-enhancement-suggestions",
      );
      const init = call[1] as RequestInit;
      expect(
        (init.headers as Record<string, string>)["X-Telemetry-Source"],
      ).toBe("synthetic");
    }
  });

  it("driveSpanLabels hits /llm/label-spans with the right header", async () => {
    await driveSpanLabels("http://localhost:3001", PROMPTS);
    expect(fetchSpy).toHaveBeenCalledTimes(PROMPTS.length);
    for (const call of fetchSpy.mock.calls) {
      expect(call[0]).toBe("http://localhost:3001/llm/label-spans");
      const init = call[1] as RequestInit;
      expect(
        (init.headers as Record<string, string>)["X-Telemetry-Source"],
      ).toBe("synthetic");
    }
  });

  it("zero requests carry a source other than 'synthetic'", async () => {
    await driveOptimize("http://localhost:3001", PROMPTS);
    await driveSuggestions("http://localhost:3001", PROMPTS);
    await driveSpanLabels("http://localhost:3001", PROMPTS);
    const sources = fetchSpy.mock.calls.map(
      (c) =>
        ((c[1] as RequestInit).headers as Record<string, string>)[
          "X-Telemetry-Source"
        ],
    );
    const non = sources.filter((s) => s !== "synthetic");
    expect(non).toEqual([]);
  });

  it("error responses count toward errorCount in the summary", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 500 }),
    );
    const summary = await driveOptimize("http://localhost:3001", PROMPTS);
    expect(summary.errorCount).toBe(PROMPTS.length);
    expect(summary.successCount).toBe(0);
  });
});
