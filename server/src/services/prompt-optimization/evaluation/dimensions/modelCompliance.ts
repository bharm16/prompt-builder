import { normalizeText } from '../utils/text';
import { getTechnicalTerms } from './technicalDensity';

export function evaluateModelCompliance(optimized: string, targetModel?: string): number {
  if (!targetModel) return 1.0;
  const lower = normalizeText(optimized);
  let score = 1.0;

  if (targetModel.toLowerCase() === 'sora') {
    if (/\d+\s*(seconds?|s)\b/.test(lower)) {
      score -= 0.2;
    }
  }

  if (targetModel.toLowerCase() === 'veo3') {
    const techCount = getTechnicalTerms().filter((term) => lower.includes(term)).length;
    if (techCount === 0) {
      score -= 0.1;
    }
  }

  return Math.max(0, score);
}
