import type { ContinuitySession, ContinuityShot } from './types';
import type { ProviderStyleAdapter } from './ProviderStyleAdapter';

export class AnchorService {
  constructor(private providerAdapter: ProviderStyleAdapter) {}

  assertProviderSupportsContinuity(provider: string, modelId?: string): void {
    const caps = this.providerAdapter.getCapabilities(provider, modelId as any);
    if (caps.supportsStartImage || caps.supportsNativeStyleReference) return;

    throw new Error(`Provider ${provider} does not support continuity (no image input or style reference).`);
  }

  shouldUseSceneProxy(session: ContinuitySession, shot: ContinuityShot): boolean {
    return Boolean(
      session.defaultSettings.useSceneProxy &&
        session.sceneProxy &&
        session.sceneProxy.status === 'ready' &&
        shot.continuityMode === 'style-match'
    );
  }
}
