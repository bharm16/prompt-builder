import { CATEGORY_GUIDANCE, GUIDANCE_MAPPING } from '../config/categoryGuidance.js';
import { normalizeText } from '../utils/textHelpers.js';

/**
 * Service responsible for providing category-specific focus guidance
 */
export class CategoryGuidanceService {
  /**
   * Get category-specific focus guidance for better suggestions
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @returns {Array|null} Array of guidance strings or null
   */
  getCategoryFocusGuidance(phraseRole, categoryHint) {
    if (!phraseRole) return null;

    const role = normalizeText(phraseRole);
    const hint = normalizeText(categoryHint);

    // Try to find guidance by matching keywords
    const guidanceKey = this._findGuidanceKey(role, hint);
    
    if (guidanceKey) {
      return CATEGORY_GUIDANCE[guidanceKey];
    }

    return null;
  }

  /**
   * Find guidance key by matching role and hint keywords
   * @private
   */
  _findGuidanceKey(role, hint) {
    // Check all guidance mapping keywords
    for (const [keyword, guidanceKey] of Object.entries(GUIDANCE_MAPPING)) {
      if (role.includes(keyword) || hint.includes(keyword)) {
        return guidanceKey;
      }
    }

    return null;
  }
}

