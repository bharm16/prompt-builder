/**
 * Unit tests for selectionUtils
 */

import { describe, expect, it } from 'vitest';

import {
  cleanSelectedText,
  extractMetadataFromSelection,
} from '@components/PromptEnhancementEditor/utils/selectionUtils';

function createSelection(anchorNode: Node | null, focusNode?: Node | null): Selection {
  return {
    anchorNode,
    focusNode: focusNode ?? anchorNode,
  } as Selection;
}

describe('selectionUtils', () => {
  describe('error handling', () => {
    it('returns null when selection is missing', () => {
      expect(extractMetadataFromSelection(null)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null when no highlighted element is found', () => {
      const container = document.createElement('div');
      container.textContent = 'plain text';
      const selection = createSelection(container.firstChild);

      expect(extractMetadataFromSelection(selection)).toBeNull();
    });

    it('returns null confidence when confidence is out of range', () => {
      const highlight = document.createElement('span');
      highlight.setAttribute('data-category', 'tone');
      highlight.setAttribute('data-confidence', '1.5');
      highlight.setAttribute('data-phrase', 'sparkling');
      highlight.textContent = 'sparkling';

      const selection = createSelection(highlight.firstChild);
      const metadata = extractMetadataFromSelection(selection);

      expect(metadata).toEqual({
        category: 'tone',
        phrase: 'sparkling',
        confidence: null,
      });
    });
  });

  describe('core behavior', () => {
    it('extracts metadata from a highlighted text node', () => {
      const highlight = document.createElement('span');
      highlight.setAttribute('data-category', 'mood');
      highlight.setAttribute('data-confidence', '0.72');
      highlight.setAttribute('data-phrase', 'serene');
      highlight.textContent = 'serene';

      const selection = createSelection(highlight.firstChild);
      const metadata = extractMetadataFromSelection(selection);

      expect(metadata).toEqual({
        category: 'mood',
        phrase: 'serene',
        confidence: 0.72,
      });
    });

    it('inspects the focus node when anchor does not match', () => {
      const container = document.createElement('div');
      const normal = document.createElement('span');
      normal.textContent = 'plain';
      const highlight = document.createElement('span');
      highlight.setAttribute('data-category', 'style');
      highlight.setAttribute('data-confidence', '0.5');
      highlight.setAttribute('data-phrase', 'noir');
      highlight.textContent = 'noir';

      container.appendChild(normal);
      container.appendChild(highlight);

      const selection = createSelection(normal.firstChild, highlight.firstChild);
      const metadata = extractMetadataFromSelection(selection);

      expect(metadata?.category).toBe('style');
      expect(metadata?.confidence).toBe(0.5);
    });

    it('removes leading dash and whitespace from selections', () => {
      expect(cleanSelectedText('-   Focus on light')).toBe('Focus on light');
      expect(cleanSelectedText(' - Not trimmed')).toBe(' - Not trimmed');
      expect(cleanSelectedText('No dash')).toBe('No dash');
    });
  });
});
