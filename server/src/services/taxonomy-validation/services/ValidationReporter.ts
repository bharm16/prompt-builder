import { TAXONOMY } from '#shared/taxonomy.ts';
import type { 
  ValidationIssue, 
  OrphanedAttributeGroup, 
  ValidationResult, 
  FormattedValidationIssue,
  SuggestedFix,
  Severity
} from '../types.js';

/**
 * ValidationReporter
 * Formats validation issues into human-readable messages and suggestion payloads
 * 
 * Generates API responses and user-facing guidance for taxonomy violations
 */
export class ValidationReporter {
  /**
   * Format validation issues for API response
   */
  formatValidationResult(issues: ValidationIssue[], orphans: OrphanedAttributeGroup[]): ValidationResult {
    const formattedIssues = issues.map(issue => this.formatIssue(issue));
    const formattedOrphans = orphans.map(orphan => this.formatOrphan(orphan));

    const allIssues = [...formattedIssues, ...formattedOrphans];
    const hasErrors = allIssues.some(i => i.severity === 'error');
    const hasWarnings = allIssues.some(i => i.severity === 'warning');

    return {
      isValid: !hasErrors,
      hasWarnings,
      issueCount: allIssues.length,
      issues: allIssues,
      summary: this.generateSummary(allIssues)
    };
  }

  /**
   * Format a single validation issue
   */
  formatIssue(issue: ValidationIssue): FormattedValidationIssue {
    return {
      type: issue.type,
      severity: issue.severity || 'warning',
      message: issue.message,
      affectedSpans: issue.affectedSpan ? [issue.affectedSpan] : [],
      suggestedFix: this.generateFix(issue)
    };
  }

  /**
   * Format orphaned attribute group
   */
  formatOrphan(orphan: OrphanedAttributeGroup): FormattedValidationIssue {
    const severity = orphan.severity || this.determineOrphanSeverity(orphan);
    
    return {
      type: 'ORPHANED_ATTRIBUTE',
      severity,
      message: this.generateOrphanMessage(orphan),
      affectedSpans: orphan.orphanedSpans,
      missingParent: orphan.missingParent,
      suggestedFix: this.generateOrphanFix(orphan)
    };
  }

  /**
   * Generate human-readable message for orphaned attributes
   */
  generateOrphanMessage(orphan: OrphanedAttributeGroup): string {
    const { missingParent, categories, count } = orphan;
    const parentLabel = this.getCategoryLabel(missingParent);
    const attrLabels = categories.map(c => `'${c}'`).join(', ');

    if (count === 1) {
      return `Found ${attrLabels} but no ${parentLabel} defined. Consider adding a ${parentLabel} to describe who or what these attributes apply to.`;
    }

    return `Found ${count} attribute(s) (${attrLabels}) without a ${parentLabel}. These attributes need a ${parentLabel} to provide context.`;
  }

  /**
   * Generate suggested fix for orphaned attributes
   */
  generateOrphanFix(orphan: OrphanedAttributeGroup): SuggestedFix {
    const { missingParent, orphanedSpans } = orphan;
    const parentLabel = this.getCategoryLabel(missingParent);

    // Generate example based on parent type
    const exampleSubject = this.getExampleForParent(missingParent);

    return {
      action: 'ADD_PARENT',
      parentCategory: missingParent,
      parentLabel,
      suggestion: `Add a ${parentLabel} before these attributes`,
      example: exampleSubject,
      insertPosition: orphanedSpans[0]?.start || 0 // Insert before first orphaned span
    };
  }

  /**
   * Generate fix for generic validation issue
   */
  generateFix(issue: ValidationIssue): SuggestedFix {
    if (issue.type === 'MISSING_PARENT') {
      return {
        action: 'ADD_PARENT',
        parentCategory: issue.requiredParent,
        suggestion: `Add a '${issue.requiredParent}' category to provide context`
      };
    }

    if (issue.type === 'DISTANT_RELATIONSHIP') {
      return {
        action: 'REORDER',
        suggestion: 'Consider moving the attribute closer to its parent in the prompt'
      };
    }

    return {
      action: 'REVIEW',
      suggestion: 'Review the prompt structure for consistency'
    };
  }

  /**
   * Generate summary of all issues
   */
  generateSummary(issues: FormattedValidationIssue[]): string {
    if (issues.length === 0) {
      return 'No hierarchy issues detected';
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error(s)`);
    if (warnings > 0) parts.push(`${warnings} warning(s)`);
    if (info > 0) parts.push(`${info} suggestion(s)`);

    return `Found ${parts.join(', ')}`;
  }

  /**
   * Determine severity for orphaned attribute
   */
  determineOrphanSeverity(orphan: OrphanedAttributeGroup): Severity {
    const { missingParent } = orphan;

    // Subject orphans are critical - they represent attributes without a subject
    if (missingParent === TAXONOMY.SUBJECT.id) {
      return 'error';
    }

    // All other orphaned attributes are warnings
    return 'warning';
  }

  /**
   * Get human-readable label for category
   */
  getCategoryLabel(categoryId: string): string {
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
  getExampleForParent(parentId: string): string {
    const examples: Record<string, string> = {
      [TAXONOMY.SUBJECT.id]: 'a weathered cowboy',
      [TAXONOMY.ENVIRONMENT.id]: 'in a dusty frontier town',
      [TAXONOMY.CAMERA.id]: 'wide shot',
      [TAXONOMY.LIGHTING.id]: 'bathed in golden hour light'
    };

    return examples[parentId] || `a ${parentId}`;
  }
}

