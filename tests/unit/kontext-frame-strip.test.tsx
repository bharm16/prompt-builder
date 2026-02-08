import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { KontextFrameStrip } from '@features/prompt-optimizer/GenerationsPanel/components/KontextFrameStrip';

describe('KontextFrameStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('disables a frame when the image fails to load', () => {
      const onFrameClick = vi.fn();
      render(
        <KontextFrameStrip
          frames={['https://cdn/frame.png']}
          duration={5}
          isGenerating={false}
          onFrameClick={onFrameClick}
        />
      );

      const img = screen.getByAltText('Frame 1');
      fireEvent.error(img);

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      expect(firstButton).toBeDefined();
      if (!firstButton) return;
      fireEvent.click(firstButton);

      expect(onFrameClick).not.toHaveBeenCalled();
      expect(firstButton).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('falls back to the default duration for invalid values', () => {
      render(
        <KontextFrameStrip
          frames={['https://cdn/frame.png']}
          duration={Number.NaN}
          isGenerating={false}
        />
      );

      expect(screen.getByText('1.7s')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders progress for the first slot when generating', () => {
      render(
        <KontextFrameStrip
          frames={[null, null, null, null]}
          duration={5}
          isGenerating
          progressPercent={25}
        />
      );

      expect(screen.getByText('25% Complete')).toBeInTheDocument();
    });

    it('invokes onFrameClick for selectable frames', () => {
      const onFrameClick = vi.fn();
      render(
        <KontextFrameStrip
          frames={['https://cdn/frame.png']}
          duration={5}
          isGenerating={false}
          onFrameClick={onFrameClick}
        />
      );

      const firstButton = screen.getAllByRole('button')[0];
      expect(firstButton).toBeDefined();
      if (!firstButton) return;
      fireEvent.click(firstButton);
      expect(onFrameClick).toHaveBeenCalledWith(0, 'https://cdn/frame.png');
    });
  });
});
