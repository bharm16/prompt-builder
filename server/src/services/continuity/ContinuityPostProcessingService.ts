import type { GradingService } from './GradingService';
import type { QualityGateService } from './QualityGateService';
import type { SceneProxyService } from './SceneProxyService';
import type { ContinuitySession } from './types';

export class ContinuityPostProcessingService {
  constructor(
    private grading: GradingService,
    private qualityGate: QualityGateService,
    private sceneProxy: SceneProxyService
  ) {}

  matchPalette(assetId: string, referenceUrl: string): ReturnType<GradingService['matchPalette']> {
    return this.grading.matchPalette(assetId, referenceUrl);
  }

  matchImagePalette(
    userId: string,
    imageUrl: string,
    referenceUrl: string
  ): ReturnType<GradingService['matchImagePalette']> {
    return this.grading.matchImagePalette(userId, imageUrl, referenceUrl);
  }

  evaluateQuality(payload: Parameters<QualityGateService['evaluate']>[0]): ReturnType<QualityGateService['evaluate']> {
    return this.qualityGate.evaluate(payload);
  }

  renderSceneProxy(
    userId: string,
    proxy: ContinuitySession['sceneProxy'],
    shotId: string,
    camera: ContinuitySession['shots'][number]['camera']
  ): ReturnType<SceneProxyService['renderFromProxy']> {
    if (!proxy) {
      throw new Error('Scene proxy is not available');
    }
    return this.sceneProxy.renderFromProxy(userId, proxy, shotId, camera);
  }

  createSceneProxyFromVideo(
    userId: string,
    videoId: string,
    videoUrl: string
  ): ReturnType<SceneProxyService['createProxyFromVideo']> {
    return this.sceneProxy.createProxyFromVideo(userId, videoId, videoUrl);
  }
}
