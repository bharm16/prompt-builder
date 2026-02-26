import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applySpanEditToPrompt } from '../applySpanEdit';

vi.mock('@utils/textQuoteRelocator', () => ({
  relocateQuote: vi.fn(),
}));

import { relocateQuote } from '@utils/textQuoteRelocator';

const mockedRelocate = vi.mocked(relocateQuote);

describe('applySpanEditToPrompt', () => {
  beforeEach(() => {
    mockedRelocate.mockReset();
  });

  describe('error handling — early returns', () => {
    it('returns null when prompt is empty', () => {
      const result = applySpanEditToPrompt({
        prompt: '',
        edit: { type: 'replaceSpanText', replacementText: 'new' },
      });
      expect(result.updatedPrompt).toBeNull();
    });

    it('returns null when no quote can be derived', () => {
      const result = applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'new' },
        span: null,
      });
      expect(result.updatedPrompt).toBeNull();
    });

    it('returns null when span text is whitespace-only', () => {
      const result = applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'new' },
        span: { text: '   ' },
      });
      expect(result.updatedPrompt).toBeNull();
    });

    it('returns null when relocateQuote returns null (no match found)', () => {
      mockedRelocate.mockReturnValue(null);
      const result = applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'new' },
        span: { text: 'hello' },
      });
      expect(result.updatedPrompt).toBeNull();
    });

    it('returns null when replacement produces identical prompt', () => {
      mockedRelocate.mockReturnValue({ start: 0, end: 5, exact: true });
      const result = applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'hello' },
        span: { text: 'hello', start: 0, end: 5 },
      });
      expect(result.updatedPrompt).toBeNull();
    });
  });

  describe('quote derivation priority', () => {
    it('uses span.quote when available', () => {
      mockedRelocate.mockReturnValue({ start: 0, end: 5, exact: true });
      applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'hi' },
        span: { quote: 'hello', text: 'other', start: 0, end: 5 },
      });
      expect(mockedRelocate).toHaveBeenCalledWith(
        expect.objectContaining({ quote: 'hello' })
      );
    });

    it('falls back to span.text when no quote', () => {
      mockedRelocate.mockReturnValue({ start: 0, end: 5, exact: true });
      applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'hi' },
        span: { text: 'hello', start: 0, end: 5 },
      });
      expect(mockedRelocate).toHaveBeenCalledWith(
        expect.objectContaining({ quote: 'hello' })
      );
    });

    it('falls back to edit.anchorQuote when no span text', () => {
      mockedRelocate.mockReturnValue({ start: 0, end: 5, exact: true });
      applySpanEditToPrompt({
        prompt: 'hello world',
        edit: { type: 'replaceSpanText', replacementText: 'hi', anchorQuote: 'hello' },
      });
      expect(mockedRelocate).toHaveBeenCalledWith(
        expect.objectContaining({ quote: 'hello' })
      );
    });
  });

  describe('core behavior — replaceSpanText', () => {
    it('replaces matched text and returns new prompt with positions', () => {
      mockedRelocate.mockReturnValue({ start: 6, end: 11, exact: true });
      const result = applySpanEditToPrompt({
        prompt: 'hello world today',
        edit: { type: 'replaceSpanText', replacementText: 'earth' },
        span: { text: 'world', start: 6, end: 11 },
      });
      expect(result.updatedPrompt).toBe('hello earth today');
      expect(result.matchStart).toBe(6);
      expect(result.matchEnd).toBe(11);
    });
  });

  describe('core behavior — removeSpan', () => {
    it('removes the matched text (replaces with empty string)', () => {
      mockedRelocate.mockReturnValue({ start: 5, end: 11, exact: true });
      const result = applySpanEditToPrompt({
        prompt: 'hello world today',
        edit: { type: 'removeSpan' },
        span: { text: ' world', start: 5, end: 11 },
      });
      expect(result.updatedPrompt).toBe('hello today');
      expect(result.matchStart).toBe(5);
      expect(result.matchEnd).toBe(11);
    });
  });
});
