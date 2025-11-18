/**
 * Role definitions for span labeling
 * Updated for Video AI standards (Sora/Runway/Kling)
 */

/**
 * Complete set of valid roles for span labeling
 * @type {Set<string>}
 */
export const ROLE_SET = new Set([
  'Subject',
  'Appearance',
  'Wardrobe',
  'Movement',    // Was 'Action' - specific to subject movement
  'Environment',
  'Lighting',    // Includes TimeOfDay
  'Camera',      // Was 'CameraMove' - includes move + lens
  'Framing',
  'Specs',       // Hardware/Res details (8k, 16:9)
  'Style',       // Artistic style (Cyberpunk, 35mm film)
  'Quality',     // Was 'Descriptive' - Prompt boosters
]);

/**
 * Role categories for validation and analysis
 */
export const ROLE_CATEGORIES = {
  subject: ['Subject', 'Appearance', 'Wardrobe'],
  narrative: ['Movement'],
  environment: ['Environment', 'Lighting'], // Lighting now covers time
  cinematic: ['Camera', 'Framing', 'Specs', 'Style'],
  metadata: ['Quality']
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
  return 'Quality';
}
