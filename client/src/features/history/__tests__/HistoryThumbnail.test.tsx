import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { HistoryThumbnail } from '../components/HistoryThumbnail';

// ============================================================================
// HistoryThumbnail
// ============================================================================

describe('HistoryThumbnail', () => {
  describe('error handling', () => {
    it('falls back to a placeholder when the image fails to load', () => {
      render(<HistoryThumbnail src="https://example.com/bad.png" label="Example" />);

      const img = screen.getByRole('img', { name: 'Example' });
      fireEvent.error(img);
      fireEvent.error(img);

      expect(screen.queryByRole('img', { name: 'Example' })).toBeNull();
      expect(screen.getByText('E')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('uses the first alphanumeric character from the label', () => {
      render(<HistoryThumbnail src={null} label="  9 lives" />);

      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('resets the error state when the source changes', () => {
      const { rerender } = render(
        <HistoryThumbnail src="https://example.com/bad.png" label="Sample" />
      );

      const img = screen.getByRole('img', { name: 'Sample' });
      fireEvent.error(img);

      rerender(<HistoryThumbnail src="https://example.com/good.png" label="Sample" />);

      expect(screen.getByRole('img', { name: 'Sample' })).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders the trimmed image source when available', () => {
      render(<HistoryThumbnail src="  https://example.com/thumb.png  " label="Thumb" />);

      const img = screen.getByRole('img', { name: 'Thumb' });
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
    });
  });
});
