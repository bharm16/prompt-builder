/**
 * Scroll and Animation Utilities for Span Bento Grid
 */

/**
 * Scrolls to a span in the editor and adds pulse animation
 * Finds the highlight wrapper by data-span-id and smoothly scrolls to it
 * Adds a temporary pulse animation to draw attention
 * 
 * @param {Object} editorRef - React ref to the editor DOM element
 * @param {Object} span - Span object with id property
 */
export function scrollToSpan(editorRef, span) {
  if (!editorRef?.current || !span?.id) {
    return;
  }
  
  // Find the highlight wrapper with matching span ID
  const wrapper = editorRef.current.querySelector(
    `[data-span-id="${span.id}"]`
  );
  
  if (!wrapper) {
    console.warn('Span not found in editor:', span.id);
    return;
  }
  
  // Scroll into view smoothly
  wrapper.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center',
    inline: 'nearest',
  });
  
  // Add temporary pulse animation
  wrapper.classList.add('highlight-pulse');
  
  // Remove pulse after animation completes (1000ms as defined in CSS)
  setTimeout(() => {
    wrapper.classList.remove('highlight-pulse');
  }, 1000);
}

