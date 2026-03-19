import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaceMatchIndicator } from '../FaceMatchIndicator';

describe('FaceMatchIndicator', () => {
  describe('edge cases', () => {
    it('renders placeholder when score is undefined', () => {
      render(<FaceMatchIndicator score={undefined} />);

      expect(screen.getByText('Face match: --')).toBeInTheDocument();
    });

    it('renders placeholder when score is null', () => {
      render(<FaceMatchIndicator score={null as unknown as undefined} />);

      expect(screen.getByText('Face match: --')).toBeInTheDocument();
    });

    it('renders 0% for score of 0', () => {
      render(<FaceMatchIndicator />);
      const { container } = render(<FaceMatchIndicator score={0} />);

      expect(screen.getByText('0% match')).toBeInTheDocument();
      // Check the progress bar width is 0%
      const progressBar = container.querySelector('.bg-red-400');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('renders 100% for score of 1', () => {
      const { container } = render(<FaceMatchIndicator score={1} />);

      expect(screen.getByText('100% match')).toBeInTheDocument();
      const progressBar = container.querySelector('.bg-emerald-400');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('color thresholds', () => {
    it('uses red color for scores below 60%', () => {
      const { container } = render(<FaceMatchIndicator score={0.5} />);

      expect(screen.getByText('50% match')).toHaveClass('text-red-400');
      expect(container.querySelector('.bg-red-400')).toBeInTheDocument();
    });

    it('uses amber color for scores between 60% and 79%', () => {
      const { container } = render(<FaceMatchIndicator score={0.7} />);

      expect(screen.getByText('70% match')).toHaveClass('text-amber-400');
      expect(container.querySelector('.bg-amber-400')).toBeInTheDocument();
    });

    it('uses emerald color for scores 80% and above', () => {
      const { container } = render(<FaceMatchIndicator score={0.85} />);

      expect(screen.getByText('85% match')).toHaveClass('text-emerald-400');
      expect(container.querySelector('.bg-emerald-400')).toBeInTheDocument();
    });

    it('uses amber at exactly 60% boundary', () => {
      render(<FaceMatchIndicator score={0.6} />);

      expect(screen.getByText('60% match')).toHaveClass('text-amber-400');
    });

    it('uses emerald at exactly 80% boundary', () => {
      render(<FaceMatchIndicator score={0.8} />);

      expect(screen.getByText('80% match')).toHaveClass('text-emerald-400');
    });
  });

  describe('core behavior', () => {
    it('rounds percentage to nearest integer', () => {
      render(<FaceMatchIndicator score={0.7567} />);

      expect(screen.getByText('76% match')).toBeInTheDocument();
    });

    it('sets progress bar width to match percentage', () => {
      const { container } = render(<FaceMatchIndicator score={0.45} />);

      const progressBar = container.querySelector('.bg-red-400');
      expect(progressBar).toHaveStyle({ width: '45%' });
    });
  });
});
