/**
 * Rank-based quartile stratification for calibration sample selection.
 *
 * Rationale: the calibration set must cover the full quality range so
 * Spearman ρ can distinguish judge behavior across high/mid/low scoring
 * events. Random sampling biases toward whatever score level dominates
 * the population (typically high). Rank-based quartiles guarantee 5
 * events per quartile regardless of score-distribution skew.
 *
 * See docs/superpowers/specs/2026-05-15-quality-judge-calibration-seeding-design.md
 * § 2.1 for the algorithm description.
 */

const MIN_POPULATION = 20;
const QUARTILES = 4;
const PER_QUARTILE = 5;

export function stratifyByQuartile<T>(
  events: T[],
  getScore: (e: T) => number,
): T[] {
  if (events.length < MIN_POPULATION) {
    throw new Error(
      `stratifyByQuartile: need at least ${MIN_POPULATION} events, got ${events.length}.`,
    );
  }

  const sorted = [...events].sort((a, b) => getScore(a) - getScore(b));
  const n = sorted.length;
  const result: T[] = [];

  for (let q = 0; q < QUARTILES; q++) {
    const qStart = Math.floor((q * n) / QUARTILES);
    const qEnd = Math.floor(((q + 1) * n) / QUARTILES);
    const qMid = qStart + Math.floor((qEnd - qStart) / 2);

    const half = Math.floor(PER_QUARTILE / 2);
    let pickStart = qMid - half;
    if (pickStart < qStart) pickStart = qStart;
    if (pickStart + PER_QUARTILE > qEnd) pickStart = qEnd - PER_QUARTILE;
    if (pickStart < qStart) pickStart = qStart;

    for (let i = pickStart; i < Math.min(pickStart + PER_QUARTILE, qEnd); i++) {
      result.push(sorted[i]!);
    }
  }

  return result;
}
