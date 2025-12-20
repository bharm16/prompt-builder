import { RelaxedF1Evaluator } from './RelaxedF1Evaluator.js';
import type { LLMSpan } from '../types.js';

export type Span = Pick<LLMSpan, 'start' | 'end' | 'role' | 'text' | 'confidence'> & {
  start: number;
  end: number;
  role: string;
};

export interface F1Metrics {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  totalPredicted: number;
  totalGroundTruth: number;
}

export interface TaxonomyMetrics {
  accuracy: number;
  correct: number;
  total: number;
}

export interface FragmentationMetrics {
  rate: number;
  fragmentedCount: number;
  totalGroundTruth: number;
  examples: Array<{
    groundTruth: Span;
    fragments: Array<Pick<Span, 'text' | 'role' | 'start' | 'end'>>;
  }>;
}

export interface OverExtractionMetrics {
  rate: number;
  spuriousCount: number;
  totalPredicted: number;
  examples: Span[];
}

export type ConfusionMatrix = Record<string, Record<string, number>>;

/**
 * SpanLabelingEvaluator
 *
 * Typed wrapper over RelaxedF1Evaluator with extended metrics:
 * - Fragmentation rate
 * - Over-extraction rate
 * - Confusion matrix
 */
export class SpanLabelingEvaluator extends RelaxedF1Evaluator {
  override calculateIoU(predicted: Span, groundTruth: Span): number {
    return super.calculateIoU(predicted, groundTruth);
  }

  override evaluateSpans(predicted: Span[], groundTruth: Span[], iouThreshold = 0.5): F1Metrics {
    return super.evaluateSpans(predicted, groundTruth, iouThreshold) as F1Metrics;
  }

  override evaluateTaxonomyAccuracy(
    predicted: Span[],
    groundTruth: Span[],
    iouThreshold = 0.5
  ): TaxonomyMetrics {
    return super.evaluateTaxonomyAccuracy(predicted, groundTruth, iouThreshold) as TaxonomyMetrics;
  }

  override calculateFragmentationRate(
    predicted: Span[],
    groundTruth: Span[],
    iouThreshold = 0.1,
    useParentRole = true
  ): FragmentationMetrics {
    return super.calculateFragmentationRate(
      predicted,
      groundTruth,
      iouThreshold,
      useParentRole
    ) as FragmentationMetrics;
  }

  override calculateOverExtractionRate(
    predicted: Span[],
    groundTruth: Span[],
    iouThreshold = 0.5
  ): OverExtractionMetrics {
    return super.calculateOverExtractionRate(predicted, groundTruth, iouThreshold) as OverExtractionMetrics;
  }

  override updateConfusionMatrix(
    matrix: ConfusionMatrix,
    predicted: Span[],
    groundTruth: Span[],
    iouThreshold = 0.5
  ): ConfusionMatrix {
    return super.updateConfusionMatrix(matrix, predicted, groundTruth, iouThreshold) as ConfusionMatrix;
  }

  override generateConfusionMatrix(
    testResults: Array<{ predicted: Span[]; groundTruth: Span[] }>,
    iouThreshold = 0.5
  ): ConfusionMatrix {
    return super.generateConfusionMatrix(testResults, iouThreshold) as ConfusionMatrix;
  }
}

export const spanLabelingEvaluator = new SpanLabelingEvaluator();

