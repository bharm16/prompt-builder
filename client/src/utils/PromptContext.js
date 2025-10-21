/**
 * PromptContext - Manages context data from Creative Brainstorm for intelligent phrase extraction
 *
 * This class:
 * - Stores structured input from Creative Brainstorm (subject, action, location, etc.)
 * - Generates keyword maps and semantic expansions
 * - Provides methods to check if text matches user-provided context
 * - Enables context-aware phrase highlighting and suggestion generation
 */

export class PromptContext {
  constructor(brainstormData = {}, metadata = {}) {
    this.version = '1.0.0';
    this.createdAt = Date.now();

    // Core elements from Creative Brainstorm
    this.elements = {
      subject: brainstormData.subject || null,
      action: brainstormData.action || null,
      location: brainstormData.location || null,
      time: brainstormData.time || null,
      mood: brainstormData.mood || null,
      style: brainstormData.style || null,
      event: brainstormData.event || null,
    };

    // Metadata from optimization process
    this.metadata = {
      format: metadata.format || 'detailed',
      technicalParams: metadata.technicalParams || {},
      validationScore: metadata.validationScore || null,
      history: metadata.history || [],
    };

    // Build keyword maps and semantic groups
    this.keywordMaps = this.buildKeywordMaps();
    this.semanticGroups = this.buildSemanticGroups();
  }

  /**
   * Check if context has any meaningful data
   */
  hasContext() {
    return Object.values(this.elements).some(value => value && value.trim().length > 0);
  }

  /**
   * Build keyword maps for each element category
   * These help identify user-provided phrases in the optimized text
   */
  buildKeywordMaps() {
    const maps = {};

    Object.entries(this.elements).forEach(([category, value]) => {
      if (!value) {
        maps[category] = [];
        return;
      }

      // Extract individual words and phrases
      const keywords = [];

      // Add the full value
      keywords.push(value.toLowerCase().trim());

      // Extract individual significant words (longer than 3 chars)
      const words = value.toLowerCase().match(/\b\w{4,}\b/g) || [];
      keywords.push(...words);

      // Extract 2-word phrases
      const twoWordPhrases = value.toLowerCase().match(/\b\w+\s+\w+\b/g) || [];
      keywords.push(...twoWordPhrases);

      maps[category] = [...new Set(keywords)]; // Remove duplicates
    });

    return maps;
  }

  /**
   * Build semantic groups - expand terms to include related concepts
   * This helps catch paraphrases and synonyms in the optimized text
   */
  buildSemanticGroups() {
    const groups = {};

    // Camera movement expansions
    if (this.elements.action) {
      const action = this.elements.action.toLowerCase();
      groups.cameraMovements = [];

      if (action.includes('pan') || action.includes('sweep')) {
        groups.cameraMovements.push('pan', 'pans', 'panning', 'sweep', 'sweeps', 'sweeping');
      }
      if (action.includes('zoom') || action.includes('dolly')) {
        groups.cameraMovements.push('zoom', 'zooms', 'zooming', 'dolly', 'dollies', 'dollying');
      }
      if (action.includes('track')) {
        groups.cameraMovements.push('track', 'tracks', 'tracking', 'follow', 'follows', 'following');
      }
    }

    // Lighting quality expansions
    if (this.elements.time) {
      const time = this.elements.time.toLowerCase();
      groups.lightingQuality = [];

      if (time.includes('golden hour')) {
        groups.lightingQuality.push('golden hour', 'magic hour', 'warm light', 'sunset', 'sunrise', 'warm glow');
      }
      if (time.includes('blue hour')) {
        groups.lightingQuality.push('blue hour', 'dusk', 'twilight', 'cool light');
      }
      if (time.includes('harsh') || time.includes('midday')) {
        groups.lightingQuality.push('harsh', 'high contrast', 'midday', 'overhead', 'direct');
      }
    }

    // Style/aesthetic expansions
    if (this.elements.style) {
      const style = this.elements.style.toLowerCase();
      groups.aesthetics = [];

      if (style.includes('35mm') || style.includes('film')) {
        groups.aesthetics.push('35mm', 'film', 'analog', 'film grain', 'celluloid');
      }
      if (style.includes('documentary') || style.includes('verité')) {
        groups.aesthetics.push('documentary', 'verité', 'handheld', 'naturalistic', 'observational');
      }
      if (style.includes('noir')) {
        groups.aesthetics.push('noir', 'high contrast', 'chiaroscuro', 'shadows');
      }
    }

    return groups;
  }

