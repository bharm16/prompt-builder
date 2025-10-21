/**
 * Smart "swap" suggestions (role-aware)
 *
 * Provides intelligent alternatives based on the semantic role of the selected text.
 * Each role has curated alternatives that maintain consistency and quality.
 */

const COLORS = ['black','grey','navy','olive','burgundy','tan','white','golden','silver','crimson'];
const GARMENTS = ['overcoat','tunic','uniform','cloak','frock coat','waistcoat','tailcoat'];
const LIGHT_QUAL = ['soft','diffuse','harsh','dramatic','rim','backlit'];
const LIGHT_DIR  = ['from camera-left','from camera-right','from behind','toplight','underlight'];
const TIMES      = ['dawn','golden hour','noon','sunset','twilight','blue hour','overcast'];
const MOVES      = ['static hold','slow push-in','gentle dolly left','slow pan right','rack focus'];
const FRAMING    = ['extreme close-up','close-up','medium shot','wide shot','profile close-up'];
const ENVIRONMENTS = ['urban cityscape','rural countryside','indoor studio','desert landscape','forest clearing'];
const APPEARANCES = ['weathered face','clean-shaven','bearded','youthful','aged'];

/**
 * Get suggested alternatives for a given role
 *
 * @param {string} role - The semantic role (Wardrobe, Lighting, TimeOfDay, etc.)
 * @param {number} k - Number of suggestions to return
 * @returns {string[]} Array of alternative suggestions
 */
export function suggestAlternatives(role, k=5) {
  switch (role) {
    case 'Wardrobe':
      return pickCombos(COLORS, GARMENTS, k);
    case 'Lighting':
      return pickCombos(LIGHT_QUAL, LIGHT_DIR, k);
    case 'TimeOfDay':
      return pick(TIMES, k);
    case 'CameraMove':
      return pick(MOVES, k);
    case 'Framing':
      return pick(FRAMING, k);
    case 'Environment':
      return pick(ENVIRONMENTS, k);
    case 'Appearance':
      return pick(APPEARANCES, k);
    default:
      return [];
  }
}

/**
 * Pick random items from an array
 */
function pick(arr, k) {
  const a=[...arr];
  a.sort(()=>Math.random()-0.5);
  return a.slice(0, k);
}

/**
 * Create combinations from two arrays and pick k random ones
 */
function pickCombos(a, b, k) {
  const combos = [];
  for (const x of a) {
    for (const y of b) {
      combos.push(`${x} ${y}`);
    }
  }
  combos.sort(()=>Math.random()-0.5);
  return combos.slice(0, k);
}

/**
 * Get contextual suggestions based on the current text and role
 *
 * @param {string} currentText - The currently selected text
 * @param {string} role - The semantic role
 * @param {string} fullPrompt - The full prompt for context
 * @returns {Array<{text: string, explanation?: string}>}
 */
export function getContextualSuggestions(currentText, role, fullPrompt) {
  const alternatives = suggestAlternatives(role, 5);

  return alternatives.map(alt => ({
    text: alt,
    explanation: `Alternative ${role.toLowerCase()} option`
  }));
}

/**
 * Enhance suggestions with explanations based on context
 *
 * @param {Array<{text: string}>} suggestions - Raw suggestions
 * @param {string} role - The semantic role
 * @returns {Array<{text: string, category: string, explanation?: string}>}
 */
export function enhanceSuggestions(suggestions, role) {
  return suggestions.map(s => ({
    ...s,
    category: role,
    explanation: s.explanation || `Alternative for ${role}`
  }));
}
