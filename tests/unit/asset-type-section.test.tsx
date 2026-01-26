import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetTypeSection } from '@features/prompt-optimizer/components/AssetsSidebar/AssetTypeSection';
import type { Asset } from '@shared/types/asset';

vi.mock('@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail', () => ({
  AssetThumbnail: ({
    asset,
    onInsert,
    onEdit,
  }: {
    asset: Asset;
    onInsert: () => void;
    onEdit: () => void;
  }) => (
    <div data-testid={`asset-${asset.id}`}>
      <button type="button" onClick={onInsert}>Insert</button>
      <button type="button" onClick={onEdit}>Edit</button>
    </div>
  ),
}));

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: overrides.id ?? 'asset-1',
  userId: 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? '@hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'hero',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('AssetTypeSection', () => {
  const onToggle = vi.fn();
  const onInsertTrigger = vi.fn();
  const onCreateAsset = vi.fn();
  const onEditAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('shows empty state and triggers create when expanded and empty', async () => {
      const user = userEvent.setup();
      render(
        <AssetTypeSection
          type="character"
          assets={[]}
          isExpanded
          onToggle={onToggle}
          onInsertTrigger={onInsertTrigger}
          onCreateAsset={onCreateAsset}
          onEditAsset={onEditAsset}
        />
      );

      expect(screen.getByText(/No character assets yet/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Add Character/i }));
      expect(onCreateAsset).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('calls onToggle when the header button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AssetTypeSection
          type="character"
          assets={[]}
          isExpanded={false}
          onToggle={onToggle}
          onInsertTrigger={onInsertTrigger}
          onCreateAsset={onCreateAsset}
          onEditAsset={onEditAsset}
        />
      );

      await user.click(screen.getByRole('button', { name: /character/i }));
      expect(onToggle).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('renders assets and wires insert/edit/create actions', async () => {
      const user = userEvent.setup();
      const hero = createAsset({ id: 'asset-hero', trigger: '@hero' });

      render(
        <AssetTypeSection
          type="character"
          assets={[hero]}
          isExpanded
          onToggle={onToggle}
          onInsertTrigger={onInsertTrigger}
          onCreateAsset={onCreateAsset}
          onEditAsset={onEditAsset}
        />
      );

      expect(screen.getByTestId('asset-asset-hero')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Insert' }));
      expect(onInsertTrigger).toHaveBeenCalledWith('@hero');

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEditAsset).toHaveBeenCalledWith('asset-hero');

      await user.click(screen.getByRole('button', { name: 'Add' }));
      expect(onCreateAsset).toHaveBeenCalled();
    });
  });
});
