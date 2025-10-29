/**
 * Cache Service Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface for cache operations
 * - DIP: Abstraction that services depend on
 */
export class ICacheService {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    throw new Error('get() must be implemented');
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Object} options - Cache options (ttl, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, options = {}) {
    throw new Error('set() must be implemented');
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of deleted keys
   */
  async delete(key) {
    throw new Error('delete() must be implemented');
  }

  /**
   * Generate cache key from namespace and data
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to include in key
   * @returns {string} Cache key
   */
  generateKey(namespace, data) {
    throw new Error('generateKey() must be implemented');
  }
}
