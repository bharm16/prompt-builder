import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useCapabilities } from '@features/prompt-optimizer/hooks/useCapabilities';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { capabilitiesApi } from '@/services';

vi.mock('@/services', () => ({
  capabilitiesApi: {
    getCapabilities: vi.fn(),
  },
}));

const mockCapabilitiesApi = vi.mocked(capabilitiesApi);

describe('useCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads schema and resolves target label', async () => {
    const schema: CapabilitiesSchema = {
      provider: 'test',
      model: 'model-a',
      version: '1',
      fields: {},
    };

    mockCapabilitiesApi.getCapabilities.mockResolvedValue(schema);

    const { result } = renderHook(() => useCapabilities('model-a'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.schema).toEqual(schema);
    expect(result.current.target.model).toBe('model-a');
  });

  it('returns error when API call fails', async () => {
    mockCapabilitiesApi.getCapabilities.mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useCapabilities('model-a'));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed');
    });
  });

  it('does not fetch when disabled', async () => {
    const { result } = renderHook(() => useCapabilities('model-a', { enabled: false }));

    expect(result.current.isLoading).toBe(false);
    expect(mockCapabilitiesApi.getCapabilities).not.toHaveBeenCalled();
  });
});
