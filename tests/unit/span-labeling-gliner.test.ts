import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mockExistsSync = vi.fn();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    default: actual,
  };
});

vi.mock('@llm/span-labeling/nlp/log', () => ({
  log: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('gliner/node', () => ({
  Gliner: class {
    async initialize() {
      return;
    }

    async inference() {
      return [
        [
          { spanText: 'cat', label: 'person', score: 0.6, start: 0, end: 3 },
        ],
      ];
    }
  },
}));

describe('gliner tier2 extraction', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(true);
    vi.resetModules();
  });

  it('initializes and maps GLiNER entities to taxonomy spans', async () => {
    const { default: SpanLabelingConfig } = await import('@llm/span-labeling/config/SpanLabelingConfig');
    SpanLabelingConfig.NEURO_SYMBOLIC.GLINER.USE_WORKER = false;
    SpanLabelingConfig.NEURO_SYMBOLIC.GLINER.LABEL_THRESHOLDS = {};

    const { warmupGliner, extractOpenVocabulary } = await import('@llm/span-labeling/nlp/tier2/gliner');

    const warmup = await warmupGliner();
    expect(warmup.success).toBe(true);

    const spans = await extractOpenVocabulary('cat');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.role).toBe('subject.identity');
    expect(spans[0]?.confidence).toBeCloseTo(0.71, 2);
  });

  it('drops spans that do not meet per-label thresholds', async () => {
    const { default: SpanLabelingConfig } = await import('@llm/span-labeling/config/SpanLabelingConfig');
    SpanLabelingConfig.NEURO_SYMBOLIC.GLINER.USE_WORKER = false;
    SpanLabelingConfig.NEURO_SYMBOLIC.GLINER.LABEL_THRESHOLDS = { person: 0.9 };

    const { warmupGliner, extractOpenVocabulary } = await import('@llm/span-labeling/nlp/tier2/gliner');

    await warmupGliner();
    const spans = await extractOpenVocabulary('cat');

    expect(spans).toHaveLength(0);
  });
});
