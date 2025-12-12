import { describe, it, expect } from 'vitest';
import { buildTextNodeIndex, surroundRange } from '../../features/span-highlighting/utils/anchorRanges';

const createRoot = (html: string): HTMLElement => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

describe('anchorRanges', () => {
  it('builds a text index with cumulative length', () => {
    const root = createRoot('<p>hello</p><p>world</p>');
    const index = buildTextNodeIndex(root);
    expect(index.length).toBe('helloworld'.length);
    expect(index.nodes).toHaveLength(2);
  });

  it('surrounds a range with a wrapper element', () => {
    const root = createRoot('<p>hello world</p>');
    const wrapper = surroundRange({
      root,
      start: 0,
      end: 5,
      createWrapper: () => document.createElement('mark'),
    });

    expect(wrapper?.tagName).toBe('MARK');
    expect(root.querySelector('mark')?.textContent).toBe('hello');
  });

  it('returns null when inputs are invalid', () => {
    const result = surroundRange({
      root: null,
      start: 0,
      end: 1,
      createWrapper: () => document.createElement('span'),
    });
    expect(result).toBeNull();
  });
});
