import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CharactersPanel } from '@components/ToolSidebar/components/panels/CharactersPanel';
import type { Asset } from '@shared/types/asset';

vi.mock('@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail', () => ({
  AssetThumbnail: ({ asset, onInsert, onEdit }: { asset: Asset; onInsert: () => void; onEdit: () => void }) => (
    <div data-testid={`asset-${asset.id}`}>
      <span>{asset.name}</span>
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

describe('CharactersPanel', () => {
  const onInsertTrigger = vi.fn();
  const onEditAsset = vi.fn();
  const onCreateAsset = vi.fn();

  beforeEach(() => {
    onInsertTrigger.mockClear();
    onEditAsset.mockClear();
    onCreateAsset.mockClear();
  });

  describe('error handling', () => {
    it('shows loading spinner when loading', () => {
      const { container } = render(
        <CharactersPanel
          assets={[]}
          characterAssets={[]}
          isLoading
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(container.querySelector('.animate-spin')).not.toBeNull();
      expect(screen.queryByText('No characters yet')).toBeNull();
    });

    it('shows empty state and triggers create when no characters exist', async () => {
      const user = userEvent.setup();
      render(
        <CharactersPanel
          assets={[]}
          characterAssets={[]}
          isLoading={false}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(screen.getByText('No characters yet')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Create character' }));
      expect(onCreateAsset).toHaveBeenCalledWith('character');
    });
  });

  describe('edge cases', () => {
    it('falls back to filtering assets when characterAssets is empty', async () => {
      const user = userEvent.setup();
      const hero = createAsset({ id: 'asset-hero', trigger: '@hero', name: 'Hero' });
      const style = createAsset({ id: 'asset-style', type: 'style', name: 'Style', trigger: '@style' });

      render(
        <CharactersPanel
          assets={[hero, style]}
          characterAssets={[]}
          isLoading={false}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(screen.getByTestId('asset-asset-hero')).toBeInTheDocument();
      expect(screen.queryByTestId('asset-asset-style')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Insert' }));
      expect(onInsertTrigger).toHaveBeenCalledWith('@hero');

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEditAsset).toHaveBeenCalledWith('asset-hero');
    });
  });

  describe('core behavior', () => {
    it('renders provided characterAssets list when present', () => {
      const hero = createAsset({ id: 'asset-hero', name: 'Hero' });
      const alt = createAsset({ id: 'asset-alt', name: 'Alt Hero' });

      render(
        <CharactersPanel
          assets={[hero]}
          characterAssets={[alt]}
          isLoading={false}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(screen.getByTestId('asset-asset-alt')).toBeInTheDocument();
      expect(screen.queryByTestId('asset-asset-hero')).toBeNull();
    });
  });
});
