import { TAXONOMY, getParentCategory, isAttribute, resolveCategory } from '#shared/taxonomy.ts';

/**
 * OrphanDetector
 * Specialized service for detecting orphaned attributes
 * 
 * An "orphaned attribute" is an attribute category (like wardrobe, action)
 * that exists without its required parent entity (like subject)
 */

export class OrphanDetector {
  /**
   * Find all orphaned attributes in spans
   * @param {Array} spans - Array of span objects
   * @returns {Array} Array of orphaned span groups
   */
  findOrphanedAttributes(spans) {
    if (!Array.isArray(spans) || spans.length === 0) {
      return [];
    }

    const orphans = [];
    // Resolve all categories to handle legacy IDs
    const categoriesPresent = new Set(
      spans.map(s => s.category ? resolveCategory(s.category) : null).filter(Boolean)
    );
    
    // Group orphaned attributes by their missing parent
    const orphansByParent = {};

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
        categories: [...new Set(orphanedSpans.map(s => resolveCategory(s.category)))]
      });
    }

    return orphans;
  }

  /**
   * Detect orphaned subject attributes (wardrobe, action, appearance without subject)
   * @param {Array} spans - Array of spans
   * @returns {Object|null} Orphaned subject info or null
   */
  detectOrphanedSubjectAttributes(spans) {
    const hasSubject = spans.some(s => s.category === TAXONOMY.SUBJECT.id);
    
    if (hasSubject) {
      return null; // No orphans - subject exists
    }

    const subjectAttributes = Object.values(TAXONOMY.SUBJECT.attributes);
    const orphanedSpans = spans.filter(s => subjectAttributes.includes(s.category));

    if (orphanedSpans.length === 0) {
      return null; // No subject attributes to orphan
    }

    return {
      missingParent: TAXONOMY.SUBJECT.id,
      orphanedSpans,
      categories: [...new Set(orphanedSpans.map(s => s.category))],
      count: orphanedSpans.length
    };
  }

  /**
   * Detect orphaned camera attributes (framing, movement without camera context)
   * @param {Array} spans - Array of spans
   * @returns {Object|null} Orphaned camera info or null
   */
  detectOrphanedCameraAttributes(spans) {
    const hasCamera = spans.some(s => s.category === TAXONOMY.CAMERA.id);
    
    // Camera attributes can exist independently (they imply camera presence)
    // But we can still flag it as a suggestion for completeness
    const cameraAttributes = Object.values(TAXONOMY.CAMERA.attributes);
    const cameraAttrSpans = spans.filter(s => cameraAttributes.includes(s.category));

    if (cameraAttrSpans.length === 0 || hasCamera) {
      return null;
    }

    return {
      missingParent: TAXONOMY.CAMERA.id,
      orphanedSpans: cameraAttrSpans,
      categories: [...new Set(cameraAttrSpans.map(s => s.category))],
      count: cameraAttrSpans.length,
      severity: 'info' // Lower severity - camera attributes often standalone
    };
  }

  /**
   * Check if specific span is orphaned
   * @param {Object} span - Span object
   * @param {Array} allSpans - All spans for context
   * @returns {boolean} True if orphaned
   */
  isSpanOrphaned(span, allSpans) {
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
      const resolved = resolveCategory(s.category);
      return resolved === parentCategory;
    });
    return !hasParent;
  }

  /**
   * Get severity level for orphaned attributes
   * @param {string} parentCategory - Missing parent category
   * @param {number} orphanCount - Number of orphaned attributes
   * @returns {string} Severity level (error, warning, info)
   */
  getSeverity(parentCategory, orphanCount) {
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

