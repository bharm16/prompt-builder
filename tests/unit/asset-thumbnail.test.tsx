import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetThumbnail } from '@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail';
import type { Asset } from '@shared/types/asset';

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
  });
});
