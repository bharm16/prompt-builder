import { normalizeText } from '../utils/text';

const TECHNICAL_TERMS = [
  'close-up',
  'close up',
  'medium shot',
  'wide shot',
  'tracking',
  'pan',
  'tilt',
  'dolly',
  'push-in',
  'pull-back',
  'depth of field',
  'shallow dof',
  'bokeh',
  'golden hour',
  'high-key',
  'low-key',
  'handheld',
  'steadycam',
  'rack focus',
  'chiaroscuro',
  'slow motion',
  'motion blur',
  'lens',
  '35mm',
  '50mm',
  'anamorphic',
  'f/2.8',
  'f/4',
];

export function evaluateTechnicalDensity(optimized: string): number {
  const lower = normalizeText(optimized);
  const count = TECHNICAL_TERMS.filter((term) => lower.includes(term)).length;
  if (count >= 2 && count <= 5) return 1.0;
  if (count >= 1 && count <= 7) return 0.7;
  return 0.3;
}

export function getTechnicalTerms(): string[] {
  return [...TECHNICAL_TERMS];
}
