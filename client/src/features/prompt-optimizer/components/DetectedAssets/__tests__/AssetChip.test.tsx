import fs from 'node:fs';
import path from 'node:path';
import { StrictMode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Asset } from '@shared/types/asset';
import { AssetChip } from '../AssetChip';
import { DetectedAssets } from '../DetectedAssets';

const buildAsset = (): Asset => ({
  id: 'asset-1',
  userId: 'user-1',
  type: 'character',
  trigger: 'hero',
  name: 'Hero',
  textDefinition: 'Lead character',
  negativePrompt: '',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});

describe('AssetChip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not trigger maximum update depth errors when hovered', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AssetChip asset={buildAsset()} />
    );

    const trigger = screen.getByRole('button', { name: '@hero' });
    await user.hover(trigger);

    const maxDepthErrorLogged = errorSpy.mock.calls.some((call) =>
      call.some(
        (arg) => typeof arg === 'string' && arg.includes('Maximum update depth exceeded')
      )
    );

    expect(maxDepthErrorLogged).toBe(false);
  });

  it('does not trigger maximum update depth errors when detected chips mount/unmount repeatedly', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const baseAsset = buildAsset();
    const { rerender } = render(
      <StrictMode>
        <DetectedAssets prompt="@hero" assets={[baseAsset]} />
      </StrictMode>
    );

    for (let i = 0; i < 20; i += 1) {
      const prompt = i % 2 === 0 ? '' : '@hero';
      const nextAsset = { ...baseAsset, updatedAt: `2025-01-01T00:00:${i.toString().padStart(2, '0')}.000Z` };
      rerender(
        <StrictMode>
          <DetectedAssets prompt={prompt} assets={[nextAsset]} />
        </StrictMode>
      );
    }

    const maxDepthErrorLogged = errorSpy.mock.calls.some((call) =>
      call.some(
        (arg) => typeof arg === 'string' && arg.includes('Maximum update depth exceeded')
      )
    );

    expect(maxDepthErrorLogged).toBe(false);
  });

  it('does not reintroduce Radix tooltip primitives in AssetChip', () => {
    const sourcePath = path.resolve(
      process.cwd(),
      'client/src/features/prompt-optimizer/components/DetectedAssets/AssetChip.tsx'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('@promptstudio/system/components/ui/tooltip');
    expect(source).not.toContain('TooltipTrigger');
    expect(source).not.toContain('<Tooltip');
  });
});
