import { countWords, extractMainVideoPrompt } from '../utils/text';

export function evaluateWordCountCompliance(optimized: string): number {
  const words = countWords(extractMainVideoPrompt(optimized));
  if (words >= 75 && words <= 125) return 1.0;
  if (words >= 50 && words <= 150) return 0.8;
  if (words >= 30 && words <= 200) return 0.5;
  return 0.2;
}
