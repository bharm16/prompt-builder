/**
 * Highlight Styles Configuration
 * 
 * CSS class names and style properties for highlight elements.
 */

/**
 * Get CSS class name for a category
 */
export function getHighlightClassName(category) {
  return `value-word value-word-${category}`;
}

/**
 * Default highlight styles
 */
export const HIGHLIGHT_STYLES = {
  padding: '1px 3px',
  borderRadius: '3px',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
};

/**
 * Apply styles to a highlight element
 */
export function applyHighlightStyles(element, color) {
  if (!color) return;
  
  element.style.backgroundColor = color.bg;
  element.style.borderBottom = `${HIGHLIGHT_STYLES.borderBottomWidth} ${HIGHLIGHT_STYLES.borderBottomStyle} ${color.border}`;
  element.style.padding = HIGHLIGHT_STYLES.padding;
  element.style.borderRadius = HIGHLIGHT_STYLES.borderRadius;
}

