import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import SpanLabelingConfig from '@llm/span-labeling/config/SpanLabelingConfig';
import type { NlpSpan } from '@llm/span-labeling/nlp/types';

const mockExtractClosedVocabulary = vi.fn();
const mockExtractActionSpans = vi.fn();
const mockExtractLightingSpans = vi.fn();
const mockExtractOpenVocabulary = vi.fn();
const mockFilterSectionHeaders = vi.fn();

vi.mock('@llm/span-labeling/nlp/tier1/closedVocabulary', () => ({
  extractClosedVocabulary: (...args: unknown[]) => mockExtractClosedVocabulary(...args),
}));

vi.mock('@llm/span-labeling/nlp/CompromiseService', () => ({
  extractActionSpans: (...args: unknown[]) => mockExtractActionSpans(...args),
  warmupCompromise: vi.fn(),
  isCompromiseAvailable: vi.fn(),
}));

vi.mock('@llm/span-labeling/nlp/LightingService', () => ({
  extractLightingSpans: (...args: unknown[]) => mockExtractLightingSpans(...args),
  warmupLightingService: vi.fn(),
  isLightingServiceAvailable: vi.fn(),
}));

vi.mock('@llm/span-labeling/nlp/tier2/gliner', () => ({
  extractOpenVocabulary: (...args: unknown[]) => mockExtractOpenVocabulary(...args),
  isGlinerReady: vi.fn(() => true),
  warmupGliner: vi.fn(),
  ALL_GLINER_LABELS: ['person', 'location'],
}));

vi.mock('@llm/span-labeling/nlp/filters/sectionHeaders', () => ({
  filterSectionHeaders: (...args: unknown[]) => mockFilterSectionHeaders(...args),
}));

describe('NlpSpanService', () => {
  const setCompromiseEnabled = (enabled: boolean) => {
    (SpanLabelingConfig.COMPROMISE as { ENABLED: boolean }).ENABLED = enabled;
  };

  const setLightingEnabled = (enabled: boolean) => {
    (SpanLabelingConfig.LIGHTING as { ENABLED: boolean }).ENABLED = enabled;
  };

  const originalCompromise = SpanLabelingConfig.COMPROMISE.ENABLED;
  const originalLighting = SpanLabelingConfig.LIGHTING.ENABLED;

  beforeEach(() => {
    mockExtractClosedVocabulary.mockReset();
    mockExtractActionSpans.mockReset();
    mockExtractLightingSpans.mockReset();
    mockExtractOpenVocabulary.mockReset();
    mockFilterSectionHeaders.mockReset();

    setCompromiseEnabled(true);
    setLightingEnabled(true);
  });

  afterEach(() => {
    setCompromiseEnabled(originalCompromise);
    setLightingEnabled(originalLighting);
  });

  it('returns empty stats for invalid input', async () => {
    const { extractSemanticSpans } = await import('@llm/span-labeling/nlp/NlpSpanService');
    const result = await extractSemanticSpans(undefined as unknown as string);
    expect(result.spans).toEqual([]);
    expect(result.stats.phase).toBe('empty-input');
  });

  it('combines tier outputs and omits open vocab spans when disabled', async () => {
    const text = 'Pan running soft shadows in forest';

    mockExtractClosedVocabulary.mockReturnValue([
      { text: 'Pan', start: 0, end: 3, role: 'camera.movement', confidence: 1, source: 'pattern' },
    ] as NlpSpan[]);

    mockExtractActionSpans.mockResolvedValue({
      spans: [
        { text: 'running', start: 4, end: 11, role: 'action.movement', confidence: 0.8, source: 'compromise' },
      ] as NlpSpan[],
      stats: { verbPhrases: 1, gerunds: 0, totalExtracted: 1, latencyMs: 5 },
    });

    mockExtractLightingSpans.mockResolvedValue({
      spans: [
        { text: 'soft shadows', start: 12, end: 24, role: 'lighting.quality', confidence: 0.7, source: 'lighting' },
      ] as NlpSpan[],
      stats: { patternsFound: 1, shadowPhrases: 1, lightPhrases: 0, totalExtracted: 1, latencyMs: 4 },
    });

    mockExtractOpenVocabulary.mockResolvedValue([
      { text: 'forest', start: 28, end: 34, role: 'environment.location', confidence: 0.9, source: 'gliner' },
    ] as NlpSpan[]);

    mockFilterSectionHeaders.mockImplementation((_text: string, spans: NlpSpan[]) => spans);

    const { extractSemanticSpans } = await import('@llm/span-labeling/nlp/NlpSpanService');
    const result = await extractSemanticSpans(text, { useGliner: false });

    expect(result.spans).toHaveLength(3);
    expect(result.stats.openVocabSpans).toBe(0);
    expect(result.stats.compromiseSpans).toBe(1);
    expect(result.stats.lightingSpans).toBe(1);
  });

  it('applies section header filtering to merged spans', async () => {
    const text = 'Camera: Pan shot';

    mockExtractClosedVocabulary.mockReturnValue([
      { text: 'Camera', start: 0, end: 6, role: 'camera', confidence: 1, source: 'pattern' },
    ] as NlpSpan[]);

    mockExtractActionSpans.mockResolvedValue({ spans: [] as NlpSpan[], stats: { verbPhrases: 0, gerunds: 0, totalExtracted: 0, latencyMs: 0 } });
    mockExtractLightingSpans.mockResolvedValue({ spans: [] as NlpSpan[], stats: { patternsFound: 0, shadowPhrases: 0, lightPhrases: 0, totalExtracted: 0, latencyMs: 0 } });
    mockExtractOpenVocabulary.mockResolvedValue([] as NlpSpan[]);

    mockFilterSectionHeaders.mockReturnValue([] as NlpSpan[]);

    const { extractSemanticSpans } = await import('@llm/span-labeling/nlp/NlpSpanService');
    const result = await extractSemanticSpans(text, { useGliner: false });

    expect(result.spans).toHaveLength(0);
    expect(result.stats.totalSpans).toBe(0);
  });

  it('computes coverage based on known spans', async () => {
    mockExtractClosedVocabulary.mockReturnValue([
      { text: 'Pan', start: 0, end: 3, role: 'camera.movement', confidence: 1, source: 'pattern' },
      { text: 'Tilt', start: 4, end: 8, role: 'camera.movement', confidence: 1, source: 'pattern' },
    ] as NlpSpan[]);

    const { estimateCoverage } = await import('@llm/span-labeling/nlp/NlpSpanService');
    const coverage = estimateCoverage('Pan Tilt');
    expect(coverage).toBe(100);
  });

  it('summarizes vocab statistics from taxonomy and labels', async () => {
    const { getVocabStats } = await import('@llm/span-labeling/nlp/NlpSpanService');
    const stats = getVocabStats();

    expect(stats.totalCategories).toBeGreaterThan(0);
    expect(stats.totalTerms).toBeGreaterThan(0);
    expect(stats.glinerLabels).toBeGreaterThan(0);
  });
});
