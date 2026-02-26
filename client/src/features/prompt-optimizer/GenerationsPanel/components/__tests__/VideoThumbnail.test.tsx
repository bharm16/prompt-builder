import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    it('shows model label, progress, and cancel when generating', async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl={null}
          isGenerating={true}
          modelLabel="Kling 1.6"
          progressPercent={42}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Kling 1.6')).toBeInTheDocument();
      expect(screen.getByText('42%')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('failed state', () => {
    it('shows failed UI when generation fails', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl={null}
          isGenerating={false}
          isFailed={true}
        />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(document.querySelector('video')).not.toBeInTheDocument();
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

      expect(screen.getByText('No preview')).toBeInTheDocument();
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
          isGenerating={false}
        />
      );

      expect(screen.getByText('No preview')).toBeInTheDocument();
    });
  });

  describe('overlay behavior', () => {
    it('shows play button, duration badge, and scrubber for completed video', () => {
      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: 'Video scrubber' })).toBeInTheDocument();
      expect(screen.getByText('0:04')).toBeInTheDocument();
    });

    it('does not show play button or scrubber when only thumbnail exists', () => {
      render(
        <VideoThumbnail
          videoUrl={null}
          thumbnailUrl="https://example.com/thumb.jpg"
          isGenerating={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: 'Video scrubber' })).not.toBeInTheDocument();
    });

    it('shows tier/model metadata and more actions when provided', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
          tier="render"
          modelLabel="Veo 2"
          onDelete={onDelete}
        />
      );

      expect(screen.getByText('Render')).toBeInTheDocument();
      expect(screen.getByText('Veo 2')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onPlay when play button is clicked', async () => {
      const onPlay = vi.fn();
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(function (this: HTMLMediaElement) {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        });

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
          onPlay={onPlay}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Play video' }));

      expect(onPlay).toHaveBeenCalledTimes(1);
      playSpy.mockRestore();
    });

    it('hides the center play button after playback starts', async () => {
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(function (this: HTMLMediaElement) {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        });

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Play video' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
      });

      playSpy.mockRestore();
    });

    it('pauses on video click without bringing back the center play button', async () => {
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(function (this: HTMLMediaElement) {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        });
      const pauseSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(function (this: HTMLMediaElement) {
          this.dispatchEvent(new Event('pause'));
        });

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Play video' }));

      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      await user.click(video as HTMLVideoElement);

      expect(pauseSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();

      playSpy.mockRestore();
      pauseSpy.mockRestore();
    });

    it('plays the video element when play button is clicked with a video URL', async () => {
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);

      render(
        <VideoThumbnail
          videoUrl="https://example.com/video.mp4"
          thumbnailUrl={null}
          isGenerating={false}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Play video' }));

      expect(playSpy).toHaveBeenCalledTimes(1);
      playSpy.mockRestore();
    });
  });

  describe('core behavior', () => {
    it('renders video element without native controls when videoUrl provided', () => {
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
      expect(video).not.toHaveAttribute('controls');
    });
  });
});
