import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ConflictsAlert } from '../ConflictsAlert';

describe('ConflictsAlert', () => {
  describe('error handling', () => {
    it('shows loading state when analysis is in progress', () => {
      render(<ConflictsAlert conflicts={[]} isLoading />);

      expect(screen.getByText(/potential conflicts detected/i)).toBeInTheDocument();
      expect(screen.getByText(/analyzing element harmony/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('returns null when there are no conflicts and not loading', () => {
      const { container } = render(<ConflictsAlert conflicts={[]} isLoading={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('renders conflict messages with resolutions or suggestions', () => {
      render(
        <ConflictsAlert
          conflicts={[
            { message: 'Mismatch in lighting', resolution: 'Align time of day' },
            { message: 'Style clash', suggestion: 'Choose one aesthetic' },
          ]}
          isLoading={false}
        />
      );

      expect(screen.getByText('Mismatch in lighting')).toBeInTheDocument();
      expect(screen.getByText('Align time of day')).toBeInTheDocument();
      expect(screen.getByText('Style clash')).toBeInTheDocument();
      expect(screen.getByText('Choose one aesthetic')).toBeInTheDocument();
    });
  });
});
