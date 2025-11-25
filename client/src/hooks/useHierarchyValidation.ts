import { useMemo } from 'react';
import { TAXONOMY, getParentCategory, isAttribute } from '@shared/taxonomy';
import type {
  Span,
  ValidationResult,
  HierarchyValidationOptions,
  CanAddCategoryResult,
  ValidationIssue,
  ValidationSuggestion,
} from './types';

interface OrphanGroup {
  missingParent: string;
  spans: Span[];
  count: number;
  categories: string[];
}

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
 */
export function useHierarchyValidation(
  spans: Span[] = [],
  options: HierarchyValidationOptions = {}
): ValidationResult {
  const { enabled = true, strictMode = false, showSuggestions = true } = options;

  const validation = useMemo(() => {
    // Skip validation if disabled or no spans
    if (!enabled || !Array.isArray(spans) || spans.length === 0) {
      return {
        warnings: [],
        errors: [],
        suggestions: [],
        isValid: true,
        hasOrphans: false,
        orphanCount: 0,
      };
    }

    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    const categoriesPresent = new Set(spans.map((s) => s.category).filter(Boolean) as string[]);

    // Detect orphaned attributes
    const orphanedGroups = detectOrphanedAttributes(spans, categoriesPresent);

    // Convert orphaned groups to warnings/errors
    orphanedGroups.forEach((orphan) => {
      const severity = getOrphanSeverity(orphan.missingParent, orphan.count);
      const message = generateOrphanMessage(orphan);

      const issue: ValidationIssue = {
        type: 'ORPHANED_ATTRIBUTE',
        missingParent: orphan.missingParent,
        affectedSpans: orphan.spans,
        message,
        count: orphan.count,
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
          example: getExampleForParent(orphan.missingParent),
        });
      }
    });

    // Check for missing parents that should be suggested
    if (showSuggestions && categoriesPresent.size > 0) {
      const missingSuggestions = generateMissingSuggestions(categoriesPresent);
      suggestions.push(...missingSuggestions);
    }

    const isValid = strictMode ? errors.length === 0 && warnings.length === 0 : errors.length === 0;

    return {
      warnings,
      errors,
      suggestions,
      isValid,
      hasOrphans: orphanedGroups.length > 0,
      orphanCount: orphanedGroups.reduce((sum, o) => sum + o.count, 0),
    };
  }, [spans, enabled, strictMode, showSuggestions]);

  return validation;
}

/**
 * Detect orphaned attributes in spans
 */
function detectOrphanedAttributes(spans: Span[], categoriesPresent: Set<string>): OrphanGroup[] {
  const orphansByParent: Record<string, Span[]> = {};

  for (const span of spans) {
    if (!span.category || !isAttribute(span.category)) continue;

    const parentCategory = getParentCategory(span.category);
    if (parentCategory && !categoriesPresent.has(parentCategory)) {
      if (!orphansByParent[parentCategory]) {
        orphansByParent[parentCategory] = [];
      }
      orphansByParent[parentCategory]!.push(span);
    }
  }

  return Object.entries(orphansByParent).map(([parent, spans]) => ({
    missingParent: parent,
    spans,
    count: spans.length,
    categories: [...new Set(spans.map((s) => s.category).filter(Boolean) as string[])],
  }));
}

/**
 * Get severity for orphaned attributes
 */
function getOrphanSeverity(parentCategory: string, count: number): 'error' | 'warning' {
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
 */
function generateOrphanMessage(orphan: OrphanGroup): string {
  const { missingParent, categories, count } = orphan;
  const parentLabel = getCategoryLabel(missingParent);
  const attrLabels = categories.map((c) => `"${c}"`).join(', ');

  if (count === 1) {
    return `Found ${attrLabels} without a ${parentLabel}. Consider adding a ${parentLabel} first.`;
  }

  return `Found ${count} attribute(s) (${attrLabels}) without a ${parentLabel}. Add a ${parentLabel} to provide context.`;
}

/**
 * Get human-readable label for category
 */
function getCategoryLabel(categoryId: string): string {
  for (const category of Object.values(TAXONOMY)) {
    if (category.id === categoryId) {
      return category.label;
    }
  }
  return categoryId;
}

/**
 * Get example text for parent category
 */
function getExampleForParent(parentId: string): string {
  const examples: Record<string, string> = {
    [TAXONOMY.SUBJECT.id]: 'a weathered cowboy',
    [TAXONOMY.ENVIRONMENT.id]: 'in a dusty frontier town',
    [TAXONOMY.CAMERA.id]: 'wide shot',
    [TAXONOMY.LIGHTING.id]: 'bathed in golden hour light',
  };

  return examples[parentId] || `a ${parentId}`;
}

/**
 * Generate suggestions for missing complementary categories
 */
function generateMissingSuggestions(categoriesPresent: Set<string>): ValidationSuggestion[] {
  const suggestions: ValidationSuggestion[] = [];

  // If has subject but no environment, suggest it
  if (categoriesPresent.has(TAXONOMY.SUBJECT.id) && !categoriesPresent.has(TAXONOMY.ENVIRONMENT.id)) {
    suggestions.push({
      action: 'ADD_COMPLEMENTARY',
      parentCategory: TAXONOMY.ENVIRONMENT.id,
      message: 'Consider adding an Environment to set the scene',
      example: 'in a dusty frontier town',
      priority: 'low',
    });
  }

  // If has subject and environment but no camera, suggest it
  if (
    categoriesPresent.has(TAXONOMY.SUBJECT.id) &&
    categoriesPresent.has(TAXONOMY.ENVIRONMENT.id) &&
    !categoriesPresent.has(TAXONOMY.CAMERA.id)
  ) {
    const hasCameraAttrs = Array.from(categoriesPresent).some((cat) =>
      Object.values(TAXONOMY.CAMERA.attributes).includes(cat)
    );

    if (!hasCameraAttrs) {
      suggestions.push({
        action: 'ADD_COMPLEMENTARY',
        parentCategory: TAXONOMY.CAMERA.id,
        message: 'Consider adding Camera framing for cinematic direction',
        example: 'wide shot',
        priority: 'low',
      });
    }
  }

  return suggestions;
}

/**
 * Hook variant for checking if a category can be added
 * Useful for real-time validation in UI
 */
export function useCanAddCategory(categoryId: string | undefined, existingSpans: Span[] = []): CanAddCategoryResult {
  return useMemo(() => {
    if (!categoryId || !isAttribute(categoryId)) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const parentCategory = getParentCategory(categoryId);
    if (!parentCategory) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const hasParent = existingSpans.some((s) => s.category === parentCategory);

    if (hasParent) {
      return { canAdd: true, warning: null, missingParent: null };
    }

    const parentLabel = getCategoryLabel(parentCategory);

    return {
      canAdd: true, // Don't block, just warn
      warning: `This attribute typically requires a ${parentLabel}. Consider adding one first.`,
      missingParent: parentCategory,
    };
  }, [categoryId, existingSpans]);
}

export default useHierarchyValidation;

