/**
 * Text Selection Manager
 * Handles text selection and cursor position management in contentEditable elements
 */

export interface SelectionOffsets {
  start: number;
  end: number;
}

interface NodePosition {
  node: Node;
  offset: number;
}

/**
 * Gets the character offsets of a selection range within an element
 */
export const getSelectionOffsets = (
  editorElement: HTMLElement | null,
  range: Range | null
): SelectionOffsets | null => {
  if (!editorElement || !range) {
    return null;
  }

  try {
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorElement);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);

    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return null;
    }

    return { start, end };
  } catch (error) {
    console.error('Error computing selection offsets:', error);
    return null;
  }
};

/**
 * Selects a Range object in the browser's selection
 */
export const selectRange = (range: Range | null): void => {
  if (!range) {
    return;
  }

  const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
  if (typeof getSelectionFn !== 'function') {
    return;
  }

  const selection = getSelectionFn.call(window);
  if (!selection || typeof selection.removeAllRanges !== 'function' || typeof selection.addRange !== 'function') {
    return;
  }

  try {
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (error) {
    console.error('Error selecting range:', error);
  }
};

/**
 * Restores a text selection in an element from character offsets
 */
export const restoreSelectionFromOffsets = (
  element: HTMLElement | null,
  startOffset: number | null | undefined,
  endOffset: number | null | undefined
): void => {
  if (!element || startOffset == null || endOffset == null) {
    return;
  }

  const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
  if (typeof getSelectionFn !== 'function') {
    return;
  }

  const selection = getSelectionFn.call(window);
  if (!selection || typeof selection.removeAllRanges !== 'function' || typeof selection.addRange !== 'function') {
    return;
  }

  const normalizedStart = Math.max(0, startOffset);
  const normalizedEnd = Math.max(normalizedStart, endOffset);

  const findPosition = (offset: number): NodePosition | null => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode = walker.nextNode();
    let accumulated = 0;
    let lastNode: Node | null = null;

    while (currentNode) {
      const textLength = currentNode.textContent?.length ?? 0;
      if (offset <= accumulated + textLength) {
        return {
          node: currentNode,
          offset: Math.min(textLength, Math.max(0, offset - accumulated)),
        };
      }

      accumulated += textLength;
      lastNode = currentNode;
      currentNode = walker.nextNode();
    }

    if (lastNode) {
      return { node: lastNode, offset: lastNode.textContent?.length ?? 0 };
    }

    return { node: element, offset: element.childNodes.length };
  };

  const startPosition = findPosition(normalizedStart);
  const endPosition = findPosition(normalizedEnd);

  if (!startPosition?.node || !endPosition?.node) {
    return;
  }

  const range = document.createRange();

  try {
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
  } catch (error) {
    console.error('Error restoring selection offsets:', error);
    return;
  }

  try {
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (error) {
    console.error('Error applying selection range:', error);
  }
};

/**
 * TextSelectionManager class for managing selections in an editor
 */
export class TextSelectionManager {
  private editor: HTMLElement | null;

  constructor(editorElement: HTMLElement | null) {
    this.editor = editorElement;
  }

  /**
   * Updates the editor element reference
   */
  setEditor(editorElement: HTMLElement | null): void {
    this.editor = editorElement;
  }

  /**
   * Gets the selection offsets for the current editor
   */
  getSelectionOffsets(range: Range | null): SelectionOffsets | null {
    return getSelectionOffsets(this.editor, range);
  }

  /**
   * Restores selection from offsets for the current editor
   */
  restoreSelection(startOffset: number | null, endOffset: number | null): void {
    return restoreSelectionFromOffsets(this.editor, startOffset, endOffset);
  }

  /**
   * Gets the current selection range
   */
  getCurrentRange(): Range | null {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return null;
    const selection = getSelectionFn.call(window);
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    return selection.getRangeAt(0);
  }

  /**
   * Gets the currently selected text
   */
  getSelectedText(): string {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return '';
    const selection = getSelectionFn.call(window);
    return selection ? selection.toString() : '';
  }

  /**
   * Clears the current selection
   */
  clearSelection(): void {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return;
    const selection = getSelectionFn.call(window);
    if (!selection || typeof selection.removeAllRanges !== 'function') return;
    selection.removeAllRanges();
  }

  /**
   * Selects the contents of a specific node
   */
  selectNode(node: Node): void {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return;
    const selection = getSelectionFn.call(window);
    if (!selection || typeof selection.removeAllRanges !== 'function' || typeof selection.addRange !== 'function') return;

    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

