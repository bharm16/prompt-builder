import { useMemo } from 'react';
import { CATEGORY_ORDER } from '../config/bentoConfig.js';
import { TAXONOMY, getParentCategory, isAttribute, getAllParentCategories } from '@shared/taxonomy.js';

/**
 * Legacy category mapping for backward compatibility
 * Maps old flat categories to new taxonomy parent categories
 */
const LEGACY_CATEGORY_MAP = {
  'appearance': TAXONOMY.SUBJECT.id,
  'wardrobe': TAXONOMY.SUBJECT.id,
  'movement': TAXONOMY.SUBJECT.id,
  'action': TAXONOMY.SUBJECT.id,
  'framing': TAXONOMY.CAMERA.id,
  'specs': TAXONOMY.TECHNICAL.id,
  'quality': TAXONOMY.STYLE.id,
  // Keep existing parent IDs as-is
  'subject': TAXONOMY.SUBJECT.id,
  'environment': TAXONOMY.ENVIRONMENT.id,
  'lighting': TAXONOMY.LIGHTING.id,
  'camera': TAXONOMY.CAMERA.id,
  'style': TAXONOMY.STYLE.id,
  'technical': TAXONOMY.TECHNICAL.id,
  'audio': TAXONOMY.AUDIO.id,
};

/**
 * Maps any category ID to its display category (parent)
 * Handles taxonomy IDs, legacy IDs, and unknown categories
 * 
 * @param {string} categoryId - Category ID from span
 * @returns {string} Parent category ID for display
 */
function mapToDisplayCategory(categoryId) {
  if (!categoryId) return TAXONOMY.SUBJECT.id;

  // Check if it's already a taxonomy parent category
  if (getAllParentCategories().includes(categoryId)) {
    return categoryId;
  }

  // Check if it's a taxonomy attribute - get its parent
  if (isAttribute(categoryId)) {
    const parent = getParentCategory(categoryId);
    return parent || TAXONOMY.SUBJECT.id;
  }

  // Check if it's a legacy category
  if (LEGACY_CATEGORY_MAP[categoryId]) {
    return LEGACY_CATEGORY_MAP[categoryId];
  }

  // Unknown category - default to subject
  console.warn(`[useSpanGrouping] Unknown category "${categoryId}", mapping to subject`);
  return TAXONOMY.SUBJECT.id;
}

/**
 * Groups spans by category with hierarchical awareness
 * Now fully integrated with unified taxonomy system
 * - Maps all categories to parent categories for display
 * - Groups attributes under their parent categories
 * - Handles legacy categories with backward compatibility
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
        const originalCategory = span.category || TAXONOMY.SUBJECT.id;
        
        // Map to display category (parent)
        const displayCategory = mapToDisplayCategory(originalCategory);
        
        // Track hierarchy if enabled
        if (enableHierarchy) {
          if (getAllParentCategories().includes(originalCategory)) {
            hierarchyInfo.parentCategories.push(originalCategory);
          } else if (isAttribute(originalCategory)) {
            const parentCategory = getParentCategory(originalCategory);
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
        
        // Add metadata about the original category for debugging
        if (originalCategory !== displayCategory) {
          span._originalCategory = originalCategory;
          span._mappedTo = displayCategory;
        }
        
        // Add metadata if it's an attribute
        if (isAttribute(originalCategory)) {
          span._isAttribute = true;
          span._parentCategory = displayCategory;
        }
        
        // Add to the appropriate group
        if (groups[displayCategory]) {
          groups[displayCategory].push(span);
        } else {
          // If display category not in config, default to subject
          if (groups[TAXONOMY.SUBJECT.id]) {
            groups[TAXONOMY.SUBJECT.id].push(span);
            console.warn(`[useSpanGrouping] Category "${displayCategory}" not in config, adding to subject`);
          }
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

