import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpanItem } from '@features/prompt-optimizer/SpanBentoGrid/components/SpanItem';
import type { Span } from '@features/prompt-optimizer/SpanBentoGrid/components/types';

const span: Span = { id: 'span-1', quote: 'hello', category: 'shot' };

describe('SpanItem', () => {
  describe('error handling', () => {
    it('clears hover state on mouse leave', () => {
      const onHoverChange = vi.fn();

      render(
        <SpanItem
          span={span}
          onHoverChange={onHoverChange}
          backgroundColor="red"
          borderColor="blue"
        />
      );

      fireEvent.mouseLeave(screen.getByRole('button'));

      expect(onHoverChange).toHaveBeenCalledWith(null);
    });
  });

  describe('edge cases', () => {
    it('sets hover state on mouse enter', () => {
      const onHoverChange = vi.fn();

      render(
        <SpanItem
          span={span}
          onHoverChange={onHoverChange}
          backgroundColor="red"
          borderColor="blue"
        />
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      expect(onHoverChange).toHaveBeenCalledWith('span-1');
    });
  });

  describe('core behavior', () => {
    it('calls onClick with the span data', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <SpanItem
          span={span}
          onClick={onClick}
          backgroundColor="red"
          borderColor="blue"
        />
      );

      await user.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledWith(span);
    });
  });
});
