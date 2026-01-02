/**
 * Highlight Styles Configuration
 * 
 * CSS class names and style properties for highlight elements.
 */

export interface HighlightColor {
  bg: string;
  border: string;
}

/**
 * Get CSS class name for a category
 */
export function getHighlightClassName(category: string | null | undefined): string {
  return `value-word value-word-${category ?? ''}`;
}

/**
 * Default highlight styles
 */
export const HIGHLIGHT_STYLES = {
  // Pill-shaped highlights
  padding: '1px 6px',
  borderRadius: '9999px',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
} as const;

/**
 * Apply styles to a highlight element
 */
export function applyHighlightStyles(element: HTMLElement, color: HighlightColor | undefined): void {
  if (!color) return;
  
  element.style.backgroundColor = color.bg;
  element.style.borderBottom = `${HIGHLIGHT_STYLES.borderBottomWidth} ${HIGHLIGHT_STYLES.borderBottomStyle} ${color.border}`;
  element.style.padding = HIGHLIGHT_STYLES.padding;
  element.style.borderRadius = HIGHLIGHT_STYLES.borderRadius;
}

