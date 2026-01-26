import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetPopover } from '@features/prompt-optimizer/components/DetectedAssets/AssetPopover';
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

describe('AssetPopover', () => {
  describe('error handling', () => {
    it('falls back to the config label when no images are present', () => {
      render(<AssetPopover asset={createAsset({ type: 'style', name: 'My Style' })} />);

      expect(screen.getByText('Style')).toBeInTheDocument();
      expect(screen.getByText('@hero')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('shows face embedding status for character assets', () => {
      render(
        <AssetPopover asset={createAsset({ faceEmbedding: 'vector' })} />
      );

      expect(screen.getByText('Face embedding ready')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders edit button when onEdit is provided', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(<AssetPopover asset={createAsset()} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: 'Edit Asset' }));
      expect(onEdit).toHaveBeenCalled();
    });
  });
});
