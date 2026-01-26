import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VideoGuidancePanel } from '../VideoGuidancePanel';

describe('VideoGuidancePanel', () => {
  describe('error handling', () => {
    it('hides guidance content when showGuidance is false', () => {
      render(<VideoGuidancePanel showGuidance={false} onToggle={vi.fn()} />);

      expect(screen.getByText(/show examples/i)).toBeInTheDocument();
      expect(screen.queryByText(/video prompt writing guide/i)).toBeInTheDocument();
      expect(screen.queryByText(/remember:/i)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('shows guidance content when showGuidance is true', () => {
      render(<VideoGuidancePanel showGuidance onToggle={vi.fn()} />);

      expect(screen.getByText(/hide/i)).toBeInTheDocument();
      expect(screen.getByText(/remember:/i)).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes onToggle when header button is clicked', async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(<VideoGuidancePanel showGuidance={false} onToggle={onToggle} />);

      await user.click(screen.getByRole('button', { name: /video prompt writing guide/i }));

      expect(onToggle).toHaveBeenCalled();
    });
  });
});
