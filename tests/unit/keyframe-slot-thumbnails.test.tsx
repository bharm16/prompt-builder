import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { StartFrameControl } from '@components/ToolSidebar/components/panels/StartFrameControl';
import { ImageReferenceSlotsRow } from '@components/ToolSidebar/components/panels/ImageReferenceSlotsRow';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: vi.fn(),
}));

const mockUseResolvedMediaUrl = vi.mocked(useResolvedMediaUrl);

const createResolvedValue = (url: string | null) => ({
  url,
  expiresAt: null,
  loading: false,
  error: null,
  refresh: vi.fn().mockResolvedValue({
    url,
    source: 'raw' as const,
  }),
});

const createKeyframe = (overrides: Partial<KeyframeTile> = {}): KeyframeTile => ({
  id: overrides.id ?? 'frame-1',
  url: overrides.url ?? 'users/user-1/previews/images/frame-1.webp',
  source: overrides.source ?? 'upload',
  ...(overrides.storagePath !== undefined ? { storagePath: overrides.storagePath } : {}),
  ...(overrides.assetId !== undefined ? { assetId: overrides.assetId } : {}),
  ...(overrides.viewUrlExpiresAt !== undefined ? { viewUrlExpiresAt: overrides.viewUrlExpiresAt } : {}),
});

describe('keyframe slot thumbnails', () => {
  beforeEach(() => {
    mockUseResolvedMediaUrl.mockImplementation(({ url }) =>
      createResolvedValue(url ?? null)
    );
  });

  it('uses resolved URL in StartFrameControl when available', () => {
    const tile = createKeyframe({
      url: 'https://expired.example/frame-1.webp?X-Goog-Signature=expired',
      storagePath: 'users/user-1/previews/images/frame-1.webp',
    });
    mockUseResolvedMediaUrl.mockReturnValueOnce(
      createResolvedValue('https://signed.example/frame-1.webp')
    );

    render(
      <StartFrameControl
        startFrame={tile}
        isUploadDisabled={false}
        onRequestUpload={vi.fn()}
        onUploadFile={vi.fn()}
        onClear={vi.fn()}
      />
    );

    const image = screen.getByAltText('Start frame');
    expect(image).toHaveAttribute('src', 'https://signed.example/frame-1.webp');
    expect(mockUseResolvedMediaUrl).toHaveBeenCalledWith({
      kind: 'image',
      url: tile.url,
      storagePath: tile.storagePath ?? null,
      assetId: tile.assetId ?? null,
      enabled: true,
    });
  });

  it('uses resolved URL in ImageReferenceSlotsRow when available', () => {
    const tile = createKeyframe({
      url: 'https://expired.example/frame-2.webp?X-Goog-Signature=expired',
      storagePath: 'users/user-1/previews/images/frame-2.webp',
    });
    mockUseResolvedMediaUrl.mockReturnValueOnce(
      createResolvedValue('https://signed.example/frame-2.webp')
    );

    render(
      <ImageReferenceSlotsRow
        keyframes={[tile]}
        isUploadDisabled={false}
        onRequestUpload={vi.fn()}
        onRemoveKeyframe={vi.fn()}
      />
    );

    const image = screen.getByAltText('Reference 1');
    expect(image).toHaveAttribute('src', 'https://signed.example/frame-2.webp');
    expect(mockUseResolvedMediaUrl).toHaveBeenCalledWith({
      kind: 'image',
      url: tile.url,
      storagePath: tile.storagePath ?? null,
      assetId: tile.assetId ?? null,
      enabled: true,
    });
  });
});
