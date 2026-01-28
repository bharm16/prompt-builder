import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useGenerationMediaRefresh } from '@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationMediaRefresh';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { storageApi } from '@/api/storageApi';
import { getVideoAssetViewUrl } from '@features/preview/api/previewApi';
import { extractStorageObjectPath, extractVideoContentAssetId } from '@/utils/storageUrl';

const loggerChild = vi.hoisted(() => ({
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/api/storageApi', () => ({
  storageApi: { getViewUrl: vi.fn() },
}));

vi.mock('@features/preview/api/previewApi', () => ({
  getImageAssetViewUrl: vi.fn(),
  getVideoAssetViewUrl: vi.fn(),
}));

vi.mock('@/utils/storageUrl', () => ({
  extractStorageObjectPath: vi.fn(),
  extractVideoContentAssetId: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: { child: () => loggerChild },
}));

const mockGetViewUrl = vi.mocked(storageApi.getViewUrl);
const mockGetVideoAssetViewUrl = vi.mocked(getVideoAssetViewUrl);
const mockExtractStorageObjectPath = vi.mocked(extractStorageObjectPath);
const mockExtractVideoContentAssetId = vi.mocked(extractVideoContentAssetId);

describe('useGenerationMediaRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractStorageObjectPath.mockReturnValue(null);
    mockExtractVideoContentAssetId.mockReturnValue(null);
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
      mockExtractVideoContentAssetId.mockReturnValue('asset-1');
      mockGetVideoAssetViewUrl.mockRejectedValue(new Error('boom'));
      const dispatch = vi.fn();

      renderHook(() => useGenerationMediaRefresh([createGeneration()], dispatch));

      await waitFor(() => {
        expect(loggerChild.warn).toHaveBeenCalled();
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
        expect(mockGetViewUrl).not.toHaveBeenCalled();
      });
    });
  });

  describe('core behavior', () => {
    it('refreshes media URLs using storage paths', async () => {
      mockGetViewUrl.mockResolvedValue({ viewUrl: 'https://cdn/updated.mp4' });
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
