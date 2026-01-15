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
  padding: '1px 3px',
  borderRadius: '3px',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
} as const;

/**
 * Apply styles to a highlight element
 */
export function applyHighlightStyles(element: HTMLElement, color: HighlightColor | undefined): void {
  if (!color) return;
  element.style.setProperty('--highlight-bg', color.bg);
  element.style.setProperty('--highlight-border', color.border);
  element.style.backgroundColor = color.bg;
  element.style.borderBottomColor = color.border;
  element.style.borderBottomWidth = HIGHLIGHT_STYLES.borderBottomWidth;
  element.style.borderBottomStyle = HIGHLIGHT_STYLES.borderBottomStyle;
  element.style.padding = HIGHLIGHT_STYLES.padding;
  element.style.borderRadius = HIGHLIGHT_STYLES.borderRadius;
}
