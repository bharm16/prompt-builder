/**
 * Role definitions for span labeling
 * Unified with taxonomy system - single source of truth
 * 
 * This file now derives all roles from shared/taxonomy.js
 * ensuring client-server consistency
 */

import { VALID_CATEGORIES, TAXONOMY } from '../../../../../shared/taxonomy.ts';

/**
 * Complete set of valid roles for span labeling
 * Directly uses the taxonomy validation set for perfect alignment
 * @type {Set<string>}
 */
export const ROLE_SET = VALID_CATEGORIES;

/**
 * Role categories for validation and analysis
 * Organized by semantic groupings aligned with taxonomy hierarchy
 */
export const ROLE_CATEGORIES = {
  // Entity-related: The subject and its attributes
  subject: [
    TAXONOMY.SUBJECT.id,
    ...Object.values(TAXONOMY.SUBJECT.attributes)
  ],
  
  // Setting-related: Environmental and lighting context
  setting: [
    TAXONOMY.ENVIRONMENT.id,
    ...Object.values(TAXONOMY.ENVIRONMENT.attributes),
    TAXONOMY.LIGHTING.id,
    ...Object.values(TAXONOMY.LIGHTING.attributes)
  ],
  
  // Cinematic/Technical: Camera, style, and technical specs
  cinematic: [
    TAXONOMY.CAMERA.id,
    ...Object.values(TAXONOMY.CAMERA.attributes),
    TAXONOMY.STYLE.id,
    ...Object.values(TAXONOMY.STYLE.attributes),
    TAXONOMY.TECHNICAL.id,
    ...Object.values(TAXONOMY.TECHNICAL.attributes)
  ],
  
  // Audio: Sound design elements
  audio: [
    TAXONOMY.AUDIO.id,
    ...Object.values(TAXONOMY.AUDIO.attributes)
  ]
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
 * Falls back to generic subject category
 * @returns {string} Default role
 */
export function getDefaultRole() {
  return TAXONOMY.SUBJECT.id;
}

/**
 * Get all roles in a specific category
 * @param {string} categoryName - Category name (subject, setting, cinematic, audio)
 * @returns {Array<string>} Array of role IDs in that category
 */
export function getRolesInCategory(categoryName) {
  return ROLE_CATEGORIES[categoryName] || [];
}

/**
 * Get the category group for a given role ID
 * @param {string} roleId - Role/category ID to check
 * @returns {string|null} Category group name or null if not found
 */
export function getCategoryGroup(roleId) {
  for (const [groupName, roles] of Object.entries(ROLE_CATEGORIES)) {
    if (roles.includes(roleId)) {
      return groupName;
    }
  }
  return null;
}
