import { describe, expect, it } from "vitest";
import { configureServices } from "@config/services.config";
import { VideoConceptService } from "@services/video-concept/VideoConceptService";

/**
 * Regression: the /api/video/* route family is conditionally mounted on
 * `if (videoConceptService) { ... }` in api.routes.ts. When DI does not
 * register the aggregator service, the entire /api/video/* namespace is
 * silently dropped and every request gets a 401 from auth middleware
 * that's indistinguishable from a typoed URL.
 *
 * Invariant: for any properly-bootstrapped DI container, resolving
 * "videoConceptService" returns a real VideoConceptService instance
 * exposing the 7 methods declared in VideoConceptServiceContract.
 */
describe("regression: videoConceptService DI registration", () => {
  it("resolves a real VideoConceptService that satisfies the route contract", async () => {
    const container = await configureServices();

    const service = container.resolve<VideoConceptService>(
      "videoConceptService",
    );

    expect(service).toBeInstanceOf(VideoConceptService);

    for (const method of [
      "getCreativeSuggestions",
      "checkCompatibility",
      "detectConflicts",
      "completeScene",
      "getSmartDefaults",
      "generateVariations",
      "parseConcept",
    ] as const) {
      expect(
        typeof (service as unknown as Record<string, unknown>)[method],
      ).toBe("function");
    }
  }, 30_000);
});
