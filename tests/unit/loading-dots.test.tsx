import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { LoadingDots } from '@/components/LoadingDots';

describe('LoadingDots', () => {
  describe('error handling', () => {
    it('falls back to the default size for unsupported numeric values', () => {
      const { container } = render(<LoadingDots size={0} />);
      const dots = container.querySelectorAll('div > div');

      expect(dots).toHaveLength(3);
      expect(dots[0].className).toContain('h-1.5');
      expect(dots[0].className).toContain('w-1.5');
    });

    it('uses the default size when numeric size is not mapped', () => {
      const { container } = render(<LoadingDots size={99} />);
      const dots = container.querySelectorAll('div > div');

      expect(dots[1].className).toContain('h-1.5');
      expect(dots[1].className).toContain('w-1.5');
    });
  });

  describe('edge cases', () => {
    it('supports small named sizes', () => {
      const { container } = render(<LoadingDots size="sm" />);
      const dots = container.querySelectorAll('div > div');

      expect(dots[0].className).toContain('h-1');
      expect(dots[0].className).toContain('w-1');
    });

    it('supports mapped numeric sizes', () => {
      const { container } = render(<LoadingDots size={5} />);
      const dots = container.querySelectorAll('div > div');

      expect(dots[2].className).toContain('h-2');
      expect(dots[2].className).toContain('w-2');
    });
  });

  describe('core behavior', () => {
    it('renders three animated dots and applies custom className', () => {
      const { container } = render(<LoadingDots className="custom" />);
      const dots = container.querySelectorAll('div > div');

      expect(dots).toHaveLength(3);
      expect(container.firstChild).toHaveClass('custom');
    });
  });
});