  /**
   * Find which category a phrase belongs to based on context
   * Returns null if no match, or {category, confidence, source} if matched
   */
  findCategoryForPhrase(phraseText) {
    const lowerPhrase = phraseText.toLowerCase().trim();

    // First, check for exact or partial matches in keyword maps
    for (const [category, keywords] of Object.entries(this.keywordMaps)) {
      for (const keyword of keywords) {
        if (lowerPhrase.includes(keyword) || keyword.includes(lowerPhrase)) {
          return {
            category,
            confidence: 1.0,
            source: 'user-input',
            originalValue: this.elements[category]
          };
        }
      }
    }

    // Second, check semantic groups for related terms
    for (const [groupName, terms] of Object.entries(this.semanticGroups)) {
      for (const term of terms) {
        if (lowerPhrase.includes(term)) {
          // Map group names back to categories
          const category = this.mapGroupToCategory(groupName);
          if (category) {
            return {
              category,
              confidence: 0.8,
              source: 'semantic-match',
              originalValue: this.elements[category]
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Map semantic group names to element categories
   */
  mapGroupToCategory(groupName) {
    const mappings = {
      cameraMovements: 'action',
      lightingQuality: 'time',
      aesthetics: 'style'
    };
    return mappings[groupName] || null;
  }

  /**
   * Generate variations of a value for fuzzy matching
   * Handles plurals, verb tenses, etc.
   */
  generateVariations(value) {
    if (!value) return [];

    const variations = [value];
    const lower = value.toLowerCase();

    // Add lowercase version
    variations.push(lower);

    // Add without articles
    const withoutArticles = lower.replace(/\b(a|an|the)\s+/g, '');
    if (withoutArticles !== lower) {
      variations.push(withoutArticles);
    }

    // Add singular/plural variations for common endings
    if (lower.endsWith('s')) {
      variations.push(lower.slice(0, -1)); // Remove 's'
    } else {
      variations.push(lower + 's'); // Add 's'
    }

    // Add present participle (-ing) for verbs
    if (lower.match(/\w+$/)) {
      const base = lower.replace(/e$/, ''); // Remove trailing 'e'
      variations.push(base + 'ing');
    }

    return [...new Set(variations)];
  }

  /**
   * Get category color for UI display
   */
  static getCategoryColor(category) {
    const colors = {
      subject: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)' }, // Blue
      action: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.5)' }, // Purple
      location: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)' }, // Green
      time: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' }, // Amber
      mood: { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)' }, // Pink
      style: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)' }, // Indigo
      event: { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.5)' }, // Sky
      technical: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)' }, // Violet
      descriptive: { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.4)' }, // Amber
      lighting: { bg: 'rgba(253, 224, 71, 0.2)', border: 'rgba(253, 224, 71, 0.6)' }, // Yellow
      cameraMove: { bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.55)' }, // Sky blue
      framing: { bg: 'rgba(147, 197, 253, 0.18)', border: 'rgba(59, 130, 246, 0.45)' }, // Light blue
      environment: { bg: 'rgba(34, 197, 94, 0.18)', border: 'rgba(34, 197, 94, 0.55)' }, // Green
      color: { bg: 'rgba(244, 114, 182, 0.2)', border: 'rgba(244, 114, 182, 0.55)' }, // Pink
      depthOfField: { bg: 'rgba(251, 146, 60, 0.18)', border: 'rgba(251, 146, 60, 0.5)' }, // Orange
    };

    return colors[category] || { bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.5)' };
  }

  /**
   * Serialize context for storage/transmission
   */
  toJSON() {
    return {
      version: this.version,
      createdAt: this.createdAt,
      elements: this.elements,
      metadata: this.metadata,
    };
  }

  /**
   * Deserialize context from stored JSON
   */
  static fromJSON(json) {
    if (!json) return null;
    return new PromptContext(json.elements || {}, json.metadata || {});
  }
}

export default PromptContext;
