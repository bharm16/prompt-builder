import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LLMSpan } from '@llm/span-labeling/types';
import { evaluateIntentPreservation } from './dimensions/intentPreservation';
import { evaluateModelCompliance } from './dimensions/modelCompliance';
import { evaluateStructuralCompleteness } from './dimensions/structuralCompleteness';
import { evaluateTechnicalDensity } from './dimensions/technicalDensity';
import { evaluateWordCountCompliance } from './dimensions/wordCountCompliance';
import { labelOptimizedSpans } from './integrations/spanLabeling';
import { normalizeText } from './utils/text';

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

export class OptimizationQualityEvaluator {
  constructor(private readonly ai: AIModelService) {}

  async evaluateCase(testCase: OptimizationTestCase, optimized: string): Promise<OptimizationQualityResult> {
    const failures: string[] = [];

    const intent = await evaluateIntentPreservation(
      this.ai,
      testCase.input,
      optimized,
      testCase.requiredElements || []
    );

    if (intent.score < 1.0) {
      failures.push(
        `Intent preservation failed: missing required elements (${intent.missing.join(', ')})`
      );
    }

    const wordCountCompliance = evaluateWordCountCompliance(optimized);
    const technicalDensity = evaluateTechnicalDensity(optimized);
    const modelCompliance = evaluateModelCompliance(optimized, testCase.targetModel);

    // Forbidden patterns
    if (testCase.forbiddenPatterns && testCase.forbiddenPatterns.length) {
      const lower = normalizeText(optimized);
      for (const pat of testCase.forbiddenPatterns) {
        if (lower.includes(normalizeText(pat))) {
          failures.push(`Forbidden pattern present: "${pat}"`);
        }
      }
    }

    // Structural completeness via span labeling
    let spans: LLMSpan[] = [];
    try {
      spans = await labelOptimizedSpans(this.ai, optimized);
    } catch (e) {
      failures.push(`Span labeling failed: ${(e as Error).message}`);
    }

    const structuralCompleteness = evaluateStructuralCompleteness(spans);

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
