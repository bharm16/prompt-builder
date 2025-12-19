/**
 * Role definitions for span labeling
 * Unified with taxonomy system - single source of truth
 * 
 * This file now derives all roles from shared/taxonomy.js
 * ensuring client-server consistency
 */

import { VALID_CATEGORIES, TAXONOMY } from '@shared/taxonomy.js';

/**
 * Complete set of valid roles for span labeling
 * Directly uses the taxonomy validation set for perfect alignment
 */
export const ROLE_SET = VALID_CATEGORIES;

/**
 * Role categories for validation and analysis
 * Organized by semantic groupings aligned with taxonomy hierarchy
 */
export const ROLE_CATEGORIES: Record<string, string[]> = {
  // Entity-related: The subject and its attributes
  subject: [
    TAXONOMY.SUBJECT.id,
    ...Object.values(TAXONOMY.SUBJECT.attributes || {}),
  ],
  
  // Setting-related: Environmental and lighting context
  setting: [
    TAXONOMY.ENVIRONMENT.id,
    ...Object.values(TAXONOMY.ENVIRONMENT.attributes || {}),
    TAXONOMY.LIGHTING.id,
    ...Object.values(TAXONOMY.LIGHTING.attributes || {}),
  ],
  
  // Cinematic/Technical: Camera, style, and technical specs
  cinematic: [
    TAXONOMY.CAMERA.id,
    ...Object.values(TAXONOMY.CAMERA.attributes || {}),
    TAXONOMY.STYLE.id,
    ...Object.values(TAXONOMY.STYLE.attributes || {}),
    TAXONOMY.TECHNICAL.id,
    ...Object.values(TAXONOMY.TECHNICAL.attributes || {}),
  ],
  
  // Audio: Sound design elements
  audio: [
    TAXONOMY.AUDIO.id,
    ...Object.values(TAXONOMY.AUDIO.attributes || {}),
  ],
};

/**
 * Check if a role is valid
 */
export function isValidRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && ROLE_SET.has(role);
}

/**
 * Get default role (used when role is invalid or missing)
 * Falls back to generic subject category
 */
export function getDefaultRole(): string {
  return TAXONOMY.SUBJECT.id;
}

/**
 * Get all roles in a specific category
 */
export function getRolesInCategory(categoryName: string): string[] {
  return ROLE_CATEGORIES[categoryName] || [];
}

/**
 * Get the category group for a given role ID
 */
export function getCategoryGroup(roleId: string): string | null {
  for (const [groupName, roles] of Object.entries(ROLE_CATEGORIES)) {
    if (roles.includes(roleId)) {
      return groupName;
    }
  }
  return null;
}

