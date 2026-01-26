import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { ContextPreviewBadge, ContextIndicatorBanner, ContextFieldTag } from '@/components/ContextPreviewBadge';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('ContextPreviewBadge components', () => {
  describe('error handling', () => {
    it('renders nothing when context is null', () => {
      const { container } = render(<ContextPreviewBadge context={null} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when context values are blank', () => {
      const { container } = render(
        <ContextPreviewBadge
          context={{
            specificAspects: '   ',
            backgroundLevel: '',
            intendedUse: undefined,
          }}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('truncates long context field values and keeps full title', () => {
      const onRemove = vi.fn();
      render(
        <ContextFieldTag
          label="Focus"
          value="This is a very long context string that should be truncated"
          onRemove={onRemove}
        />
      );

      const tag = screen.getByText(/This is a very long context/);
      expect(tag.textContent?.endsWith('...')).toBe(true);
      expect((tag.textContent ?? '').length).toBeLessThan('This is a very long context string that should be truncated'.length);
      expect(tag).toHaveAttribute('title', 'This is a very long context string that should be truncated');

      fireEvent.click(screen.getByRole('button', { name: 'Remove Focus' }));
      expect(onRemove).toHaveBeenCalled();
    });

    it('only renders provided fields in the indicator banner', () => {
      render(
        <ContextIndicatorBanner
          context={{
            specificAspects: 'Tone and pacing',
          }}
        />
      );

      expect(screen.getByText('Focus Areas:')).toBeInTheDocument();
      expect(screen.queryByText('Audience Level:')).toBeNull();
      expect(screen.queryByText('Use Case:')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('shows the active field count and clears context when requested', () => {
      const onClear = vi.fn();
      render(
        <ContextPreviewBadge
          context={{
            specificAspects: 'Focus',
            backgroundLevel: 'Beginner',
          }}
          onClear={onClear}
        />
      );

      expect(screen.getByText('Context: 2 fields')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear context' }));
      expect(onClear).toHaveBeenCalled();
    });
  });
});
