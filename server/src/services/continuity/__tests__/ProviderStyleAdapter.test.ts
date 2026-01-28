import { describe, it, expect, vi } from 'vitest';
import { ProviderStyleAdapter } from '../ProviderStyleAdapter';

describe('ProviderStyleAdapter', () => {
  it('prefers native style references when available', () => {
    const adapter = new ProviderStyleAdapter();
    vi.spyOn(adapter, 'getCapabilities').mockReturnValue({
      supportsNativeStyleReference: true,
      supportsNativeCharacterReference: false,
      supportsStartImage: true,
      supportsSeedPersistence: false,
      supportsExtendVideo: false,
      styleReferenceParam: 'style_reference',
    });

    expect(adapter.getContinuityStrategy('runway', 'native')).toEqual({
      type: 'native-style-ref',
      provider: 'runway',
    });

    expect(adapter.getContinuityStrategy('runway', 'style-match')).toEqual({
      type: 'native-style-ref',
      provider: 'runway',
    });
  });

  it('falls back to frame bridge or IP-Adapter when native style is unavailable', () => {
    const adapter = new ProviderStyleAdapter();
    vi.spyOn(adapter, 'getCapabilities').mockReturnValue({
      supportsNativeStyleReference: false,
      supportsNativeCharacterReference: false,
      supportsStartImage: true,
      supportsSeedPersistence: false,
      supportsExtendVideo: false,
    });

    expect(adapter.getContinuityStrategy('replicate', 'frame-bridge')).toEqual({
      type: 'frame-bridge',
    });

    expect(adapter.getContinuityStrategy('replicate', 'style-match')).toEqual({
      type: 'ip-adapter',
    });
  });
});
