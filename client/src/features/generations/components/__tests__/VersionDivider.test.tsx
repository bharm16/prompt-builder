import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionDivider } from '../VersionDivider';

describe('VersionDivider', () => {
  describe('edge cases', () => {
    it('does not show prompt edited dot when promptChanged is false', () => {
      render(<VersionDivider versionLabel="V1" promptChanged={false} />);

      expect(screen.queryByLabelText('Prompt edited')).not.toBeInTheDocument();
    });

    it('handles empty string versionLabel', () => {
      render(<VersionDivider versionLabel="" promptChanged={false} />);

      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-label', 'Version ');
    });
  });

  describe('accessibility', () => {
    it('has separator role', () => {
      render(<VersionDivider versionLabel="V2" promptChanged={false} />);

      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('includes version label in aria-label', () => {
      render(<VersionDivider versionLabel="V3" promptChanged={false} />);

      expect(screen.getByRole('separator')).toHaveAttribute('aria-label', 'Version V3');
    });

    it('includes prompt edited status in aria-label when true', () => {
      render(<VersionDivider versionLabel="V4" promptChanged={true} />);

      expect(screen.getByRole('separator')).toHaveAttribute(
        'aria-label',
        'Version V4, prompt edited'
      );
    });
  });

  describe('core behavior', () => {
    it('displays version label', () => {
      render(<VersionDivider versionLabel="V5" promptChanged={false} />);

      expect(screen.getByText('V5')).toBeInTheDocument();
    });

    it('shows prompt edited dot when promptChanged is true', () => {
      render(<VersionDivider versionLabel="V6" promptChanged={true} />);

      expect(screen.getByLabelText('Prompt edited')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <VersionDivider versionLabel="V7" promptChanged={false} className="custom-divider" />
      );

      expect(container.querySelector('.custom-divider')).toBeInTheDocument();
    });

    it('does not render horizontal divider lines', () => {
      const { container } = render(
        <VersionDivider versionLabel="V8" promptChanged={false} />
      );

      const lines = container.querySelectorAll('[aria-hidden="true"]');
      expect(lines.length).toBe(0);
    });
  });
});
