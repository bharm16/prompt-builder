import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useModelRegistry } from '@features/prompt-optimizer/hooks/useModelRegistry';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { capabilitiesApi } from '@/services';
import { AI_MODEL_LABELS } from '@features/prompt-optimizer/components/constants';

vi.mock('@/services', () => ({
  capabilitiesApi: {
    getRegistry: vi.fn(),
    getVideoAvailability: vi.fn(),
  },
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({ warn: vi.fn(), error: vi.fn() }),
  },
}));

const mockCapabilitiesApi = vi.mocked(capabilitiesApi);

describe('useModelRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns models from registry and applies availability filter', async () => {
    const schema: CapabilitiesSchema = {
      provider: 'openai',
      model: 'sora-2',
      version: '1',
      fields: {},
    };

    mockCapabilitiesApi.getRegistry.mockResolvedValue({
      openai: { 'sora-2': schema },
      generic: { 'other': schema },
    });

    mockCapabilitiesApi.getVideoAvailability.mockResolvedValue({
      availableModels: ['sora-2'],
    });

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toEqual([
      { id: 'sora-2', label: AI_MODEL_LABELS['sora-2'], provider: 'openai' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('falls back to registry models when availability is empty', async () => {
    const schema: CapabilitiesSchema = {
      provider: 'kling',
      model: 'kling-26',
      version: '1',
      fields: {},
    };

    mockCapabilitiesApi.getRegistry.mockResolvedValue({
      kling: { 'kling-26': schema },
    });

    mockCapabilitiesApi.getVideoAvailability.mockResolvedValue({
      availableModels: [],
    });

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.models.length).toBe(1);
    });

    expect(result.current.models[0]).toEqual({
      id: 'kling-26',
      label: AI_MODEL_LABELS['kling-26'],
      provider: 'kling',
    });
  });

  it('falls back to default models on registry error', async () => {
    mockCapabilitiesApi.getRegistry.mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useModelRegistry());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed');
    });

    expect(result.current.models.length).toBeGreaterThan(0);
  });
});
