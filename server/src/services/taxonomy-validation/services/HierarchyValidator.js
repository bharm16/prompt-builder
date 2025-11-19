import { TAXONOMY, getParentCategory, isAttribute, getAllParentCategories } from '../../../shared/taxonomy.js';

/**
 * HierarchyValidator
 * Core validation logic for taxonomy hierarchy rules
 * 
 * Validates that attribute categories have their required parent entities
 * Example: 'wardrobe' requires 'subject' to be present
 */

export class HierarchyValidator {
  /**
   * Validate that all attribute spans have their parent entities
   * @param {Array} spans - Array of span objects with category property
   * @returns {Array} Array of validation issues
   */
  validateHierarchy(spans) {
    if (!Array.isArray(spans) || spans.length === 0) {
      return [];
    }

    const issues = [];
    const categoriesPresent = new Set(spans.map(s => s.category).filter(Boolean));
    
    // Check each span
    for (const span of spans) {
      if (!span.category) continue;

      // If this is an attribute, check if its parent exists
      if (isAttribute(span.category)) {
        const parentCategory = getParentCategory(span.category);
        
        if (parentCategory && !categoriesPresent.has(parentCategory)) {
          issues.push({
            type: 'MISSING_PARENT',
            severity: 'warning',
            attributeCategory: span.category,
            requiredParent: parentCategory,
            affectedSpan: span,
            message: `Attribute '${span.category}' requires parent category '${parentCategory}'`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check if a specific attribute can exist without its parent
   * @param {string} attributeId - Attribute category ID
   * @param {Array} existingCategories - Array of existing category IDs
   * @returns {Object} { valid: boolean, missingParent: string|null }
   */
  canAttributeExist(attributeId, existingCategories) {
    if (!isAttribute(attributeId)) {
      return { valid: true, missingParent: null };
    }

    const parentCategory = getParentCategory(attributeId);
    if (!parentCategory) {
      return { valid: true, missingParent: null };
    }

    const parentExists = existingCategories.includes(parentCategory);
    
    return {
      valid: parentExists,
      missingParent: parentExists ? null : parentCategory
    };
  }

  /**
   * Get required parent categories for a set of spans
   * @param {Array} spans - Array of spans
   * @returns {Set} Set of required parent category IDs
   */
  getRequiredParents(spans) {
    const requiredParents = new Set();

    for (const span of spans) {
      if (!span.category) continue;

      if (isAttribute(span.category)) {
        const parent = getParentCategory(span.category);
        if (parent) {
          requiredParents.add(parent);
        }
      }
    }

    return requiredParents;
  }

  /**
   * Validate parent-child relationships are logically consistent
   * @param {Array} spans - Array of spans
   * @returns {Array} Array of consistency issues
   */
  validateConsistency(spans) {
    const issues = [];
    const parentSpans = spans.filter(s => getAllParentCategories().includes(s.category));
    const attributeSpans = spans.filter(s => isAttribute(s.category));

    // Check if attributes are consistent with their parents
    for (const attrSpan of attributeSpans) {
      const parentCategory = getParentCategory(attrSpan.category);
      const parentSpan = parentSpans.find(s => s.category === parentCategory);

      if (parentSpan) {
        // Both exist - check for logical consistency
        // For example: wardrobe should be near subject in the text
        const distance = Math.abs(attrSpan.start - parentSpan.end);
        
        if (distance > 200) { // Characters apart
          issues.push({
            type: 'DISTANT_RELATIONSHIP',
            severity: 'info',
            attributeSpan: attrSpan,
            parentSpan: parentSpan,
            distance,
            message: `Attribute '${attrSpan.category}' is ${distance} characters away from its parent '${parentCategory}'`
          });
        }
      }
    }

    return issues;
  }
}

