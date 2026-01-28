import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { PromptEditor } from '@features/prompt-optimizer/components/PromptEditor';

describe('PromptEditor', () => {
  describe('error handling', () => {
    it('invokes onHighlightMouseLeave when the pointer leaves', () => {
      const onHighlightMouseLeave = vi.fn();

      render(
        <PromptEditor
          onHighlightMouseLeave={onHighlightMouseLeave}
        />
      );

      fireEvent.mouseLeave(screen.getByRole('textbox'));

      expect(onHighlightMouseLeave).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('forwards mouse move events to onHighlightMouseEnter', () => {
      const onHighlightMouseEnter = vi.fn();

      render(
        <PromptEditor
          onHighlightMouseEnter={onHighlightMouseEnter}
        />
      );

      fireEvent.mouseMove(screen.getByRole('textbox'));

      expect(onHighlightMouseEnter).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('forwards copy events to the handler', () => {
      const onCopyEvent = vi.fn();

      render(
        <PromptEditor
          onCopyEvent={onCopyEvent}
        />
      );

      fireEvent.copy(screen.getByRole('textbox'));

      expect(onCopyEvent).toHaveBeenCalled();
    });
  });
});
