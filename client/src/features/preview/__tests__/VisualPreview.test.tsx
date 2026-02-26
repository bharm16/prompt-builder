import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VisualPreview } from '../components/VisualPreview';
import { useImagePreview } from '../hooks/useImagePreview';

vi.mock('../hooks/useImagePreview', () => ({
  useImagePreview: vi.fn(),
}));

const mockUseImagePreview = vi.mocked(useImagePreview);

// ============================================================================
// VisualPreview
// ============================================================================

describe('VisualPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('renders nothing when not visible', () => {
      mockUseImagePreview.mockReturnValue({
        imageUrl: 'https://example.com/preview.png',
        imageUrls: [],
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      const { container } = render(
        <VisualPreview
          prompt="Test"
          isVisible={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('normalizes cinematic ratios to 21:9', () => {
      mockUseImagePreview.mockReturnValue({
        imageUrl: null,
        imageUrls: [],
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      render(
        <VisualPreview
          prompt="Test"
          aspectRatio="2.39:1"
          isVisible
        />
      );

      expect(mockUseImagePreview).toHaveBeenCalledWith(
        expect.objectContaining({ aspectRatio: '21:9' })
      );
    });

    it('renders a grid for kontext providers and selects frames', async () => {
      const onImageSelected = vi.fn();
      const user = userEvent.setup();

      mockUseImagePreview.mockReturnValue({
        imageUrl: 'https://example.com/base.png',
        imageUrls: ['https://example.com/1.png', null, 'https://example.com/3.png'],
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      render(
        <VisualPreview
          prompt="Test"
          provider="replicate-flux-kontext-fast"
          isVisible
          onImageSelected={onImageSelected}
        />
      );

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      const secondButton = buttons[1];
      expect(firstButton).toBeDefined();
      expect(secondButton).toBeDefined();
      expect(secondButton!).toBeDisabled();

      await user.click(firstButton!);

      expect(onImageSelected).toHaveBeenCalledWith('https://example.com/1.png', 0);
    });
  });

  describe('core behavior', () => {
    it('uses the seed image when no preview image exists', () => {
      mockUseImagePreview.mockReturnValue({
        imageUrl: null,
        imageUrls: [],
        loading: false,
        error: null,
        regenerate: vi.fn(),
      });

      render(
        <VisualPreview
          prompt="Test"
          seedImageUrl="https://example.com/seed.png"
          isVisible
        />
      );

      expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
        'src',
        'https://example.com/seed.png'
      );
    });

    it('reports generated previews using the last requested prompt', async () => {
      const regenerate = vi.fn();
      const onPreviewGenerated = vi.fn();

      mockUseImagePreview.mockReturnValue({
        imageUrl: null,
        imageUrls: [],
        loading: false,
        error: null,
        regenerate,
      });

      const { rerender } = render(
        <VisualPreview
          prompt="First prompt"
          isVisible
          generateRequestId={1}
          onPreviewGenerated={onPreviewGenerated}
        />
      );

      await waitFor(() => {
        expect(regenerate).toHaveBeenCalledTimes(1);
      });

      mockUseImagePreview.mockReturnValue({
        imageUrl: 'https://example.com/preview.png',
        imageUrls: [],
        loading: false,
        error: null,
        regenerate,
      });

      rerender(
        <VisualPreview
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
          imageUrl: 'https://example.com/preview.png',
          aspectRatio: null,
        });
      });
    });
  });
});
