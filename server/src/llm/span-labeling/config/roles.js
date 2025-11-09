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
  'Subject',
  'Appearance',
  'Wardrobe',
  'Action',
  'Environment',
  'Lighting',
  'TimeOfDay',
  'CameraMove',
  'Framing',
  'Technical',
  'Descriptive',
]);

/**
 * Role categories for validation and analysis
 */
export const ROLE_CATEGORIES = {
  subject: ['Subject', 'Appearance', 'Wardrobe'],
  environment: ['Environment', 'Lighting', 'TimeOfDay'],
  cinematic: ['CameraMove', 'Framing'],
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
