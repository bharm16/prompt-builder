/**
 * Text Selection Manager
 * Handles text selection and cursor position management in contentEditable elements
 */

/**
 * Gets the character offsets of a selection range within an element
 * @param {HTMLElement} editorElement - The contentEditable element
 * @param {Range} range - The selection range
 * @returns {Object|null} { start: number, end: number } or null if invalid
 */
export const getSelectionOffsets = (editorElement, range) => {
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
 * Restores a text selection in an element from character offsets
 * @param {HTMLElement} element - The contentEditable element
 * @param {number} startOffset - The start character offset
 * @param {number} endOffset - The end character offset
 */
export const restoreSelectionFromOffsets = (element, startOffset, endOffset) => {
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

  const findPosition = (offset) => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode = walker.nextNode();
    let accumulated = 0;
    let lastNode = null;

    while (currentNode) {
      const textLength = currentNode.textContent.length;
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
      return { node: lastNode, offset: lastNode.textContent.length };
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
  constructor(editorElement) {
    this.editor = editorElement;
  }

  /**
   * Updates the editor element reference
   */
  setEditor(editorElement) {
    this.editor = editorElement;
  }

  /**
   * Gets the selection offsets for the current editor
   */
  getSelectionOffsets(range) {
    return getSelectionOffsets(this.editor, range);
  }

  /**
   * Restores selection from offsets for the current editor
   */
  restoreSelection(startOffset, endOffset) {
    return restoreSelectionFromOffsets(this.editor, startOffset, endOffset);
  }

  /**
   * Gets the current selection range
   */
  getCurrentRange() {
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
  getSelectedText() {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return '';
    const selection = getSelectionFn.call(window);
    return selection ? selection.toString() : '';
  }

  /**
   * Clears the current selection
   */
  clearSelection() {
    const getSelectionFn = typeof window !== 'undefined' ? window.getSelection : null;
    if (typeof getSelectionFn !== 'function') return;
    const selection = getSelectionFn.call(window);
    if (!selection || typeof selection.removeAllRanges !== 'function') return;
    selection.removeAllRanges();
  }

  /**
   * Selects the contents of a specific node
   */
  selectNode(node) {
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
