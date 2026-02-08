import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { ImagePreview } from '@/components/MediaViewer/components/ImagePreview';
import { VideoPlayer } from '@/components/MediaViewer/components/VideoPlayer';
import { useMediaStorage } from '@/hooks/useMediaStorage';

vi.mock('@/hooks/useMediaStorage', () => ({
  useMediaStorage: vi.fn(),
}));

describe('MediaViewer', () => {
  const mockUseMediaStorage = vi.mocked(useMediaStorage);
  const createMediaStorageHookResult = (
    overrides: Partial<ReturnType<typeof useMediaStorage>> = {}
  ): ReturnType<typeof useMediaStorage> => ({
    uploadFile: vi.fn(),
    getViewUrl: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
    uploading: false,
    uploadProgress: 0,
    error: null,
    clearError: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('shows an error message when media loading fails', async () => {
      const getViewUrl = vi.fn().mockRejectedValue(new Error('No access'));
      mockUseMediaStorage.mockReturnValue(createMediaStorageHookResult({ getViewUrl }));

      render(<MediaViewer storagePath="assets/video.mp4" contentType="video/mp4" />);

      await waitFor(() => expect(screen.getByText('No access')).toBeInTheDocument());
    });

    it('renders image fallback when src is missing', () => {
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
      const getViewUrl = vi.fn();
      mockUseMediaStorage.mockReturnValue(createMediaStorageHookResult({ getViewUrl }));

      render(<MediaViewer storagePath={null} contentType="image/png" initialUrl="/image.png" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/image.png');
      expect(getViewUrl).not.toHaveBeenCalled();
    });

    it('clears image error state when src changes', () => {
      const { rerender } = render(<ImagePreview src="/bad.png" />);

      const img = screen.getByRole('img');
      fireEvent.error(img);

      expect(screen.getByText('Image unavailable')).toBeInTheDocument();

      rerender(<ImagePreview src="/good.png" />);

      expect(screen.getByRole('img')).toHaveAttribute('src', '/good.png');
    });
  });

  describe('core behavior', () => {
    it('renders a video when content type is video', async () => {
      const getViewUrl = vi.fn().mockResolvedValue('https://cdn/video.mp4');
      mockUseMediaStorage.mockReturnValue(createMediaStorageHookResult({ getViewUrl }));

      const { container } = render(
        <MediaViewer storagePath="assets/video.mp4" contentType="video/mp4" />
      );

      await waitFor(() => {
        const video = container.querySelector('video');
        expect(video).not.toBeNull();
        expect(video).toHaveAttribute('src', 'https://cdn/video.mp4');
      });
    });
  });
});
