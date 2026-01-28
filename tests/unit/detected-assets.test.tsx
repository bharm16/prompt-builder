import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DetectedAssets } from '@features/prompt-optimizer/components/DetectedAssets/DetectedAssets';
import { useDetectedAssets } from '@features/prompt-optimizer/components/DetectedAssets/hooks/useDetectedAssets';
import type { Asset } from '@shared/types/asset';

vi.mock('@features/prompt-optimizer/components/DetectedAssets/hooks/useDetectedAssets', () => ({
  useDetectedAssets: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/components/DetectedAssets/AssetChip', () => ({
  AssetChip: ({
    asset,
    onEdit,
  }: {
    asset: Asset;
    onEdit?: () => void;
  }) => (
    <button type="button" onClick={onEdit}>
      {asset.name}
    </button>
  ),
}));

const mockUseDetectedAssets = vi.mocked(useDetectedAssets);

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

describe('DetectedAssets', () => {
  describe('error handling', () => {
    it('returns null when no assets or triggers are detected', () => {
      mockUseDetectedAssets.mockReturnValue({
        detectedAssets: [],
        unresolvedTriggers: [],
        hasCharacter: false,
        characterCount: 0,
      });

      const { container } = render(
        <DetectedAssets prompt="" assets={[]} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders unresolved trigger buttons that call onCreateFromTrigger', async () => {
      mockUseDetectedAssets.mockReturnValue({
        detectedAssets: [],
        unresolvedTriggers: ['style'],
        hasCharacter: false,
        characterCount: 0,
      });

      const onCreateFromTrigger = vi.fn();
      const user = userEvent.setup();

      render(
        <DetectedAssets
          prompt="@style"
          assets={[]}
          onCreateFromTrigger={onCreateFromTrigger}
        />
      );

      await user.click(screen.getByRole('button', { name: '@style (create?)' }));
      expect(onCreateFromTrigger).toHaveBeenCalledWith('style');
    });
  });

  describe('core behavior', () => {
    it('renders detected assets and character consistency indicator', async () => {
      const hero = createAsset();
      const onEditAsset = vi.fn();
      const user = userEvent.setup();

      mockUseDetectedAssets.mockReturnValue({
        detectedAssets: [hero],
        unresolvedTriggers: [],
        hasCharacter: true,
        characterCount: 1,
      });

      render(
        <DetectedAssets
          prompt="@hero"
          assets={[hero]}
          onEditAsset={onEditAsset}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Hero' }));
      expect(onEditAsset).toHaveBeenCalledWith('asset-1');
      expect(screen.getByText('Character consistency enabled')).toBeInTheDocument();
    });
  });
});
