/**
 * PromptContext - Core Data Model
 * 
 * Manages context data from Creative Brainstorm for intelligent phrase extraction
 */

import { buildKeywordMaps, buildSemanticGroups, generateVariations } from './keywordExtraction.js';
import { findCategoryForPhrase as findCategory, mapGroupToCategory } from './categoryMatching.js';
import { getCategoryColor } from './categoryStyles.js';

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
    this.keywordMaps = buildKeywordMaps(this.elements);
    this.semanticGroups = buildSemanticGroups(this.elements);
  }

  /**
   * Check if context has any meaningful data
   */
  hasContext() {
    return Object.values(this.elements).some(value => value && value.trim().length > 0);
  }

  /**
   * Find which category a phrase belongs to based on context
   * Returns null if no match, or {category, confidence, source} if matched
   */
  findCategoryForPhrase(phraseText) {
    return findCategory(phraseText, this.keywordMaps, this.semanticGroups, this.elements);
  }

  /**
   * Map semantic group names to element categories
   */
  mapGroupToCategory(groupName) {
    return mapGroupToCategory(groupName);
  }

  /**
   * Generate variations of a value for fuzzy matching
   * Handles plurals, verb tenses, etc.
   */
  generateVariations(value) {
    return generateVariations(value);
  }

  /**
   * Get category color for UI display
   */
  static getCategoryColor(category) {
    return getCategoryColor(category);
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

