import { useMemo } from 'react';
import { CATEGORY_ORDER } from '../config/bentoConfig.js';

/**
 * Groups spans by category and provides metadata
 * Always returns ALL categories (even empty ones) for consistent layout
 * 
 * @param {Array} spans - Array of span objects with category property
 * @returns {Object} - { groups, totalSpans, categoryCount }
 */
export function useSpanGrouping(spans) {
  return useMemo(() => {
    // Initialize all categories with empty arrays for consistent layout
    const groups = {};
    CATEGORY_ORDER.forEach(category => {
      groups[category] = [];
    });
    
    // Populate with actual spans
    if (Array.isArray(spans)) {
      spans.forEach(span => {
        const category = span.category || 'descriptive';
        if (groups[category]) {
          groups[category].push(span);
        } else {
          // Fallback to descriptive if unknown category
          groups.descriptive.push(span);
        }
      });
    }
    
    // Sort spans within each category by start position
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => (a.start || 0) - (b.start || 0));
    });
    
    // Calculate metadata
    const totalSpans = Array.isArray(spans) ? spans.length : 0;
    const categoryCount = Object.values(groups).filter(arr => arr.length > 0).length;
    
    return {
      groups,
      totalSpans,
      categoryCount,
    };
  }, [spans]);
}

