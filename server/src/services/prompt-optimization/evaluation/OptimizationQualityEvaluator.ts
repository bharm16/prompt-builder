import type { AIService } from '../types.js';
import type { LLMSpan } from '../../../llm/span-labeling/types.js';
import { labelSpans } from '../../../llm/span-labeling/SpanLabelingService.js';

export interface OptimizationTestCase {
  id: string;
  input: string;
  requiredElements: string[];
  forbiddenPatterns?: string[];
  targetModel?: string;
  expectedQualities?: Partial<Record<OptimizationQualityDimension, { min?: number; max?: number }>>;
}

export type OptimizationQualityDimension =
  | 'intentPreservation'
  | 'structuralCompleteness'
  | 'wordCountCompliance'
  | 'technicalDensity'
  | 'modelCompliance';

export interface OptimizationQualityScores {
  intentPreservation: number;
  structuralCompleteness: number;
  wordCountCompliance: number;
  technicalDensity: number;
  modelCompliance: number;
}

export interface OptimizationQualityResult {
  id: string;
  optimized: string;
  scores: OptimizationQualityScores;
  passed: boolean;
  failures: string[];
  spans?: LLMSpan[];
}

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

const normalize = (t: string) =>
  t.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const countWords = (t: string) =>
  normalize(t).split(/\s+/).filter(Boolean).length;

const extractMainVideoPrompt = (optimized: string): string => {
  const text = typeof optimized === 'string' ? optimized.trim() : '';
  if (!text) return '';

  // If the optimizer ever returns raw JSON (e.g., before reassembly), prefer the structured field.
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.prompt === 'string' && parsed.prompt.trim()) {
        return parsed.prompt.trim();
      }
    } catch {
      // fall through to section parsing
    }
  }

  const techHeader = /\n\s*\*\*TECHNICAL SPECS\*\*\s*\n/i;
  const match = techHeader.exec(text);
  if (match && typeof match.index === 'number' && match.index > 0) {
    return text.slice(0, match.index).trim();
  }

  return text;
};

export class OptimizationQualityEvaluator {
  constructor(private readonly ai: AIService) {}

  private async intentPreservation(
    input: string,
    optimized: string,
    requiredElements: string[]
  ): Promise<{ score: number; missing: string[]; evidence?: Array<{ element: string; present: boolean; evidence?: string }> }> {
    const opt = normalize(optimized);
    const missing = (requiredElements || []).filter((el) => !opt.includes(normalize(el)));
    if (missing.length === 0) {
      return { score: 1.0, missing: [] };
    }

    // Semantic fallback: allow paraphrases like "downpour" ≈ "rain" or "glides" ≈ "flying".
    // Uses a deterministic, JSON-only LLM check to avoid brittle substring matching.
    try {
      const systemPrompt = [
        'You are a strict intent-preservation evaluator for video prompts.',
        'Task: Decide whether the OPTIMIZED prompt preserves each required element from the ORIGINAL prompt.',
        '',
        'Rules:',
        '- Treat synonyms/paraphrases as preserved if the concept is clearly present.',
        '- Be conservative: if it is not clearly present, mark it as NOT preserved.',
        '- Provide a short evidence snippet (a phrase from the optimized prompt) when preserved.',
        '- Output ONLY valid JSON with the exact schema below.',
        '',
        'JSON schema:',
        '{',
        '  "items": [',
        '    { "element": string, "present": boolean, "evidence": string }',
        '  ],',
        '  "allPresent": boolean',
        '}',
        '',
        `ORIGINAL: ${input}`,
        `OPTIMIZED: ${optimized}`,
        `REQUIRED_ELEMENTS: ${JSON.stringify(requiredElements || [])}`,
      ].join('\n');

      const resp = await (this.ai as any).execute('optimize_intent_check', {
        systemPrompt,
        maxTokens: 600,
        temperature: 0,
        jsonMode: true,
      });

      const rawText =
        (resp && typeof resp.text === 'string' && resp.text) ||
        (Array.isArray(resp?.content) && resp.content[0]?.text) ||
        '';

      const parsed = JSON.parse(rawText);
      const items: Array<{ element: string; present: boolean; evidence?: string }> = Array.isArray(parsed?.items)
        ? parsed.items
        : [];
      const allPresent = parsed?.allPresent === true;

      return { score: allPresent ? 1.0 : 0.0, missing: missing, evidence: items };
    } catch {
      // Fall back to strict substring enforcement if the intent check fails.
      return { score: 0.0, missing };
    }
  }

