import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCapabilities } from '../useCapabilities';

const getCapabilitiesMock = vi.fn();

vi.mock('@/services', () => ({
  capabilitiesApi: {
    getCapabilities: (...args: unknown[]) => getCapabilitiesMock(...args),
  },
}));

describe('useCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads capabilities for supported video models', async () => {
    getCapabilitiesMock.mockResolvedValue({
      provider: 'wan',
      model: 'wan-2.2',
      version: '1',
      fields: {},
    });

    const { result } = renderHook(() => useCapabilities('wan-2.2'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCapabilitiesMock).toHaveBeenCalledWith('wan', 'wan-2.2');
    expect(result.current.schema?.model).toBe('wan-2.2');
    expect(result.current.error).toBeNull();
  });

  it('skips capabilities lookup for flux-kontext image model ids', async () => {
    const { result } = renderHook(() => useCapabilities('flux-kontext'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCapabilitiesMock).not.toHaveBeenCalled();
    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
