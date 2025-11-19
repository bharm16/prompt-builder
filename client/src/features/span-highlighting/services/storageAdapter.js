/**
 * Storage adapter for span labeling cache
 * Provides safe access to browser storage with fallback mechanisms
 */

/**
 * Gets the available cache storage (localStorage or sessionStorage)
 * with SSR-safe detection and fallback mechanisms
 *
 * @returns {Storage|null} Storage object or null if unavailable
 */
export const getCacheStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    // Ignore storage access errors and try sessionStorage
  }

  try {
    if (window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (error) {
    // Ignore storage access errors
  }

  return null;
};
