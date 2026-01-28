import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssetChip } from '@features/prompt-optimizer/components/DetectedAssets/AssetChip';
import type { Asset } from '@shared/types/asset';

vi.mock('@promptstudio/system/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@features/prompt-optimizer/components/DetectedAssets/AssetPopover', () => ({
  AssetPopover: ({ onEdit }: { onEdit?: () => void }) => (
    <button type="button" onClick={onEdit}>Edit Asset</button>
  ),
}));

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: overrides.id ?? 'asset-1',
  userId: 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? 'hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'hero',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('AssetChip', () => {
  describe('edge cases', () => {
    it('adds @ prefix to trigger labels', () => {
      render(<AssetChip asset={createAsset({ trigger: 'style' })} />);

      expect(screen.getByText('@style')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('passes onEdit handler to the popover', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(<AssetChip asset={createAsset()} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: 'Edit Asset' }));
      expect(onEdit).toHaveBeenCalled();
    });
  });
});
