import { useMemo } from 'react';
import { TAXONOMY, getParentCategory, isAttribute, getAllParentCategories } from '@shared/taxonomy.js';

/**
 * useHierarchyValidation
 * Custom React hook for real-time taxonomy hierarchy validation
 * 
 * Following VideoConceptBuilder hook pattern:
 * - Memoized validation logic for performance
 * - Returns structured warnings/errors/suggestions
 * - Detects orphaned attributes as user types
 * 
 * USAGE:
 *   const { warnings, errors, suggestions, isValid } = useHierarchyValidation(spans);
 * 
 * @param {Array} spans - Array of span objects with category property
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function useHierarchyValidation(spans = [], options = {}) {
  const {
    enabled = true,
    strictMode = false,
    showSuggestions = true
  } = options;

  const validation = useMemo(() => {
    // Skip validation if disabled or no spans
    if (!enabled || !Array.isArray(spans) || spans.length === 0) {
      return {
        warnings: [],
        errors: [],
        suggestions: [],
        isValid: true,
        hasOrphans: false
      };
    }

    const warnings = [];
    const errors = [];
    const suggestions = [];
    
    const categoriesPresent = new Set(spans.map(s => s.category).filter(Boolean));

    // Detect orphaned attributes
    const orphanedGroups = detectOrphanedAttributes(spans, categoriesPresent);

    // Convert orphaned groups to warnings/errors
    orphanedGroups.forEach(orphan => {
      const severity = getOrphanSeverity(orphan.missingParent, orphan.count);
      const message = generateOrphanMessage(orphan);
      
      const issue = {
        type: 'ORPHANED_ATTRIBUTE',
        missingParent: orphan.missingParent,
        affectedSpans: orphan.spans,
        message,
        count: orphan.count
      };

      if (severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }

      // Generate suggestion to fix
      if (showSuggestions) {
        suggestions.push({
          action: 'ADD_PARENT',
          parentCategory: orphan.missingParent,
          message: `Add a ${getCategoryLabel(orphan.missingParent)} to provide context`,
          example: getExampleForParent(orphan.missingParent)
        });
      }
    });

    // Check for missing parents that should be suggested
    if (showSuggestions && categoriesPresent.size > 0) {
      const missingSuggestions = generateMissingSuggestions(categoriesPresent);
      suggestions.push(...missingSuggestions);
    }

    const isValid = strictMode ? (errors.length === 0 && warnings.length === 0) : errors.length === 0;

    return {
      warnings,
      errors,
      suggestions,
      isValid,
      hasOrphans: orphanedGroups.length > 0,
      orphanCount: orphanedGroups.reduce((sum, o) => sum + o.count, 0)
    };
  }, [spans, enabled, strictMode, showSuggestions]);

  return validation;
}

/**
 * Detect orphaned attributes in spans
 * @param {Array} spans - Spans to check
 * @param {Set} categoriesPresent - Set of present category IDs
 * @returns {Array} Array of orphan groups
 */
function detectOrphanedAttributes(spans, categoriesPresent) {
  const orphansByParent = {};

  for (const span of spans) {
    if (!span.category || !isAttribute(span.category)) continue;

    const parentCategory = getParentCategory(span.category);
    if (parentCategory && !categoriesPresent.has(parentCategory)) {
      if (!orphansByParent[parentCategory]) {
        orphansByParent[parentCategory] = [];
      }
      orphansByParent[parentCategory].push(span);
    }
  }

  return Object.entries(orphansByParent).map(([parent, spans]) => ({
    missingParent: parent,
    spans,
    count: spans.length,
    categories: [...new Set(spans.map(s => s.category))]
  }));
}

/**
 * Get severity for orphaned attributes
 * @param {string} parentCategory - Missing parent
 * @param {number} count - Number of orphans
 * @returns {string} 'error' or 'warning'
 */
function getOrphanSeverity(parentCategory, count) {
  // Subject attributes are critical
  if (parentCategory === TAXONOMY.SUBJECT.id) {
    return count > 2 ? 'error' : 'warning';
  }

  // Camera/lighting less critical
  if (parentCategory === TAXONOMY.CAMERA.id || parentCategory === TAXONOMY.LIGHTING.id) {
    return 'warning';
  }

  return 'warning';
}

