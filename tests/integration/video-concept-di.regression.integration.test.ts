import { describe, expect, it } from "vitest";
import { configureServices } from "@config/services.config";

/**
 * Regression: the /api/video/* route family is wired in api.registration.ts
 * by resolving each sub-service from DI. When a sub-service registration is
 * missing, container.resolve throws at boot — preventing the silent 404
 * trap (every /api/video/* request returning 401 from auth middleware,
 * indistinguishable from a typoed URL).
 *
 * Invariant: for any properly-bootstrapped DI container, the seven video
 * concept sub-service tokens consumed by api.registration.ts must resolve
 * to truthy instances.
 */
describe("regression: video concept DI registration", () => {
  it("resolves all seven video concept sub-services consumed by /api/video/*", async () => {
    const container = await configureServices();

    const tokens = [
      "videoSuggestionGeneratorService",
      "videoCompatibilityService",
      "videoConflictDetectionService",
      "videoSceneCompletionService",
      "videoPromptValidationService",
      "videoSceneVariationService",
      "videoConceptParsingService",
    ] as const;

    for (const token of tokens) {
      const service = container.resolve(token);
      expect(
        service,
        `${token} must resolve to a truthy instance`,
      ).toBeTruthy();
    }
  }, 30_000);
});
