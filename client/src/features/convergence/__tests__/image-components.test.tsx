import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';

import { ImageOption } from '../components/shared/ImageOption';
import { ImageGrid } from '../components/shared/ImageGrid';
import { FrameAnimator, useFrameAnimator } from '../components/shared/FrameAnimator';
import type { GeneratedImage } from '../types';

const startMock = vi.fn();
const stopMock = vi.fn();
let capturedOnFrame: ((frame: string) => void) | null = null;

vi.mock('@/features/convergence/utils/cameraMotionRenderer', () => ({
  createFrameAnimator: vi.fn((frames: string[], fps: number, onFrame: (frame: string) => void) => {
    capturedOnFrame = onFrame;
    return {
      start: startMock,
      stop: stopMock,
    };
  }),
}));

// ============================================================================
// ImageOption
// ============================================================================

describe('ImageOption', () => {
  beforeEach(() => {
    startMock.mockClear();
    stopMock.mockClear();
    capturedOnFrame = null;
  });

  describe('error handling', () => {
    it('ignores click and keyboard selection when disabled', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <ImageOption
          id="option-a"
          imageUrl="https://example.com/a.png"
          label="Option A"
          disabled
          onSelect={onSelect}
        />
      );

      const button = screen.getByRole('option', { name: 'Option A' });
      expect(button).toBeDisabled();

      await user.click(button);
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('falls back when the image fails to load', () => {
      render(
        <ImageOption
          id="option-b"
          imageUrl="https://example.com/b.png"
          label="Option B"
        />
      );

      const img = screen.getByRole('img', { name: 'Option B' });
      fireEvent.error(img);

      expect(screen.queryByRole('img', { name: 'Option B' })).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('removes the loading overlay after the image loads', () => {
      const { container } = render(
        <ImageOption
          id="option-c"
          imageUrl="https://example.com/c.png"
          label="Option C"
        />
      );

      const img = screen.getByRole('img', { name: 'Option C' });
      expect(container.querySelector('.animate-pulse')).not.toBeNull();

      fireEvent.load(img);

      expect(container.querySelector('.animate-pulse')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('adds selected indicator and aria label when selected', () => {
      render(
        <ImageOption
          id="option-d"
          imageUrl="https://example.com/d.png"
          label="Option D"
          isSelected
        />
      );

      const button = screen.getByRole('option', { name: 'Option D (selected)' });
      expect(button).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Option D' })).toBeInTheDocument();
    });
  });
});

// ============================================================================
// ImageGrid
// ============================================================================

describe('ImageGrid', () => {
  const options = [
    { id: 'one', label: 'Option One' },
    { id: 'two', label: 'Option Two' },
  ];

  const images: GeneratedImage[] = [
    {
      id: 'img-1',
      url: 'https://example.com/one.png',
      dimension: 'direction',
      optionId: 'one',
      prompt: 'one',
      generatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  ];

  describe('error handling', () => {
    it('disables options that are missing images', () => {
      render(
        <ImageGrid
          images={images}
          options={options}
        />
      );

      const optionButtons = screen.getAllByRole('option');
      expect(optionButtons[0]).not.toBeDisabled();
      expect(optionButtons[1]).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('renders the requested number of skeleton placeholders while loading', () => {
      render(
        <ImageGrid
          images={[]}
          options={options}
          isLoading
          skeletonCount={3}
        />
      );

      expect(screen.getAllByRole('status')).toHaveLength(3);
    });
  });

  describe('core behavior', () => {
    it('invokes onSelect with the chosen option id', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <ImageGrid
          images={images}
          options={options}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getByRole('option', { name: 'Option One' }));

      expect(onSelect).toHaveBeenCalledWith('one');
    });
  });
});

// ============================================================================
// FrameAnimator
// ============================================================================

describe('FrameAnimator', () => {
  beforeEach(() => {
    startMock.mockClear();
    stopMock.mockClear();
    capturedOnFrame = null;
  });

  describe('error handling', () => {
    it('renders nothing when no frames are provided', () => {
      const { container } = render(<FrameAnimator frames={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('stops playback after a full loop when loop is disabled', async () => {
      const onLoopComplete = vi.fn();
      const onStop = vi.fn();

      render(
        <FrameAnimator
          frames={['frame-a', 'frame-b']}
          loop={false}
          onLoopComplete={onLoopComplete}
          onStop={onStop}
        />
      );

      const img = await screen.findByRole('img');

      act(() => {
        capturedOnFrame?.('frame-b');
        capturedOnFrame?.('frame-a');
      });

      expect(onLoopComplete).toHaveBeenCalledTimes(1);
      expect(onStop).toHaveBeenCalledTimes(1);
      expect(img).toHaveAttribute('data-playing', 'false');
    });
  });

  describe('core behavior', () => {
    it('updates the displayed frame when the animator advances', () => {
      render(
        <FrameAnimator
          frames={['frame-a', 'frame-b']}
          autoPlay={false}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'frame-a');

      act(() => {
        capturedOnFrame?.('frame-b');
      });

      expect(screen.getByRole('img')).toHaveAttribute('src', 'frame-b');
    });
  });
});

// ============================================================================
// useFrameAnimator
// ============================================================================

describe('useFrameAnimator', () => {
  beforeEach(() => {
    startMock.mockClear();
    stopMock.mockClear();
    capturedOnFrame = null;
  });

  describe('error handling', () => {
    it('does not start playback when there are no frames', () => {
      const { result } = renderHook(() => useFrameAnimator([]));

      act(() => {
        result.current.start();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentFrame).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('toggles playback state', () => {
      const { result } = renderHook(() => useFrameAnimator(['a', 'b']));

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('starts and stops playback through the returned controls', () => {
      const { result } = renderHook(() => useFrameAnimator(['a', 'b']));

      act(() => {
        result.current.start();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.stop();
      });
      expect(result.current.isPlaying).toBe(false);
    });
  });
});
