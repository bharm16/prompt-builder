/**
 * Span Critic - Validates spans for logical errors
 * 
 * PDF Design C: Section 3.3 - Semantic validation after generation
 * 
 * This module provides post-generation validation that checks for logical
 * errors the LLM might make, such as:
 * - Camera movements mislabeled as subject actions
 * - Multiple sequential actions violating "One Clip, One Action" rule
 * - Taxonomy misalignment (e.g., 35mm labeled as style.aesthetic instead of style.filmStock)
 * 
 * The Critic can trigger regeneration with feedback or auto-correct known issues.
 */

export class SpanCritic {
  constructor() {
    // Camera-specific verbs that should ALWAYS be camera.movement
    this.cameraVerbs = /\b(pan|pans|panning|dolly|dollies|dollying|truck|trucks|trucking|crane|cranes|craning|zoom|zooms|zooming|tilt|tilts|tilting)\b/i;
    
    // Sequential markers indicating multiple actions
    this.sequentialMarkers = /\b(and then|then\s|after\s|next\s|followed by|subsequently)\b/i;
    
    // Film stock terms
    this.filmStockTerms = /\b(35mm|16mm|super\s+8|kodak|fuji|velvia|portra|vision|anamorphic)\b/i;
  }

  /**
   * Check if any camera movements were mislabeled as actions
   * PDF Section 3.3: Camera/Action Disambiguation
   * @param {Array} spans - Array of span objects
   * @param {string} originalText - Original input text for context
   * @returns {Array} Array of error objects
   */
  checkCameraActionConfusion(spans, originalText) {
    const errors = [];

    for (const span of spans) {
      // If span is labeled as action but contains camera verbs
      if (span.role.startsWith('action.') && this.cameraVerbs.test(span.text)) {
        // Check if "camera" appears nearby in context (within 100 characters)
        const contextStart = Math.max(0, span.start - 100);
        const contextEnd = Math.min(originalText.length, span.end + 100);
        const context = originalText.slice(contextStart, contextEnd);
        
        if (/\bcamera\b/i.test(context)) {
          errors.push({
            type: 'camera_action_confusion',
            span,
            suggestion: 'Should probably be camera.movement',
            context: context.slice(0, 150),
            severity: 'high',
            autoCorrect: true
          });
        } else {
          // Even without "camera" in context, camera verbs are suspicious
          errors.push({
            type: 'camera_action_confusion',
            span,
            suggestion: 'Camera verb detected - verify if this is camera movement or subject action',
            severity: 'medium',
            autoCorrect: false
          });
        }
      }
    }

    return errors;
  }

