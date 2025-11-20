/**
 * Centralized Version Management
 * 
 * Update these versions when making breaking changes to trigger cache invalidation.
 * This ensures users don't see stale data after updates.
 */

/**
 * Version numbers for different system components
 */
export const VERSIONS = {
  // Increment when taxonomy structure changes
  // Examples: Adding/removing categories, changing attribute IDs
  TAXONOMY: '2.0.1',
  
  // Increment when LLM prompt changes significantly
  // Examples: Changing instructions, detection patterns, or output format
  PROMPT: '1.1.0', // Updated: Added special handling for structured metadata sections
  
  // Increment when cache format changes
  // Examples: Adding new fields, changing key structure
  CACHE: '1.0.0',
  
  // Increment when API response format changes
  // Examples: Changing span structure, metadata format
  API: '1.0.0',
};

/**
 * Get combined version string for cache keys
 * @returns {string} Hyphen-separated version string
 */
export function getVersionString() {
  return Object.values(VERSIONS).join('-');
}

/**
 * Get version hash for compact storage
 * Simple hash for version comparison
 * @returns {string} Version hash
 */
export function getVersionHash() {
  const versionString = getVersionString();
  let hash = 0;
  for (let i = 0; i < versionString.length; i++) {
    const char = versionString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export default VERSIONS;

