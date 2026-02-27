import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { KeyframeWorkflow } from '../components/KeyframeWorkflow';

const videoPreviewSpy = vi.fn();

vi.mock('../components/VisualPreview', () => ({
  VisualPreview: ({ onImageSelected, generateRequestId, selectedImageIndex }: { onImageSelected?: (url: string, index: number) => void; generateRequestId?: number; selectedImageIndex?: number | null }) => (
    <div>
      <button
        type="button"
        onClick={() => onImageSelected?.('https://example.com/frame.png', 0)}
      >
        Select Frame
      </button>
      <span data-testid="frame-request">{generateRequestId ?? 0}</span>
      <span data-testid="selected-index">{selectedImageIndex ?? -1}</span>
    </div>
  ),
}));

vi.mock('../components/VideoPreview', () => ({
  VideoPreview: (props: Record<string, unknown>) => {
    videoPreviewSpy(props);
    return <div data-testid="video-preview">Video Preview</div>;
  },
}));

// ============================================================================
// KeyframeWorkflow
// ============================================================================

describe('KeyframeWorkflow', () => {
  beforeEach(() => {
    videoPreviewSpy.mockClear();
  });

  describe('error handling', () => {
    it('does not render the video stage before a frame is selected', () => {
      render(
        <KeyframeWorkflow
          prompt="A test prompt"
        />
      );

      expect(screen.queryByTestId('video-preview')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('uses a fallback model when the target model lacks image support', () => {
      render(
        <KeyframeWorkflow
          prompt="A test prompt"
          targetModel="custom-model"
          modelCapabilities={{
            'custom-model': { supportsImageInput: false },
          }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select Frame' }));
      expect(screen.getByText('custom-model does not support i2v. Using Sora 2.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Generate video from this frame' }));

      expect(videoPreviewSpy).toHaveBeenCalledWith(expect.objectContaining({ model: 'sora-2' }));
    });

    it('resets frame selection when prompt changes', () => {
      const { rerender } = render(
        <KeyframeWorkflow
          prompt="First prompt"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select Frame' }));
      expect(screen.getByText('Frame 1 selected')).toBeInTheDocument();

      rerender(
        <KeyframeWorkflow
          prompt="Second prompt"
        />
      );

      expect(screen.getByTestId('selected-index')).toHaveTextContent('-1');
      expect(screen.getByTestId('frame-request')).toHaveTextContent('2');
    });
  });

  describe('core behavior', () => {
    it('transitions from frame selection to video generation', () => {
      render(
        <KeyframeWorkflow
          prompt="A test prompt"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select Frame' }));
      expect(screen.getByText('Frame 1 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Generate video from this frame' }));

      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    });
  });
});
