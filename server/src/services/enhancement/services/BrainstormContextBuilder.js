/**
 * BrainstormContextBuilder
 * 
 * Responsible for building and formatting brainstorm context sections
 * for inclusion in prompts. Handles signature creation and value formatting.
 * 
 * Single Responsibility: Brainstorm context management and formatting
 */
export class BrainstormContextBuilder {
  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Build a compact signature of brainstorm context for caching
   * @param {Object} brainstormContext - Brainstorm context object
   * @returns {Object|null} Normalized signature or null
   */
  buildBrainstormSignature(brainstormContext) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return null;
    }

    const { elements = {}, metadata = {} } = brainstormContext;

    const normalizedElements = Object.entries(elements).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          acc[key] = trimmed;
        }
      }
      return acc;
    }, {});

    const normalizedMetadata = {};
    if (metadata && typeof metadata === 'object') {
      if (typeof metadata.format === 'string' && metadata.format.trim()) {
        normalizedMetadata.format = metadata.format.trim();
      }

      if (metadata.technicalParams && typeof metadata.technicalParams === 'object') {
        const technicalEntries = Object.entries(metadata.technicalParams).reduce(
          (acc, [key, value]) => {
            if (value === undefined || value === null) {
              return acc;
            }

            if (typeof value === 'string') {
              const trimmedValue = value.trim();
              if (trimmedValue) {
                acc[key] = trimmedValue;
              }
              return acc;
            }

            if (Array.isArray(value)) {
              if (value.length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            if (typeof value === 'object') {
              if (Object.keys(value).length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            acc[key] = value;
            return acc;
          },
          {}
        );

        if (Object.keys(technicalEntries).length) {
          normalizedMetadata.technicalParams = technicalEntries;
        }
      }

      if (
        typeof metadata.validationScore === 'number' &&
        Number.isFinite(metadata.validationScore)
      ) {
        normalizedMetadata.validationScore = metadata.validationScore;
      }
    }

    const signature = {};
    if (Object.keys(normalizedElements).length) {
      signature.elements = normalizedElements;
    }
    if (Object.keys(normalizedMetadata).length) {
      signature.metadata = normalizedMetadata;
    }

    return Object.keys(signature).length ? signature : null;
  }

  /**
   * Infer creative intent from element combinations
   * NEW: Analyzes how elements work together to understand the narrative intent
   * 
   * @param {Object} elements - Brainstorm elements
   * @returns {Object} Creative intent analysis
   */
  inferCreativeIntent(elements) {
    if (!elements || typeof elements !== 'object') {
      return null;
    }

    const analysis = {
      primaryIntent: null,
      supportingThemes: [],
      narrativeDirection: null,
      emotionalTone: null,
    };

    const elementText = Object.values(elements).filter(v => typeof v === 'string').join(' ').toLowerCase();

    // Detect primary intent patterns
    if (elementText.match(/\b(memory|nostalgia|past|vintage|retro)\b/)) {
      analysis.primaryIntent = 'nostalgic narrative';
      analysis.supportingThemes.push('temporal reflection');
    } else if (elementText.match(/\b(future|sci-fi|tech|neon|cyber)\b/)) {
      analysis.primaryIntent = 'futuristic vision';
      analysis.supportingThemes.push('technological advancement');
    } else if (elementText.match(/\b(dream|surreal|abstract|ethereal)\b/)) {
      analysis.primaryIntent = 'dreamlike exploration';
      analysis.supportingThemes.push('subconscious imagery');
    } else if (elementText.match(/\b(tense|thriller|dark|suspense)\b/)) {
      analysis.primaryIntent = 'tension and suspense';
      analysis.supportingThemes.push('psychological pressure');
    } else if (elementText.match(/\b(calm|peaceful|serene|gentle)\b/)) {
      analysis.primaryIntent = 'tranquil contemplation';
      analysis.supportingThemes.push('meditative atmosphere');
    } else if (elementText.match(/\b(action|dynamic|fast|energy)\b/)) {
      analysis.primaryIntent = 'kinetic energy';
      analysis.supportingThemes.push('movement and momentum');
    }

    // Detect narrative direction
    if (elementText.match(/\b(journey|travel|path|destination)\b/)) {
      analysis.narrativeDirection = 'journey/quest';
    } else if (elementText.match(/\b(transform|change|evolve|become)\b/)) {
      analysis.narrativeDirection = 'transformation';
    } else if (elementText.match(/\b(discover|reveal|uncover|find)\b/)) {
      analysis.narrativeDirection = 'discovery';
    } else if (elementText.match(/\b(conflict|fight|struggle|battle)\b/)) {
      analysis.narrativeDirection = 'conflict/resolution';
    }

    // Detect emotional tone
    if (elementText.match(/\b(hopeful|inspiring|uplifting)\b/)) {
      analysis.emotionalTone = 'hopeful';
    } else if (elementText.match(/\b(melancholic|sad|somber|bittersweet)\b/)) {
      analysis.emotionalTone = 'melancholic';
    } else if (elementText.match(/\b(joyful|happy|celebratory)\b/)) {
      analysis.emotionalTone = 'joyful';
    } else if (elementText.match(/\b(mysterious|enigmatic|cryptic)\b/)) {
      analysis.emotionalTone = 'mysterious';
    }

    return analysis.primaryIntent ? analysis : null;
  }

  /**
   * Suggest missing elements based on creative intent
   * NEW: Identifies gaps in the creative direction
   * 
   * @param {Object} intent - Creative intent from inferCreativeIntent
   * @param {Object} elements - Existing elements
   * @returns {Array} Suggested missing elements
   */
  suggestMissingElements(intent, elements) {
    if (!intent || !intent.primaryIntent) {
      return [];
    }

    const suggestions = [];
    const hasElement = (keywords) => {
      const elementText = Object.values(elements || {}).join(' ').toLowerCase();
      return keywords.some(k => elementText.includes(k));
    };

    // Intent-specific suggestions
    if (intent.primaryIntent === 'nostalgic narrative') {
      if (!hasElement(['time', 'era', 'period', 'year'])) {
        suggestions.push({ category: 'time_period', reason: 'Nostalgic narratives need temporal anchoring' });
      }
      if (!hasElement(['sepia', 'faded', 'vintage', 'aged'])) {
        suggestions.push({ category: 'visual_treatment', reason: 'Consider period-appropriate visual aesthetics' });
      }
    }

    if (intent.primaryIntent === 'futuristic vision') {
      if (!hasElement(['neon', 'holographic', 'led', 'digital'])) {
        suggestions.push({ category: 'lighting', reason: 'Futuristic settings often feature artificial/neon lighting' });
      }
      if (!hasElement(['glass', 'metal', 'chrome', 'sleek'])) {
        suggestions.push({ category: 'materials', reason: 'Futuristic aesthetics benefit from modern materials' });
      }
    }

    if (intent.primaryIntent === 'tension and suspense') {
      if (!hasElement(['shadow', 'dim', 'low key', 'dark'])) {
        suggestions.push({ category: 'lighting', reason: 'Suspense typically requires low-key lighting for atmosphere' });
      }
      if (!hasElement(['close-up', 'dutch', 'handheld'])) {
        suggestions.push({ category: 'camera', reason: 'Tension benefits from claustrophobic framing or unstable camera' });
      }
    }

    if (intent.narrativeDirection === 'journey/quest') {
      if (!hasElement(['landscape', 'path', 'road', 'horizon'])) {
        suggestions.push({ category: 'environment', reason: 'Journey narratives often emphasize the landscape/path' });
      }
    }

    return suggestions;
  }

  /**
   * Detect style conflicts in element combinations
   * NEW: Identifies clashing or contradictory elements
   * 
   * @param {Object} elements - Brainstorm elements
   * @returns {Array} Detected conflicts
   */
  detectStyleConflicts(elements) {
    if (!elements || typeof elements !== 'object') {
      return [];
    }

    const conflicts = [];
    const elementText = Object.values(elements).filter(v => typeof v === 'string').join(' ').toLowerCase();

    // Time period conflicts
    if (elementText.match(/\b(vintage|retro|historical)\b/) && elementText.match(/\b(futuristic|sci-fi|neon)\b/)) {
      conflicts.push({
        type: 'temporal_clash',
        description: 'Mixing vintage/historical with futuristic elements',
        suggestion: 'Decide on a primary time period or intentionally blend as retrofuturism',
      });
    }

    // Mood conflicts
    if (elementText.match(/\b(calm|peaceful|serene)\b/) && elementText.match(/\b(chaotic|frantic|intense)\b/)) {
      conflicts.push({
        type: 'mood_clash',
        description: 'Conflicting calm and chaotic moods',
        suggestion: 'Choose a primary mood or show contrast intentionally (e.g., calm before storm)',
      });
    }

    // Lighting conflicts
    if (elementText.match(/\b(bright|sunny|golden hour)\b/) && elementText.match(/\b(dark|moody|noir)\b/)) {
      conflicts.push({
        type: 'lighting_clash',
        description: 'Mixing bright/sunny with dark/moody lighting',
        suggestion: 'Reconcile with "dramatic chiaroscuro" or choose one primary lighting tone',
      });
    }

    // Style conflicts
    if (elementText.match(/\b(realistic|documentary|naturalistic)\b/) && elementText.match(/\b(stylized|abstract|surreal)\b/)) {
      conflicts.push({
        type: 'style_clash',
        description: 'Mixing realistic with highly stylized approaches',
        suggestion: 'Choose a primary visual approach or specify "stylized realism" as a hybrid',
      });
    }

    return conflicts;
  }

  /**
   * Get complementary elements for a given element
   * NEW: Suggests what naturally pairs with an element given the creative intent
   * 
   * @param {string} element - Element to find complements for
   * @param {Object} intent - Creative intent
   * @returns {Array} Complementary elements
   */
  getComplementaryElements(element, intent) {
    if (!element || typeof element !== 'string') {
      return [];
    }

    const elementLower = element.toLowerCase();
    const complements = [];

    // Golden hour lighting complements
    if (elementLower.includes('golden hour')) {
      complements.push({ element: 'warm color grading', reason: 'Enhances golden hour warmth' });
      complements.push({ element: 'rim lighting on subject', reason: 'Backlit subjects glow during golden hour' });
      complements.push({ element: 'lens flare', reason: 'Natural from low-angle sun' });
    }

    // Underwater complements
    if (elementLower.includes('underwater')) {
      complements.push({ element: 'caustic light patterns', reason: 'Essential for underwater realism' });
      complements.push({ element: 'slow, fluid movement', reason: 'Physics of water resistance' });
      complements.push({ element: 'blue-green color cast', reason: 'Light absorption underwater' });
    }

    // Moody/dark lighting complements
    if (elementLower.match(/\b(moody|dark|noir)\b/)) {
      complements.push({ element: 'high contrast ratio (4:1+)', reason: 'Defines moody lighting technically' });
      complements.push({ element: 'selective pools of light', reason: 'Creates dramatic shadows' });
      complements.push({ element: 'smoke or haze', reason: 'Reveals light beams, adds atmosphere' });
    }

    // Handheld camera complements
    if (elementLower.includes('handheld')) {
      complements.push({ element: 'documentary-style framing', reason: 'Matches handheld aesthetic' });
      complements.push({ element: 'natural lighting', reason: 'Enhances realism of handheld' });
      
      if (intent && intent.primaryIntent === 'tension and suspense') {
        complements.push({ element: 'close-up framing', reason: 'Handheld + close-ups heighten claustrophobia' });
      }
    }

    // Cinematic/film style complements
    if (elementLower.match(/\b(cinematic|film|35mm)\b/)) {
      complements.push({ element: '2.39:1 aspect ratio', reason: 'Classic cinema widescreen' });
      complements.push({ element: 'shallow depth of field', reason: 'Film aesthetic, subject isolation' });
      complements.push({ element: 'motivated lighting', reason: 'Professional film lighting approach' });
    }

    return complements;
  }

  /**
   * Build brainstorm context section for prompt inclusion
   * ENHANCED: Now includes creative intent analysis, missing elements, and relationships
   * 
   * @param {Object} brainstormContext - Brainstorm context object
   * @param {Object} options - Options for context building
   * @returns {string} Formatted context section
   */
  buildBrainstormContextSection(
    brainstormContext,
    { includeCategoryGuidance = false, isVideoPrompt = false } = {}
  ) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return '';
    }

    const elements = brainstormContext.elements || {};
    const metadata = brainstormContext.metadata || {};

    const definedElements = Object.entries(elements).filter(([, value]) => {
      return typeof value === 'string' && value.trim().length > 0;
    });

    const technicalParams =
      metadata && typeof metadata.technicalParams === 'object'
        ? Object.entries(metadata.technicalParams).filter(([, value]) => {
            if (value === null || value === undefined) {
              return false;
            }
            if (typeof value === 'string') {
              return value.trim().length > 0;
            }
            if (Array.isArray(value)) {
              return value.length > 0;
            }
            if (typeof value === 'object') {
              return Object.keys(value).length > 0;
            }
            return true;
          })
        : [];

    const formatPreference =
      typeof metadata.format === 'string' && metadata.format.trim().length > 0
        ? metadata.format.trim()
        : null;

    const validationScore =
      typeof metadata.validationScore === 'number' &&
      Number.isFinite(metadata.validationScore)
        ? metadata.validationScore
        : null;

    if (!definedElements.length && !technicalParams.length && !formatPreference && validationScore === null) {
      return '';
    }

    // NEW: Infer creative intent
    const intent = this.inferCreativeIntent(elements);
    const conflicts = this.detectStyleConflicts(elements);
    const missingElements = intent ? this.suggestMissingElements(intent, elements) : [];

    let section = '**Creative Brainstorm Structured Context:**\n';
    section += 'These are user-confirmed anchors that suggestions must respect.\n';

    if (definedElements.length) {
      definedElements.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${value.trim()}\n`;
      });
    }

    // NEW: Include creative intent analysis
    if (intent && intent.primaryIntent) {
      section += '\n**Creative Intent Analysis:**\n';
      section += `The elements suggest a "${intent.primaryIntent}" direction`;
      
      if (intent.narrativeDirection) {
        section += ` with a "${intent.narrativeDirection}" narrative arc`;
      }
      
      if (intent.emotionalTone) {
        section += `, conveying a ${intent.emotionalTone} emotional tone`;
      }
      
      section += '.\n';

      if (intent.supportingThemes.length > 0) {
        section += `Supporting themes: ${intent.supportingThemes.join(', ')}.\n`;
      }

      // NEW: Show element relationships as narrative
      section += '\n**Element Relationships:**\n';
      definedElements.forEach(([key, value]) => {
        const complements = this.getComplementaryElements(value, intent);
        if (complements.length > 0) {
          section += `- "${value}" naturally pairs with:\n`;
          complements.slice(0, 2).forEach(c => {
            section += `  • ${c.element} (${c.reason})\n`;
          });
        }
      });
    }

    // NEW: Highlight gaps and opportunities
    if (missingElements.length > 0) {
      section += '\n**Opportunities to Strengthen:**\n';
      missingElements.forEach(({ category, reason }) => {
        section += `- Consider adding ${category}: ${reason}\n`;
      });
    }

    // NEW: Warn about conflicts
    if (conflicts.length > 0) {
      section += '\n**⚠️  Style Considerations:**\n';
      conflicts.forEach(c => {
        section += `- ${c.description}\n`;
        section += `  Suggestion: ${c.suggestion}\n`;
      });
    }

    if (formatPreference || technicalParams.length || validationScore !== null) {
      section += '\n**Metadata & Technical Guidance:**\n';

      if (formatPreference) {
        section += `- Format Preference: ${formatPreference}\n`;
      }

      if (validationScore !== null) {
        section += `- Validation Score: ${validationScore}\n`;
      }

      technicalParams.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${this.formatBrainstormValue(value)}\n`;
      });
    }

    if (includeCategoryGuidance) {
      section += '\nUse these anchors to inspire category labels and keep suggestions aligned with the user\'s core concept.\n';
    } else {
      section += '\nEnsure every rewrite strengthens these anchors and creative intent rather than contradicting them.\n';
    }

    if (isVideoPrompt) {
      section += 'Translate these anchors into cinematic details that serve the narrative direction.\n';
    }

    return section;
  }

  /**
   * Format brainstorm keys into human-readable labels
   * @param {string} key - Key to format
   * @returns {string} Formatted key
   */
  formatBrainstormKey(key) {
    if (!key) {
      return '';
    }

    return key
      .toString()
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Normalize brainstorm metadata values for prompt inclusion
   * @param {*} value - Value to format
   * @returns {string} Formatted value
   */
  formatBrainstormValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
