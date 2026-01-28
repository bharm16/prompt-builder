import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ConceptInputSection } from '../ConceptInputSection';

describe('ConceptInputSection', () => {
  describe('error handling', () => {
    it('disables parse button when concept is empty', async () => {
      const onParseConcept = vi.fn();
      const user = userEvent.setup();

      render(
        <ConceptInputSection
          concept=""
          onConceptChange={vi.fn()}
          onParseConcept={onParseConcept}
        />
      );

      const button = screen.getByRole('button', { name: /parse into elements/i });
      expect(button).toBeDisabled();

      await user.click(button);
      expect(onParseConcept).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('treats whitespace-only concept as non-empty for button enablement', () => {
      render(
        <ConceptInputSection
          concept="   "
          onConceptChange={vi.fn()}
          onParseConcept={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /parse into elements/i });
      expect(button).toBeEnabled();
    });
  });

  describe('core behavior', () => {
    it('updates concept value through onConceptChange', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [value, setValue] = useState('');
        return (
          <ConceptInputSection
            concept={value}
            onConceptChange={setValue}
            onParseConcept={vi.fn()}
          />
        );
      };

      render(<Wrapper />);

      const textarea = screen.getByPlaceholderText(/sleek sports car/i);
      await user.type(textarea, 'New concept');

      expect((textarea as HTMLTextAreaElement).value).toBe('New concept');
    });

    it('invokes onParseConcept when button is clicked', async () => {
      const onParseConcept = vi.fn();
      const user = userEvent.setup();

      render(
        <ConceptInputSection
          concept="A concept"
          onConceptChange={vi.fn()}
          onParseConcept={onParseConcept}
        />
      );

      await user.click(screen.getByRole('button', { name: /parse into elements/i }));
      expect(onParseConcept).toHaveBeenCalled();
    });
  });
});
