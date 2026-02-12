import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetThumbnail } from '@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail';
import type { Asset } from '@shared/types/asset';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: vi.fn(),
}));

const mockUseResolvedMediaUrl = vi.mocked(useResolvedMediaUrl);

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: overrides.id ?? 'asset-1',
  userId: 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? 'hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'hero',
  referenceImages: overrides.referenceImages ?? [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('AssetThumbnail', () => {
  const createResolvedValue = (url: string | null) => ({
    url,
    expiresAt: null,
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue({
      url,
      source: 'raw' as const,
    }),
  });

  beforeEach(() => {
    mockUseResolvedMediaUrl.mockImplementation(({ url }) => createResolvedValue(url ?? null));
  });

  describe('error handling', () => {
    it('invokes onEdit on context menu action', async () => {
      const user = userEvent.setup();
      const onInsert = vi.fn();
      const onEdit = vi.fn();

      render(
        <AssetThumbnail
          asset={createAsset({ trigger: '@hero' })}
          onInsert={onInsert}
          onEdit={onEdit}
        />
      );

      await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button') });

      expect(onEdit).toHaveBeenCalled();
      expect(onInsert).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('prefixes trigger labels with @ when missing', () => {
      render(
        <AssetThumbnail
          asset={createAsset({ trigger: 'style' })}
          onInsert={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      expect(screen.getByText('@style')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders the primary image and triggers insert on click', async () => {
      const user = userEvent.setup();
      const onInsert = vi.fn();
      const onEdit = vi.fn();

      render(
        <AssetThumbnail
          asset={createAsset({
            trigger: '@hero',
            referenceImages: [
              {
                id: 'img-1',
                url: 'full.png',
                thumbnailUrl: 'thumb.png',
                isPrimary: true,
                metadata: {
                  uploadedAt: '2024-01-01T00:00:00Z',
                  width: 100,
                  height: 100,
                  sizeBytes: 123,
                },
              },
            ],
          })}
          onInsert={onInsert}
          onEdit={onEdit}
        />
      );

      const button = screen.getByRole('button');
      const img = button.querySelector('img');

      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('thumb.png');

      await user.click(button);

      expect(onInsert).toHaveBeenCalled();
    });

    it('uses resolved signed thumbnail URL when storage paths are present', () => {
      mockUseResolvedMediaUrl
        .mockReturnValueOnce(createResolvedValue('https://signed.example/thumb.jpg'))
        .mockReturnValueOnce(createResolvedValue('https://signed.example/full.jpg'));

      render(
        <AssetThumbnail
          asset={createAsset({
            trigger: '@hero',
            referenceImages: [
              {
                id: 'img-2',
                url: 'https://broken.example/full.jpg',
                thumbnailUrl: 'https://broken.example/thumb.jpg',
                storagePath: 'users/user-1/assets/asset-1/img-2.jpg',
                thumbnailPath: 'users/user-1/assets/asset-1/img-2_thumb.jpg',
                isPrimary: true,
                metadata: {
                  uploadedAt: '2024-01-01T00:00:00Z',
                  width: 100,
                  height: 100,
                  sizeBytes: 123,
                },
              },
            ],
          })}
          onInsert={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      const image = screen.getByRole('button').querySelector('img');
      expect(image).not.toBeNull();
      expect(image).toHaveAttribute('src', 'https://signed.example/thumb.jpg');
    });
  });
});
