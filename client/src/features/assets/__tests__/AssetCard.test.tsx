import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetCard } from '../components/AssetCard';
import type { Asset } from '@shared/types/asset';

const baseAsset: Asset = {
  id: 'asset-1',
  userId: 'user-1',
  type: 'character',
  trigger: '@Ada',
  name: 'Ada Lovelace',
  textDefinition: 'A pioneering programmer',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: 'now',
  updatedAt: 'now',
};

describe('AssetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('does not delete when confirmation is dismissed', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onDelete = vi.fn();

      render(
        <AssetCard
          asset={baseAsset}
          isSelected={false}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByTitle('Delete'));

      expect(onDelete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('does not propagate edit clicks to card selection', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();

      render(
        <AssetCard
          asset={baseAsset}
          isSelected={false}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTitle('Edit'));

      expect(onEdit).toHaveBeenCalledWith(baseAsset);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('renders placeholder when no reference images exist', () => {
      render(
        <AssetCard
          asset={baseAsset}
          isSelected={false}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('Character')).toBeInTheDocument();
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('uses primary thumbnail when available', () => {
      const asset: Asset = {
        ...baseAsset,
        referenceImages: [
          {
            id: 'img-1',
            url: 'full.jpg',
            thumbnailUrl: 'thumb.jpg',
            isPrimary: true,
            metadata: {
              uploadedAt: 'now',
              width: 1,
              height: 1,
              sizeBytes: 100,
            },
          },
        ],
      };

      render(
        <AssetCard
          asset={asset}
          isSelected={false}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'thumb.jpg');
    });
  });

  describe('core behavior', () => {
    it('selects asset when card is clicked', () => {
      const onSelect = vi.fn();

      render(
        <AssetCard
          asset={baseAsset}
          isSelected={false}
          onSelect={onSelect}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Ada Lovelace'));

      expect(onSelect).toHaveBeenCalledWith(baseAsset);
    });

    it('allows character assets to be used in generation', () => {
      const onUse = vi.fn();

      render(
        <AssetCard
          asset={baseAsset}
          isSelected={false}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUseInGeneration={onUse}
        />
      );

      fireEvent.click(screen.getByTitle('Use in generation'));

      expect(onUse).toHaveBeenCalledWith(baseAsset);
    });
  });
});
