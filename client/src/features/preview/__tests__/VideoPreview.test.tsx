import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { VideoPreview } from '../components/VideoPreview';
import { useVideoPreview } from '../hooks/useVideoPreview';

vi.mock('../hooks/useVideoPreview', () => ({
  useVideoPreview: vi.fn(),
}));

const mockUseVideoPreview = vi.mocked(useVideoPreview);

// ============================================================================
// VideoPreview
// ============================================================================

describe('VideoPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('renders nothing when not visible', () => {
      mockUseVideoPreview.mockReturnValue({
        videoUrl: 'https://example.com/video.mp4',
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      const { container } = render(
        <VideoPreview
          prompt="Test"
          isVisible={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('normalizes invalid aspect ratios to the default', () => {
      mockUseVideoPreview.mockReturnValue({
        videoUrl: null,
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      render(
        <VideoPreview
          prompt="Test"
          aspectRatio="weird"
          isVisible
        />
      );

      expect(mockUseVideoPreview).toHaveBeenCalledWith(
        expect.objectContaining({ aspectRatio: '16:9' })
      );
    });
  });

  describe('core behavior', () => {
    it('uses the seed video when no generated video exists', () => {
      mockUseVideoPreview.mockReturnValue({
        videoUrl: null,
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      const { container } = render(
        <VideoPreview
          prompt="Test"
          seedVideoUrl="https://example.com/seed.mp4"
          isVisible
        />
      );

      const video = container.querySelector('video');
      expect(video).not.toBeNull();
      expect(video).toHaveAttribute('src', 'https://example.com/seed.mp4');
    });

    it('reports generated previews using the last requested prompt', async () => {
      const regenerate = vi.fn();
      const onPreviewGenerated = vi.fn();

      mockUseVideoPreview.mockReturnValue({
        videoUrl: null,
        loading: false,
        error: null,
        regenerate,
      });

      const { rerender } = render(
        <VideoPreview
          prompt="First prompt"
          isVisible
          generateRequestId={1}
          onPreviewGenerated={onPreviewGenerated}
        />
      );

      await waitFor(() => {
        expect(regenerate).toHaveBeenCalledTimes(1);
      });

      mockUseVideoPreview.mockReturnValue({
        videoUrl: 'https://example.com/video.mp4',
        loading: false,
        error: null,
        regenerate,
      });

      rerender(
        <VideoPreview
          prompt="Updated prompt"
          isVisible
          generateRequestId={1}
          onPreviewGenerated={onPreviewGenerated}
        />
      );

      await waitFor(() => {
        expect(onPreviewGenerated).toHaveBeenCalledWith({
          prompt: 'First prompt',
          generatedAt: expect.any(Number),
          videoUrl: 'https://example.com/video.mp4',
          aspectRatio: '16:9',
          model: null,
        });
      });
    });
  });
});
