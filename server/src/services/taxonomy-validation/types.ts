/**
 * Types for taxonomy validation services
 * Shared type definitions used across taxonomy validation modules
 */

/**
 * Span object with category property
 * Used for validation input
 */
export interface Span {
  category?: string;
  text?: string;
  start?: number;
  end?: number;
  [key: string]: unknown;
}

/**
 * Validation options for validateSpans method
 */
export interface ValidationOptions {
  strictMode?: boolean;
  checkConsistency?: boolean;
  ignoreCategories?: string[];
}

/**
 * Severity level for validation issues
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Raw validation issue from HierarchyValidator
 */
export interface ValidationIssue {
  type: 'MISSING_PARENT' | 'DISTANT_RELATIONSHIP';
  severity: Severity;
  attributeCategory?: string;
  originalCategory?: string;
  requiredParent?: string;
  affectedSpan?: Span;
  attributeSpan?: Span;
  parentSpan?: Span;
  distance?: number;
  message: string;
}

/**
 * Orphaned attribute group from OrphanDetector
 */
export interface OrphanedAttributeGroup {
  missingParent: string;
  orphanedSpans: Span[];
  count: number;
  categories: string[];
  severity?: Severity;
}

/**
 * Suggested fix for validation issues
 */
export interface SuggestedFix {
  action: 'ADD_PARENT' | 'REORDER' | 'REVIEW';
  parentCategory?: string;
  parentLabel?: string;
  suggestion: string;
  example?: string;
  insertPosition?: number;
}

/**
 * Formatted validation issue for API response
 */
export interface FormattedValidationIssue {
  type: string;
  severity: Severity;
  message: string;
  affectedSpans: Span[];
  missingParent?: string;
  suggestedFix: SuggestedFix;
}

/**
 * Validation result returned by validateSpans
 */
export interface ValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  issueCount: number;
  issues: FormattedValidationIssue[];
  summary: string;
}

/**
 * Result from canAttributeExist check
 */
export interface AttributeExistenceCheck {
  valid: boolean;
  missingParent: string | null;
}

/**
 * Result from validateBeforeAdd
 */
export interface PreAddValidation {
  canAdd: boolean;
  missingParent: string | null;
  warning: string | null;
}

/**
 * Validation statistics for analytics
 */
export interface ValidationStats {
  totalSpans: number;
  orphanedCount: number;
  issueCount: number;
  hasOrphans: boolean;
  missingParents: string[];
}

