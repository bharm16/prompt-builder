import type { HighlightMetadata } from '../types';

/**
 * Extracts metadata from a DOM selection by finding the closest element
 * with data-category attribute.
 */
export function extractMetadataFromSelection(selection: Selection | null): HighlightMetadata | null {
  if (!selection) return null;

  const nodesToInspect: Node[] = [];
  if (selection.anchorNode) nodesToInspect.push(selection.anchorNode);
  if (selection.focusNode && selection.focusNode !== selection.anchorNode) {
    nodesToInspect.push(selection.focusNode);
  }

  for (const node of nodesToInspect) {
    if (!node) continue;

    const element =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const highlightElement = element?.closest
      ? element.closest('[data-category]')
      : null;

    if (highlightElement) {
      const category = highlightElement.getAttribute('data-category');
      const confidenceAttr = highlightElement.getAttribute('data-confidence');
      const phrase = highlightElement.getAttribute('data-phrase');

      const parsedConfidence =
        confidenceAttr !== null && confidenceAttr !== undefined
          ? Number.parseFloat(confidenceAttr)
          : null;

      const normalizedConfidence =
        typeof parsedConfidence === 'number' &&
        Number.isFinite(parsedConfidence) &&
        parsedConfidence >= 0 &&
        parsedConfidence <= 1
          ? parsedConfidence
          : null;

      return {
        category: category || null,
        phrase: phrase || null,
        confidence: normalizedConfidence,
      };
    }
  }

  return null;
}

/**
 * Cleans selected text by removing leading dash and whitespace from bullet points.
 */
export function cleanSelectedText(text: string): string {
  return text.replace(/^-\s*/, '');
}