  private wordCountCompliance(optimized: string): number {
    // Measure only the main prompt paragraph. The full optimized output also includes
    // TECHNICAL SPECS and VARIATIONS, which intentionally push total length >125 words.
    const words = countWords(extractMainVideoPrompt(optimized));
    if (words >= 75 && words <= 125) return 1.0;
    if (words >= 50 && words <= 150) return 0.8;
    if (words >= 30 && words <= 200) return 0.5;
    return 0.2;
  }

  private technicalDensity(optimized: string): number {
    const lower = normalize(optimized);
    const count = TECHNICAL_TERMS.filter((term) => lower.includes(term)).length;
    if (count >= 2 && count <= 5) return 1.0;
    if (count >= 1 && count <= 7) return 0.7;
    return 0.3;
  }

  private modelCompliance(optimized: string, targetModel?: string): number {
    if (!targetModel) return 1.0;
    const lower = normalize(optimized);
    let score = 1.0;

    if (targetModel.toLowerCase() === 'sora') {
      if (/\d+\s*(seconds?|s)\b/.test(lower)) {
        score -= 0.2;
      }
    }

    if (targetModel.toLowerCase() === 'veo3') {
      const techCount = TECHNICAL_TERMS.filter((term) => lower.includes(term)).length;
      if (techCount === 0) {
        score -= 0.1;
      }
    }

    return Math.max(0, score);
  }

  private structuralCompleteness(spans: LLMSpan[]): number {
    const parents = new Set((spans || []).map((s) => (s.role || '').split('.')[0]));
    const hasSubject = parents.has('subject');
    const hasAction = parents.has('action');
    const hasEnvironment = parents.has('environment');
    const hasCameraOrLighting =
      parents.has('camera') || parents.has('lighting') || parents.has('shot');

    const present = [hasSubject, hasAction, hasEnvironment, hasCameraOrLighting].filter(Boolean).length;
    return present / 4;
  }

  async evaluateCase(testCase: OptimizationTestCase, optimized: string): Promise<OptimizationQualityResult> {
    const failures: string[] = [];

    const intent = await this.intentPreservation(
      testCase.input,
      optimized,
      testCase.requiredElements || []
    );

    if (intent.score < 1.0) {
      failures.push(
        `Intent preservation failed: missing required elements (${intent.missing.join(', ')})`
      );
    }

    const wordCountCompliance = this.wordCountCompliance(optimized);
    const technicalDensity = this.technicalDensity(optimized);
    const modelCompliance = this.modelCompliance(optimized, testCase.targetModel);

    // Forbidden patterns
    if (testCase.forbiddenPatterns && testCase.forbiddenPatterns.length) {
      const lower = normalize(optimized);
      for (const pat of testCase.forbiddenPatterns) {
        if (lower.includes(normalize(pat))) {
          failures.push(`Forbidden pattern present: "${pat}"`);
        }
      }
    }

    // Structural completeness via span labeling
    let spans: LLMSpan[] = [];
    try {
      const spanResult = await labelSpans(
        { text: optimized, maxSpans: 80, minConfidence: 0.4, templateVersion: 'v3.0' },
        this.ai
      );
      spans = spanResult.spans || [];
    } catch (e) {
      failures.push(`Span labeling failed: ${(e as Error).message}`);
    }

    const structuralCompleteness = this.structuralCompleteness(spans);

    const scores: OptimizationQualityScores = {
      intentPreservation: intent.score,
      structuralCompleteness,
      wordCountCompliance,
      technicalDensity,
      modelCompliance,
    };

    if (testCase.expectedQualities) {
      for (const [dim, range] of Object.entries(testCase.expectedQualities)) {
        const value = scores[dim as OptimizationQualityDimension];
        if (range?.min !== undefined && value < range.min) {
          failures.push(`${dim} (${value.toFixed(3)}) below min ${range.min}`);
        }
        if (range?.max !== undefined && value > range.max) {
          failures.push(`${dim} (${value.toFixed(3)}) above max ${range.max}`);
        }
      }
    }

    return {
      id: testCase.id,
      optimized,
      scores,
      passed: failures.length === 0,
      failures,
      spans,
    };
  }
}
