/**
 * Fuzzy matching utilities for phrase recognition
 *
 * Handles:
 * - Common typos and spelling variations
 * - Levenshtein distance matching
 * - Common cinematography term misspellings
 */

export class FuzzyMatcher {
  constructor() {
    // Common misspellings for cinematography terms
    this.commonTypos = {
      'bokhe': 'bokeh',
      'bokey': 'bokeh',
      'bokah': 'bokeh',
      'depth of feild': 'depth of field',
      'anamophic': 'anamorphic',
      'anamporhic': 'anamorphic',
      'cinematic': 'cinematic',
      'cinematc': 'cinematic',
      'lense': 'lens',
      'focuss': 'focus',
      'exposeure': 'exposure',
      'lightting': 'lighting',
      'lighitng': 'lighting',
      'shaddow': 'shadow',
      'shaddows': 'shadows',
      'refletion': 'reflection',
      'reflecton': 'reflection',
    };
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy matching with a tolerance
   */
  levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Check if two words are similar enough (fuzzy match)
   * Tolerance: max 1-2 character differences depending on word length
   */
  isFuzzyMatch(word1, word2) {
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();

    // Exact match
    if (w1 === w2) return true;

    // Check common typos
    if (this.commonTypos[w1] === w2 || this.commonTypos[w2] === w1) {
      return true;
    }

    // For very short words, require exact match
    if (w1.length < 4 || w2.length < 4) return false;

    const distance = this.levenshteinDistance(w1, w2);
    const maxDistance = w1.length <= 6 ? 1 : 2;

    return distance <= maxDistance;
  }

  /**
   * Auto-correct common typos in text
   */
  autoCorrect(text) {
    let corrected = text;

    // Replace common typos
    Object.entries(this.commonTypos).forEach(([typo, correct]) => {
      const regex = new RegExp(`\\b${typo}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    });

    return corrected;
  }

  /**
   * Find best fuzzy match from a list of candidates
   * Returns {match: string, distance: number, confidence: number}
   */
  findBestMatch(input, candidates) {
    const inputLower = input.toLowerCase();
    let bestMatch = null;
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(inputLower, candidate.toLowerCase());

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = candidate;
      }
    }

    // Calculate confidence (0-100%)
    const maxAllowedDistance = Math.floor(input.length / 4);
    const confidence = Math.max(0, 100 - (minDistance / maxAllowedDistance * 100));

    return {
      match: bestMatch,
      distance: minDistance,
      confidence: Math.round(confidence),
      isGoodMatch: minDistance <= maxAllowedDistance,
    };
  }

  /**
   * Suggest corrections for a phrase
   * Returns array of {original, suggested, confidence}
   */
  suggestCorrections(phrase, knownPhrases) {
    const words = phrase.toLowerCase().split(/\s+/);
    const suggestions = [];

    words.forEach((word, index) => {
      // Check if it's a known typo
      if (this.commonTypos[word]) {
        suggestions.push({
          original: word,
          suggested: this.commonTypos[word],
          confidence: 95,
          position: index,
        });
      }
    });

    return suggestions;
  }
}

// Export singleton
export const fuzzyMatcher = new FuzzyMatcher();
