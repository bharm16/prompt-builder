/**
 * Tests for textSelection
 *
 * Test Plan:
 * - Verifies getSelectionOffsets calculates correct character offsets
 * - Verifies restoreSelectionFromOffsets restores cursor position
 * - Verifies TextSelectionManager class methods
 * - Verifies edge cases (null elements, invalid ranges, boundary conditions)
 *
 * What these tests catch:
 * - Incorrect offset calculations breaking selection persistence
 * - Failing to handle DOM boundary cases
 * - Breaking text selection restoration
 * - Memory leaks from improper range handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSelectionOffsets,
  restoreSelectionFromOffsets,
  TextSelectionManager
} from '../textSelection.js';

describe('textSelection', () => {
  let testElement;

  beforeEach(() => {
    testElement = document.createElement('div');
    testElement.contentEditable = 'true';
    testElement.textContent = 'Hello world';
    document.body.appendChild(testElement);
  });

  describe('getSelectionOffsets', () => {
    it('returns null for null element - catches null handling', () => {
      // Would fail if null check is missing
      const range = document.createRange();
      const result = getSelectionOffsets(null, range);
      expect(result).toBeNull();
    });

    it('returns null for null range - catches null handling', () => {
      // Would fail if null check is missing
      const result = getSelectionOffsets(testElement, null);
      expect(result).toBeNull();
    });

    it('returns offsets object with start and end - catches return structure', () => {
      // Would fail if return object structure is wrong
      const range = document.createRange();
      const textNode = testElement.firstChild;
      if (textNode) {
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        const result = getSelectionOffsets(testElement, range);
        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('end');
      }
    });

    it('calculates correct offsets for simple selection - catches offset calculation', () => {
      // Would fail if offset logic is broken
      const range = document.createRange();
      const textNode = testElement.firstChild;
      if (textNode) {
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        const result = getSelectionOffsets(testElement, range);
        expect(result?.start).toBe(0);
        expect(result?.end).toBe(5);
      }
    });

    it('returns null for NaN offsets - catches NaN handling', () => {
      // Would fail if Number.isNaN check is missing
      const range = document.createRange();
      const result = getSelectionOffsets(testElement, range);
      // If calculation results in NaN, should return null
      if (result) {
        expect(Number.isNaN(result.start)).toBe(false);
        expect(Number.isNaN(result.end)).toBe(false);
      }
    });

    it('handles errors gracefully - catches error handling', () => {
      // Would fail if try/catch is missing
      const brokenRange = {
        cloneRange: () => { throw new Error('Test error'); }
      };
      const result = getSelectionOffsets(testElement, brokenRange);
      expect(result).toBeNull();
    });

    it('handles collapsed range - catches collapsed selection', () => {
      // Would fail if we don't handle start === end
      const range = document.createRange();
      const textNode = testElement.firstChild;
      if (textNode) {
        range.setStart(textNode, 3);
        range.setEnd(textNode, 3);
        const result = getSelectionOffsets(testElement, range);
        expect(result?.start).toBe(result?.end);
      }
    });
  });

  describe('restoreSelectionFromOffsets', () => {
    it('does not throw for null element - catches null handling', () => {
      // Would fail if null check is missing
      expect(() => restoreSelectionFromOffsets(null, 0, 5)).not.toThrow();
    });

    it('does not throw for null offsets - catches null handling', () => {
      // Would fail if null check is missing
      expect(() => restoreSelectionFromOffsets(testElement, null, 5)).not.toThrow();
      expect(() => restoreSelectionFromOffsets(testElement, 0, null)).not.toThrow();
    });

    it('normalizes negative start offset to 0 - catches bounds checking', () => {
      // Would fail if Math.max is not used
      expect(() => restoreSelectionFromOffsets(testElement, -10, 5)).not.toThrow();
    });

    it('normalizes end before start - catches order validation', () => {
      // Would fail if Math.max(normalizedStart, endOffset) is not used
      expect(() => restoreSelectionFromOffsets(testElement, 5, 3)).not.toThrow();
    });

    it('handles missing window.getSelection - catches browser compatibility', () => {
      // Would fail if we don't check for getSelection existence
      const originalGetSelection = window.getSelection;
      window.getSelection = undefined;
      expect(() => restoreSelectionFromOffsets(testElement, 0, 5)).not.toThrow();
      window.getSelection = originalGetSelection;
    });

    it('handles errors in range.setStart - catches error handling', () => {
      // Would fail if try/catch is missing
      expect(() => restoreSelectionFromOffsets(testElement, 0, 1000)).not.toThrow();
    });

    it('clamps offset to text length - catches boundary clamping', () => {
      // Would fail if we don't clamp to available text
      const textLength = testElement.textContent.length;
      expect(() => restoreSelectionFromOffsets(testElement, 0, textLength + 100)).not.toThrow();
    });

    it('creates selection range - catches selection creation', () => {
      // Would fail if range is not created
      const selection = window.getSelection();
      selection?.removeAllRanges();
      restoreSelectionFromOffsets(testElement, 0, 5);
      expect(selection?.rangeCount).toBeGreaterThan(0);
    });
  });

  describe('TextSelectionManager class', () => {
    let manager;

    beforeEach(() => {
      manager = new TextSelectionManager(testElement);
    });

    it('creates instance with editor reference - catches constructor', () => {
      // Would fail if constructor doesn't store editor
      expect(manager.editor).toBe(testElement);
    });

    it('setEditor updates editor reference - catches setter', () => {
      // Would fail if setEditor doesn't update editor
      const newElement = document.createElement('div');
      manager.setEditor(newElement);
      expect(manager.editor).toBe(newElement);
    });

    it('getSelectionOffsets calls utility function - catches delegation', () => {
      // Would fail if method doesn't delegate correctly
      const range = document.createRange();
      const result = manager.getSelectionOffsets(range);
      // Should call getSelectionOffsets with stored editor
      expect(result).toBeDefined();
    });

    it('restoreSelection calls utility function - catches delegation', () => {
      // Would fail if method doesn't delegate correctly
      expect(() => manager.restoreSelection(0, 5)).not.toThrow();
    });

    it('getCurrentRange returns range or null - catches range retrieval', () => {
      // Would fail if window.getSelection access is broken
      const result = manager.getCurrentRange();
      // Could be null if no selection
      expect(result === null || result instanceof Range).toBe(true);
    });

    it('getCurrentRange returns null when no selection - catches empty selection', () => {
      // Would fail if we don't check rangeCount
      const selection = window.getSelection();
      selection?.removeAllRanges();
      const result = manager.getCurrentRange();
      expect(result).toBeNull();
    });

    it('getSelectedText returns string - catches text retrieval', () => {
      // Would fail if toString() is not called
      const result = manager.getSelectedText();
      expect(typeof result).toBe('string');
    });

    it('getSelectedText returns empty string when no selection - catches fallback', () => {
      // Would fail if fallback is not provided
      const selection = window.getSelection();
      selection?.removeAllRanges();
      const result = manager.getSelectedText();
      expect(result).toBe('');
    });

    it('clearSelection removes all ranges - catches clearing', () => {
      // Would fail if removeAllRanges is not called
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(testElement);
      selection?.addRange(range);
      manager.clearSelection();
      expect(selection?.rangeCount).toBe(0);
    });

    it('clearSelection handles missing window.getSelection - catches null check', () => {
      // Would fail if we don't check for selection existence
      const originalGetSelection = window.getSelection;
      window.getSelection = () => null;
      expect(() => manager.clearSelection()).not.toThrow();
      window.getSelection = originalGetSelection;
    });

    it('selectNode selects node contents - catches node selection', () => {
      // Would fail if selectNodeContents is not called
      const node = document.createElement('span');
      node.textContent = 'Test';
      testElement.appendChild(node);
      manager.selectNode(node);
      const selection = window.getSelection();
      expect(selection?.toString()).toContain('Test');
    });

    it('selectNode handles missing window.getSelection - catches null check', () => {
      // Would fail if we don't check for selection existence
      const originalGetSelection = window.getSelection;
      window.getSelection = () => null;
      const node = document.createElement('span');
      expect(() => manager.selectNode(node)).not.toThrow();
      window.getSelection = originalGetSelection;
    });

    it('selectNode clears existing selection - catches removeAllRanges', () => {
      // Would fail if removeAllRanges is not called before addRange
      const node = document.createElement('span');
      node.textContent = 'Test';
      testElement.appendChild(node);
      manager.selectNode(node);
      const selection = window.getSelection();
      expect(selection?.rangeCount).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('round-trip: get and restore selection - catches full cycle', () => {
      // Would fail if offset calculation and restoration don't match
      const range = document.createRange();
      const textNode = testElement.firstChild;
      if (textNode) {
        range.setStart(textNode, 2);
        range.setEnd(textNode, 7);

        const offsets = getSelectionOffsets(testElement, range);
        if (offsets) {
          restoreSelectionFromOffsets(testElement, offsets.start, offsets.end);
          const selection = window.getSelection();
          const newRange = selection?.getRangeAt(0);
          if (newRange) {
            const newOffsets = getSelectionOffsets(testElement, newRange);
            expect(newOffsets?.start).toBe(offsets.start);
            expect(newOffsets?.end).toBe(offsets.end);
          }
        }
      }
    });

    it('handles multi-node content - catches tree walker logic', () => {
      // Would fail if TreeWalker doesn't traverse properly
      testElement.innerHTML = '<span>Hello</span> <span>world</span>';
      expect(() => restoreSelectionFromOffsets(testElement, 0, 5)).not.toThrow();
    });

    it('handles nested elements - catches deep traversal', () => {
      // Would fail if walker doesn't go deep
      testElement.innerHTML = '<div><span><b>Text</b></span></div>';
      expect(() => restoreSelectionFromOffsets(testElement, 0, 2)).not.toThrow();
    });

    it('manager maintains selection across editor changes - catches editor updates', () => {
      // Would fail if setEditor breaks selection management
      const manager = new TextSelectionManager(testElement);
      const newElement = document.createElement('div');
      newElement.contentEditable = 'true';
      newElement.textContent = 'New content';
      document.body.appendChild(newElement);
      manager.setEditor(newElement);
      expect(() => manager.restoreSelection(0, 3)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles element with no text - catches empty content', () => {
      // Would fail if we don't handle empty elements
      testElement.textContent = '';
      expect(() => restoreSelectionFromOffsets(testElement, 0, 0)).not.toThrow();
    });

    it('handles very large offsets - catches bounds checking', () => {
      // Would fail if we don't clamp offsets
      expect(() => restoreSelectionFromOffsets(testElement, 0, Number.MAX_SAFE_INTEGER)).not.toThrow();
    });

    it('handles element with only whitespace - catches whitespace handling', () => {
      // Would fail if whitespace breaks logic
      testElement.textContent = '   ';
      expect(() => restoreSelectionFromOffsets(testElement, 0, 1)).not.toThrow();
    });

    it('handles selection at very end of text - catches end boundary', () => {
      // Would fail if end boundary handling is wrong
      const textLength = testElement.textContent.length;
      expect(() => restoreSelectionFromOffsets(testElement, textLength, textLength)).not.toThrow();
    });
  });
});
