import { logger } from '@infrastructure/Logger';

/**
 * Repository for user preferences with support for eventual persistence.
 * Currently uses in-memory storage but designed for easy database migration.
 *
 * Future improvements:
 * - Add database adapter (PostgreSQL, MongoDB, etc.)
 * - Implement TTL for preference expiration
 * - Add preference aggregation across users
 * - Support preference export/import
 */
export class PreferenceRepository {
  constructor(options = {}) {
    // Storage adapter - currently in-memory, easily swappable
    this.storage = options.storage || new InMemoryStorage();
    this.maxChosenHistory = options.maxChosenHistory || 20;
    this.maxRejectedHistory = options.maxRejectedHistory || 50;
  }

  /**
   * Get user preferences for a specific element type
   * @param {string} userId - User identifier
   * @param {string} elementType - Type of element
   * @returns {Promise<Object>} Preferences object with chosen and rejected arrays
   */
  async getPreferences(userId, elementType) {
    try {
      const preferences = await this.storage.get(userId, elementType);
      return preferences || { chosen: [], rejected: [] };
    } catch (error) {
      logger.error('Failed to get preferences', { userId, elementType, error });
      return { chosen: [], rejected: [] };
    }
  }

  /**
   * Record user choice for preference learning
   * @param {string} userId - User identifier
   * @param {string} elementType - Type of element
   * @param {string} chosen - Selected suggestion
   * @param {Array<string>} rejected - Other suggestions that were not chosen
   * @returns {Promise<Object>} Success status
   */
  async recordChoice(userId, elementType, chosen, rejected = []) {
    try {
      const preferences = await this.getPreferences(userId, elementType);

      // Add to chosen (limit history)
      preferences.chosen.push(chosen);
      if (preferences.chosen.length > this.maxChosenHistory) {
        preferences.chosen.shift();
      }

      // Add to rejected (limit history)
      preferences.rejected.push(...rejected);
      if (preferences.rejected.length > this.maxRejectedHistory) {
        preferences.rejected = preferences.rejected.slice(-this.maxRejectedHistory);
      }

      await this.storage.set(userId, elementType, preferences);

      logger.info('Recorded user preference', {
        userId,
        elementType,
        rejectedCount: rejected.length,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to record preference', { userId, elementType, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear preferences for a user
   * @param {string} userId - User identifier
   * @param {string} elementType - Optional element type to clear specific preferences
   */
  async clearPreferences(userId, elementType = null) {
    try {
      if (elementType) {
        await this.storage.delete(userId, elementType);
      } else {
        await this.storage.deleteAll(userId);
      }
      logger.info('Cleared preferences', { userId, elementType });
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear preferences', { userId, elementType, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all preferences for a user (useful for analytics)
   * @param {string} userId - User identifier
   */
  async getAllPreferences(userId) {
    try {
      return await this.storage.getAllForUser(userId);
    } catch (error) {
      logger.error('Failed to get all preferences', { userId, error });
      return {};
    }
  }
}

/**
 * In-memory storage adapter
 * Replace this with DatabaseStorageAdapter when adding persistence
 */
class InMemoryStorage {
  constructor() {
    this.data = new Map();
  }

  async get(userId, elementType) {
    const userKey = this._getUserKey(userId);
    if (!this.data.has(userKey)) {
      return null;
    }
    const userData = this.data.get(userKey);
    return userData[elementType] || null;
  }

  async set(userId, elementType, preferences) {
    const userKey = this._getUserKey(userId);
    if (!this.data.has(userKey)) {
      this.data.set(userKey, {});
    }
    const userData = this.data.get(userKey);
    userData[elementType] = preferences;
  }

  async delete(userId, elementType) {
    const userKey = this._getUserKey(userId);
    if (this.data.has(userKey)) {
      const userData = this.data.get(userKey);
      delete userData[elementType];
    }
  }

  async deleteAll(userId) {
    const userKey = this._getUserKey(userId);
    this.data.delete(userKey);
  }

  async getAllForUser(userId) {
    const userKey = this._getUserKey(userId);
    return this.data.get(userKey) || {};
  }

  _getUserKey(userId) {
    return `user:${userId}`;
  }
}

/**
 * Example database storage adapter (for future implementation)
 *
 * class DatabaseStorageAdapter {
 *   constructor(dbConnection) {
 *     this.db = dbConnection;
 *   }
 *
 *   async get(userId, elementType) {
 *     const result = await this.db.query(
 *       'SELECT preferences FROM user_preferences WHERE user_id = $1 AND element_type = $2',
 *       [userId, elementType]
 *     );
 *     return result.rows[0]?.preferences || null;
 *   }
 *
 *   async set(userId, elementType, preferences) {
 *     await this.db.query(
 *       'INSERT INTO user_preferences (user_id, element_type, preferences) VALUES ($1, $2, $3) ON CONFLICT (user_id, element_type) DO UPDATE SET preferences = $3',
 *       [userId, elementType, JSON.stringify(preferences)]
 *     );
 *   }
 *
 *   // ... other methods
 * }
 */
