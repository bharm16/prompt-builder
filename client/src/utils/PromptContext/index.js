/**
 * PromptContext Module
 * 
 * Exports all PromptContext-related functionality with backward compatibility
 * 
 * @example
 * // Import the class
 * import { PromptContext } from './utils/PromptContext';
 * 
 * // Or import specific utilities
 * import { getCategoryColor, findCategoryForPhrase } from './utils/PromptContext';
 */

// Core class
export { PromptContext } from './PromptContext.js';

// Keyword extraction utilities
export { 
  buildKeywordMaps, 
  buildSemanticGroups, 
  generateVariations 
} from './keywordExtraction.js';

// Category matching utilities
export { 
  findCategoryForPhrase, 
  mapGroupToCategory 
} from './categoryMatching.js';

// Category styling utilities
export { 
  getCategoryColor,
  CATEGORY_COLORS 
} from './categoryStyles.js';

// Default export for backward compatibility
export { PromptContext as default } from './PromptContext.js';

