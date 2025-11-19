import { useMemo } from 'react';
import { CATEGORY_ORDER } from '../config/bentoConfig.js';
import { TAXONOMY, getParentCategory, isAttribute, getAllParentCategories } from '@shared/taxonomy.js';

/**
 * Groups spans by category with hierarchical awareness
 * Now understands parent-child relationships from TAXONOMY
 * - Groups attributes under their parent categories
 * - Maintains visual hierarchy in bento grid layout
 * 
 * @param {Array} spans - Array of span objects with category property
 * @param {Object} options - Grouping options
 * @returns {Object} - { groups, totalSpans, categoryCount, hierarchyInfo }
 */
export function useSpanGrouping(spans, options = {}) {
  const { enableHierarchy = false } = options;

  return useMemo(() => {
    // Initialize all categories with empty arrays for consistent layout
    const groups = {};
    CATEGORY_ORDER.forEach(category => {
      groups[category] = [];
    });
    
    // Track hierarchy information
    const hierarchyInfo = {
      parentCategories: [],
      attributesByParent: {},
      orphanedAttributes: []
    };
    
    // Populate with actual spans
    if (Array.isArray(spans)) {
      const categoriesPresent = new Set(spans.map(s => s.category).filter(Boolean));
      
      spans.forEach(span => {
        const category = span.category || 'quality';
        
        // Track hierarchy if enabled
        if (enableHierarchy) {
          if (getAllParentCategories().includes(category)) {
            hierarchyInfo.parentCategories.push(category);
          } else if (isAttribute(category)) {
            const parentCategory = getParentCategory(category);
            if (parentCategory) {
              if (!hierarchyInfo.attributesByParent[parentCategory]) {
                hierarchyInfo.attributesByParent[parentCategory] = [];
              }
              hierarchyInfo.attributesByParent[parentCategory].push(span);
              
              // Check if orphaned (parent not present)
              if (!categoriesPresent.has(parentCategory)) {
                hierarchyInfo.orphanedAttributes.push({
                  span,
                  missingParent: parentCategory
                });
              }
            }
          }
        }
        
        // Group span by category (or parent if hierarchy enabled)
        let groupKey = category;
        
        if (enableHierarchy && isAttribute(category)) {
          // Group attributes under their parent category
          const parentCategory = getParentCategory(category);
          if (parentCategory && groups[parentCategory] !== undefined) {
            groupKey = parentCategory;
            // Add metadata to track it's a child
            span._isAttribute = true;
            span._parentCategory = parentCategory;
          }
        }
        
        if (groups[groupKey]) {
          groups[groupKey].push(span);
        } else if (groups.quality) {
          // Fallback to quality if unknown category
          groups.quality.push(span);
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
    const hasOrphans = hierarchyInfo.orphanedAttributes.length > 0;
    
    return {
      groups,
      totalSpans,
      categoryCount,
      hierarchyInfo: enableHierarchy ? {
        ...hierarchyInfo,
        hasOrphans,
        parentCount: hierarchyInfo.parentCategories.length,
        orphanCount: hierarchyInfo.orphanedAttributes.length
      } : null
    };
  }, [spans, enableHierarchy]);
}

/**
 * Get hierarchy display info for a category
 * Useful for rendering nested UI
 * 
 * @param {string} categoryId - Category ID
 * @param {Array} spans - Spans in this category
 * @returns {Object} Display info
 */
export function useCategoryHierarchyInfo(categoryId, spans) {
  return useMemo(() => {
    const isParent = getAllParentCategories().includes(categoryId);
    const isAttr = isAttribute(categoryId);
    const parent = isAttr ? getParentCategory(categoryId) : null;
    
    // Separate parent spans from attribute spans
    const parentSpans = spans.filter(s => !s._isAttribute);
    const attributeSpans = spans.filter(s => s._isAttribute);
    
    return {
      isParent,
      isAttribute: isAttr,
      parentCategory: parent,
      parentSpans,
      attributeSpans,
      hasAttributes: attributeSpans.length > 0
    };
  }, [categoryId, spans]);
}

