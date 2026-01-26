import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ProgressHeader } from '../ProgressHeader';

describe('ProgressHeader', () => {
  describe('error handling', () => {
    it('caps completion percent display at 100%', () => {
      render(
        <ProgressHeader
          completionPercent={140}
          groupProgress={[]}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles groups with zero total without NaN', () => {
      render(
        <ProgressHeader
          completionPercent={0}
          groupProgress={[{ key: 'empty', label: 'Empty', filled: 0, total: 0 }]}
        />
      );

      expect(screen.getAllByText('0%')).toHaveLength(2);
      expect(screen.getByText('Start here')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('shows status labels based on progress thresholds', () => {
      render(
        <ProgressHeader
          completionPercent={50}
          groupProgress={[
            { key: 'core', label: 'Core', filled: 4, total: 5 },
            { key: 'style', label: 'Style', filled: 2, total: 5 },
          ]}
        />
      );

      expect(screen.getByText('Dialed in')).toBeInTheDocument();
      expect(screen.getByText('In progress')).toBeInTheDocument();
    });
  });
});
