import { HierarchyValidator } from './services/HierarchyValidator.js';
import { OrphanDetector } from './services/OrphanDetector.js';
import { ValidationReporter } from './services/ValidationReporter.js';

/**
 * TaxonomyValidationService
 * Main orchestrator for taxonomy hierarchy validation
 * 
 * Follows the PromptOptimizationService pattern:
 * - Thin orchestrator that delegates to specialized services
 * - Single public API: validateSpans()
 * - Returns structured validation results
 * 
 * USAGE:
 *   const validator = new TaxonomyValidationService();
 *   const result = validator.validateSpans(spans, options);
 * 
 * RETURNS:
 *   {
 *     isValid: boolean,
 *     hasWarnings: boolean,
 *     issues: Array<ValidationIssue>,
 *     summary: string
 *   }
 */

export class TaxonomyValidationService {
  constructor() {
    this.hierarchyValidator = new HierarchyValidator();
    this.orphanDetector = new OrphanDetector();
    this.reporter = new ValidationReporter();
  }

  /**
   * Validate spans against taxonomy hierarchy rules
   * Main public API method
   * 
   * @param {Array} spans - Array of span objects with category property
   * @param {Object} options - Validation options
   * @param {boolean} options.strictMode - Fail on warnings (default: false)
   * @param {boolean} options.checkConsistency - Check span proximity (default: false)
   * @param {Array<string>} options.ignoreCategories - Categories to skip validation
   * @returns {Object} Validation result
   */
  validateSpans(spans, options = {}) {
    const {
      strictMode = false,
      checkConsistency = false,
      ignoreCategories = []
    } = options;

    // Filter out ignored categories
    const filteredSpans = ignoreCategories.length > 0
      ? spans.filter(s => !ignoreCategories.includes(s.category))
      : spans;

    // Step 1: Validate hierarchy (parent-child relationships)
    const hierarchyIssues = this.hierarchyValidator.validateHierarchy(filteredSpans);

    // Step 2: Detect orphaned attributes
    const orphans = this.orphanDetector.findOrphanedAttributes(filteredSpans);

    // Step 3: Optional consistency checks
    let consistencyIssues = [];
    if (checkConsistency) {
      consistencyIssues = this.hierarchyValidator.validateConsistency(filteredSpans);
    }

    // Step 4: Combine and format results
    const allIssues = [...hierarchyIssues, ...consistencyIssues];
    const result = this.reporter.formatValidationResult(allIssues, orphans);

    // Step 5: Apply strict mode if enabled
    if (strictMode && result.hasWarnings) {
      result.isValid = false;
    }

    return result;
  }

  /**
   * Quick check: Does this span have orphaned attributes?
   * Lighter-weight check for real-time validation
   * 
   * @param {Array} spans - Array of spans
   * @returns {boolean} True if orphans detected
   */
  hasOrphanedAttributes(spans) {
    const orphans = this.orphanDetector.findOrphanedAttributes(spans);
    return orphans.length > 0;
  }

  /**
   * Get suggested parent categories that should be added
   * Useful for proactive UI suggestions
   * 
   * @param {Array} spans - Array of spans
   * @returns {Array<string>} Array of missing parent category IDs
   */
  getMissingParents(spans) {
    const requiredParents = this.hierarchyValidator.getRequiredParents(spans);
    const existingCategories = new Set(spans.map(s => s.category));
    
    return Array.from(requiredParents).filter(parent => !existingCategories.has(parent));
  }

  /**
   * Validate a single span before adding it
   * Returns whether it would create an orphan
   * 
   * @param {string} categoryId - Category ID to validate
   * @param {Array} existingSpans - Current spans
   * @returns {Object} { canAdd: boolean, missingParent: string|null, warning: string|null }
   */
  validateBeforeAdd(categoryId, existingSpans) {
    const existingCategories = existingSpans.map(s => s.category);
    const validation = this.hierarchyValidator.canAttributeExist(categoryId, existingCategories);

    if (validation.valid) {
      return {
        canAdd: true,
        missingParent: null,
        warning: null
      };
    }

    const parentLabel = this.reporter.getCategoryLabel(validation.missingParent);
    
    return {
      canAdd: true, // Don't block, just warn
      missingParent: validation.missingParent,
      warning: `This attribute requires a ${parentLabel}. Consider adding one first.`
    };
  }

  /**
   * Get validation statistics for analytics
   * @param {Array} spans - Array of spans
   * @returns {Object} Statistics
   */
  getValidationStats(spans) {
    const orphans = this.orphanDetector.findOrphanedAttributes(spans);
    const issues = this.hierarchyValidator.validateHierarchy(spans);

    return {
      totalSpans: spans.length,
      orphanedCount: orphans.reduce((sum, o) => sum + o.count, 0),
      issueCount: issues.length,
      hasOrphans: orphans.length > 0,
      missingParents: orphans.map(o => o.missingParent)
    };
  }
}

export default TaxonomyValidationService;

