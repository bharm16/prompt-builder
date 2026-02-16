import { describe, expect, it, vi } from 'vitest';
import type { VideoTier } from '@components/ToolSidebar/types';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { applyGenerationReuse } from '@features/prompt-optimizer/PromptCanvas/utils/reuseGeneration';

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'render',
  status: 'completed',
  model: 'sora-2',
  prompt: 'Cinematic test prompt',
  promptVersionId: 'v1',
  createdAt: 1000,
  completedAt: 2000,
  mediaType: 'video',
  mediaUrls: ['https://example.com/video.mp4'],
  ...overrides,
});

describe('PromptCanvas generation reuse', () => {
  it('loads prompt and core settings from generation settings snapshot', () => {
    const onInputPromptChange = vi.fn();
    const onResetResultsForEditing = vi.fn();
    const setSelectedModel = vi.fn();
    const setVideoTier = vi.fn();
    const setGenerationParams = vi.fn();

    const reused = applyGenerationReuse(
      createGeneration({
        prompt: '  Snowy mountain flythrough  ',
        generationSettings: {
          selectedModel: 'veo-3-fast',
          videoTier: 'draft',
          aspectRatio: '9:16',
          duration: 6,
          fps: 24,
          generationParams: {
            motion_strength: 0.4,
          },
        },
      }),
      {
        onInputPromptChange,
        onResetResultsForEditing,
        setSelectedModel,
        setVideoTier: setVideoTier as (tier: VideoTier) => void,
        setGenerationParams,
      }
    );

    expect(reused).toBe(true);
    expect(onInputPromptChange).toHaveBeenCalledWith('Snowy mountain flythrough');
    expect(onResetResultsForEditing).toHaveBeenCalledTimes(1);
    expect(setSelectedModel).toHaveBeenCalledWith('veo-3-fast');
    expect(setVideoTier).toHaveBeenCalledWith('draft');
    expect(setGenerationParams).toHaveBeenCalledWith({
      motion_strength: 0.4,
      aspect_ratio: '9:16',
      duration_s: 6,
      fps: 24,
    });
  });

  it('falls back to generation metadata and ignores non-reusable tiers', () => {
    const setSelectedModel = vi.fn();
    const setVideoTier = vi.fn();
    const setGenerationParams = vi.fn();

    applyGenerationReuse(
      createGeneration({
        model: 'wan-2.2',
        aspectRatio: '16:9',
        duration: 5,
        fps: 30,
        generationSettings: {
          videoTier: 'preview' as unknown as VideoTier,
        },
      }),
      {
        onInputPromptChange: vi.fn(),
        setSelectedModel,
        setVideoTier: setVideoTier as (tier: VideoTier) => void,
        setGenerationParams,
      }
    );

    expect(setSelectedModel).toHaveBeenCalledWith('wan-2.2');
    expect(setVideoTier).not.toHaveBeenCalled();
    expect(setGenerationParams).toHaveBeenCalledWith({
      aspect_ratio: '16:9',
      duration_s: 5,
      fps: 30,
    });
  });

  it('does not mutate editor state when prompt is empty', () => {
    const onInputPromptChange = vi.fn();
    const onResetResultsForEditing = vi.fn();
    const setSelectedModel = vi.fn();
    const setVideoTier = vi.fn();
    const setGenerationParams = vi.fn();

    const reused = applyGenerationReuse(
      createGeneration({
        prompt: '   ',
      }),
      {
        onInputPromptChange,
        onResetResultsForEditing,
        setSelectedModel,
        setVideoTier: setVideoTier as (tier: VideoTier) => void,
        setGenerationParams,
      }
    );

    expect(reused).toBe(false);
    expect(onInputPromptChange).not.toHaveBeenCalled();
    expect(onResetResultsForEditing).not.toHaveBeenCalled();
    expect(setSelectedModel).not.toHaveBeenCalled();
    expect(setVideoTier).not.toHaveBeenCalled();
    expect(setGenerationParams).not.toHaveBeenCalled();
  });
});
