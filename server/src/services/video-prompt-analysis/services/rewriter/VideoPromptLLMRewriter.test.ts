
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoPromptLLMRewriter } from './VideoPromptLLMRewriter';
import type { VideoPromptIR } from '../../types';

// Mock GeminiAdapter
const mockGenerateText = vi.fn();
const mockGenerateStructuredOutput = vi.fn();

vi.mock('../../../../clients/adapters/GeminiAdapter', () => {
  return {
    GeminiAdapter: vi.fn().mockImplementation(() => ({
      generateText: mockGenerateText,
      generateStructuredOutput: mockGenerateStructuredOutput,
    })),
  };
});

describe('VideoPromptLLMRewriter', () => {
  let rewriter: VideoPromptLLMRewriter;
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
    rewriter = new VideoPromptLLMRewriter();
  });

  it('should call generateText for runway-gen45', async () => {
    mockGenerateText.mockResolvedValue('Optimized prompt');
    const result = await rewriter.rewrite(baseIr, 'runway-gen45');
    
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Runway Gen-4.5'),
      expect.objectContaining({ maxTokens: 8192 })
    );
    expect(result).toBe('Optimized prompt');
  });

  it('should call generateStructuredOutput for veo-4', async () => {
    const mockJson = { mode: 'generate', subject: { description: 'test', action: 'test' } };
    mockGenerateStructuredOutput.mockResolvedValue(mockJson);
    
    const result = await rewriter.rewrite(baseIr, 'veo-4');
    
    expect(mockGenerateStructuredOutput).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Google Veo 4'),
      expect.any(Object) // Schema
    );
    expect(result).toEqual(mockJson);
  });
});
