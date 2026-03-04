import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPromptLLMRewriter } from './VideoPromptLLMRewriter';
import type { VideoPromptIR } from '../../types';
import type { VideoPromptLlmGateway } from '../llm/VideoPromptLlmGateway';

describe('VideoPromptLLMRewriter', () => {
  let rewriter: VideoPromptLLMRewriter;
  const mockGateway: VideoPromptLlmGateway = {
    extractIr: vi.fn(),
    rewriteStructured: vi.fn(),
    rewriteText: vi.fn(),
  };

  const baseIr: VideoPromptIR = {
    subjects: [{ text: 'test subject', attributes: [] }],
    actions: ['test action'],
    camera: { movements: [] },
    environment: { setting: 'test setting', lighting: [] },
    audio: {},
    meta: { mood: [], style: [] },
    technical: {},
    raw: 'test input',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rewriter = new VideoPromptLLMRewriter(mockGateway);
  });

  it('routes text strategy rewrites through gateway', async () => {
    vi.mocked(mockGateway.rewriteText).mockResolvedValue('Optimized prompt');

    const result = await rewriter.rewrite(baseIr, 'runway-gen45');

    expect(mockGateway.rewriteText).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Runway Gen-4.5')
    );
    expect(result).toBe('Optimized prompt');
  });

  it('routes Veo rewrites through text gateway', async () => {
    vi.mocked(mockGateway.rewriteText).mockResolvedValue('Cinematic veo prose output');

    const result = await rewriter.rewrite(baseIr, 'veo-3');

    expect(mockGateway.rewriteText).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Google Veo 3')
    );
    expect(result).toEqual('Cinematic veo prose output');
  });

  it('throws when gateway dependency is unavailable', async () => {
    const unavailableGatewayRewriter = new VideoPromptLLMRewriter(null);

    await expect(unavailableGatewayRewriter.rewrite(baseIr, 'runway-gen45')).rejects.toThrow(
      'Video prompt LLM gateway unavailable'
    );
  });
});
