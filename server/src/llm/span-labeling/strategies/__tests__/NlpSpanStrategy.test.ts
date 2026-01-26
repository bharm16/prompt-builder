import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SpanLabelingConfig from '../../config/SpanLabelingConfig';

const mockExtractSemanticSpans = vi.fn();
const mockExtractKnownSpans = vi.fn();
const mockValidateSpans = vi.fn();
const mockGetVocabStats = vi.fn();
const mockIsGlinerAvailable = vi.fn();

vi.mock('../../nlp/NlpSpanService', () => ({
  extractSemanticSpans: (...args: unknown[]) => mockExtractSemanticSpans(...args),
  extractKnownSpans: (...args: unknown[]) => mockExtractKnownSpans(...args),
  validateSpans: undefined,
  getVocabStats: () => mockGetVocabStats(),
  isGlinerAvailable: () => mockIsGlinerAvailable(),
}));

vi.mock('../../validation/SpanValidator', () => ({
  validateSpans: (...args: unknown[]) => mockValidateSpans(...args),
}));

let NlpSpanStrategy: typeof import('../NlpSpanStrategy').NlpSpanStrategy;

describe('NlpSpanStrategy', () => {
  const originalConfig = {
    NLP_FAST_PATH: { ...SpanLabelingConfig.NLP_FAST_PATH },
    NEURO_SYMBOLIC: {
      ...SpanLabelingConfig.NEURO_SYMBOLIC,
      GLINER: { ...SpanLabelingConfig.NEURO_SYMBOLIC.GLINER },
    },
  };

  beforeEach(async () => {
    if (!NlpSpanStrategy) {
      ({ NlpSpanStrategy } = await import('../NlpSpanStrategy'));
    }
  });

  beforeEach(() => {
    mockExtractSemanticSpans.mockReset();
    mockExtractKnownSpans.mockReset();
    mockValidateSpans.mockReset();
    mockGetVocabStats.mockReset();
    mockIsGlinerAvailable.mockReset();

    (SpanLabelingConfig.NLP_FAST_PATH as unknown as { ENABLED: boolean }).ENABLED = true;
    (SpanLabelingConfig.NEURO_SYMBOLIC as unknown as { ENABLED: boolean }).ENABLED = false;
    (SpanLabelingConfig.NEURO_SYMBOLIC.GLINER as unknown as { ENABLED: boolean }).ENABLED = true;
  });

  afterEach(() => {
    (SpanLabelingConfig.NLP_FAST_PATH as unknown as { ENABLED: boolean }).ENABLED =
      originalConfig.NLP_FAST_PATH.ENABLED;
    (SpanLabelingConfig.NEURO_SYMBOLIC as unknown as { ENABLED: boolean }).ENABLED =
      originalConfig.NEURO_SYMBOLIC.ENABLED;
    (SpanLabelingConfig.NEURO_SYMBOLIC.GLINER as unknown as { ENABLED: boolean }).ENABLED =
      originalConfig.NEURO_SYMBOLIC.GLINER.ENABLED;
  });

  const baseParams = {
    policy: {},
    options: { maxSpans: 10, minConfidence: 0.5, templateVersion: 'v1' },
    cache: {} as unknown as any,
  };

  describe('error handling', () => {
    it('returns null when NLP extraction fails', async () => {
      (SpanLabelingConfig.NEURO_SYMBOLIC as unknown as { ENABLED: boolean }).ENABLED = true;
      mockExtractSemanticSpans.mockRejectedValue(new Error('boom'));
      mockExtractKnownSpans.mockImplementation(() => {
        throw new Error('fail');
      });

      const strategy = new NlpSpanStrategy();
      const result = await strategy.extractSpans('short text', baseParams.policy, baseParams.options, baseParams.cache);

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('falls back to LLM when GLiNER is required but unavailable', async () => {
      const longText = Array.from({ length: 100 }, () => 'word').join(' ');
      const spans = Array.from({ length: 8 }, (_, index) => ({
        start: 0,
        end: 4,
        role: index % 2 === 0 ? 'subject' : 'action',
        confidence: 0.9,
      }));

      mockExtractKnownSpans.mockReturnValue(spans);
      mockValidateSpans.mockReturnValue({
        ok: true,
        errors: [],
        result: { spans, meta: { version: 'v1', notes: 'ok' } },
      });
      mockIsGlinerAvailable.mockReturnValue(false);

      const strategy = new NlpSpanStrategy();
      const result = await strategy.extractSpans(longText, baseParams.policy, baseParams.options, baseParams.cache);

      expect(result).toBeNull();
    });

    it('uses lenient validation when strict validation fails', async () => {
      const spans = [
        { start: 0, end: 3, role: 'subject', confidence: 0.9 },
      ];

      mockExtractKnownSpans.mockReturnValue(spans);
      mockValidateSpans
        .mockReturnValueOnce({ ok: false, errors: ['bad'], result: { spans: [], meta: { version: 'v1', notes: '' } } })
        .mockReturnValueOnce({ ok: true, errors: [], result: { spans, meta: { version: 'v1', notes: 'lenient' } } });

      const strategy = new NlpSpanStrategy();
      const result = await strategy.extractSpans('short text', baseParams.policy, baseParams.options, baseParams.cache);

      expect(result?.meta.notes).toBe('lenient');
    });
  });

  describe('core behavior', () => {
    it('returns validated spans when fast-path succeeds', async () => {
      const spans = [
        { start: 0, end: 3, role: 'subject', confidence: 0.9 },
        { start: 4, end: 9, role: 'action', confidence: 0.8 },
      ];

      mockExtractKnownSpans.mockReturnValue(spans);
      mockValidateSpans.mockImplementation((args: { spans: unknown[]; meta: { notes?: string; version?: string } }) => ({
        ok: true,
        errors: [],
        result: { spans: args.spans as typeof spans, meta: args.meta },
      }));
      mockIsGlinerAvailable.mockReturnValue(true);

      const strategy = new NlpSpanStrategy();
      const result = await strategy.extractSpans('short text for NLP', baseParams.policy, baseParams.options, baseParams.cache);

      expect(result?.spans).toHaveLength(2);
      expect(result?.meta.notes).toContain('Generated via dictionary');
    });
  });
});
