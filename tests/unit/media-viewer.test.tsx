import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { ImagePreview } from '@/components/MediaViewer/components/ImagePreview';
import { VideoPlayer } from '@/components/MediaViewer/components/VideoPlayer';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: vi.fn(),
}));

describe('MediaViewer', () => {
  const mockUseResolvedMediaUrl = vi.mocked(useResolvedMediaUrl);
  const createResolvedMediaHookResult = (
    overrides: Partial<ReturnType<typeof useResolvedMediaUrl>> = {}
  ): ReturnType<typeof useResolvedMediaUrl> => ({
    url: null,
    expiresAt: null,
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue({ url: null, source: 'direct' }),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedMediaUrl.mockReturnValue(createResolvedMediaHookResult());
  });

  describe('error handling', () => {
    it('shows an error message when media loading fails', () => {
      mockUseResolvedMediaUrl.mockReturnValue(
        createResolvedMediaHookResult({ error: 'No access' })
      );

      render(<MediaViewer storagePath="assets/video.mp4" contentType="video/mp4" />);

      expect(screen.getByText('No access')).toBeInTheDocument();
    });

    it('renders image fallback when src is missing', () => {
      mockUseResolvedMediaUrl.mockReturnValue(createResolvedMediaHookResult({ url: null }));
      render(<ImagePreview src={null} />);

      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });

    it('renders video fallback when src is missing', () => {
      render(<VideoPlayer src={null} />);

      expect(screen.getByText('Video unavailable')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('uses initialUrl when no storage path is provided', () => {
      mockUseResolvedMediaUrl.mockReturnValue(
        createResolvedMediaHookResult({ url: '/image.png' })
      );

      render(<MediaViewer storagePath={null} contentType="image/png" initialUrl="/image.png" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/image.png');
      expect(mockUseResolvedMediaUrl).toHaveBeenCalled();
    });

    it('clears image error state when src changes', async () => {
      mockUseResolvedMediaUrl.mockReturnValue(createResolvedMediaHookResult({ url: '/bad.png' }));
      const { rerender } = render(<ImagePreview src="/bad.png" />);

      const img = screen.getByRole('img');
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByText('Image unavailable')).toBeInTheDocument();
      });

      mockUseResolvedMediaUrl.mockReturnValue(createResolvedMediaHookResult({ url: '/good.png' }));
      rerender(<ImagePreview src="/good.png" />);

      expect(screen.getByRole('img')).toHaveAttribute('src', '/good.png');
    });
  });

  describe('core behavior', () => {
    it('renders a video when content type is video', () => {
      mockUseResolvedMediaUrl.mockReturnValue(
        createResolvedMediaHookResult({ url: 'https://cdn/video.mp4' })
      );

      const { container } = render(
        <MediaViewer storagePath="assets/video.mp4" contentType="video/mp4" />
      );

      const video = container.querySelector('video');
      expect(video).not.toBeNull();
      expect(video).toHaveAttribute('src', 'https://cdn/video.mp4');
    });
  });
});
