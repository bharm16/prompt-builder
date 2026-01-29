import { describe, it, expect } from 'vitest';
import { buildReplicateInput } from '../replicateProvider';
import type { VideoModelId } from '../../types';

describe('buildReplicateInput', () => {
  it('includes a rounded seed when provided', () => {
    const modelId = 'custom-model' as VideoModelId;
    const input = buildReplicateInput(modelId, 'prompt', {
      aspectRatio: '16:9',
      seed: 42.7,
    });

    expect(input.seed).toBe(43);
  });

  it('preserves a seed of 0', () => {
    const modelId = 'custom-model' as VideoModelId;
    const input = buildReplicateInput(modelId, 'prompt', {
      aspectRatio: '16:9',
      seed: 0,
    });

    expect(input.seed).toBe(0);
  });
});
