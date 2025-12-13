import { logger } from '@infrastructure/Logger';
import SpanLabelingConfig from '../config/SpanLabelingConfig.js';
import { extractKnownSpans, getVocabStats, extractSemanticSpans } from '@services/nlp/NlpSpanService.js';
import { validateSpans } from '../validation/SpanValidator.js';
import type { SubstringPositionCache } from '../cache/SubstringPositionCache.js';
import type { LabelSpansResult, ValidationPolicy, ProcessingOptions } from '../types.js';

/**
 * NLP Span Strategy
 *
 * Handles NLP fast-path extraction using:
 * - Neuro-Symbolic NLP (Aho-Corasick + GLiNER) - Phase 1
 * - Dictionary matching (technical terms) - Phase 0 fallback
 *
 * Returns null if fast-path should be skipped (insufficient coverage or disabled)
 */
export class NlpSpanStrategy {
  private readonly log = logger.child({ service: 'NlpSpanStrategy' });

  private _calculateCoveragePercent(
    spans: Array<{ start?: number; end?: number }> | null | undefined,
    textLength: number
  ): number {
    if (!Array.isArray(spans) || spans.length === 0 || textLength <= 0) {
      return 0;
    }

    const intervals = spans
      .map((s) => ({
        start: typeof s.start === 'number' ? Math.max(0, Math.min(textLength, s.start)) : null,
        end: typeof s.end === 'number' ? Math.max(0, Math.min(textLength, s.end)) : null,
      }))
      .filter((i): i is { start: number; end: number } => i.start !== null && i.end !== null && i.end > i.start)
      .sort((a, b) => a.start - b.start);

    if (intervals.length === 0) return 0;

    let covered = 0;
    let curStart = intervals[0]!.start;
    let curEnd = intervals[0]!.end;

    for (let i = 1; i < intervals.length; i++) {
      const it = intervals[i]!;
      if (it.start > curEnd) {
        covered += curEnd - curStart;
        curStart = it.start;
        curEnd = it.end;
      } else if (it.end > curEnd) {
        curEnd = it.end;
      }
    }

    covered += curEnd - curStart;
    return (covered / textLength) * 100;
  }

