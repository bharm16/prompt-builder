import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RefinementSuggestions } from '../RefinementSuggestions';
import type { ElementConfig } from '../types';

describe('RefinementSuggestions', () => {
  const elementConfig: Record<string, ElementConfig> = {
    subject: {
      icon: () => null,
      label: 'Subject',
      placeholder: 'Subject',
      color: 'slate',
      examples: [],
      group: 'core',
      optional: false,
      taxonomyId: null,
    },
  };

  describe('error handling', () => {
    it('renders header when fetching refinements', () => {
      render(
        <RefinementSuggestions
          refinements={{}}
          isLoading
          elementConfig={elementConfig}
          onApplyRefinement={vi.fn()}
        />
      );

      expect(screen.getByText(/ai refinement suggestions/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('returns null when there are no refinements and not loading', () => {
      const { container } = render(
        <RefinementSuggestions
          refinements={{}}
          isLoading={false}
          elementConfig={elementConfig}
          onApplyRefinement={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('renders refinement options and applies selection', async () => {
      const onApplyRefinement = vi.fn();
      const user = userEvent.setup();

      render(
        <RefinementSuggestions
          refinements={{ subject: ['option a'], cameraMovement: ['slow dolly'] }}
          isLoading={false}
          elementConfig={elementConfig}
          onApplyRefinement={onApplyRefinement}
        />
      );

      expect(screen.getByText('Subject')).toBeInTheDocument();
      expect(screen.getByText('Camera Movement')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'option a' }));

      expect(onApplyRefinement).toHaveBeenCalledWith('subject', 'option a');
      expect(screen.getByRole('button', { name: 'slow dolly' })).toBeInTheDocument();
    });
  });
});
