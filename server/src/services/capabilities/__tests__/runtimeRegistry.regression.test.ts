import { describe, expect, it } from 'vitest';
import { getCapabilitiesRegistry } from '../registry';

describe('runtime capabilities registry regression', () => {
  it('keeps corrected capability fields for sora, veo, luma, and kling models', () => {
    const registry = getCapabilitiesRegistry();

    const sora2 = registry.openai?.['sora-2'];
    const sora2Pro = registry.openai?.['sora-2-pro'];
    const veo = registry.google?.['veo-4'];
    const luma = registry.luma?.['luma-ray3'];
    const kling = registry.kling?.['kling-26'];

    expect(sora2?.fields.guidance).toBeUndefined();
    expect(sora2Pro?.fields.guidance).toBeUndefined();

    expect(veo?.fields.guidance).toBeUndefined();
    expect(veo?.fields.image_input?.default).toBe(true);
    expect(veo?.fields.last_frame?.default).toBe(true);
    expect(veo?.fields.reference_images?.default).toBe(true);
    expect(veo?.fields.extend_video?.default).toBe(true);
    expect(veo?.features?.image_to_video).toBe(true);

    expect(luma?.fields.last_frame?.default).toBe(true);
    expect(kling?.fields.last_frame?.default).toBe(true);
  });
});
