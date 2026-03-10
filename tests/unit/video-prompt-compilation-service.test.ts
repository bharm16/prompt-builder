import { describe, expect, it, vi } from 'vitest';
import { VideoPromptCompilationService } from '@services/prompt-optimization/services/VideoPromptCompilationService';
import type { VideoPromptService } from '@services/video-prompt-analysis/VideoPromptService';

describe('VideoPromptCompilationService', () => {
  it('keeps generic output when no target model is provided', async () => {
    const videoPromptService = {
      optimizeForModel: vi.fn(),
      detectTargetModel: vi.fn(),
    } as unknown as VideoPromptService;
    const service = new VideoPromptCompilationService(videoPromptService);

    const result = await service.compileOptimizedPrompt({
      operation: 'optimize',
      optimizedPrompt: 'generic optimized prompt',
      mode: 'video',
    });

    expect(result).toEqual({
      prompt: 'generic optimized prompt',
      metadata: null,
    });
    expect(videoPromptService.optimizeForModel).not.toHaveBeenCalled();
    expect(videoPromptService.detectTargetModel).not.toHaveBeenCalled();
  });

  it('compiles when an explicit target model is provided', async () => {
    const videoPromptService = {
      optimizeForModel: vi.fn().mockResolvedValue({
        prompt: 'kling-compiled prompt',
        metadata: { phases: [] },
      }),
      detectTargetModel: vi.fn(),
    } as unknown as VideoPromptService;
    const service = new VideoPromptCompilationService(videoPromptService);

    const result = await service.compileOptimizedPrompt({
      operation: 'optimize',
      optimizedPrompt: 'generic optimized prompt',
      targetModel: 'kling',
      mode: 'video',
    });

    expect(videoPromptService.optimizeForModel).toHaveBeenCalledWith(
      'generic optimized prompt',
      'kling-2.1'
    );
    expect(result.prompt).toBe('kling-compiled prompt');
    expect(result.metadata).toMatchObject({
      compiledFor: 'kling-2.1',
      normalizedModelId: 'kling-2.1',
      genericPrompt: 'generic optimized prompt',
    });
    expect(result.metadata).not.toHaveProperty('compilationQuality');
    expect(result.metadata).not.toHaveProperty('compilationWarning');
  });

  it('keeps successful terse compilations instead of falling back to the generic prompt', async () => {
    const videoPromptService = {
      optimizeForModel: vi.fn().mockResolvedValue({
        prompt: 'Tabby cat walks along a sandy beach at golden hour.',
        metadata: { phases: [{ changes: ['trimmed for wan'] }] },
      }),
      detectTargetModel: vi.fn(),
    } as unknown as VideoPromptService;
    const service = new VideoPromptCompilationService(videoPromptService);

    const result = await service.compileOptimizedPrompt({
      operation: 'optimize',
      optimizedPrompt: 'A much longer generic optimized prompt with many details and camera controls.',
      targetModel: 'wan',
      mode: 'video',
    });

    expect(result.prompt).toBe('Tabby cat walks along a sandy beach at golden hour.');
    expect(result.metadata?.compiledFor).toBe('wan-2.2');
  });
});
