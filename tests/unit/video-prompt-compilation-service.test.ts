import { describe, expect, it, vi } from 'vitest';
import { VideoPromptCompilationService } from '@services/prompt-optimization/services/VideoPromptCompilationService';
import type { QualityAssessment } from '@services/prompt-optimization/types';
import type { VideoPromptService } from '@services/video-prompt-analysis/VideoPromptService';
import type { QualityAssessmentService } from '@services/prompt-optimization/services/QualityAssessmentService';

const buildQualityAssessment = (score: number): QualityAssessment => ({
  score,
  details: {
    clarity: score,
    specificity: score,
    structure: score,
    completeness: score,
    actionability: score,
  },
  strengths: [],
  weaknesses: [],
});

describe('VideoPromptCompilationService', () => {
  it('keeps generic output when no target model is provided', async () => {
    const videoPromptService = {
      optimizeForModel: vi.fn(),
      detectTargetModel: vi.fn(),
    } as unknown as VideoPromptService;
    const qualityAssessmentService = {
      assessQuality: vi.fn(),
    } as unknown as QualityAssessmentService;

    const service = new VideoPromptCompilationService(
      videoPromptService,
      qualityAssessmentService
    );

    const result = await service.compileOptimizedPrompt({
      operation: 'optimize',
      optimizedPrompt: 'generic optimized prompt',
      mode: 'video',
      qualityAssessment: buildQualityAssessment(82),
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
    const qualityAssessmentService = {
      assessQuality: vi.fn().mockResolvedValue(buildQualityAssessment(95)),
    } as unknown as QualityAssessmentService;

    const service = new VideoPromptCompilationService(
      videoPromptService,
      qualityAssessmentService
    );

    const result = await service.compileOptimizedPrompt({
      operation: 'optimize',
      optimizedPrompt: 'generic optimized prompt',
      targetModel: 'kling',
      mode: 'video',
      qualityAssessment: buildQualityAssessment(82),
    });

    expect(videoPromptService.optimizeForModel).toHaveBeenCalledWith(
      'generic optimized prompt',
      'kling-26'
    );
    expect(result.prompt).toBe('kling-compiled prompt');
    expect(result.metadata?.compiledFor).toBe('kling-26');
  });
});