/**
 * Generate human-readable message for orphaned attributes
 * @param {Object} orphan - Orphan group
 * @returns {string} Message
 */
function generateOrphanMessage(orphan) {
  const { missingParent, categories, count } = orphan;
  const parentLabel = getCategoryLabel(missingParent);
  const attrLabels = categories.map(c => `"${c}"`).join(', ');

  if (count === 1) {
    return `Found ${attrLabels} without a ${parentLabel}. Consider adding a ${parentLabel} first.`;
  }

  return `Found ${count} attribute(s) (${attrLabels}) without a ${parentLabel}. Add a ${parentLabel} to provide context.`;
}

/**
 * Get human-readable label for category
 * @param {string} categoryId - Category ID
 * @returns {string} Label
 */
function getCategoryLabel(categoryId) {
  for (const category of Object.values(TAXONOMY)) {
    if (category.id === categoryId) {
      return category.label;
    }
  }
  return categoryId;
}

/**
 * Get example text for parent category
 * @param {string} parentId - Parent ID
 * @returns {string} Example
 */
function getExampleForParent(parentId) {
  const examples = {
    [TAXONOMY.SUBJECT.id]: 'a weathered cowboy',
    [TAXONOMY.ENVIRONMENT.id]: 'in a dusty frontier town',
    [TAXONOMY.CAMERA.id]: 'wide shot',
    [TAXONOMY.LIGHTING.id]: 'bathed in golden hour light'
  };

  return examples[parentId] || `a ${parentId}`;
}

/**
 * Generate suggestions for missing complementary categories
 * @param {Set} categoriesPresent - Present categories
 * @returns {Array} Suggestions
 */
function generateMissingSuggestions(categoriesPresent) {
  const suggestions = [];

  // If has subject but no environment, suggest it
  if (categoriesPresent.has(TAXONOMY.SUBJECT.id) && !categoriesPresent.has(TAXONOMY.ENVIRONMENT.id)) {
    suggestions.push({
      action: 'ADD_COMPLEMENTARY',
      parentCategory: TAXONOMY.ENVIRONMENT.id,
      message: 'Consider adding an Environment to set the scene',
      example: 'in a dusty frontier town',
      priority: 'low'
    });
  }

  // If has subject and environment but no camera, suggest it
  if (categoriesPresent.has(TAXONOMY.SUBJECT.id) && 
      categoriesPresent.has(TAXONOMY.ENVIRONMENT.id) && 
      !categoriesPresent.has(TAXONOMY.CAMERA.id)) {
    const hasCameraAttrs = Array.from(categoriesPresent).some(cat => 
      Object.values(TAXONOMY.CAMERA.attributes).includes(cat)
    );
    
    if (!hasCameraAttrs) {
      suggestions.push({
        action: 'ADD_COMPLEMENTARY',
        parentCategory: TAXONOMY.CAMERA.id,
        message: 'Consider adding Camera framing for cinematic direction',
        example: 'wide shot',
        priority: 'low'
      });
    }
  }

  return suggestions;
}

/**
 * Hook variant for checking if a category can be added
 * Useful for real-time validation in UI
 * 
 * @param {string} categoryId - Category to check
 * @param {Array} existingSpans - Current spans
 * @returns {Object} { canAdd, warning, missingParent }
 */
export function useCanAddCategory(categoryId, existingSpans = []) {
  return useMemo(() => {
    if (!categoryId || !isAttribute(categoryId)) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const parentCategory = getParentCategory(categoryId);
    if (!parentCategory) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const hasParent = existingSpans.some(s => s.category === parentCategory);
    
    if (hasParent) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const parentLabel = getCategoryLabel(parentCategory);
    
    return {
      canAdd: true, // Don't block, just warn
      warning: `This attribute typically requires a ${parentLabel}. Consider adding one first.`,
      missingParent: parentCategory
    };
  }, [categoryId, existingSpans]);
}

export default useHierarchyValidation;

