import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { useVideoInputCapabilities } from '../useVideoInputCapabilities';

describe('useVideoInputCapabilities', () => {
  it('returns all-false defaults when schema is null', () => {
    const { result } = renderHook(() => useVideoInputCapabilities(null));

    expect(result.current).toEqual({
      supportsStartFrame: false,
      supportsEndFrame: false,
      supportsReferenceImages: false,
      supportsExtendVideo: false,
      maxReferenceImages: 0,
    });
  });

  it('reads boolean support flags from schema defaults', () => {
    const schema: CapabilitiesSchema = {
      provider: 'generic',
      model: 'google/veo-3',
      version: '1',
      fields: {
        image_input: { type: 'bool', default: true },
        last_frame: { type: 'bool', default: true },
        reference_images: { type: 'bool', default: true },
        extend_video: { type: 'bool', default: true },
      },
    };

    const { result } = renderHook(() => useVideoInputCapabilities(schema));

    expect(result.current).toEqual({
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImages: true,
      supportsExtendVideo: true,
      maxReferenceImages: 3,
    });
  });

  it('disables references and max slots when reference_images is false', () => {
    const schema: CapabilitiesSchema = {
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {
        image_input: { type: 'bool', default: true },
        last_frame: { type: 'bool', default: false },
        reference_images: { type: 'bool', default: false },
        extend_video: { type: 'bool', default: false },
      },
    };

    const { result } = renderHook(() => useVideoInputCapabilities(schema));

    expect(result.current.supportsReferenceImages).toBe(false);
    expect(result.current.maxReferenceImages).toBe(0);
  });
});
