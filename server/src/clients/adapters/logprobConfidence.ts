/**
 * Logprob confidence utilities
 *
 * Single responsibility: derive confidence metrics from logprobs.
 */

export function calculateConfidenceFromLogprobs(
  logprobs: Array<{ logprob: number; probability?: number }>
): {
  average: number;
  min: number;
  max: number;
  lowConfidenceTokens: number;
} {
  if (!logprobs || logprobs.length === 0) {
    return { average: 0, min: 0, max: 0, lowConfidenceTokens: 0 };
  }

  const probabilities = logprobs.map((lp) =>
    lp.probability !== undefined ? lp.probability : Math.exp(lp.logprob)
  );

  const sum = probabilities.reduce((a, b) => a + b, 0);
  const average = sum / probabilities.length;
  const min = Math.min(...probabilities);
  const max = Math.max(...probabilities);
  const lowConfidenceTokens = probabilities.filter((p) => p < 0.5).length;

  return { average, min, max, lowConfidenceTokens };
}
