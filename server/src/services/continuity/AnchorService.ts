import type { ContinuitySession, ContinuityShot } from './types';
import type { ProviderStyleAdapter } from './ProviderStyleAdapter';
import type { VideoModelId } from '@services/video-generation/types';

export class AnchorService {
  constructor(private providerAdapter: ProviderStyleAdapter) {}

  assertProviderSupportsContinuity(provider: string, modelId?: VideoModelId): void {
    const caps = this.providerAdapter.getCapabilities(provider, modelId);
    if (caps.supportsStartImage || caps.supportsNativeStyleReference) return;

    throw new Error(
      `Provider ${provider} does not support continuity (no image input or style reference). Switch to an eligible provider.`
    );
  }

  shouldUseSceneProxy(
    session: ContinuitySession,
    shot: ContinuityShot,
    continuityModeOverride?: ContinuityShot['continuityMode']
  ): boolean {
    return Boolean(
      session.defaultSettings.useSceneProxy &&
        session.sceneProxy &&
        session.sceneProxy.status === 'ready' &&
        (continuityModeOverride ?? shot.continuityMode) === 'style-match'
    );
  }
}
