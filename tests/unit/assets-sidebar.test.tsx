import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetsSidebar } from '@features/prompt-optimizer/components/AssetsSidebar/AssetsSidebar';
import type { Asset, AssetType } from '@shared/types/asset';

vi.mock('@features/prompt-optimizer/components/AssetsSidebar/AssetTypeSection', () => ({
  AssetTypeSection: ({
    type,
    assets,
    isExpanded,
    onToggle,
  }: {
    type: AssetType;
    assets: Asset[];
    isExpanded: boolean;
    onToggle: () => void;
  }) => (
    <div data-testid={`section-${type}`} data-expanded={isExpanded ? 'true' : 'false'}>
      <span>{type}</span>
      <span>{assets.length}</span>
      <button type="button" onClick={onToggle}>Toggle</button>
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

describe('AssetsSidebar', () => {
  const onToggleSection = vi.fn();
  const onInsertTrigger = vi.fn();
  const onEditAsset = vi.fn();
  const onCreateAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('shows a loading spinner when loading with no assets', () => {
      render(
        <AssetsSidebar
          assets={[]}
          byType={{ character: [], style: [], location: [], object: [] }}
          isLoading
          error={null}
          expandedSections={new Set()}
          onToggleSection={onToggleSection}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(document.querySelector('.animate-spin')).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders an error banner when provided', () => {
      render(
        <AssetsSidebar
          assets={[]}
          byType={{ character: [], style: [], location: [], object: [] }}
          isLoading={false}
          error="Failed to load"
          expandedSections={new Set()}
          onToggleSection={onToggleSection}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders sections and triggers create button', async () => {
      const user = userEvent.setup();
      const hero = createAsset();
      const byType = {
        character: [hero],
        style: [],
        location: [],
        object: [],
      };

      render(
        <AssetsSidebar
          assets={[hero]}
          byType={byType}
          isLoading={false}
          error={null}
          expandedSections={new Set(['character'])}
          onToggleSection={onToggleSection}
          onInsertTrigger={onInsertTrigger}
          onEditAsset={onEditAsset}
          onCreateAsset={onCreateAsset}
        />
      );

      expect(screen.getByTestId('section-character')).toBeInTheDocument();
      expect(screen.getByTestId('section-style')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'New' }));
      expect(onCreateAsset).toHaveBeenCalledWith('character');
    });
  });
});
