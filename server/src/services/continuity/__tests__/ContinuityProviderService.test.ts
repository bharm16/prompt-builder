import { describe, expect, it, vi } from 'vitest';
import { ContinuityProviderService } from '../ContinuityProviderService';
import type { ContinuitySession, ContinuityShot } from '../types';

const mockAnchorService = {
  assertProviderSupportsContinuity: vi.fn(),
  shouldUseSceneProxy: vi.fn().mockReturnValue(false),
};

const mockProviderAdapter = {
  getProviderFromModel: vi.fn().mockReturnValue('kling'),
  getCapabilities: vi.fn().mockReturnValue({
    supportsNativeStyleReference: true,
    supportsNativeCharacterReference: false,
    supportsStartImage: true,
    supportsSeedPersistence: true,
    supportsExtendVideo: false,
  }),
  getContinuityStrategy: vi.fn().mockReturnValue({ type: 'native-style-ref' }),
  buildGenerationOptions: vi.fn().mockResolvedValue({ options: { styleRef: 'ref-url' } }),
};

const mockSeedService = {
  getInheritedSeed: vi.fn().mockReturnValue(42),
  buildSeedParam: vi.fn().mockReturnValue({ seed: 42 }),
  extractSeed: vi.fn().mockReturnValue({ seed: 42, provider: 'kling', modelId: 'kling-v1', extractedAt: new Date() }),
};

function buildService(): ContinuityProviderService {
  return new ContinuityProviderService(
    mockAnchorService as unknown as ConstructorParameters<typeof ContinuityProviderService>[0],
    mockProviderAdapter as unknown as ConstructorParameters<typeof ContinuityProviderService>[1],
    mockSeedService as unknown as ConstructorParameters<typeof ContinuityProviderService>[2]
  );
}

describe('ContinuityProviderService', () => {
  it('delegates getProviderFromModel to ProviderStyleAdapter', () => {
    const service = buildService();
    const result = service.getProviderFromModel('kling-v1');
    expect(mockProviderAdapter.getProviderFromModel).toHaveBeenCalledWith('kling-v1');
    expect(result).toBe('kling');
  });

  it('delegates getCapabilities to ProviderStyleAdapter', () => {
    const service = buildService();
    const caps = service.getCapabilities('kling', 'kling-v1');
    expect(caps.supportsNativeStyleReference).toBe(true);
    expect(caps.supportsSeedPersistence).toBe(true);
  });

  it('delegates getContinuityStrategy to ProviderStyleAdapter', () => {
    const service = buildService();
    const strategy = service.getContinuityStrategy('kling', 'style-match', 'kling-v1');
    expect(strategy.type).toBe('native-style-ref');
    expect(mockProviderAdapter.getContinuityStrategy).toHaveBeenCalledWith('kling', 'style-match', 'kling-v1');
  });

  it('delegates assertProviderSupportsContinuity to AnchorService', () => {
    const service = buildService();
    service.assertProviderSupportsContinuity('kling', 'kling-v1');
    expect(mockAnchorService.assertProviderSupportsContinuity).toHaveBeenCalledWith('kling', 'kling-v1');
  });

  it('delegates shouldUseSceneProxy to AnchorService', () => {
    const session = { id: 'session-1' } as ContinuitySession;
    const shot = { id: 'shot-1' } as ContinuityShot;
    const service = buildService();
    const result = service.shouldUseSceneProxy(session, shot, 'style-match');
    expect(result).toBe(false);
    expect(mockAnchorService.shouldUseSceneProxy).toHaveBeenCalledWith(session, shot, 'style-match');
  });

  it('delegates getInheritedSeed to SeedPersistenceService', () => {
    const service = buildService();
    const seed = service.getInheritedSeed(undefined, 'kling');
    expect(seed).toBe(42);
    expect(mockSeedService.getInheritedSeed).toHaveBeenCalledWith(undefined, 'kling');
  });

  it('delegates buildSeedParam to SeedPersistenceService', () => {
    const service = buildService();
    const param = service.buildSeedParam('kling', 42);
    expect(param).toEqual({ seed: 42 });
  });

  it('delegates extractSeed to SeedPersistenceService', () => {
    const service = buildService();
    const result = service.extractSeed('kling', 'kling-v1', { seed: 42 });
    expect(result).toBeDefined();
    expect(result?.seed).toBe(42);
  });
});
