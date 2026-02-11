import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_MODEL_IDS } from '@/config/videoModels';

const {
  mockCapabilitiesApi,
} = vi.hoisted(() => ({
  mockCapabilitiesApi: {
    getRegistry: vi.fn(),
    getVideoAvailability: vi.fn(),
  },
}));

vi.mock('@/services', () => ({
  capabilitiesApi: mockCapabilitiesApi,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { useModelRegistry } from '../useModelRegistry';

describe('useModelRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flattens registry and applies availability filtering', async () => {
    mockCapabilitiesApi.getRegistry.mockResolvedValue({
      openai: {
        'sora-2': { modes: ['video'] },
      },
      google: {
        'veo-4': { modes: ['video'] },
      },
      generic: {
        helper: { modes: ['text'] },
      },
    });
    mockCapabilitiesApi.getVideoAvailability.mockResolvedValue({
      availableModels: ['sora-2'],
    });

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.models).toEqual([
        {
          id: 'sora-2',
          label: 'Sora',
          provider: 'openai',
        },
      ]);
    });
    expect(result.current.error).toBeNull();
  });

  it('uses full registry list when availability has no matching models', async () => {
    mockCapabilitiesApi.getRegistry.mockResolvedValue({
      openai: {
        'sora-2': { modes: ['video'] },
      },
      google: {
        'veo-4': { modes: ['video'] },
      },
    });
    mockCapabilitiesApi.getVideoAvailability.mockResolvedValue({
      availableCapabilityModels: ['nonexistent-model'],
      availableModels: ['nonexistent-model'],
    });

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.models.map((model) => model.id)).toEqual(['sora-2', 'veo-4']);
    });
  });

  it('falls back to static model list when registry fetch fails', async () => {
    mockCapabilitiesApi.getRegistry.mockRejectedValue(new Error('Registry unavailable'));

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Registry unavailable');
      expect(result.current.models).toHaveLength(AI_MODEL_IDS.length);
    });

    expect(result.current.models.some((model) => model.id === 'sora-2')).toBe(true);
    expect(result.current.models.every((model) => typeof model.label === 'string' && model.label.length > 0)).toBe(true);
  });
});
