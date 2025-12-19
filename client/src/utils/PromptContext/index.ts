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
export { PromptContext } from './PromptContext.ts';

// Keyword extraction utilities
export { 
  buildKeywordMaps, 
  buildSemanticGroups, 
  generateVariations 
} from './keywordExtraction.ts';

// Category matching utilities
export { 
  findCategoryForPhrase, 
  mapGroupToCategory 
} from './categoryMatching.ts';

// Category styling utilities
export { 
  getCategoryColor,
  CATEGORY_COLORS 
} from './categoryStyles.ts';

// Default export for backward compatibility
export { PromptContext as default } from './PromptContext.ts';

