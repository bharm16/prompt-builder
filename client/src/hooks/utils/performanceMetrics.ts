/**
 * Performance Metrics Utilities
 *
 * Utilities for measuring and tracking performance metrics during prompt optimization.
 * Handles performance marks and measurements for optimization timing.
 */

/**
 * Mark the start of optimization
 */
export function markOptimizationStart(): void {
  performance.mark('optimize-start');
}

/**
 * Mark when draft is ready
 */
export function markDraftReady(): void {
  performance.mark('draft-ready');
}

/**
 * Mark when refinement is complete
 */
export function markRefinementComplete(): void {
  performance.mark('refinement-complete');
}

/**
 * Mark when spans are received
 */
export function markSpansReceived(source: string): void {
  performance.mark(`spans-received-${source}`);
}

/**
 * Measure time from optimization start to draft ready
 */
export function measureOptimizeToDraft(): void {
  try {
    const entries = performance.getEntriesByName('optimize-start', 'mark');
    if (entries.length > 0) {
      performance.measure('optimize-to-draft', 'optimize-start', 'draft-ready');
    }
  } catch (e) {
    // Silently ignore if mark doesn't exist
  }
}

/**
 * Measure time from draft ready to refinement complete
 */
export function measureDraftToRefined(): void {
  try {
    const entries = performance.getEntriesByName('draft-ready', 'mark');
    if (entries.length > 0) {
      performance.measure('draft-to-refined', 'draft-ready', 'refinement-complete');
    }
  } catch (e) {
    // Silently ignore if mark doesn't exist
  }
}

/**
 * Measure total time from optimization start to refinement complete
 */
export function measureOptimizeToRefinedTotal(): void {
  try {
    performance.measure('optimize-to-refined-total', 'optimize-start', 'refinement-complete');
  } catch (e) {
    // Silently ignore if mark doesn't exist
  }
}

