import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmIrExtractor } from './LlmIrExtractor';
import type { VideoPromptLlmGateway } from '../llm/VideoPromptLlmGateway';

describe('LlmIrExtractor', () => {
  const gateway: VideoPromptLlmGateway = {
    extractIr: vi.fn(),
    rewriteStructured: vi.fn(),
    rewriteText: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the gateway for structured IR extraction', async () => {
    vi.mocked(gateway.extractIr).mockResolvedValue({
      narrative: 'A runner crosses a rainy city street',
      subjects: ['runner'],
      actions: ['crosses'],
      camera: { movements: ['dolly in'] },
      environment: { setting: 'city street', lighting: ['moody'] },
      meta: { style: ['cinematic'], mood: ['tense'] },
    });

    const extractor = new LlmIrExtractor(gateway);
    const ir = await extractor.tryAnalyze('runner in rain');

    expect(gateway.extractIr).toHaveBeenCalledWith(
      expect.stringContaining('runner in rain'),
      expect.objectContaining({ type: 'object' })
    );
    expect(ir).not.toBeNull();
    expect(ir?.raw).toBe('A runner crosses a rainy city street');
    expect(ir?.subjects[0]?.text).toBe('runner');
    expect(ir?.actions).toContain('crosses');
  });

  it('returns null when gateway is unavailable', async () => {
    const extractor = new LlmIrExtractor(null);

    await expect(extractor.tryAnalyze('test prompt')).resolves.toBeNull();
  });

  it('returns null when gateway call fails', async () => {
    vi.mocked(gateway.extractIr).mockRejectedValue(new Error('upstream unavailable'));
    const extractor = new LlmIrExtractor(gateway);

    await expect(extractor.tryAnalyze('test prompt')).resolves.toBeNull();
  });
});
