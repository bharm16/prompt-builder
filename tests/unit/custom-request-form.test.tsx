/**
 * Unit tests for CustomRequestForm
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ButtonHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { CustomRequestForm } from '@components/SuggestionsPanel/components/CustomRequestForm';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@promptstudio/system/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}));

describe('CustomRequestForm', () => {
  describe('error handling', () => {
    it('disables submit when loading', () => {
      render(
        <CustomRequestForm
          customRequest="Refine tone"
          isLoading
          onSubmit={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /Generating/i });
      expect(button).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('disables submit when request is empty', () => {
      render(<CustomRequestForm customRequest="" onSubmit={vi.fn()} />);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('updates custom request on change', async () => {
      const onCustomRequestChange = vi.fn();
      const user = userEvent.setup();

      render(
        <CustomRequestForm
          customRequest=""
          onCustomRequestChange={onCustomRequestChange}
        />
      );

      await user.type(screen.getByRole('textbox'), 'Add tension');

      expect(onCustomRequestChange).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('submits the form and calls onSubmit', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <CustomRequestForm
          customRequest="Add detail"
          onSubmit={onSubmit}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('renders token editor variant controls', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <CustomRequestForm
          customRequest="More cinematic"
          onSubmit={onSubmit}
          variant="tokenEditor"
          ctaLabel="Generate more"
        />
      );

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        expect.stringContaining('e.g. more cinematic')
      );

      await user.click(screen.getByRole('button'));
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});
