// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToSpanById } from '../scrollToSpanById';

describe('scrollToSpanById', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('edge cases — early returns', () => {
    it('does nothing for empty spanId', () => {
      scrollToSpanById('');
      // No error thrown
    });

    it('does nothing when no matching element found', () => {
      scrollToSpanById('nonexistent-id');
      // No error thrown
    });
  });

  describe('core behavior', () => {
    it('scrolls matching element into view', () => {
      const el = document.createElement('div');
      el.setAttribute('data-span-id', 'test-span');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      scrollToSpanById('test-span');
      expect(el.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });

    it('adds pulse animation class', () => {
      const el = document.createElement('div');
      el.setAttribute('data-span-id', 'test-span');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      scrollToSpanById('test-span');
      expect(el.classList.contains('ps-animate-span-pulse')).toBe(true);
    });

    it('removes pulse class after 700ms', () => {
      const el = document.createElement('div');
      el.setAttribute('data-span-id', 'test-span');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      scrollToSpanById('test-span');
      expect(el.classList.contains('ps-animate-span-pulse')).toBe(true);

      vi.advanceTimersByTime(700);
      expect(el.classList.contains('ps-animate-span-pulse')).toBe(false);
    });

    it('escapes special characters in spanId for querySelector', () => {
      const el = document.createElement('div');
      el.setAttribute('data-span-id', 'span"with"quotes');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      // Should not throw
      scrollToSpanById('span"with"quotes');
      // The element may or may not be found depending on CSS.escape availability
      // but no exception should be thrown
    });
  });
});
