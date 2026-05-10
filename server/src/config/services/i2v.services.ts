/**
 * I2V Service Registration
 *
 * Registers I2V-specific services (motion ideas, etc.) that translate
 * existing observation data into user-facing motion vocabulary.
 *
 * MotionIdeaService depends on `aiService` (LLM routing) and
 * `imageObservationService` — both registered earlier:
 *   - `imageObservationService` in core.services.ts
 *   - `aiService` in llm.services.ts
 */

import type { DIContainer } from "@infrastructure/DIContainer";
import type { AIExecutionPort } from "@services/ai-model/ports/AIExecutionPort";
import type { ImageObservationService } from "@services/image-observation/ImageObservationService";
import { MotionIdeaService } from "@services/i2v-motion-ideas/MotionIdeaService";

export function registerI2VServices(container: DIContainer): void {
  container.register(
    "motionIdeaService",
    (ai: AIExecutionPort, observation: ImageObservationService) =>
      new MotionIdeaService(ai, observation),
    ["aiService", "imageObservationService"],
  );
}
