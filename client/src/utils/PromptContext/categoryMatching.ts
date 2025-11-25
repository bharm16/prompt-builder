/**
 * Category Matching Logic
 * 
 * Determines which category a phrase belongs to based on keyword maps
 * and semantic groups
 */

interface KeywordMaps {
  [category: string]: string[];
}

export interface SemanticGroups {
  cameraMovements?: string[];
  lightingQuality?: string[];
  aesthetics?: string[];
  [key: string]: string[] | undefined;
}

interface Elements {
  [category: string]: string | null;
}

interface CategoryMatch {
  category: string;
  confidence: number;
  source: 'user-input' | 'semantic-match';
  originalValue: string | null;
}

/**
 * Find which category a phrase belongs to based on context
 * Returns null if no match, or match result if matched
 */
export function findCategoryForPhrase(
  phraseText: string,
  keywordMaps: KeywordMaps,
  semanticGroups: SemanticGroups,
  elements: Elements
): CategoryMatch | null {
  const lowerPhrase = phraseText.toLowerCase().trim();

  // First, check for exact or partial matches in keyword maps
  for (const [category, keywords] of Object.entries(keywordMaps)) {
    for (const keyword of keywords) {
      if (lowerPhrase.includes(keyword) || keyword.includes(lowerPhrase)) {
        return {
          category,
          confidence: 1.0,
          source: 'user-input',
          originalValue: elements[category] ?? null,
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
            originalValue: elements[category] ?? null,
          };
        }
      }
    }
  }

  return null;
}

type GroupName = 'cameraMovements' | 'lightingQuality' | 'aesthetics' | 'audioElements';

/**
 * Map semantic group names to element categories
 */
export function mapGroupToCategory(groupName: string): string | null {
  const mappings: Record<GroupName, string> = {
    cameraMovements: 'cameraMove',
    lightingQuality: 'lighting',
    aesthetics: 'style',
    audioElements: 'technical',
  };
  return mappings[groupName as GroupName] || null;
}

