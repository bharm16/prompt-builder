import { describe, expect, it, vi } from 'vitest';

import { TAXONOMY } from '#shared/taxonomy';
import { TaxonomyValidationService } from '@services/taxonomy-validation/TaxonomyValidationService.js';
import { HierarchyValidator } from '@services/taxonomy-validation/services/HierarchyValidator.js';
import { OrphanDetector } from '@services/taxonomy-validation/services/OrphanDetector.js';
import { ValidationReporter } from '@services/taxonomy-validation/services/ValidationReporter.js';
import type { Span } from '@services/taxonomy-validation/types';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('taxonomy validation service stack', () => {
  it('detects orphaned attributes and formats them as issues', () => {
    const service = new TaxonomyValidationService();
    const spans: Span[] = [
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'red coat', start: 10, end: 18 },
    ];

    const result = service.validateSpans(spans);

    expect(result.isValid).toBe(false);
    expect(result.issueCount).toBe(1);
    expect(result.issues[0]?.type).toBe('ORPHANED_ATTRIBUTE');
    expect(result.issues[0]?.missingParent).toBe(TAXONOMY.SUBJECT.id);
  });

  it('applies strictMode by turning warnings into invalid results', () => {
    const service = new TaxonomyValidationService();
    const spans: Span[] = [
      { category: TAXONOMY.CAMERA.attributes?.MOVEMENT, text: 'slow pan', start: 10, end: 18 },
    ];

    const relaxed = service.validateSpans(spans, { strictMode: false });
    const strict = service.validateSpans(spans, { strictMode: true });

    expect(relaxed.hasWarnings).toBe(true);
    expect(relaxed.isValid).toBe(true);
    expect(strict.hasWarnings).toBe(true);
    expect(strict.isValid).toBe(false);
  });

  it('adds consistency issues when parent and attribute are far apart', () => {
    const service = new TaxonomyValidationService();
    const spans: Span[] = [
      { category: TAXONOMY.SUBJECT.id, text: 'hero', start: 0, end: 4 },
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'coat', start: 450, end: 454 },
    ];

    const result = service.validateSpans(spans, { checkConsistency: true });
    const issueTypes = result.issues.map((issue) => issue.type);

    expect(issueTypes).toContain('DISTANT_RELATIONSHIP');
  });

  it('ignores categories listed in ignoreCategories', () => {
    const service = new TaxonomyValidationService();
    const spans: Span[] = [
      { category: TAXONOMY.CAMERA.attributes?.MOVEMENT, text: 'whip pan', start: 10, end: 18 },
    ];

    const result = service.validateSpans(spans, {
      ignoreCategories: [TAXONOMY.CAMERA.attributes?.MOVEMENT as string],
    });

    expect(result.issueCount).toBe(0);
    expect(result.isValid).toBe(true);
    expect(result.summary).toBe('No hierarchy issues detected');
  });

  it('returns missing parents, pre-add warnings, and validation stats', () => {
    const service = new TaxonomyValidationService();
    const spans: Span[] = [
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'coat' },
      { category: TAXONOMY.CAMERA.attributes?.MOVEMENT, text: 'dolly' },
    ];

    const missingParents = service.getMissingParents(spans);
    const preAdd = service.validateBeforeAdd(TAXONOMY.SUBJECT.attributes?.WARDROBE as string, []);
    const stats = service.getValidationStats(spans);

    expect(missingParents).toEqual(expect.arrayContaining([TAXONOMY.SUBJECT.id, TAXONOMY.CAMERA.id]));
    expect(preAdd.canAdd).toBe(true);
    expect(preAdd.missingParent).toBe(TAXONOMY.SUBJECT.id);
    expect(preAdd.warning).toContain('requires');
    expect(stats.hasOrphans).toBe(true);
    expect(stats.orphanedCount).toBe(2);
  });

  it('covers HierarchyValidator parent requirements and consistency checks', () => {
    const validator = new HierarchyValidator();
    const spans: Span[] = [
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'coat', start: 300, end: 304 },
      { category: TAXONOMY.SUBJECT.id, text: 'hero', start: 0, end: 4 },
    ];

    const hierarchyIssues = validator.validateHierarchy([{ category: TAXONOMY.SUBJECT.attributes?.WARDROBE }]);
    const consistencyIssues = validator.validateConsistency(spans);
    const required = validator.getRequiredParents([{ category: TAXONOMY.SUBJECT.attributes?.WARDROBE }]);
    const canExist = validator.canAttributeExist(
      TAXONOMY.SUBJECT.attributes?.WARDROBE as string,
      [TAXONOMY.CAMERA.id]
    );

    expect(hierarchyIssues[0]?.type).toBe('MISSING_PARENT');
    expect(consistencyIssues[0]?.type).toBe('DISTANT_RELATIONSHIP');
    expect(required.has(TAXONOMY.SUBJECT.id)).toBe(true);
    expect(canExist).toEqual({ valid: false, missingParent: TAXONOMY.SUBJECT.id });
  });

  it('covers OrphanDetector orphan grouping and severity helpers', () => {
    const detector = new OrphanDetector();
    const spans: Span[] = [
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'coat', start: 1, end: 5 },
      { category: TAXONOMY.CAMERA.attributes?.MOVEMENT, text: 'pan', start: 8, end: 11 },
    ];

    const groups = detector.findOrphanedAttributes(spans);
    const subjectOrphan = detector.detectOrphanedSubjectAttributes(spans);
    const cameraOrphan = detector.detectOrphanedCameraAttributes(spans);
    const orphanCheck = detector.isSpanOrphaned(
      { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, text: 'coat' },
      spans
    );

    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(subjectOrphan?.missingParent).toBe(TAXONOMY.SUBJECT.id);
    expect(cameraOrphan?.severity).toBe('info');
    expect(orphanCheck).toBe(true);
    expect(detector.getSeverity(TAXONOMY.SUBJECT.id, 3)).toBe('error');
    expect(detector.getSeverity(TAXONOMY.CAMERA.id, 1)).toBe('info');
  });

  it('covers ValidationReporter formatting and summary generation', () => {
    const reporter = new ValidationReporter();
    const formatted = reporter.formatValidationResult(
      [
        {
          type: 'DISTANT_RELATIONSHIP',
          severity: 'info',
          message: 'too far',
          attributeSpan: { category: TAXONOMY.SUBJECT.attributes?.WARDROBE, start: 400, end: 408 },
          parentSpan: { category: TAXONOMY.SUBJECT.id, start: 0, end: 4 },
          distance: 396,
        },
      ],
      [
        {
          missingParent: TAXONOMY.CAMERA.id,
          orphanedSpans: [{ category: TAXONOMY.CAMERA.attributes?.MOVEMENT, text: 'pan', start: 10, end: 13 }],
          categories: [TAXONOMY.CAMERA.attributes?.MOVEMENT as string],
          count: 1,
        },
      ]
    );

    expect(formatted.issueCount).toBe(2);
    expect(formatted.summary).toContain('suggestion');
    expect(reporter.getCategoryLabel('missing.category')).toBe('missing.category');
    expect(reporter.getExampleForParent(TAXONOMY.SUBJECT.id)).toContain('cowboy');
    expect(reporter.generateSummary([])).toBe('No hierarchy issues detected');
  });
});
