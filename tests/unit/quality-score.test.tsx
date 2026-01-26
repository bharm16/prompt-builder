/**
 * Unit tests for QualityScore
 */

import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import QualityScore from '@components/QualityScore';

vi.mock('@hooks/useDebugLogger', () => ({
  useDebugLogger: () => ({
    logEffect: vi.fn(),
    logAction: vi.fn(),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  }),
}));

describe('QualityScore', () => {
  describe('error handling', () => {
    it('animates score updates when enabled', () => {
      vi.useFakeTimers();

      render(<QualityScore score={80} animated />);

      expect(screen.getByText('0')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('80')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('renders static score when animation is disabled', () => {
      render(<QualityScore score={72} animated={false} />);

      expect(screen.getByText('72')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('shows improvement tips in detailed view for low scores', () => {
      render(
        <QualityScore
          score={50}
          previousScore={60}
          showDetails
          inputPrompt="Short"
          outputPrompt="Needs more detail"
        />
      );

      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Improvement Tips')).toBeInTheDocument();
      expect(screen.getByText('Define a clear goal or objective')).toBeInTheDocument();
      expect(screen.getByText('Specify the desired output format')).toBeInTheDocument();
    });
  });
});
