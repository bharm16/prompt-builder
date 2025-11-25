/**
 * Keyword Extraction and Semantic Grouping
 * 
 * Extracts keywords and builds semantic groups from element data
 * to enable fuzzy matching and synonym detection
 */

export interface Elements {
  [category: string]: string | null;
}

interface KeywordMaps {
  [category: string]: string[];
}

interface SemanticGroups {
  cameraMovements?: string[];
  lightingQuality?: string[];
  aesthetics?: string[];
  [key: string]: string[] | undefined;
}

/**
 * Build keyword maps for each element category
 * These help identify user-provided phrases in the optimized text
 */
export function buildKeywordMaps(elements: Elements): KeywordMaps {
  const maps: KeywordMaps = {};

  Object.entries(elements).forEach(([category, value]) => {
    if (!value) {
      maps[category] = [];
      return;
    }

    // Extract individual words and phrases
    const keywords: string[] = [];

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
export function buildSemanticGroups(elements: Elements): SemanticGroups {
  const groups: SemanticGroups = {};

  // Camera movement expansions
  if (elements.action) {
    const action = elements.action.toLowerCase();
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
  if (elements.time) {
    const time = elements.time.toLowerCase();
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
  if (elements.style) {
    const style = elements.style.toLowerCase();
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
 * Generate variations of a value for fuzzy matching
 * Handles plurals, verb tenses, etc.
 */
export function generateVariations(value: string | null | undefined): string[] {
  if (!value) return [];

  const variations: string[] = [value];
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

