import type { OptimizeTelemetryService } from "@services/observability/OptimizeTelemetryService";
import type { PromptOptimizationService } from "@services/prompt-optimization/PromptOptimizationService";

export type PromptOptimizationServiceContract = Pick<
  PromptOptimizationService,
  "optimize" | "compilePrompt"
>;

export interface OptimizeServices {
  promptOptimizationService: PromptOptimizationServiceContract;
  /**
   * Optional at this boundary so legacy test fixtures that wire only the
   * service contract continue to compile. When omitted, the routes layer
   * substitutes a no-op telemetry stub. Production wiring resolves the real
   * service from the DI container in `api.registration.ts`.
   */
  optimizeTelemetryService?: OptimizeTelemetryService;
}
