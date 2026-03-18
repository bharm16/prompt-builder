import { describe, expect, it, vi } from 'vitest';

import { TAXONOMY } from '#shared/taxonomy';
import { TaxonomyValidationService } from '../TaxonomyValidationService';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('TaxonomyValidationService', () => {
  it('returns a clean no-op result for empty input', () => {
    const service = new TaxonomyValidationService();

    expect(service.validateSpans([])).toEqual({
      isValid: true,
      hasWarnings: false,
      issueCount: 0,
      issues: [],
      summary: 'No hierarchy issues detected',
    });
    expect(service.hasOrphanedAttributes([])).toBe(false);
    expect(service.getValidationStats([])).toEqual({
      totalSpans: 0,
      orphanedCount: 0,
      issueCount: 0,
      hasOrphans: false,
      missingParents: [],
    });
  });

  it('returns no orphan warning when required parents already exist', () => {
    const service = new TaxonomyValidationService();
    const spans = [
      { category: TAXONOMY.SUBJECT.id, text: 'runner' },
      { category: TAXONOMY.SUBJECT.attributes.WARDROBE, text: 'rain jacket' },
    ];

    expect(service.hasOrphanedAttributes(spans)).toBe(false);
    expect(service.getMissingParents(spans)).toEqual([]);
  });

  it('allows pre-add validation without warnings when the parent already exists', () => {
    const service = new TaxonomyValidationService();

    expect(
      service.validateBeforeAdd(TAXONOMY.SUBJECT.attributes.WARDROBE, [
        { category: TAXONOMY.SUBJECT.id, text: 'runner' },
      ])
    ).toEqual({
      canAdd: true,
      missingParent: null,
      warning: null,
    });
  });
});
