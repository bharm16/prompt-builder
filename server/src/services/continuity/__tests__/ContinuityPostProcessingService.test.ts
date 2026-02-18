import { describe, expect, it, vi } from 'vitest';
import { ContinuityPostProcessingService } from '../ContinuityPostProcessingService';

const mockGrading = {
  matchPalette: vi.fn().mockResolvedValue({ gradedUrl: 'graded.mp4' }),
  matchImagePalette: vi.fn().mockResolvedValue({ gradedUrl: 'graded.png' }),
};

const mockQualityGate = {
  evaluate: vi.fn().mockResolvedValue({ passed: true, styleScore: 0.85 }),
};

const mockSceneProxy = {
  renderFromProxy: vi.fn().mockResolvedValue({ renderUrl: 'render.png' }),
  createProxyFromVideo: vi.fn().mockResolvedValue({
    id: 'proxy-1',
    proxyType: 'depth-parallax',
    referenceFrameUrl: 'frame.png',
    status: 'ready',
  }),
};

function buildService(): ContinuityPostProcessingService {
  return new ContinuityPostProcessingService(
    mockGrading as unknown as ConstructorParameters<typeof ContinuityPostProcessingService>[0],
    mockQualityGate as unknown as ConstructorParameters<typeof ContinuityPostProcessingService>[1],
    mockSceneProxy as unknown as ConstructorParameters<typeof ContinuityPostProcessingService>[2]
  );
}

describe('ContinuityPostProcessingService', () => {
  it('delegates matchPalette to GradingService', async () => {
    const service = buildService();
    const result = await service.matchPalette('asset-1', 'https://example.com/ref.png');
    expect(mockGrading.matchPalette).toHaveBeenCalledWith('asset-1', 'https://example.com/ref.png');
    expect(result).toEqual({ gradedUrl: 'graded.mp4' });
  });

  it('delegates matchImagePalette to GradingService', async () => {
    const service = buildService();
    const result = await service.matchImagePalette('user-1', 'https://example.com/img.png', 'https://example.com/ref.png');
    expect(mockGrading.matchImagePalette).toHaveBeenCalledWith('user-1', 'https://example.com/img.png', 'https://example.com/ref.png');
    expect(result).toEqual({ gradedUrl: 'graded.png' });
  });

  it('delegates evaluateQuality to QualityGateService', async () => {
    const service = buildService();
    const payload = {
      userId: 'user-1',
      generatedVideoUrl: 'https://example.com/gen.mp4',
      referenceImageUrl: 'https://example.com/ref.png',
    };
    const result = await service.evaluateQuality(payload);
    expect(mockQualityGate.evaluate).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ passed: true, styleScore: 0.85 });
  });

  it('delegates renderSceneProxy to SceneProxyService', async () => {
    const proxy = {
      id: 'proxy-1',
      proxyType: 'depth-parallax' as const,
      referenceFrameUrl: 'frame.png',
      status: 'ready' as const,
      sourceVideoId: 'video-1',
      createdAt: new Date(),
    };
    const camera = { yaw: 10, pitch: 5 };

    const service = buildService();
    const result = await service.renderSceneProxy('user-1', proxy, 'shot-1', camera);

    expect(mockSceneProxy.renderFromProxy).toHaveBeenCalledWith(
      'user-1',
      proxy,
      'shot-1',
      { yaw: 10, pitch: 5 }
    );
    expect(result).toEqual({ renderUrl: 'render.png' });
  });

  it('throws when renderSceneProxy called with null proxy', () => {
    const service = buildService();
    expect(() => service.renderSceneProxy('user-1', undefined, 'shot-1', undefined)).toThrow(
      'Scene proxy is not available'
    );
  });

  it('normalizes camera by omitting undefined fields', async () => {
    const proxy = {
      id: 'proxy-1',
      proxyType: 'depth-parallax' as const,
      referenceFrameUrl: 'frame.png',
      status: 'ready' as const,
      sourceVideoId: 'video-1',
      createdAt: new Date(),
    };

    const service = buildService();
    await service.renderSceneProxy('user-1', proxy, 'shot-1', { yaw: 15, pitch: undefined, roll: undefined, dolly: 2 });

    expect(mockSceneProxy.renderFromProxy).toHaveBeenCalledWith(
      'user-1',
      proxy,
      'shot-1',
      { yaw: 15, dolly: 2 }
    );
  });

  it('delegates createSceneProxyFromVideo to SceneProxyService', async () => {
    const service = buildService();
    const result = await service.createSceneProxyFromVideo('user-1', 'video-1', 'https://example.com/video.mp4');

    expect(mockSceneProxy.createProxyFromVideo).toHaveBeenCalledWith('user-1', 'video-1', 'https://example.com/video.mp4');
    expect(result).toHaveProperty('proxyType', 'depth-parallax');
  });
});
