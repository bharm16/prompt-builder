import type {
  ContinuityMode,
  ContinuitySession,
  ContinuityShot,
  ContinuityStrategy,
  ProviderContinuityCapabilities,
  StyleReference,
} from './types';
import { AnchorService } from './AnchorService';
import { ProviderStyleAdapter } from './ProviderStyleAdapter';
import { SeedPersistenceService } from './SeedPersistenceService';

export class ContinuityProviderService {
  constructor(
    private anchorService: AnchorService,
    private providerAdapter: ProviderStyleAdapter,
    private seedService: SeedPersistenceService
  ) {}

  getProviderFromModel(modelId: string): string {
    return this.providerAdapter.getProviderFromModel(modelId);
  }

  getCapabilities(provider: string, modelId: string): ProviderContinuityCapabilities {
    return this.providerAdapter.getCapabilities(provider, modelId);
  }

  getContinuityStrategy(
    provider: string,
    mode: ContinuityMode,
    modelId: string
  ): ContinuityStrategy {
    return this.providerAdapter.getContinuityStrategy(provider, mode, modelId);
  }

  buildGenerationOptions(
    provider: string,
    options: Record<string, unknown>,
    styleReference: StyleReference,
    styleStrength: number
  ): Promise<{ options: Record<string, unknown> }> {
    return this.providerAdapter.buildGenerationOptions(provider, options, styleReference, styleStrength);
  }

  assertProviderSupportsContinuity(provider: string, modelId: string): void {
    this.anchorService.assertProviderSupportsContinuity(provider, modelId);
  }

  shouldUseSceneProxy(
    session: ContinuitySession,
    shot: ContinuityShot,
    mode: ContinuityMode
  ): boolean {
    return this.anchorService.shouldUseSceneProxy(session, shot, mode);
  }

  getInheritedSeed(seedInfo: ContinuityShot['seedInfo'] | undefined, provider: string): number | undefined {
    return this.seedService.getInheritedSeed(seedInfo, provider);
  }

  buildSeedParam(provider: string, seed: number | undefined): Record<string, unknown> {
    return this.seedService.buildSeedParam(provider, seed);
  }

  extractSeed(
    provider: string,
    modelId: string,
    result: Record<string, unknown>
  ): ContinuityShot['seedInfo'] | null {
    return this.seedService.extractSeed(provider, modelId, result);
  }
}
