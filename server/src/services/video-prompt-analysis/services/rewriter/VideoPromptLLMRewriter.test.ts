
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoPromptLLMRewriter } from './VideoPromptLLMRewriter';

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

  beforeEach(() => {
    vi.clearAllMocks();
    rewriter = new VideoPromptLLMRewriter();
  });

  it('should call generateText for runway-gen45', async () => {
    mockGenerateText.mockResolvedValue('Optimized prompt');
    const result = await rewriter.rewrite('test input', 'runway-gen45');
    
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Runway Gen-4.5'),
      expect.objectContaining({ maxTokens: 1024 })
    );
    expect(result).toBe('Optimized prompt');
  });

  it('should call generateStructuredOutput for veo-4', async () => {
    const mockJson = { mode: 'generate', subject: { description: 'test', action: 'test' } };
    mockGenerateStructuredOutput.mockResolvedValue(mockJson);
    
    const result = await rewriter.rewrite('test input', 'veo-4');
    
    expect(mockGenerateStructuredOutput).toHaveBeenCalledWith(
      expect.stringContaining('INSTRUCTIONS for Google Veo 4'),
      expect.any(Object) // Schema
    );
    expect(result).toEqual(mockJson);
  });
});
