/**
 * Confidence scoring system for phrase matches
 *
 * Assigns confidence scores (0-100) to matches based on:
 * - Pattern specificity
 * - Context relevance
 * - Match completeness
 * - Surrounding keyword density
 */

export class MatchConfidenceScorer {
  constructor() {
    // Keywords that boost confidence for specific categories
    this.categoryKeywords = {
      camera: ['camera', 'shot', 'lens', 'angle', 'view', 'focus', 'film'],
      lighting: ['light', 'shadow', 'glow', 'ray', 'illuminat', 'bright', 'dark'],
      atmospheric: ['fog', 'mist', 'rain', 'weather', 'atmospheric', 'air'],
      technical: ['fps', 'depth', 'field', 'aperture', 'exposure', 'resolution'],
      action: ['walk', 'move', 'emerg', 'disappear', 'pass', 'motion'],
    };
  }

  /**
   * Calculate base confidence score for a match
   */
  calculateBaseScore(match) {
    let score = 60; // Base score

    // Longer matches are more specific
    if (match.length > 20) score += 15;
    else if (match.length > 10) score += 10;
    else if (match.length > 5) score += 5;

    // Phrase categories are more confident than single words
    if (match.isPhraseCategory) score += 10;

    // Multi-word matches are more specific
    const wordCount = match.text.split(/\s+/).length;
    if (wordCount >= 3) score += 10;
    else if (wordCount === 2) score += 5;

    return Math.min(100, score);
  }

  /**
   * Calculate contextual confidence boost
   */
  calculateContextBoost(match, surroundingText, category) {
    let boost = 0;

    // Get relevant keywords for this category
    const categoryBase = category.replace(/Phrases$/, '').toLowerCase();
    const keywords = this.categoryKeywords[categoryBase] || [];

    // Count keyword occurrences in surrounding text
    const lowerText = surroundingText.toLowerCase();
    const keywordMatches = keywords.filter(kw =>
      lowerText.includes(kw)
    ).length;

    // Boost confidence based on keyword density
    if (keywordMatches >= 3) boost += 15;
    else if (keywordMatches === 2) boost += 10;
    else if (keywordMatches === 1) boost += 5;

    return boost;
  }

  /**
   * Calculate position-based confidence
   * Matches at the beginning of sentences might be more important
   */
  calculatePositionScore(match, fullText) {
    let score = 0;

    // Check if match is at start of sentence or paragraph
    const precedingText = fullText.slice(Math.max(0, match.start - 10), match.start);

    if (/[.!?]\s*$/.test(precedingText) || match.start === 0) {
      score += 5; // Beginning of sentence
    }

    if (/\n\s*$/.test(precedingText)) {
      score += 3; // Beginning of paragraph
    }

    return score;
  }

  /**
   * Calculate overall confidence score for a match
   * Returns score from 0-100
   */
  scoreMatch(match, fullText, allMatches) {
    // Base score from match characteristics
    let confidence = this.calculateBaseScore(match);

    // Context boost from surrounding text (50 chars each direction)
    const contextStart = Math.max(0, match.start - 50);
    const contextEnd = Math.min(fullText.length, match.end + 50);
    const surroundingText = fullText.slice(contextStart, contextEnd);

    confidence += this.calculateContextBoost(match, surroundingText, match.category);

    // Position-based score
    confidence += this.calculatePositionScore(match, fullText);

    // Add any existing context boost from the matcher
    confidence += (match.contextBoost || 0);

    // Cap at 100
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Filter matches by minimum confidence threshold
   */
  filterByConfidence(matches, fullText, minConfidence = 50) {
    return matches
      .map(match => ({
        ...match,
        confidence: this.scoreMatch(match, fullText, matches),
      }))
      .filter(match => match.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevel(score) {
    if (score >= 85) return 'very high';
    if (score >= 70) return 'high';
    if (score >= 55) return 'medium';
    if (score >= 40) return 'low';
    return 'very low';
  }
}

// Export singleton
export const confidenceScorer = new MatchConfidenceScorer();
