/**
 * Text Formatting Layer
 *
 * Utilities for safely escaping text for the prompt editor and shared views.
 * Legacy "Standard Mode" formatting has been removed in favor of
 * "Video Mode" (ML Highlighting) support.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 */
const escapeHtml = (str: string | null | undefined = ''): string =>
  String(str)
    // Strip inline event handlers to avoid leftover "onxxx=" substrings.
    .replace(/on[a-z]+(\s*)=/gi, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Escapes HTML for ML highlighting mode.
 * Preserves whitespace and newlines for span offset matching.
 */
export function escapeHTMLForMLHighlighting(text: string): string {
  const escaped = escapeHtml(text || '');

  return `<div style="white-space: pre-wrap; line-height: var(--lh-relaxed); font-size: var(--fs-14); font-family: var(--font-sans); color: var(--text);">${escaped}</div>`;
}

/**
 * Legacy export for backward compatibility during migration.
 * Now aliases to escapeHTMLForMLHighlighting since Standard Mode is removed.
 */
export const formatTextToHTML = (text: string | null | undefined): { html: string } => {
  return { html: escapeHTMLForMLHighlighting(text ?? '') };
};
