import type { DIContainer } from "@infrastructure/DIContainer";
import {
  createPostHogClient,
  type IPostHogClient,
} from "@infrastructure/PostHogClient";
import { LlmCallTelemetryService } from "@services/observability/LlmCallTelemetryService";
import { OptimizeTelemetryService } from "@services/observability/OptimizeTelemetryService";
import { SpanLabelingTelemetryService } from "@services/observability/SpanLabelingTelemetryService";
import { SuggestionsTelemetryService } from "@services/observability/SuggestionsTelemetryService";

export function registerObservabilityServices(container: DIContainer): void {
  container.register("postHogClient", () => createPostHogClient(), []);

  container.register(
    "optimizeTelemetryService",
    (postHogClient: IPostHogClient) =>
      new OptimizeTelemetryService(postHogClient),
    ["postHogClient"],
  );

  container.register(
    "suggestionsTelemetryService",
    (postHogClient: IPostHogClient) =>
      new SuggestionsTelemetryService(postHogClient),
    ["postHogClient"],
  );

  container.register(
    "llmCallTelemetryService",
    (postHogClient: IPostHogClient) =>
      new LlmCallTelemetryService(postHogClient),
    ["postHogClient"],
  );

  container.register(
    "spanLabelingTelemetryService",
    (postHogClient: IPostHogClient) =>
      new SpanLabelingTelemetryService(postHogClient),
    ["postHogClient"],
  );
}
