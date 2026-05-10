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
