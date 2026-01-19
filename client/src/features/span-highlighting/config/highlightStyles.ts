/**
 * Highlight Styles Configuration
 * 
 * CSS class names and style properties for highlight elements.
 */

export interface HighlightColor {
  bg: string;
  border: string;
  ring: string;
}

/**
 * Get CSS class name for a category
 */
export function getHighlightClassName(category: string | null | undefined): string {
  const baseClasses = [
    'value-word',
    'relative',
    'cursor-pointer',
    'rounded-sm',
    'ps-highlight-pill',
    'border',
    'border-[var(--highlight-border)]',
    'bg-[var(--highlight-bg)]',
    'transition-all',
    'duration-150',
    'ease-out',
    'hover:brightness-95',
    'hover:shadow-sm',
    'box-decoration-clone',
    'break-words',
    'select-text',
  ];
  const categoryClass = category ? `value-word-${category}` : 'value-word-unknown';
  return [...baseClasses, categoryClass].join(' ');
}


/**
 * Apply styles to a highlight element
 */
export function applyHighlightStyles(element: HTMLElement, color: HighlightColor | undefined): void {
  const fallback: HighlightColor = {
    bg: 'rgba(104,134,255,0.12)',
    border: 'rgba(104,134,255,0.35)',
    ring: 'rgba(104,134,255,0.18)',
  };
  const resolved = color ?? fallback;
  element.style.setProperty('--highlight-bg', resolved.bg);
  element.style.setProperty('--highlight-border', resolved.border);
  element.style.setProperty('--highlight-ring', resolved.ring);
}
