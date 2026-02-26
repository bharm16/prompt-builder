import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SpanLabelingConfig from '@llm/span-labeling/config/SpanLabelingConfig';
import { VideoPromptAnalyzer } from '@services/video-prompt-analysis/services/analysis/VideoPromptAnalyzer';

const mockExtractSemanticSpans = vi.fn();

vi.mock('@llm/span-labeling/nlp/NlpSpanService', () => ({
  extractSemanticSpans: (...args: unknown[]) => mockExtractSemanticSpans(...args),
}));

describe('VideoPromptAnalyzer GLiNER gating', () => {
  const originalNeuroSymbolicEnabled = SpanLabelingConfig.NEURO_SYMBOLIC.ENABLED;
  const originalGlinerEnabled = SpanLabelingConfig.NEURO_SYMBOLIC.GLINER.ENABLED;

  beforeEach(() => {
    mockExtractSemanticSpans.mockReset();
    mockExtractSemanticSpans.mockResolvedValue({
      spans: [],
      stats: {},
    });
  });

  afterEach(() => {
    (SpanLabelingConfig.NEURO_SYMBOLIC as { ENABLED: boolean }).ENABLED = originalNeuroSymbolicEnabled;
    (SpanLabelingConfig.NEURO_SYMBOLIC.GLINER as { ENABLED: boolean }).ENABLED = originalGlinerEnabled;
    delete process.env.PROMPT_OUTPUT_ONLY;
  });

  it('keeps GLiNER off when neuro-symbolic mode is disabled', async () => {
    (SpanLabelingConfig.NEURO_SYMBOLIC as { ENABLED: boolean }).ENABLED = false;
    (SpanLabelingConfig.NEURO_SYMBOLIC.GLINER as { ENABLED: boolean }).ENABLED = true;

    const analyzer = new VideoPromptAnalyzer();
    (analyzer as unknown as {
      llmExtractor: { tryAnalyze: (text: string) => Promise<null> };
    }).llmExtractor = {
      tryAnalyze: vi.fn().mockResolvedValue(null),
    };

    await analyzer.analyze('A dramatic low-angle shot of a racing car at night');

    expect(mockExtractSemanticSpans).toHaveBeenCalledWith(expect.any(String), {
      useGliner: false,
    });
  });

  it('enables GLiNER only when both neuro-symbolic and GLiNER flags are enabled', async () => {
    (SpanLabelingConfig.NEURO_SYMBOLIC as { ENABLED: boolean }).ENABLED = true;
    (SpanLabelingConfig.NEURO_SYMBOLIC.GLINER as { ENABLED: boolean }).ENABLED = true;

    const analyzer = new VideoPromptAnalyzer();
    (analyzer as unknown as {
      llmExtractor: { tryAnalyze: (text: string) => Promise<null> };
    }).llmExtractor = {
      tryAnalyze: vi.fn().mockResolvedValue(null),
    };

    await analyzer.analyze('A dramatic low-angle shot of a racing car at night');

    expect(mockExtractSemanticSpans).toHaveBeenCalledWith(expect.any(String), {
      useGliner: true,
    });
  });
});
