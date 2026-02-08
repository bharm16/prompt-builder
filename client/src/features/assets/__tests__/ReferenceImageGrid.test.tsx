import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceImageGrid } from '../components/ReferenceImageGrid';
import type { AssetReferenceImage } from '@shared/types/asset';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

const makeImage = (overrides?: Partial<AssetReferenceImage>): AssetReferenceImage => ({
  id: 'img-1',
  url: 'full.jpg',
  thumbnailUrl: 'thumb.jpg',
  isPrimary: false,
  metadata: {
    uploadedAt: 'now',
    width: 100,
    height: 100,
    sizeBytes: 123,
  },
  ...overrides,
});

describe('ReferenceImageGrid', () => {
  describe('error handling', () => {
    it('does not offer Set primary for the current primary image', () => {
      const images = [makeImage({ isPrimary: true })];

      render(
        <ReferenceImageGrid
          images={images}
          onDelete={vi.fn()}
          onSetPrimary={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Set primary' })).toBeNull();
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders empty state when there are no images', () => {
      render(
        <ReferenceImageGrid
          images={[]}
          onDelete={vi.fn()}
          onSetPrimary={vi.fn()}
        />
      );

      expect(screen.getByText('No reference images yet.')).toBeInTheDocument();
    });

    it('uses full image url when thumbnail is missing', () => {
      const images = [makeImage({ thumbnailUrl: '' })];

      render(
        <ReferenceImageGrid
          images={images}
          onDelete={vi.fn()}
          onSetPrimary={vi.fn()}
        />
      );

      const image = screen.getByRole('presentation');
      expect(image).toHaveAttribute('src', 'full.jpg');
    });
  });

  describe('core behavior', () => {
    it('invokes handlers for delete and set primary actions', () => {
      const onDelete = vi.fn();
      const onSetPrimary = vi.fn();
      const images = [makeImage({ id: 'img-2', isPrimary: false })];

      render(
        <ReferenceImageGrid
          images={images}
          onDelete={onDelete}
          onSetPrimary={onSetPrimary}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Set primary' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onSetPrimary).toHaveBeenCalledWith('img-2');
      expect(onDelete).toHaveBeenCalledWith('img-2');
    });
  });
});
