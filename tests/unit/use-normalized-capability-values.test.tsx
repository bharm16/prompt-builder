import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useNormalizedCapabilityValues } from '@features/prompt-optimizer/hooks/useNormalizedCapabilityValues';
import type { CapabilitiesSchema } from '@shared/capabilities';

const schema: CapabilitiesSchema = {
  provider: 'test',
  model: 'model',
  version: '1',
  fields: {
    mode: {
      type: 'enum',
      values: ['fast', 'quality'],
      default: 'fast',
    },
  },
};

describe('useNormalizedCapabilityValues', () => {
  it('returns generation params when schema is null', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useNormalizedCapabilityValues({
        schema: null,
        generationParams: { mode: 'fast' },
        onChange,
      })
    );

    expect(result.current).toEqual({ mode: 'fast' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange when sanitized values differ', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useNormalizedCapabilityValues({
        schema,
        generationParams: { mode: 'invalid' },
        onChange,
      })
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ mode: 'fast' });
    });

    expect(result.current).toEqual({ mode: 'fast' });
  });
});
