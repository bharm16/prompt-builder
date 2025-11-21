/**
 * Category Matching Logic
 * 
 * Determines which category a phrase belongs to based on keyword maps
 * and semantic groups
 */

/**
 * Find which category a phrase belongs to based on context
 * Returns null if no match, or {category, confidence, source} if matched
 * 
 * @param {string} phraseText - The phrase to categorize
 * @param {Object} keywordMaps - Keyword maps from keywordExtraction
 * @param {Object} semanticGroups - Semantic groups from keywordExtraction
 * @param {Object} elements - Original element data
 * @returns {Object|null} Match result or null
 */
export function findCategoryForPhrase(phraseText, keywordMaps, semanticGroups, elements) {
  const lowerPhrase = phraseText.toLowerCase().trim();

  // First, check for exact or partial matches in keyword maps
  for (const [category, keywords] of Object.entries(keywordMaps)) {
    for (const keyword of keywords) {
      if (lowerPhrase.includes(keyword) || keyword.includes(lowerPhrase)) {
        return {
          category,
          confidence: 1.0,
          source: 'user-input',
          originalValue: elements[category]
        };
      }
    }
  }

  // Second, check semantic groups for related terms
  for (const [groupName, terms] of Object.entries(semanticGroups)) {
    for (const term of terms) {
      if (lowerPhrase.includes(term)) {
        // Map group names back to categories
        const category = mapGroupToCategory(groupName);
        if (category) {
          return {
            category,
            confidence: 0.8,
            source: 'semantic-match',
            originalValue: elements[category]
          };
        }
      }
    }
  }

  return null;
}

/**
 * Map semantic group names to element categories
 * 
 * @param {string} groupName - Name of semantic group
 * @returns {string|null} Corresponding category or null
 */
export function mapGroupToCategory(groupName) {
  const mappings = {
    cameraMovements: 'cameraMove',
    lightingQuality: 'lighting',
    aesthetics: 'style',
    audioElements: 'technical'
  };
  return mappings[groupName] || null;
}

