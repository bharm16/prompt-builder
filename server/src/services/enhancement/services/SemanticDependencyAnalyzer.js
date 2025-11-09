/**
 * SemanticDependencyAnalyzer
 *
 * Analyzes semantic relationships between video prompt elements.
 * Helps ensure suggestions respect element dependencies and maintain coherence.
 *
 * Pattern: Pure logic service like PhraseRoleAnalyzer
 * Single Responsibility: Semantic relationship detection and formatting
 */

/**
 * Static configuration defining which video elements influence each other
 * Used to build coherence requirements in enhancement prompts
 */
const SEMANTIC_DEPENDENCIES = {
  // Lighting is influenced by subject, location, mood, and time
  lighting: ['subject', 'location', 'mood', 'time'],
  
  // Camera work depends on what/who you're filming and their action
  camera: ['subject', 'action', 'framing'],
  
  // Subject appearance/wardrobe must match their actions
  subject: ['action', 'wardrobe', 'appearance'],
  
  // Action is constrained by subject capabilities and location
  action: ['subject', 'location', 'camera'],
  
  // Location affects available lighting and mood
  location: ['lighting', 'mood', 'time'],
  
  // Mood is created through lighting, music, and color
  mood: ['lighting', 'music', 'color'],
  
  // Time of day affects lighting and location appearance
  time: ['lighting', 'location', 'mood'],
  
  // Framing relates to camera and subject
  framing: ['camera', 'subject', 'composition'],
  
  // Wardrobe must match subject and mood
  wardrobe: ['subject', 'mood', 'style'],
  
  // Appearance descriptor for subject
  appearance: ['subject', 'mood', 'wardrobe'],
  
  // Music/audio affects mood
  music: ['mood', 'pace', 'style'],
  
  // Color palette affects mood and style
  color: ['mood', 'lighting', 'style'],
  
  // Style encompasses multiple elements
  style: ['mood', 'color', 'camera', 'lighting'],
  
  // Composition relates to framing and camera
  composition: ['framing', 'camera', 'subject'],
  
  // Pace affects action and music
  pace: ['action', 'music', 'editing'],
  
  // Editing style relates to pace and camera
  editing: ['pace', 'camera', 'style'],
};

/**
 * Maps common category names to dependency keys
 * Handles variations in how categories might be named
 */
const CATEGORY_ALIASES = {
  // Lighting variations
  'lighting': 'lighting',
  'light': 'lighting',
  'illumination': 'lighting',
  
  // Camera variations
  'camera': 'camera',
  'camera movement': 'camera',
  'camera angle': 'camera',
  'cinematography': 'camera',
  
  // Subject variations
  'subject': 'subject',
  'character': 'subject',
  'person': 'subject',
  'actor': 'subject',
  
  // Action variations
  'action': 'action',
  'movement': 'action',
  'activity': 'action',
  
  // Location variations
  'location': 'location',
  'setting': 'location',
  'environment': 'location',
  'scene': 'location',
  
  // Mood variations
  'mood': 'mood',
  'tone': 'mood',
  'atmosphere': 'mood',
  'feeling': 'mood',
  
  // Time variations
  'time': 'time',
  'time of day': 'time',
  'timing': 'time',
  
  // Style variations
  'style': 'style',
  'aesthetic': 'style',
  'visual style': 'style',
};

export class SemanticDependencyAnalyzer {
  /**
   * Get list of elements that influence a given category
   * @param {string} category - Category to check
   * @returns {Array<string>} Array of influencing element types
   */
  getInfluencingElements(category) {
    if (!category || typeof category !== 'string') {
      return [];
    }

    // Normalize category name
    const normalized = category.toLowerCase().trim();
    const mappedCategory = CATEGORY_ALIASES[normalized] || normalized;

    return SEMANTIC_DEPENDENCIES[mappedCategory] || [];
  }

  /**
   * Extract actual element values from brainstorm context based on dependencies
   * @param {string} highlightedCategory - Category of highlighted text
   * @param {Object} brainstormContext - Brainstorm context with elements
   * @returns {Object} Map of element type to value
   */
  detectElementDependencies(highlightedCategory, brainstormContext) {
    const dependencies = {};

    if (!highlightedCategory || !brainstormContext) {
      return dependencies;
    }

    // Get which elements influence this category
    const influencingElements = this.getInfluencingElements(highlightedCategory);

    if (influencingElements.length === 0) {
      return dependencies;
    }

    // Extract brainstorm elements
    const elements = brainstormContext.elements || {};

    // Find matching values from brainstorm context
    influencingElements.forEach((elementType) => {
      // Try exact match first
      if (elements[elementType] && typeof elements[elementType] === 'string') {
        const value = elements[elementType].trim();
        if (value) {
          dependencies[elementType] = value;
        }
        return;
      }

      // Try common variations (case-insensitive)
      const elementLower = elementType.toLowerCase();
      for (const [key, value] of Object.entries(elements)) {
        if (key.toLowerCase() === elementLower && typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            dependencies[elementType] = trimmed;
            return;
          }
        }
      }
    });

    return dependencies;
  }

  /**
   * Build formatted dependency context for prompt inclusion
   * @param {string} highlightedCategory - Category of highlighted text
   * @param {Object} dependencies - Map of element dependencies from detectElementDependencies
   * @returns {string} Formatted context section or empty string
   */
  buildDependencyContext(highlightedCategory, dependencies) {
    if (!highlightedCategory || !dependencies || Object.keys(dependencies).length === 0) {
      return '';
    }

    const dependencyLines = Object.entries(dependencies).map(([elementType, value]) => {
      // Format element type as human-readable
      const formattedType = elementType
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      
      return `- ${formattedType}: ${value}`;
    });

    const categoryFormatted = highlightedCategory
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    return `
**SEMANTIC COHERENCE REQUIREMENTS:**
When suggesting alternatives for ${categoryFormatted}, ensure compatibility with these related elements:
${dependencyLines.join('\n')}

Your suggestions must complement these elements, not contradict them.
For example:
- If time is "golden hour", lighting should emphasize warm tones and long shadows
- If subject is "elderly", actions should be age-appropriate and realistic
- If location is "underwater", lighting and camera must account for water effects
`;
  }

  /**
   * Get all dependencies for a category (for debugging/logging)
   * @param {string} category - Category to analyze
   * @returns {Object} Full dependency info
   */
  getDependencyInfo(category) {
    const influencingElements = this.getInfluencingElements(category);
    const normalized = category?.toLowerCase().trim() || '';
    const mappedCategory = CATEGORY_ALIASES[normalized] || normalized;

    return {
      category,
      normalizedCategory: mappedCategory,
      influencingElements,
      hasDependencies: influencingElements.length > 0,
    };
  }
}

