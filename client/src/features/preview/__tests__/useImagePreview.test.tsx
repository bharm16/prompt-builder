import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useImagePreview } from '../hooks/useImagePreview';
import { generatePreview, generateStoryboardPreview } from '../api/previewApi';

vi.mock('../api/previewApi', () => ({
  generatePreview: vi.fn(),
  generateStoryboardPreview: vi.fn(),
}));

const mockGeneratePreview = vi.mocked(generatePreview);
const mockGenerateStoryboardPreview = vi.mocked(generateStoryboardPreview);

// ============================================================================
// useImagePreview
// ============================================================================

describe('useImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('sets an error when preview generation fails', async () => {
      mockGeneratePreview.mockResolvedValueOnce({
        success: false,
        error: 'Preview failed',
      });

      const { result } = renderHook(() =>
        useImagePreview({ prompt: 'Test', isVisible: true })
      );

      act(() => {
        result.current.regenerate();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Preview failed');
      });
      expect(result.current.imageUrl).toBeNull();
    });

    it('throws an error when storyboard responses are empty', async () => {
      mockGenerateStoryboardPreview.mockResolvedValueOnce({
        success: true,
        data: {
          imageUrls: [],
        },
      });

      const { result } = renderHook(() =>
        useImagePreview({
          prompt: 'Storyboard prompt',
          isVisible: true,
          provider: 'replicate-flux-kontext-fast',
        })
      );

      act(() => {
        result.current.regenerate();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Storyboard response contained no images');
      });
    });
  });

  describe('edge cases', () => {
    it('does not generate when the prompt is empty', () => {
      const { result } = renderHook(() =>
        useImagePreview({ prompt: '   ', isVisible: true })
      );

      act(() => {
        result.current.regenerate();
      });

      expect(mockGeneratePreview).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('passes reference images to kontext storyboard generation', async () => {
      mockGenerateStoryboardPreview.mockResolvedValueOnce({
        success: true,
        data: {
          imageUrls: ['https://example.com/1.png', 'https://example.com/2.png'],
          baseImageUrl: 'https://example.com/base.png',
        },
      });

      const { result } = renderHook(() =>
        useImagePreview({
          prompt: 'Kontext prompt',
          isVisible: true,
          provider: 'replicate-flux-kontext-fast',
          seedImageUrl: 'https://example.com/seed.png',
          useReferenceImage: true,
        })
      );

      act(() => {
        result.current.regenerate();
      });

      await waitFor(() => {
        expect(result.current.imageUrls).toHaveLength(2);
      });

      expect(mockGenerateStoryboardPreview).toHaveBeenCalledWith(
        'Kontext prompt',
        expect.objectContaining({ seedImageUrl: 'https://example.com/seed.png' })
      );
    });
  });

  describe('core behavior', () => {
    it('stores the generated preview image URL', async () => {
      mockGeneratePreview.mockResolvedValueOnce({
        success: true,
        data: {
          imageUrl: 'https://example.com/preview.png',
        },
      });

      const { result } = renderHook(() =>
        useImagePreview({ prompt: 'Test', isVisible: true })
      );

      act(() => {
        result.current.regenerate();
      });

      await waitFor(() => {
        expect(result.current.imageUrl).toBe('https://example.com/preview.png');
        expect(result.current.error).toBeNull();
      });
    });
  });
});
