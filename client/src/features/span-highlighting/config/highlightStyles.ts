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
  // NOTE: Visual token styling is now owned by CSS (PromptCanvas.css),
  // but we still provide per-category color variables via applyHighlightStyles.
  padding: '0px',
  borderRadius: '0px',
  borderBottomWidth: '0px',
  borderBottomStyle: 'solid',
} as const;

/**
 * Apply styles to a highlight element
 */
export function applyHighlightStyles(element: HTMLElement, color: HighlightColor | undefined): void {
  if (!color) return;
  // Provide original category colors back (used by CSS).
  element.style.setProperty('--highlight-bg', color.bg);
  element.style.setProperty('--highlight-border', color.border);
}

