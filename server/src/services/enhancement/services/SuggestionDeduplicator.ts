import { logger } from '@infrastructure/Logger';
import type { Suggestion, AIService } from './types.js';

/**
 * SuggestionDiversityEnforcer
 *
 * Responsible for ensuring diversity in enhancement suggestions.
 * Prevents similar suggestions and enforces categorical balance.
 *
 * Single Responsibility: Suggestion diversity and deduplication
 */
export class SuggestionDiversityEnforcer {
  constructor(private readonly ai: AIService) {}

  /**
   * Ensure diverse suggestions by replacing too-similar ones
   * @param suggestions - Array of suggestion objects
   * @returns Diverse suggestions
   */
  async ensureDiverseSuggestions(suggestions: Suggestion[]): Promise<Suggestion[]> {
    if (!suggestions || suggestions.length <= 1) return suggestions;

    // Special handling for categorized suggestions
    if (suggestions[0]?.category) {
      return this.ensureCategoricalDiversity(suggestions);
    }

    // Calculate similarity matrix
    const similarities: Array<{ i: number; j: number; similarity: number }> = [];
    for (let i = 0; i < suggestions.length; i++) {
      const first = suggestions[i];
      if (!first) continue;
      for (let j = i + 1; j < suggestions.length; j++) {
        const second = suggestions[j];
        if (!second) continue;
        const sim = await this.calculateSimilarity(
          first.text,
          second.text
        );
        similarities.push({ i, j, similarity: sim });
      }
    }

    // Find too-similar pairs (threshold: 0.7)
    const threshold = 0.7;
    const tooSimilar = similarities.filter(s => s.similarity > threshold);

    if (tooSimilar.length === 0) {
      return suggestions; // Already diverse
    }

    // Mark indices that need replacement
    const toReplace = new Set<number>();
    tooSimilar.forEach(pair => {
      // Keep the first, replace the second
      toReplace.add(pair.j);
    });

    // Generate replacements for similar suggestions
    const diverseSuggestions = [...suggestions];
    for (const idx of toReplace) {
      diverseSuggestions[idx] = await this.generateDiverseAlternative(
        suggestions,
        idx
      );
    }

    logger.info('Enforced diversity', {
      original: suggestions.length,
      replaced: toReplace.size,
    });

    return diverseSuggestions;
  }

  /**
   * Ensure diversity across categories
   * Prevents any single category from dominating suggestions
   * @param suggestions - Array of categorized suggestions
   * @returns Balanced suggestions
   */
  ensureCategoricalDiversity(suggestions: Suggestion[]): Suggestion[] {
    // Group by category
    const categoryCounts: Record<string, number> = {};
    suggestions.forEach(s => {
      const cat = s.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const uniqueCategories = Object.keys(categoryCounts);
    if (uniqueCategories.length <= 1) {
      logger.debug('Single-category suggestions, skipping categorical rebalancing', {
        category: uniqueCategories[0] || 'Other',
        suggestions: suggestions.length,
      });
      return suggestions;
    }

    // Check if any category is over-represented (more than 40% of suggestions)
    const totalSuggestions = suggestions.length;
    const maxPerCategory = Math.ceil(totalSuggestions * 0.4);

    let needsRebalancing = false;
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count > maxPerCategory) {
        logger.info('Category over-represented', { category, count, max: maxPerCategory });
        needsRebalancing = true;
        break;
      }
    }

    if (!needsRebalancing) {
      return suggestions; // Already balanced
    }

    // Rebalance by limiting each category
    const balanced: Suggestion[] = [];
    const categoryLimits: Record<string, number> = {};

    // First pass: take up to max from each category
    suggestions.forEach(suggestion => {
      const cat = suggestion.category || 'Other';
      if (!categoryLimits[cat]) categoryLimits[cat] = 0;

      if (categoryLimits[cat] < maxPerCategory) {
        balanced.push(suggestion);
        categoryLimits[cat]++;
      }
    });

    // Ensure we have enough diversity in categories
    if (uniqueCategories.length < 3 && totalSuggestions >= 6) {
      logger.warn('Not enough category diversity', {
        categories: uniqueCategories.length,
        suggestions: totalSuggestions
      });
    }

    return balanced;
  }

  /**
   * Calculate similarity between two texts using Jaccard similarity
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // Simple character-level similarity (Jaccard)
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    // Also check for substring containment
    const substringPenalty =
      text1.includes(text2) || text2.includes(text1) ? 0.3 : 0;

    return intersection.size / union.size + substringPenalty;
  }

  /**
   * Generate a diverse alternative to replace a similar suggestion
   * Uses LLM to create a meaningfully different alternative
   * @param suggestions - All suggestions
   * @param indexToReplace - Index of suggestion to replace
   * @returns New diverse suggestion
   */
  async generateDiverseAlternative(suggestions: Suggestion[], indexToReplace: number): Promise<Suggestion> {
    const original = suggestions[indexToReplace];
    if (!original) {
      logger.warn('Suggestion index out of range during diversity replacement', {
        indexToReplace,
        suggestionCount: suggestions.length,
      });
      return { text: '', explanation: 'Unable to generate alternative' };
    }
    const otherSuggestions = suggestions.filter((_, i) => i !== indexToReplace);

    const diversityPrompt = `Generate a diverse alternative that is meaningfully different from the existing suggestions.

Original suggestion to replace: "${original.text}"

Existing suggestions to differ from:
${otherSuggestions.map((s, i) => `${i + 1}. "${s.text}"`).join('\n')}

Requirements:
1. Must serve the same purpose as the original
2. Must be meaningfully different in approach or style
3. Should explore a different angle or perspective
4. Maintain quality and relevance

Provide a JSON object with the new suggestion:
{"text": "your diverse alternative", "explanation": "why this is different"}`;

    try {
      const response = await this.ai.execute('enhance_diversity', {
        systemPrompt: diversityPrompt,
        maxTokens: 256,
        temperature: 0.9, // Higher temperature for diversity
      });

      const responseText = (response as { text?: string; content?: Array<{ text?: string }> }).text || 
        ((response as { content?: Array<{ text?: string }> }).content?.[0]?.text || '');
      const alternative = JSON.parse(responseText) as Suggestion;
      return alternative;
    } catch (error) {
      logger.warn('Failed to generate diverse alternative', { error });
      // Fallback: return original with slight modification
      return {
        text: `${original.text} (alternative approach)`,
        explanation: original.explanation || 'Alternative variation',
      };
    }
  }
}
