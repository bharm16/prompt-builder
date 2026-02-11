import { describe, expect, it } from 'vitest';
import {
  getModelLabel,
  normalizeModelIdForSelection,
} from '../modelLabels';

describe('modelLabels utils', () => {
  it('normalizes known alias ids for model selection', () => {
    expect(normalizeModelIdForSelection('veo-4')).toBe('google/veo-3');
    expect(normalizeModelIdForSelection('veo-3')).toBe('google/veo-3');
    expect(normalizeModelIdForSelection('wan-video/wan-2.5-i2v-fast')).toBe('wan-2.5');
    expect(normalizeModelIdForSelection('kling-26')).toBe('kling-v2-1-master');
  });

  it('returns explicit label override for sora-2-pro', () => {
    expect(getModelLabel('sora-2-pro')).toBe('Sora Pro');
  });

  it('returns same label for canonical/alias model id pairs', () => {
    const aliasLabel = getModelLabel('veo-4');
    const canonicalLabel = getModelLabel('google/veo-3');

    expect(aliasLabel).toBe(canonicalLabel);
  });

  it('falls back to raw model id when label is unknown', () => {
    expect(getModelLabel('custom-model-id')).toBe('custom-model-id');
  });
});
