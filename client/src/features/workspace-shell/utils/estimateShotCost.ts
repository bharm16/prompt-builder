import { getModelConfig } from "@features/generations/config/generationConfig";

export interface EstimateShotCostInput {
  modelId: string;
  durationSeconds: number;
  variantCount: number;
}

/**
 * Estimates the credit cost for one shot (= variantCount tiles).
 *
 * Sources per-second cost from the existing model registry. Returns 0
 * when the model is unknown or has no exposed pricing so the UI can
 * hide the preview rather than showing a misleading number.
 *
 * Phase 3 baseline: pricing is read defensively from common field names.
 * If the model registry exposes a different shape, adjust the field
 * accesses here — the consumer-facing contract (integer, linear in
 * variants, 0 for unknown) stays the same.
 */
export function estimateShotCost({
  modelId,
  durationSeconds,
  variantCount,
}: EstimateShotCostInput): number {
  const config = getModelConfig(modelId);
  if (!config) return 0;
  const c = config as Record<string, unknown>;
  const perSecond =
    typeof c.creditsPerSecond === "number"
      ? c.creditsPerSecond
      : typeof c.cost === "number"
        ? c.cost
        : 0;
  return Math.max(0, Math.round(perSecond * durationSeconds * variantCount));
}
