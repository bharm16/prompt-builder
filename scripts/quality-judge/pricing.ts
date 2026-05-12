/**
 * Per-model $/1K-token pricing for the LLM judge framework.
 *
 * Prices are OpenAI list prices as of 2026-05-12. When OpenAI changes pricing,
 * update this table; cost-tracking dashboards re-aggregate on the next judge run.
 */

export interface ModelPricing {
  /** USD per 1,000 input tokens. */
  inputPer1k: number;
  /** USD per 1,000 output tokens. */
  outputPer1k: number;
}

export const PRICING: Record<string, ModelPricing> = {
  // $2.50 / 1M input, $10.00 / 1M output
  "gpt-4o-2024-08-06": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  // Kept for parity with span-labeling-evaluation.ts's --fast mode.
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
};

export function computeCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const entry = PRICING[model];
  if (!entry) return 0;
  return (
    (tokensIn / 1000) * entry.inputPer1k +
    (tokensOut / 1000) * entry.outputPer1k
  );
}
