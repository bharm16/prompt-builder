import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoThumbnail } from '../VideoThumbnail';

describe('VideoThumbnail', () => {
  describe('generating state', () => {
    it('renders shimmer animation when generating', () => {
      const { container } = render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl={null}
          isGenerating={true}
        />
      );

      expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
    });

    it('does not render video or thumbnail when generating', () => {
      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl="https://example.com/thumb.jpg"
          isGenerating={true}
        />
      );

      expect(screen.queryByRole('video')).not.toBeInTheDocument();
      expect(screen.queryByAltText('Video thumbnail')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('shows no preview message when no video or thumbnail', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl={null}
          isGenerating={false}
        />
      );

      expect(screen.getByText('No preview available')).toBeInTheDocument();
    });

    it('shows thumbnail when no video URL but thumbnail exists', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl="https://example.com/thumb.jpg"
          isGenerating={false}
        />
      );

      const img = screen.getByAltText('Video thumbnail');
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('handles undefined thumbnailUrl', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl={undefined}
          isGenerating={false}
        />
      );

      expect(screen.getByText('No preview available')).toBeInTheDocument();
    });
  });

  describe('play button behavior', () => {
    it('shows play button when no video URL', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl="https://example.com/thumb.jpg"
          isGenerating={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Play preview' })).toBeInTheDocument();
    });

    it('hides play button when video URL is present', () => {
      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Play preview' })).not.toBeInTheDocument();
    });

    it('calls onPlay when play button is clicked', async () => {
      const onPlay = vi.fn();
      const user = userEvent.setup();

      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl="https://example.com/thumb.jpg"
          isGenerating={false}
          onPlay={onPlay}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Play preview' }));

      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  describe('core behavior', () => {
    it('renders video element with controls when videoUrl provided', () => {
      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
        />
      );

      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
      expect(video).toHaveAttribute('controls');
    });

    it('calls onPlay when video starts playing', async () => {
      const onPlay = vi.fn();

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
          onPlay={onPlay}
        />
      );

      const video = document.querySelector('video');
      video?.dispatchEvent(new Event('play'));

      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });
});
