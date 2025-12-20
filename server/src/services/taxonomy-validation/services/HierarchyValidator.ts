import { logger } from '@infrastructure/Logger';
import { TAXONOMY, getParentCategory, isAttribute, getAllParentCategories, resolveCategory } from '#shared/taxonomy.ts';
import type { Span, ValidationIssue, AttributeExistenceCheck } from '../types';

/**
 * HierarchyValidator
 * Core validation logic for taxonomy hierarchy rules
 * 
 * Validates that attribute categories have their required parent entities
 * Example: 'wardrobe' requires 'subject' to be present
 */
export class HierarchyValidator {
  private readonly log = logger.child({ service: 'HierarchyValidator' });

  /**
   * Validate that all attribute spans have their parent entities
   */
  validateHierarchy(spans: Span[]): ValidationIssue[] {
    if (!Array.isArray(spans) || spans.length === 0) {
      return [];
    }

    const issues: ValidationIssue[] = [];
    // Resolve all categories to handle legacy IDs
    const categoriesPresent = new Set(
      spans.map(s => s.category ? resolveCategory(s.category) : null).filter(Boolean) as string[]
    );
    
    // Check each span
    for (const span of spans) {
      if (!span.category) continue;

      const resolvedCategory = resolveCategory(span.category);
      
      // If this is an attribute, check if its parent exists
      if (isAttribute(resolvedCategory)) {
        const parentCategory = getParentCategory(resolvedCategory);
        
        if (parentCategory && !categoriesPresent.has(parentCategory)) {
          issues.push({
            type: 'MISSING_PARENT',
            severity: 'warning',
            attributeCategory: resolvedCategory,
            originalCategory: span.category,
            requiredParent: parentCategory,
            affectedSpan: span,
            message: `Attribute '${resolvedCategory}' requires parent category '${parentCategory}'`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check if a specific attribute can exist without its parent
   */
  canAttributeExist(attributeId: string, existingCategories: string[]): AttributeExistenceCheck {
    const resolvedId = resolveCategory(attributeId);
    
    if (!isAttribute(resolvedId)) {
      return { valid: true, missingParent: null };
    }

    const parentCategory = getParentCategory(resolvedId);
    if (!parentCategory) {
      return { valid: true, missingParent: null };
    }

    // Check if parent exists (resolve existing categories too)
    const resolvedExisting = existingCategories.map(c => resolveCategory(c));
    const parentExists = resolvedExisting.includes(parentCategory);
    
    return {
      valid: parentExists,
      missingParent: parentExists ? null : parentCategory
    };
  }

  /**
   * Get required parent categories for a set of spans
   */
  getRequiredParents(spans: Span[]): Set<string> {
    const requiredParents = new Set<string>();

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
   */
  validateConsistency(spans: Span[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const parentSpans = spans.filter(s => s.category && getAllParentCategories().includes(s.category));
    const attributeSpans = spans.filter(s => s.category && isAttribute(s.category));

    // Check if attributes are consistent with their parents
    for (const attrSpan of attributeSpans) {
      if (!attrSpan.category) continue;
      const parentCategory = getParentCategory(attrSpan.category);
      const parentSpan = parentSpans.find(s => s.category === parentCategory);

      if (parentSpan && attrSpan.start !== undefined && parentSpan.end !== undefined) {
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

