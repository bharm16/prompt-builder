import { describe, expect, it } from 'vitest';

import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_MAP,
  SUGGESTION_TRIGGERS,
} from '@features/prompt-optimizer/PromptCanvas/constants';

describe('promptCanvas constants', () => {
  describe('error handling', () => {
    it('does not define mappings for unsupported extensions', () => {
      expect(Object.prototype.hasOwnProperty.call(EXPORT_FORMAT_MAP, 'pdf')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(EXPORT_FORMAT_MAP, 'docx')).toBe(false);
    });

    it('rejects unknown suggestion triggers', () => {
      expect(SUGGESTION_TRIGGERS).not.toContain('keyboard');
      expect(SUGGESTION_TRIGGERS).not.toContain('clipboard');
    });
  });

  describe('edge cases', () => {
    it('keeps export format map values aligned with supported formats', () => {
      const formatSet = new Set(EXPORT_FORMATS);

      Object.values(EXPORT_FORMAT_MAP).forEach((value) => {
        expect(formatSet.has(value)).toBe(true);
      });
    });
  });

  describe('core behavior', () => {
    it('defines canonical export formats, aliases, and suggestion triggers', () => {
      expect(EXPORT_FORMATS).toEqual(['text', 'markdown', 'json']);
      expect(EXPORT_FORMAT_MAP).toEqual({
        md: 'markdown',
        markdown: 'markdown',
        txt: 'text',
        text: 'text',
        json: 'json',
      });
      expect(SUGGESTION_TRIGGERS).toEqual(['selection', 'highlight', 'bento-grid']);
    });
  });
});
