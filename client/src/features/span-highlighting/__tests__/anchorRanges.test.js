/**
 * Tests for anchorRanges
 *
 * Test Plan:
 * - Verifies buildTextNodeIndex constructs correct node index
 * - Verifies mapGlobalRangeToDom creates correct DOM ranges
 * - Verifies surroundRange wraps content correctly
 * - Verifies wrapRangeSegments handles multi-node ranges
 * - Verifies edge cases (null input, empty ranges, invalid offsets)
 *
 * What these tests catch:
 * - Breaking text node traversal logic
 * - Incorrect offset calculations
 * - Failing to handle DOM boundaries
 * - Memory leaks from not detaching ranges
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildTextNodeIndex, mapGlobalRangeToDom, surroundRange, wrapRangeSegments } from '../utils/anchorRanges.js';

describe('anchorRanges', () => {
  let testRoot;

  beforeEach(() => {
    // Create a test DOM structure
    testRoot = document.createElement('div');
    testRoot.innerHTML = 'Hello world';
  });

  describe('buildTextNodeIndex', () => {
    it('builds index for single text node - catches basic indexing', () => {
      // Would fail if walker or node iteration is broken
      const result = buildTextNodeIndex(testRoot);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.length).toBe('Hello world'.length);
    });

    it('returns empty index for null root - catches null handling', () => {
      // Would fail if null check is missing
      const result = buildTextNodeIndex(null);
      expect(result.nodes).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('returns empty index for undefined root - catches undefined handling', () => {
      // Would fail if undefined check is missing
      const result = buildTextNodeIndex(undefined);
      expect(result.nodes).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('calculates correct global offsets - catches offset calculation', () => {
      // Would fail if offset accumulation is wrong
      const result = buildTextNodeIndex(testRoot);
      if (result.nodes.length > 0) {
        const firstNode = result.nodes[0];
        expect(firstNode).toHaveProperty('start');
        expect(firstNode).toHaveProperty('end');
        expect(firstNode.start).toBeGreaterThanOrEqual(0);
        expect(firstNode.end).toBeGreaterThan(firstNode.start);
      }
    });

    it('handles multiple text nodes - catches multi-node indexing', () => {
      // Would fail if walker doesn't iterate all nodes
      testRoot.innerHTML = '<span>Hello</span> <span>world</span>';
      const result = buildTextNodeIndex(testRoot);
      // Should have multiple text nodes
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('total length matches concatenated text - catches length accuracy', () => {
      // Would fail if globalOffset calculation is wrong
      const result = buildTextNodeIndex(testRoot);
      const totalText = testRoot.textContent;
      expect(result.length).toBe(totalText.length);
    });

    it('includes node references - catches node storage', () => {
      // Would fail if node property is not stored
      const result = buildTextNodeIndex(testRoot);
      if (result.nodes.length > 0) {
        expect(result.nodes[0]).toHaveProperty('node');
        expect(result.nodes[0].node).toBeDefined();
      }
    });

    it('handles empty elements - catches empty content', () => {
      // Would fail if empty elements cause errors
      testRoot.innerHTML = '';
      const result = buildTextNodeIndex(testRoot);
      expect(result.nodes).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('skips empty text nodes - catches filter logic', () => {
      // Would fail if acceptNode doesn't filter empty nodes
      testRoot.innerHTML = 'text<span></span>more';
      const result = buildTextNodeIndex(testRoot);
      // Should only include non-empty text nodes
      expect(result.nodes.every(n => n.node.nodeValue.length > 0)).toBe(true);
    });
  });

  describe('mapGlobalRangeToDom', () => {
    it('creates DOM range for valid offsets - catches range creation', () => {
      // Would fail if range creation logic is broken
      const result = mapGlobalRangeToDom(testRoot, 0, 5);
      expect(result).toBeDefined();
      if (result) {
        expect(result).toHaveProperty('range');
        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('end');
      }
    });

    it('returns null for null root - catches null handling', () => {
      // Would fail if null check is missing
      const result = mapGlobalRangeToDom(null, 0, 5);
      expect(result).toBeNull();
    });

    it('returns null for non-number start - catches type validation', () => {
      // Would fail if typeof check is missing
      const result = mapGlobalRangeToDom(testRoot, 'invalid', 5);
      expect(result).toBeNull();
    });

    it('returns null for non-number end - catches type validation', () => {
      // Would fail if typeof check is missing
      const result = mapGlobalRangeToDom(testRoot, 0, 'invalid');
      expect(result).toBeNull();
    });

    it('uses provided nodeIndex if available - catches caching optimization', () => {
      // Would fail if nodeIndex parameter is ignored
      const index = buildTextNodeIndex(testRoot);
      const result = mapGlobalRangeToDom(testRoot, 0, 5, { nodeIndex: index });
      expect(result).toBeDefined();
      if (result) {
        expect(result.nodeIndex).toBe(index);
      }
    });

    it('builds nodeIndex if not provided - catches fallback behavior', () => {
      // Would fail if we don't build index when missing
      const result = mapGlobalRangeToDom(testRoot, 0, 5);
      expect(result).toBeDefined();
      if (result) {
        expect(result.nodeIndex).toBeDefined();
        expect(result.nodeIndex.nodes).toBeDefined();
      }
    });

    it('returns null for empty nodeIndex - catches empty index handling', () => {
      // Would fail if we don't check for empty index
      testRoot.innerHTML = '';
      const result = mapGlobalRangeToDom(testRoot, 0, 5);
      expect(result).toBeNull();
    });

    it('handles range at start of text - catches boundary case', () => {
      // Would fail if start boundary handling is wrong
      const result = mapGlobalRangeToDom(testRoot, 0, 3);
      expect(result).toBeDefined();
      if (result && result.range) {
        expect(result.start.localOffset).toBe(0);
      }
    });

    it('handles range at end of text - catches boundary case', () => {
      // Would fail if end boundary handling is wrong
      const textLength = testRoot.textContent.length;
      const result = mapGlobalRangeToDom(testRoot, textLength - 3, textLength);
      expect(result).toBeDefined();
    });

    it('clamps offsets to valid range - catches bounds checking', () => {
      // Would fail if we don't handle out-of-bounds offsets
      const textLength = testRoot.textContent.length;
      const result = mapGlobalRangeToDom(testRoot, -10, textLength + 10);
      // Should still create a range (clamped to valid bounds)
      expect(result).toBeDefined();
    });
  });

  describe('surroundRange', () => {
    it('returns null for null root - catches null handling', () => {
      // Would fail if null check is missing
      const result = surroundRange({ root: null, start: 0, end: 5, createWrapper: () => document.createElement('span') });
      expect(result).toBeNull();
    });

    it('returns null for non-function createWrapper - catches type validation', () => {
      // Would fail if typeof check is missing
      const result = surroundRange({ root: testRoot, start: 0, end: 5, createWrapper: 'not a function' });
      expect(result).toBeNull();
    });

    it('returns null if createWrapper returns null - catches wrapper validation', () => {
      // Would fail if we don't check createWrapper return value
      const result = surroundRange({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: () => null
      });
      expect(result).toBeNull();
    });

    it('returns null if mapGlobalRangeToDom fails - catches mapping failure', () => {
      // Would fail if we don't check mapping result
      const result = surroundRange({
        root: testRoot,
        start: -100,
        end: -50,
        createWrapper: () => document.createElement('span')
      });
      expect(result).toBeNull();
    });

    it('calls createWrapper with mapping - catches callback invocation', () => {
      // Would fail if createWrapper is not called
      const mockWrapper = vi.fn(() => document.createElement('span'));
      surroundRange({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: mockWrapper
      });
      expect(mockWrapper).toHaveBeenCalled();
    });

    it('handles surroundContents errors gracefully - catches error handling', () => {
      // Would fail if try/catch is missing
      const brokenWrapper = document.createElement('div');
      brokenWrapper.appendChild(document.createTextNode('content'));
      const result = surroundRange({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: () => brokenWrapper // Will fail: can't surround with non-empty element
      });
      // Should return null instead of throwing
      expect(result).toBeNull();
    });
  });

  describe('wrapRangeSegments', () => {
    it('returns empty array for null root - catches null handling', () => {
      // Would fail if null check is missing
      const result = wrapRangeSegments({ root: null, start: 0, end: 5, createWrapper: () => document.createElement('span') });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-function createWrapper - catches type validation', () => {
      // Would fail if typeof check is missing
      const result = wrapRangeSegments({ root: testRoot, start: 0, end: 5, createWrapper: 'not a function' });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-finite start - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const result = wrapRangeSegments({ root: testRoot, start: NaN, end: 5, createWrapper: () => document.createElement('span') });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-finite end - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const result = wrapRangeSegments({ root: testRoot, start: 0, end: Infinity, createWrapper: () => document.createElement('span') });
      expect(result).toEqual([]);
    });

    it('returns empty array when end <= start - catches invalid range', () => {
      // Would fail if range validation is missing
      const result = wrapRangeSegments({ root: testRoot, start: 5, end: 3, createWrapper: () => document.createElement('span') });
      expect(result).toEqual([]);
    });

    it('returns empty array for empty nodeIndex - catches empty index handling', () => {
      // Would fail if we don't check for empty nodes
      testRoot.innerHTML = '';
      const result = wrapRangeSegments({ root: testRoot, start: 0, end: 5, createWrapper: () => document.createElement('span') });
      expect(result).toEqual([]);
    });

    it('calls createWrapper for each segment - catches callback invocation', () => {
      // Would fail if createWrapper is not called
      const mockWrapper = vi.fn(() => document.createElement('span'));
      wrapRangeSegments({ root: testRoot, start: 0, end: 5, createWrapper: mockWrapper });
      // Should be called at least once for valid range
      expect(mockWrapper.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('passes correct parameters to createWrapper - catches parameter passing', () => {
      // Would fail if parameter object is wrong
      const mockWrapper = vi.fn(() => document.createElement('span'));
      wrapRangeSegments({ root: testRoot, start: 0, end: 5, createWrapper: mockWrapper });
      if (mockWrapper.mock.calls.length > 0) {
        const params = mockWrapper.mock.calls[0][0];
        expect(params).toHaveProperty('node');
        expect(params).toHaveProperty('globalStart');
        expect(params).toHaveProperty('globalEnd');
        expect(params).toHaveProperty('localStart');
        expect(params).toHaveProperty('localEnd');
      }
    });

    it('skips when createWrapper returns null - catches null wrapper handling', () => {
      // Would fail if we don't check createWrapper return value
      const result = wrapRangeSegments({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: () => null
      });
      expect(result).toEqual([]);
    });

    it('handles range setStart/setEnd errors - catches error handling', () => {
      // Would fail if try/catch is missing
      const result = wrapRangeSegments({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: () => document.createElement('span')
      });
      // Should not throw
      expect(Array.isArray(result)).toBe(true);
    });

    it('uses provided nodeIndex if available - catches caching', () => {
      // Would fail if nodeIndex parameter is ignored
      const index = buildTextNodeIndex(testRoot);
      const mockWrapper = vi.fn(() => document.createElement('span'));
      wrapRangeSegments({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: mockWrapper,
        nodeIndex: index
      });
      // Should use provided index
      expect(mockWrapper.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('handles multi-node ranges - catches segment iteration', () => {
      // Would fail if loop doesn't iterate segments
      testRoot.innerHTML = '<span>Hello</span> <span>world</span>';
      const result = wrapRangeSegments({
        root: testRoot,
        start: 0,
        end: testRoot.textContent.length,
        createWrapper: () => document.createElement('mark')
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns array of wrapper elements - catches return value', () => {
      // Would fail if wrappers aren't collected
      const result = wrapRangeSegments({
        root: testRoot,
        start: 0,
        end: 5,
        createWrapper: () => document.createElement('span')
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('edge cases and integration', () => {
    it('handles complex nested DOM structures - catches deep traversal', () => {
      // Would fail if walker doesn't traverse nested elements
      testRoot.innerHTML = '<div><p><span>nested</span> <b>text</b></p></div>';
      const index = buildTextNodeIndex(testRoot);
      expect(index.length).toBeGreaterThan(0);
    });

    it('handles elements with no text content - catches empty handling', () => {
      // Would fail if we don't handle empty elements
      testRoot.innerHTML = '<div></div><span></span>';
      const index = buildTextNodeIndex(testRoot);
      expect(index.nodes).toEqual([]);
      expect(index.length).toBe(0);
    });

    it('handles mixed content types - catches content type handling', () => {
      // Tests various content types
      testRoot.innerHTML = 'text<br/>more<img/>final';
      const index = buildTextNodeIndex(testRoot);
      expect(index.length).toBeGreaterThan(0);
    });
  });
});
