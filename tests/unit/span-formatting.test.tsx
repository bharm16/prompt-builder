import type React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { scrollToSpan } from '@features/prompt-optimizer/SpanBentoGrid/utils/spanFormatting';

const { warnSpy } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      warn: warnSpy,
    }),
  },
}));

describe('scrollToSpan', () => {
  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('returns early when editorRef or span is missing', () => {
      const ref = { current: null } as unknown as React.RefObject<HTMLElement>;

      expect(() => scrollToSpan(ref, undefined)).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs when the span wrapper cannot be found', () => {
      const container = document.createElement('div');
      const ref = { current: container } as React.RefObject<HTMLElement>;

      scrollToSpan(ref, { id: 'missing' });

      expect(warnSpy).toHaveBeenCalledWith(
        'Span not found in editor',
        expect.objectContaining({ spanId: 'missing' })
      );
    });
  });

  describe('core behavior', () => {
    it('scrolls into view and removes pulse class after animation', () => {
      vi.useFakeTimers();

      const container = document.createElement('div');
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-span-id', 'span-1');
      wrapper.scrollIntoView = vi.fn();
      container.appendChild(wrapper);

      const ref = { current: container } as React.RefObject<HTMLElement>;

      scrollToSpan(ref, { id: 'span-1' });

      expect(wrapper.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      expect(wrapper.classList.contains('ps-animate-span-pulse')).toBe(true);

      vi.advanceTimersByTime(700);

      expect(wrapper.classList.contains('ps-animate-span-pulse')).toBe(false);
    });
  });
});
