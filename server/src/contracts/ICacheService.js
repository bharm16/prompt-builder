/**
 * Interface for caching services
 * Abstracts the contract for caching operations
 */
export class ICacheService {
  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found
   */
  async get(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Time to live in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, ttl) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async delete(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Clear all cache entries
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Method not implemented');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats (hits, misses, size, etc.)
   */
  async getStats() {
    throw new Error('Method not implemented');
  }
}
