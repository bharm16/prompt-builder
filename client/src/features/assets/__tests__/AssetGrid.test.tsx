import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetGrid } from '../components/AssetGrid';
import type { Asset } from '@shared/types/asset';

vi.mock('../components/AssetCard', () => ({
  default: (props: any) => (
    <button
      type="button"
      data-testid={`asset-${props.asset.id}`}
      data-selected={props.isSelected}
      onClick={() => props.onSelect(props.asset)}
    >
      {props.asset.name}
    </button>
  ),
}));

const assets: Asset[] = [
  {
    id: 'a1',
    userId: 'u1',
    type: 'character',
    trigger: '@Ada',
    name: 'Ada',
    textDefinition: 'Text',
    referenceImages: [],
    usageCount: 0,
    lastUsedAt: null,
    createdAt: 'now',
    updatedAt: 'now',
  },
  {
    id: 'a2',
    userId: 'u1',
    type: 'style',
    trigger: '@Neo',
    name: 'Neo',
    textDefinition: 'Style',
    referenceImages: [],
    usageCount: 0,
    lastUsedAt: null,
    createdAt: 'now',
    updatedAt: 'now',
  },
];

describe('AssetGrid', () => {
  describe('error handling', () => {
    it('does not mark selection when selected asset is missing from list', () => {
      render(
        <AssetGrid
          assets={assets}
          selectedAsset={{ ...assets[0], id: 'missing' }}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByTestId('asset-a1')).toHaveAttribute('data-selected', 'false');
      expect(screen.getByTestId('asset-a2')).toHaveAttribute('data-selected', 'false');
    });
  });

  describe('edge cases', () => {
    it('renders no cards when asset list is empty', () => {
      render(
        <AssetGrid
          assets={[]}
          selectedAsset={null}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('core behavior', () => {
    it('marks the selected asset based on id', () => {
      render(
        <AssetGrid
          assets={assets}
          selectedAsset={assets[1]}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByTestId('asset-a2')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('asset-a1')).toHaveAttribute('data-selected', 'false');
    });

    it('forwards selection events to the handler', () => {
      const onSelect = vi.fn();

      render(
        <AssetGrid
          assets={assets}
          selectedAsset={null}
          onSelect={onSelect}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('asset-a1'));

      expect(onSelect).toHaveBeenCalledWith(assets[0]);
    });
  });
});
