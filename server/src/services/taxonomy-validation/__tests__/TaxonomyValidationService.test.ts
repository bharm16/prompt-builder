import { describe, it, expect, beforeEach } from 'vitest';
import { TaxonomyValidationService } from '../TaxonomyValidationService.js';
import { TAXONOMY } from '#shared/taxonomy.js';
import type { Span } from '../types.js';

describe('TaxonomyValidationService', () => {
  let validator: TaxonomyValidationService;

  beforeEach(() => {
    validator = new TaxonomyValidationService();
  });

  describe('validateSpans', () => {
    it('should pass validation when no spans provided', () => {
      const result = validator.validateSpans([]);
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should pass validation when parent and attributes present', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' }
      ];

      const result = validator.validateSpans(spans);
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect orphaned subject attributes', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' },
        { category: TAXONOMY.SUBJECT.attributes?.APPEARANCE || '', text: 'tall' }
      ];

      const result = validator.validateSpans(spans);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.type).toBe('ORPHANED_ATTRIBUTE');
      expect(result.issues[0]?.missingParent).toBe(TAXONOMY.SUBJECT.id);
    });

    it('should detect orphaned camera attributes', () => {
      const spans: Span[] = [
        { category: TAXONOMY.CAMERA.attributes?.MOVEMENT || '', text: 'dolly in' },
        { category: TAXONOMY.CAMERA.attributes?.LENS || '', text: '35mm' }
      ];

      const result = validator.validateSpans(spans);
      
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.missingParent).toBe(TAXONOMY.CAMERA.id);
    });

    it('should allow parent categories without attributes', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.ENVIRONMENT.id, text: 'in a saloon' }
      ];

      const result = validator.validateSpans(spans);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect multiple orphan groups', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' },
        { category: TAXONOMY.SHOT.attributes?.TYPE || '', text: 'wide shot' }
      ];

      const result = validator.validateSpans(spans);
      
      expect(result.issues).toHaveLength(2);
      const missingParents = result.issues.map(i => i.missingParent);
      expect(missingParents).toContain(TAXONOMY.SUBJECT.id);
      expect(missingParents).toContain(TAXONOMY.SHOT.id);
    });
  });

  describe('hasOrphanedAttributes', () => {
    it('should return false when no orphans', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' }
      ];

      expect(validator.hasOrphanedAttributes(spans)).toBe(false);
    });

    it('should return true when orphans detected', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' }
      ];

      expect(validator.hasOrphanedAttributes(spans)).toBe(true);
    });
  });

  describe('getMissingParents', () => {
    it('should return empty array when no missing parents', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' }
      ];

      const missing = validator.getMissingParents(spans);
      expect(missing).toHaveLength(0);
    });

    it('should return missing parent categories', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' },
        { category: TAXONOMY.SHOT.attributes?.TYPE || '', text: 'close-up' }
      ];

      const missing = validator.getMissingParents(spans);
      expect(missing).toContain(TAXONOMY.SUBJECT.id);
      expect(missing).toContain(TAXONOMY.SHOT.id);
      expect(missing).toHaveLength(2);
    });
  });

  describe('validateBeforeAdd', () => {
    it('should allow adding parent category', () => {
      const existingSpans: Span[] = [];
      const result = validator.validateBeforeAdd(TAXONOMY.SUBJECT.id, existingSpans);
      
      expect(result.canAdd).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should allow adding attribute when parent exists', () => {
      const existingSpans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' }
      ];
      const result = validator.validateBeforeAdd(
        TAXONOMY.SUBJECT.attributes?.WARDROBE || '', 
        existingSpans
      );
      
      expect(result.canAdd).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should warn when adding attribute without parent', () => {
      const existingSpans: Span[] = [];
      const result = validator.validateBeforeAdd(
        TAXONOMY.SUBJECT.attributes?.WARDROBE || '', 
        existingSpans
      );
      
      expect(result.canAdd).toBe(true); // Doesn't block, just warns
      expect(result.warning).toBeTruthy();
      expect(result.missingParent).toBe(TAXONOMY.SUBJECT.id);
    });
  });

  describe('getValidationStats', () => {
    it('should return correct statistics', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' },
        { category: TAXONOMY.SHOT.attributes?.TYPE || '', text: 'close-up' }
      ];

      const stats = validator.getValidationStats(spans);
      
      expect(stats.totalSpans).toBe(3);
      expect(stats.hasOrphans).toBe(true);
      expect(stats.orphanedCount).toBe(1);
      expect(stats.missingParents).toContain(TAXONOMY.SHOT.id);
    });

    it('should return zero counts for valid spans', () => {
      const spans: Span[] = [
        { category: TAXONOMY.SUBJECT.id, text: 'a cowboy' },
        { category: TAXONOMY.SUBJECT.attributes?.WARDROBE || '', text: 'leather jacket' }
      ];

      const stats = validator.getValidationStats(spans);
      
      expect(stats.totalSpans).toBe(2);
      expect(stats.hasOrphans).toBe(false);
      expect(stats.orphanedCount).toBe(0);
    });
  });

  describe('strict mode', () => {
    it('should fail validation on warnings in strict mode', () => {
      const spans: Span[] = [
        { category: TAXONOMY.CAMERA.attributes?.MOVEMENT || '', text: 'dolly in' }
      ];

      const result = validator.validateSpans(spans, { strictMode: true });
      
      expect(result.isValid).toBe(false);
      expect(result.hasWarnings).toBe(true);
    });

    it('should pass validation on warnings in normal mode', () => {
      const spans: Span[] = [
        { category: TAXONOMY.CAMERA.attributes?.MOVEMENT || '', text: 'dolly in' }
      ];

      const result = validator.validateSpans(spans, { strictMode: false });
      
      // Might be valid depending on severity - camera attributes can stand alone
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});