  /**
   * Extract spans using NLP fast-path
   *
   * @param text - Source text to extract spans from
   * @param policy - Validation policy
   * @param options - Processing options
   * @param cache - Position cache for validation
   * @returns Extraction result if fast-path succeeds, null otherwise
   */
  async extractSpans(
    text: string,
    policy: ValidationPolicy,
    options: ProcessingOptions,
    cache: SubstringPositionCache
  ): Promise<LabelSpansResult | null> {
    const startTime = Date.now();
    let nlpSpans: unknown[] = [];
    let nlpMetadata: Record<string, unknown> = {};
    let nlpSource = 'none';

    // ============================================================================
    // PHASE 1: Neuro-Symbolic NLP (Aho-Corasick + GLiNER)
    // ============================================================================
    if (SpanLabelingConfig.NEURO_SYMBOLIC && SpanLabelingConfig.NEURO_SYMBOLIC.ENABLED) {
      try {
        // extractSemanticSpans runs both:
        // - Tier 1: Aho-Corasick for closed vocabulary (technical terms)
        // - Tier 2: GLiNER for open vocabulary (semantic entities)
        const semanticResult = await extractSemanticSpans(text);

        const hasSpans = semanticResult.spans && semanticResult.spans.length > 0;

        if (hasSpans) {
          nlpSpans = semanticResult.spans as unknown[];
          nlpSource = (semanticResult.stats as { phase?: string } | undefined)?.phase || 'neuro-symbolic';
          nlpMetadata = {
            closedVocab: (semanticResult.stats as { closedVocabSpans?: number } | undefined)?.closedVocabSpans || 0,
            openVocab: (semanticResult.stats as { openVocabSpans?: number } | undefined)?.openVocabSpans || 0,
            tier1Latency: (semanticResult.stats as { tier1Latency?: number } | undefined)?.tier1Latency || 0,
            tier2Latency: (semanticResult.stats as { tier2Latency?: number } | undefined)?.tier2Latency || 0,
          };

          this.log.info('Neuro-Symbolic spans extracted', {
            operation: 'extractSpans',
            spanCount: nlpSpans.length,
            closedVocab: nlpMetadata.closedVocab,
            openVocab: nlpMetadata.openVocab,
            latency: (nlpMetadata.tier1Latency as number) + (nlpMetadata.tier2Latency as number),
          });
        }
      } catch (error) {
        const err = error as Error;
        this.log.warn('Neuro-Symbolic extraction error, falling back', {
          operation: 'extractSpans',
          error: err.message,
        });
      }
    }

    // ============================================================================
    // PHASE 0: Fallback to Dictionary-only if neuro-symbolic didn't run or failed
    // ============================================================================
    if (nlpSpans.length === 0 && SpanLabelingConfig.NLP_FAST_PATH.ENABLED) {
      try {
        nlpSpans = extractKnownSpans(text) as unknown[];
        nlpSource = 'dictionary';
      } catch (error) {
        const err = error as Error;
        this.log.warn('Dictionary extraction error', {
          operation: 'extractSpans',
          error: err.message,
        });
      }
    }

    // ============================================================================
    // Check if we have sufficient coverage to skip LLM
    // ============================================================================
    if (nlpSpans.length > 0) {
      const meetsThreshold = nlpSpans.length >= SpanLabelingConfig.NLP_FAST_PATH.MIN_SPANS_THRESHOLD;

      if (meetsThreshold) {
        const nlpEndTime = Date.now();
        const nlpLatency = nlpEndTime - startTime;

        // Validate NLP spans through the same pipeline
        const baseMeta = {
          version: nlpSource === 'symbolic-nlp' ? 'nlp-v2-semantic' : 'nlp-v1',
          notes: `Generated via ${nlpSource} (${nlpSpans.length} spans, ${nlpLatency}ms)`,
          source: nlpSource,
          latency: nlpLatency,
          ...nlpMetadata,
          vocabStats: SpanLabelingConfig.NLP_FAST_PATH.TRACK_METRICS ? getVocabStats() : undefined,
        };

        const validation = validateSpans({
          spans: nlpSpans,
          meta: baseMeta,
          text,
          policy,
          options,
          attempt: 1,
          cache,
          isAdversarial: false,
        });

        if (validation.ok) {
          const coveragePercent = this._calculateCoveragePercent(validation.result.spans, text.length);
          if (coveragePercent < SpanLabelingConfig.NLP_FAST_PATH.MIN_COVERAGE_PERCENT) {
            this.log.info('NLP Fast-Path coverage insufficient, falling back to LLM', {
              operation: 'extractSpans',
              spanCount: validation.result.spans.length,
              coveragePercent: Math.round(coveragePercent * 10) / 10,
              minCoveragePercent: SpanLabelingConfig.NLP_FAST_PATH.MIN_COVERAGE_PERCENT,
              source: nlpSource,
            });
            return null;
          }

          // Log telemetry if enabled
          if (SpanLabelingConfig.NLP_FAST_PATH.TRACK_COST_SAVINGS) {
            this.log.info('NLP Fast-Path bypassed LLM call', {
              operation: 'extractSpans',
              spanCount: nlpSpans.length,
              latency: nlpLatency,
              estimatedSavings: '$0.0005',
            });
          }

          return {
            spans: validation.result.spans,
            meta: validation.result.meta,
            isAdversarial: validation.result.isAdversarial,
          };
        }

        // Retry in lenient mode to preserve fast-path spans when strict checks are too tight
        const lenientValidation = validateSpans({
          spans: nlpSpans,
          meta: baseMeta,
          text,
          policy,
          options,
          attempt: 2,
          cache,
          isAdversarial: false,
        });

        if (lenientValidation.ok) {
          const coveragePercent = this._calculateCoveragePercent(lenientValidation.result.spans, text.length);
          if (coveragePercent < SpanLabelingConfig.NLP_FAST_PATH.MIN_COVERAGE_PERCENT) {
            this.log.info('NLP Fast-Path coverage insufficient (lenient), falling back to LLM', {
              operation: 'extractSpans',
              spanCount: lenientValidation.result.spans.length,
              coveragePercent: Math.round(coveragePercent * 10) / 10,
              minCoveragePercent: SpanLabelingConfig.NLP_FAST_PATH.MIN_COVERAGE_PERCENT,
              source: nlpSource,
            });
            return null;
          }

          this.log.info('NLP Fast-Path accepted with lenient validation', {
            operation: 'extractSpans',
            spanCount: lenientValidation.result.spans.length,
            latency: nlpLatency,
          });

          return {
            spans: lenientValidation.result.spans,
            meta: lenientValidation.result.meta,
            isAdversarial: lenientValidation.result.isAdversarial,
          };
        }
      }
    }

    // Fast-path should be skipped - return null
    return null;
  }
}
