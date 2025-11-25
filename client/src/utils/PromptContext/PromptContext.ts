/**
 * PromptContext - Core Data Model
 * 
 * Manages context data from Creative Brainstorm for intelligent phrase extraction
 */

import { buildKeywordMaps, buildSemanticGroups, generateVariations, type Elements as ElementsType } from './keywordExtraction.js';
import { findCategoryForPhrase as findCategory, mapGroupToCategory, type SemanticGroups as SemanticGroupsType } from './categoryMatching.js';
import { getCategoryColor } from './categoryStyles.js';

interface BrainstormData {
  subject?: string | null;
  action?: string | null;
  location?: string | null;
  time?: string | null;
  mood?: string | null;
  style?: string | null;
  event?: string | null;
}

interface Metadata {
  format?: string;
  technicalParams?: Record<string, unknown>;
  validationScore?: number | null;
  history?: unknown[];
}

interface Elements {
  subject: string | null;
  action: string | null;
  location: string | null;
  time: string | null;
  mood: string | null;
  style: string | null;
  event: string | null;
  [key: string]: string | null;
}

interface PromptContextJSON {
  version: string;
  createdAt: number;
  elements: Elements;
  metadata: Metadata;
}

export class PromptContext {
  version: string;
  createdAt: number;
  elements: Elements;
  metadata: Metadata;
  keywordMaps: ReturnType<typeof buildKeywordMaps>;
  semanticGroups: ReturnType<typeof buildSemanticGroups>;

  constructor(brainstormData: BrainstormData = {}, metadata: Metadata = {}) {
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
    this.keywordMaps = buildKeywordMaps(this.elements as ElementsType);
    this.semanticGroups = buildSemanticGroups(this.elements as ElementsType);
  }

  /**
   * Check if context has any meaningful data
   */
  hasContext(): boolean {
    return Object.values(this.elements).some(value => value && value.trim().length > 0);
  }

  /**
   * Find which category a phrase belongs to based on context
   * Returns null if no match, or match result if matched
   */
  findCategoryForPhrase(phraseText: string): ReturnType<typeof findCategory> {
    return findCategory(phraseText, this.keywordMaps, this.semanticGroups as SemanticGroupsType, this.elements as ElementsType);
  }

  /**
   * Map semantic group names to element categories
   */
  mapGroupToCategory(groupName: string): string | null {
    return mapGroupToCategory(groupName);
  }

  /**
   * Generate variations of a value for fuzzy matching
   * Handles plurals, verb tenses, etc.
   */
  generateVariations(value: string | null | undefined): string[] {
    return generateVariations(value);
  }

  /**
   * Get category color for UI display
   */
  static getCategoryColor(category: string): ReturnType<typeof getCategoryColor> {
    return getCategoryColor(category);
  }

  /**
   * Serialize context for storage/transmission
   */
  toJSON(): PromptContextJSON {
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
  static fromJSON(json: PromptContextJSON | null | undefined): PromptContext | null {
    if (!json) return null;
    return new PromptContext(json.elements || {}, json.metadata || {});
  }
}

export default PromptContext;

