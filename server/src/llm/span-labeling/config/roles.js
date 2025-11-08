/**
 * Role definitions for span labeling
 *
 * These roles categorize different aspects of video prompts:
 * - Visual: Wardrobe, Appearance, Color, Environment
 * - Cinematic: Lighting, TimeOfDay, CameraMove, Framing
 * - Metadata: Technical, Descriptive
 */

/**
 * Complete set of valid roles for span labeling
 * @type {Set<string>}
 */
export const ROLE_SET = new Set([
  'Wardrobe',
  'Appearance',
  'Lighting',
  'TimeOfDay',
  'Action',
  'CameraMove',
  'Framing',
  'Environment',
  'Color',
  'Technical',
  'Descriptive',
]);

/**
 * Role categories for validation and analysis
 */
export const ROLE_CATEGORIES = {
  visual: ['Wardrobe', 'Appearance', 'Color', 'Environment'],
  cinematic: ['Lighting', 'TimeOfDay', 'CameraMove', 'Framing'],
  narrative: ['Action'],
  metadata: ['Technical', 'Descriptive']
};

/**
 * Check if a role is valid
 * @param {string} role - Role to validate
 * @returns {boolean} True if role is in the allowed set
 */
export function isValidRole(role) {
  return typeof role === 'string' && ROLE_SET.has(role);
}

/**
 * Get default role (used when role is invalid or missing)
 * @returns {string} Default role
 */
export function getDefaultRole() {
  return 'Descriptive';
}
