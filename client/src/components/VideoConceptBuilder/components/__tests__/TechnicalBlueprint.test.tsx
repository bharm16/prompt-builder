import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TechnicalBlueprint } from '../TechnicalBlueprint';

describe('TechnicalBlueprint', () => {
  describe('error handling', () => {
    it('renders header when fetching technical params', () => {
      render(
        <TechnicalBlueprint technicalParams={{}} isLoading />
      );

      expect(screen.getByText(/technical blueprint/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('returns null when there are no params and not loading', () => {
      const { container } = render(
        <TechnicalBlueprint technicalParams={null} isLoading={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('shows unlock message when params exist but are empty', () => {
      render(
        <TechnicalBlueprint technicalParams={{ camera: null }} isLoading={false} />
      );

      expect(
        screen.getByText(/add at least three detailed elements/i)
      ).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders ordered sections with nested values', () => {
      const { container } = render(
        <TechnicalBlueprint
          technicalParams={{
            lighting: { key: 'soft', details: ['diffused'] },
            camera: ['dolly', 'pan'],
            custom: 'extra note',
          }}
          isLoading={false}
        />
      );

      expect(screen.getByText('Camera')).toBeInTheDocument();
      expect(screen.getByText('Lighting')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('dolly')).toBeInTheDocument();
      expect(screen.getByText('pan')).toBeInTheDocument();
      expect(screen.getByText(/Key:/)).toBeInTheDocument();
      expect(screen.getByText('soft')).toBeInTheDocument();
      expect(screen.getByText('diffused')).toBeInTheDocument();

      const text = container.textContent || '';
      expect(text.indexOf('Camera')).toBeLessThan(text.indexOf('Lighting'));
    });
  });
});
