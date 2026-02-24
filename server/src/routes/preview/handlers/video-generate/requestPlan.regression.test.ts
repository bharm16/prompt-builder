import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildVideoRequestPlan } from './requestPlan';

const { normalizeGenerationParamsMock } = vi.hoisted(() => ({
  normalizeGenerationParamsMock: vi.fn(),
}));

vi.mock('@routes/optimize/normalizeGenerationParams', () => ({
  normalizeGenerationParams: normalizeGenerationParamsMock,
}));

describe('requestPlan regression', () => {
  beforeEach(() => {
    normalizeGenerationParamsMock.mockReset();
  });

  it('preserves seed and 4k resolution, and accepts 6-second duration', () => {
    normalizeGenerationParamsMock.mockReturnValue({
      normalizedGenerationParams: {
        duration_s: 6,
        fps: 24,
        resolution: '4k',
        seed: 123,
      },
    });

    const result = buildVideoRequestPlan({
      generationParams: {},
      model: 'veo-4',
      operation: 'generateVideoPreview',
      requestId: 'req-1',
      userId: 'user-1',
      costModel: 'google/veo-3',
      cleanedPrompt: 'A prompt',
      faceSwapAlreadyApplied: false,
      swappedImageUrl: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected plan to succeed');
    }

    expect(result.value.options.seconds).toBe('6');
    expect(result.value.options.size).toBe('4k');
    expect(result.value.options.seed).toBe(123);
  });

  it('parses numeric strings for duration/fps and supports 5 and 10 second values', () => {
    normalizeGenerationParamsMock.mockReturnValue({
      normalizedGenerationParams: {
        duration_s: '5',
        fps: '30',
        resolution: '1080p',
      },
    });

    const first = buildVideoRequestPlan({
      generationParams: {},
      model: 'kling-26',
      operation: 'generateVideoPreview',
      requestId: 'req-2',
      userId: 'user-1',
      costModel: 'kling-v2-1-master',
      cleanedPrompt: 'A prompt',
      faceSwapAlreadyApplied: false,
      swappedImageUrl: null,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error('Expected plan to succeed');
    }
    expect(first.value.options.seconds).toBe('5');
    expect(first.value.options.fps).toBe(30);

    normalizeGenerationParamsMock.mockReturnValue({
      normalizedGenerationParams: {
        duration_s: '10',
      },
    });

    const second = buildVideoRequestPlan({
      generationParams: {},
      model: 'kling-26',
      operation: 'generateVideoPreview',
      requestId: 'req-3',
      userId: 'user-1',
      costModel: 'kling-v2-1-master',
      cleanedPrompt: 'A prompt',
      faceSwapAlreadyApplied: false,
      swappedImageUrl: null,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error('Expected plan to succeed');
    }
    expect(second.value.options.seconds).toBe('10');
  });
});
