import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useGenerationMediaRefresh } from '@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationMediaRefresh';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';
import { extractStorageObjectPath } from '@/utils/storageUrl';

const loggerChild = vi.hoisted(() => ({
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: vi.fn(),
}));

vi.mock('@/utils/storageUrl', () => ({
  extractStorageObjectPath: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: { child: () => loggerChild },
}));

const mockResolveMediaUrl = vi.mocked(resolveMediaUrl);
const mockExtractStorageObjectPath = vi.mocked(extractStorageObjectPath);

describe('useGenerationMediaRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveMediaUrl.mockResolvedValue({ url: null, source: 'unknown' } as any);
    mockExtractStorageObjectPath.mockReturnValue(null);
  });

  const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
    id: 'gen-1',
    tier: 'draft',
    status: 'completed',
    model: 'wan-2.2',
    prompt: 'Prompt',
    promptVersionId: 'version-1',
    createdAt: 1,
    completedAt: 2,
    mediaType: 'video',
    mediaUrls: ['https://cdn/original.mp4'],
    thumbnailUrl: null,
    error: null,
    ...overrides,
  });

  describe('error handling', () => {
    it('keeps original URLs when asset refresh fails', async () => {
      mockResolveMediaUrl.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn();

      renderHook(() => useGenerationMediaRefresh([createGeneration()], dispatch));

      await waitFor(() => {
        expect(loggerChild.error).toHaveBeenCalled();
      });

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('skips generations without completed media', async () => {
      const dispatch = vi.fn();
      renderHook(() =>
        useGenerationMediaRefresh(
          [createGeneration({ status: 'generating', mediaUrls: [] })],
          dispatch
        )
      );

      await waitFor(() => {
        expect(dispatch).not.toHaveBeenCalled();
        expect(mockResolveMediaUrl).not.toHaveBeenCalled();
      });
    });
  });

  describe('core behavior', () => {
    it('refreshes media URLs using storage paths', async () => {
      mockResolveMediaUrl.mockResolvedValue({
        url: 'https://cdn/updated.mp4',
        source: 'storage',
      } as any);
      const dispatch = vi.fn();

      renderHook(() =>
        useGenerationMediaRefresh(
          [
            createGeneration({
              mediaAssetIds: ['users/path/to/video'],
            }),
          ],
          dispatch
        )
      );

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'UPDATE_GENERATION',
            payload: expect.objectContaining({
              id: 'gen-1',
              updates: { mediaUrls: ['https://cdn/updated.mp4'] },
            }),
          })
        );
      });
    });
  });
});