  /**
   * Check if "One Clip, One Action" rule is violated
   * PDF Section 3.3: Sequential Action Detection
   * @param {Array} spans - Array of span objects
   * @returns {Array} Array of error objects
   */
  checkOneActionRule(spans) {
    const errors = [];
    const actions = spans.filter(s => s.role.startsWith('action.'));
    
    if (actions.length > 1) {
      // Check if any action contains sequential markers
      for (const action of actions) {
        if (this.sequentialMarkers.test(action.text)) {
          errors.push({
            type: 'multiple_actions',
            spans: actions,
            suggestion: 'Split into single continuous action - detected "and then" or similar',
            severity: 'high',
            autoCorrect: false
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Check if film stock terms are properly categorized
   * PDF Section 3.3: Taxonomy Alignment
   * @param {Array} spans - Array of span objects
   * @returns {Array} Array of error objects
   */
  checkFilmStockTaxonomy(spans) {
    const errors = [];

    for (const span of spans) {
      // If span contains film stock terms but is labeled as style.aesthetic
      if (this.filmStockTerms.test(span.text) && span.role === 'style.aesthetic') {
        errors.push({
          type: 'taxonomy_misalignment',
          span,
          suggestion: 'Film stock terms should use style.filmStock, not style.aesthetic',
          severity: 'medium',
          autoCorrect: true
        });
      }
    }

    return errors;
  }

  /**
   * Check if golden hour / lighting time terms are properly categorized
   * @param {Array} spans - Array of span objects
   * @returns {Array} Array of error objects
   */
  checkLightingTimeTaxonomy(spans) {
    const errors = [];
    const timeTerms = /\b(golden\s+hour|dawn|dusk|sunrise|sunset|midday|noon)\b/i;

    for (const span of spans) {
      // If span contains time-of-day lighting but is labeled as lighting.source
      if (timeTerms.test(span.text) && span.role === 'lighting.source') {
        errors.push({
          type: 'taxonomy_misalignment',
          span,
          suggestion: 'Time-of-day lighting should use lighting.timeOfDay, not lighting.source',
          severity: 'medium',
          autoCorrect: true
        });
      }
    }

    return errors;
  }

  /**
   * Auto-correct spans with known fixes
   * @param {Array} spans - Array of span objects
   * @param {Array} errors - Array of error objects from validation
   * @returns {Object} {corrected: boolean, spans: Array, corrections: Array}
   */
  autoCorrect(spans, errors) {
    const corrections = [];
    const correctedSpans = spans.map(span => ({ ...span })); // Deep copy

    for (const error of errors) {
      if (!error.autoCorrect) continue;

      switch (error.type) {
        case 'camera_action_confusion':
          // Find and correct the span
          const cameraSpanIndex = correctedSpans.findIndex(s => 
            s.text === error.span.text && s.role === error.span.role
          );
          if (cameraSpanIndex !== -1) {
            correctedSpans[cameraSpanIndex].role = 'camera.movement';
            corrections.push({
              type: 'camera_action_confusion',
              old: error.span.role,
              new: 'camera.movement',
              text: error.span.text
            });
          }
          break;

        case 'taxonomy_misalignment':
          const taxSpanIndex = correctedSpans.findIndex(s => 
            s.text === error.span.text && s.role === error.span.role
          );
          if (taxSpanIndex !== -1) {
            const newRole = error.suggestion.includes('filmStock') ? 'style.filmStock' : 
                           error.suggestion.includes('timeOfDay') ? 'lighting.timeOfDay' : null;
            if (newRole) {
              correctedSpans[taxSpanIndex].role = newRole;
              corrections.push({
                type: 'taxonomy_misalignment',
                old: error.span.role,
                new: newRole,
                text: error.span.text
              });
            }
          }
          break;
      }
    }

    return {
      corrected: corrections.length > 0,
      spans: correctedSpans,
      corrections
    };
  }

  /**
   * Run all validation checks
   * @param {Array} spans - Array of span objects
   * @param {string} originalText - Original input text
   * @param {Object} options - Validation options
   * @param {boolean} options.autoCorrect - Enable auto-correction (default: true)
   * @returns {Object} {ok: boolean, spans: Array, errors: Array, corrections: Array}
   */
  validate(spans, originalText, options = {}) {
    const { autoCorrect = true } = options;

    const errors = [
      ...this.checkCameraActionConfusion(spans, originalText),
      ...this.checkOneActionRule(spans),
      ...this.checkFilmStockTaxonomy(spans),
      ...this.checkLightingTimeTaxonomy(spans)
    ];

    if (errors.length === 0) {
      return { ok: true, spans, errors: [], corrections: [] };
    }

    // Auto-correct if enabled
    if (autoCorrect) {
      const result = this.autoCorrect(spans, errors);
      
      // Filter out errors that were auto-corrected
      const remainingErrors = errors.filter(e => !e.autoCorrect);
      
      return {
        ok: remainingErrors.length === 0,
        spans: result.spans,
        errors: remainingErrors,
        corrections: result.corrections,
        autoCorrectApplied: result.corrected
      };
    }

    return { ok: false, spans, errors, corrections: [] };
  }

  /**
   * Generate feedback prompt for LLM regeneration
   * Used when auto-correction is not sufficient
   * @param {Array} errors - Array of error objects
   * @returns {string} Feedback prompt for LLM
   */
  generateFeedbackPrompt(errors) {
    if (errors.length === 0) return '';

    let feedback = 'The following spans have logical errors:\n\n';

    for (const error of errors) {
      feedback += `- **${error.type}**: "${error.span?.text || 'multiple spans'}"\n`;
      feedback += `  Issue: ${error.suggestion}\n`;
      feedback += `  Severity: ${error.severity}\n\n`;
    }

    feedback += 'Please regenerate the affected spans with corrections.\n';
    feedback += 'Apply the Disambiguation Rules and Director\'s Lexicon definitions.';

    return feedback;
  }
}

/**
 * Singleton instance for use across the application
 */
export const spanCritic = new SpanCritic();

