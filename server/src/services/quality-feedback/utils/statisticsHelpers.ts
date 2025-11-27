/**
 * Statistical calculation utilities
 */

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(values: number[] | null | undefined): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate trend between two datasets
 */
export function calculateTrend(
  recent: number[],
  previous: number[],
  threshold: number = 0.05
): 'improving' | 'declining' | 'stable' {
  const recentAvg = calculateAverage(recent);
  const previousAvg = calculateAverage(previous);

  if (recentAvg > previousAvg + threshold) return 'improving';
  if (recentAvg < previousAvg - threshold) return 'declining';
  return 'stable';
}

/**
 * Normalize weights to sum to 1
 */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const totalWeight = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);
  
  if (totalWeight === 0) return weights;

  const normalized: Record<string, number> = {};
  Object.keys(weights).forEach(feature => {
    normalized[feature] = weights[feature] / totalWeight;
  });

  return normalized;
}

/**
 * Apply sigmoid activation function
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.min(Math.max(value, min), max);
}

