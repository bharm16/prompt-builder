import { describe, expect, it, vi } from 'vitest';
import { buildLumaKeyframes, generateLumaVideo } from '../lumaProvider';
import type { VideoGenerationOptions } from '../../types';

describe('buildLumaKeyframes', () => {
  it('returns undefined when no start or end image is provided', () => {
    expect(buildLumaKeyframes({} as VideoGenerationOptions)).toBeUndefined();
  });

  it('builds frame0 when only startImage is present', () => {
    expect(buildLumaKeyframes({ startImage: 'https://example.com/start.png' })).toEqual({
      frame0: { type: 'image', url: 'https://example.com/start.png' },
    });
  });

  it('builds frame1 when only endImage is present', () => {
    expect(buildLumaKeyframes({ endImage: 'https://example.com/end.png' })).toEqual({
      frame1: { type: 'image', url: 'https://example.com/end.png' },
    });
  });

  it('builds both frame0 and frame1 when both images are present', () => {
    expect(
      buildLumaKeyframes({
        startImage: 'https://example.com/start.png',
        endImage: 'https://example.com/end.png',
      })
    ).toEqual({
      frame0: { type: 'image', url: 'https://example.com/start.png' },
      frame1: { type: 'image', url: 'https://example.com/end.png' },
    });
  });
});

describe('generateLumaVideo', () => {
  it('logs hasEndImage and interpolation mode when both start/end are set', async () => {
    const create = vi.fn(async () => ({
      id: 'gen-1',
      state: 'completed',
      assets: { video: 'https://videos.example.com/luma.mp4' },
    }));
    const get = vi.fn();
    const luma = {
      generations: { create, get },
    } as unknown as import('lumaai').LumaAI;

    const log = { info: vi.fn() };

    const result = await generateLumaVideo(
      luma,
      'prompt',
      {
        startImage: 'https://images.example.com/start.png',
        endImage: 'https://images.example.com/end.png',
        aspectRatio: '16:9',
      },
      log
    );

    expect(result).toBe('https://videos.example.com/luma.mp4');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        aspect_ratio: '16:9',
        keyframes: {
          frame0: { type: 'image', url: 'https://images.example.com/start.png' },
          frame1: { type: 'image', url: 'https://images.example.com/end.png' },
        },
      })
    );
    expect(log.info).toHaveBeenCalledWith(
      'Luma generation started',
      expect.objectContaining({
        generationId: 'gen-1',
        hasStartImage: true,
        hasEndImage: true,
        mode: 'interpolation',
      })
    );
  });
});
