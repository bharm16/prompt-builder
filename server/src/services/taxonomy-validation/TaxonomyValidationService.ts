import { logger } from '@infrastructure/Logger';
import { HierarchyValidator } from './services/HierarchyValidator';
import { OrphanDetector } from './services/OrphanDetector';
import { ValidationReporter } from './services/ValidationReporter';
import type {
  Span,
  ValidationOptions,
  ValidationResult,
  PreAddValidation,
  ValidationStats,
  ValidationIssue
} from './types';

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
  private readonly hierarchyValidator: HierarchyValidator;
  private readonly orphanDetector: OrphanDetector;
  private readonly reporter: ValidationReporter;
  private readonly log = logger.child({ service: 'TaxonomyValidationService' });

  constructor() {
    this.hierarchyValidator = new HierarchyValidator();
    this.orphanDetector = new OrphanDetector();
    this.reporter = new ValidationReporter();
  }

  /**
   * Validate spans against taxonomy hierarchy rules
   * Main public API method
   */
  validateSpans(spans: Span[], options: ValidationOptions = {}): ValidationResult {
    const startTime = performance.now();
    const operation = 'validateSpans';
    
    const {
      strictMode = false,
      checkConsistency = false,
      ignoreCategories = []
    } = options;

    this.log.debug('Validating spans', {
      operation,
      spanCount: spans.length,
      strictMode,
      checkConsistency,
      ignoreCategoriesCount: ignoreCategories.length,
    });

    // Filter out ignored categories
    const filteredSpans = ignoreCategories.length > 0
      ? spans.filter(s => !ignoreCategories.includes(s.category || ''))
      : spans;

    // Step 1: Detect orphaned attributes (primary check)
    const orphans = this.orphanDetector.findOrphanedAttributes(filteredSpans);

    // Step 2: Optional consistency checks (proximity, etc.)
    let consistencyIssues: ValidationIssue[] = [];
    if (checkConsistency) {
      consistencyIssues = this.hierarchyValidator.validateConsistency(filteredSpans);
    }

    // Step 3: Format results
    // Note: We use orphans as the primary source since they provide better grouping
    // than raw hierarchy issues. Consistency issues are separate (span proximity, etc.)
    const result = this.reporter.formatValidationResult(consistencyIssues, orphans);

    // Step 5: Apply strict mode if enabled
    if (strictMode && result.hasWarnings) {
      result.isValid = false;
    }

    const duration = Math.round(performance.now() - startTime);
    
    this.log.info('Span validation complete', {
      operation,
      duration,
      spanCount: spans.length,
      isValid: result.isValid,
      hasWarnings: result.hasWarnings,
      issueCount: result.issues.length,
      orphanCount: orphans.length,
    });

    return result;
  }

  /**
   * Quick check: Does this span have orphaned attributes?
   * Lighter-weight check for real-time validation
   */
  hasOrphanedAttributes(spans: Span[]): boolean {
    const orphans = this.orphanDetector.findOrphanedAttributes(spans);
    return orphans.length > 0;
  }

  /**
   * Get suggested parent categories that should be added
   * Useful for proactive UI suggestions
   */
  getMissingParents(spans: Span[]): string[] {
    const requiredParents = this.hierarchyValidator.getRequiredParents(spans);
    const existingCategories = new Set(spans.map(s => s.category).filter(Boolean) as string[]);
    
    return Array.from(requiredParents).filter(parent => !existingCategories.has(parent));
  }

  /**
   * Validate a single span before adding it
   * Returns whether it would create an orphan
   */
  validateBeforeAdd(categoryId: string, existingSpans: Span[]): PreAddValidation {
    const existingCategories = existingSpans.map(s => s.category).filter(Boolean) as string[];
    const validation = this.hierarchyValidator.canAttributeExist(categoryId, existingCategories);

    if (validation.valid) {
      return {
        canAdd: true,
        missingParent: null,
        warning: null
      };
    }

    const parentLabel = this.reporter.getCategoryLabel(validation.missingParent || '');
    
    return {
      canAdd: true, // Don't block, just warn
      missingParent: validation.missingParent,
      warning: `This attribute requires a ${parentLabel}. Consider adding one first.`
    };
  }

  /**
   * Get validation statistics for analytics
   */
  getValidationStats(spans: Span[]): ValidationStats {
    const orphans = this.orphanDetector.findOrphanedAttributes(spans);

    return {
      totalSpans: spans.length,
      orphanedCount: orphans.reduce((sum, o) => sum + o.count, 0),
      issueCount: orphans.length,
      hasOrphans: orphans.length > 0,
      missingParents: orphans.map(o => o.missingParent)
    };
  }
}

export default TaxonomyValidationService;
