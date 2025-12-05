import { logger } from '@infrastructure/Logger';
import { TAXONOMY, getParentCategory, isAttribute, resolveCategory } from '#shared/taxonomy.ts';
import type { Span, OrphanedAttributeGroup, Severity } from '../types.js';

/**
 * OrphanDetector
 * Specialized service for detecting orphaned attributes
 * 
 * An "orphaned attribute" is an attribute category (like wardrobe, action)
 * that exists without its required parent entity (like subject)
 */
export class OrphanDetector {
  private readonly log = logger.child({ service: 'OrphanDetector' });

  /**
   * Find all orphaned attributes in spans
   */
  findOrphanedAttributes(spans: Span[]): OrphanedAttributeGroup[] {
    if (!Array.isArray(spans) || spans.length === 0) {
      return [];
    }

    const orphans: OrphanedAttributeGroup[] = [];
    // Resolve all categories to handle legacy IDs
    const categoriesPresent = new Set(
      spans.map(s => s.category ? resolveCategory(s.category) : null).filter(Boolean) as string[]
    );
    
    // Group orphaned attributes by their missing parent
    const orphansByParent: Record<string, Span[]> = {};

    for (const span of spans) {
      if (!span.category) continue;
      
      const resolvedCategory = resolveCategory(span.category);
      if (!isAttribute(resolvedCategory)) continue;

      const parentCategory = getParentCategory(resolvedCategory);
      if (parentCategory && !categoriesPresent.has(parentCategory)) {
        if (!orphansByParent[parentCategory]) {
          orphansByParent[parentCategory] = [];
        }
        orphansByParent[parentCategory].push(span);
      }
    }

    // Convert to structured orphan objects
    for (const [missingParent, orphanedSpans] of Object.entries(orphansByParent)) {
      orphans.push({
        missingParent,
        orphanedSpans,
        count: orphanedSpans.length,
        categories: [...new Set(orphanedSpans.map(s => s.category ? resolveCategory(s.category) : '').filter(Boolean))]
      });
    }

    return orphans;
  }

  /**
   * Detect orphaned subject attributes (wardrobe, action, appearance without subject)
   */
  detectOrphanedSubjectAttributes(spans: Span[]): OrphanedAttributeGroup | null {
    const hasSubject = spans.some(s => s.category === TAXONOMY.SUBJECT.id);
    
    if (hasSubject) {
      return null; // No orphans - subject exists
    }

    const subjectAttributes = Object.values(TAXONOMY.SUBJECT.attributes || {});
    const orphanedSpans = spans.filter(s => s.category && subjectAttributes.includes(s.category));

    if (orphanedSpans.length === 0) {
      return null; // No subject attributes to orphan
    }

    return {
      missingParent: TAXONOMY.SUBJECT.id,
      orphanedSpans,
      categories: [...new Set(orphanedSpans.map(s => s.category || '').filter(Boolean))],
      count: orphanedSpans.length
    };
  }

  /**
   * Detect orphaned camera attributes (framing, movement without camera context)
   */
  detectOrphanedCameraAttributes(spans: Span[]): OrphanedAttributeGroup | null {
    const hasCamera = spans.some(s => s.category === TAXONOMY.CAMERA.id);
    
    // Camera attributes can exist independently (they imply camera presence)
    // But we can still flag it as a suggestion for completeness
    const cameraAttributes = Object.values(TAXONOMY.CAMERA.attributes || {});
    const cameraAttrSpans = spans.filter(s => s.category && cameraAttributes.includes(s.category));

    if (cameraAttrSpans.length === 0 || hasCamera) {
      return null;
    }

    return {
      missingParent: TAXONOMY.CAMERA.id,
      orphanedSpans: cameraAttrSpans,
      categories: [...new Set(cameraAttrSpans.map(s => s.category || '').filter(Boolean))],
      count: cameraAttrSpans.length,
      severity: 'info' // Lower severity - camera attributes often standalone
    };
  }

  /**
   * Check if specific span is orphaned
   */
  isSpanOrphaned(span: Span, allSpans: Span[]): boolean {
    if (!span.category) return false;
    
    const resolvedCategory = resolveCategory(span.category);
    if (!isAttribute(resolvedCategory)) {
      return false;
    }

    const parentCategory = getParentCategory(resolvedCategory);
    if (!parentCategory) {
      return false;
    }

    const hasParent = allSpans.some(s => {
      if (!s.category) return false;
      const resolved = resolveCategory(s.category);
      return resolved === parentCategory;
    });
    return !hasParent;
  }

  /**
   * Get severity level for orphaned attributes
   */
  getSeverity(parentCategory: string, orphanCount: number): Severity {
    // Subject attributes are critical - wardrobe without subject is confusing
    if (parentCategory === TAXONOMY.SUBJECT.id) {
      return orphanCount > 2 ? 'error' : 'warning';
    }

    // Camera/lighting attributes can stand alone more easily
    if (parentCategory === TAXONOMY.CAMERA.id || parentCategory === TAXONOMY.LIGHTING.id) {
      return 'info';
    }

    return 'warning';
  }
}

