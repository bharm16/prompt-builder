import { logger } from '@infrastructure/Logger.js';
import type { StorageAdapter, UserPreferences, InMemoryStorage } from '../types.js';

/**
 * In-memory storage adapter
 * Replace this with DatabaseStorageAdapter when adding persistence
 */
class InMemoryStorage implements StorageAdapter {
  private data: Map<string, Record<string, UserPreferences>> = new Map();

  private getUserKey(userId: string): string {
    return `user:${userId}`;
  }

  async get(userId: string, elementType: string): Promise<UserPreferences | null> {
    const userKey = this.getUserKey(userId);
    if (!this.data.has(userKey)) {
      return null;
    }
    const userData = this.data.get(userKey)!;
    return userData[elementType] || null;
  }

  async set(userId: string, elementType: string, preferences: UserPreferences): Promise<void> {
    const userKey = this.getUserKey(userId);
    if (!this.data.has(userKey)) {
      this.data.set(userKey, {});
    }
    const userData = this.data.get(userKey)!;
    userData[elementType] = preferences;
  }

  async delete(userId: string, elementType?: string): Promise<void> {
    const userKey = this.getUserKey(userId);
    if (this.data.has(userKey)) {
      const userData = this.data.get(userKey)!;
      if (elementType) {
        delete userData[elementType];
      } else {
        this.data.delete(userKey);
      }
    }
  }

  async deleteAll(userId: string): Promise<void> {
    const userKey = this.getUserKey(userId);
    this.data.delete(userKey);
  }

  async getAllForUser(userId: string): Promise<Record<string, UserPreferences>> {
    const userKey = this.getUserKey(userId);
    return this.data.get(userKey) || {};
  }
}

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
  private readonly storage: StorageAdapter;
  private readonly maxChosenHistory: number;
  private readonly maxRejectedHistory: number;

  constructor(options: {
    storage?: StorageAdapter;
    maxChosenHistory?: number;
    maxRejectedHistory?: number;
  } = {}) {
    // Storage adapter - currently in-memory, easily swappable
    this.storage = options.storage || new InMemoryStorage();
    this.maxChosenHistory = options.maxChosenHistory || 20;
    this.maxRejectedHistory = options.maxRejectedHistory || 50;
  }

  /**
   * Get user preferences for a specific element type
   */
  async getPreferences(userId: string, elementType: string): Promise<UserPreferences> {
    try {
      const preferences = await this.storage.get(userId, elementType);
      return preferences || { chosen: [], rejected: [] };
    } catch (error) {
      logger.error('Failed to get preferences', error as Error, { userId, elementType });
      return { chosen: [], rejected: [] };
    }
  }

  /**
   * Record user choice for preference learning
   */
  async recordChoice(
    userId: string,
    elementType: string,
    chosen: string,
    rejected: string[] = []
  ): Promise<{ success: boolean; error?: string }> {
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
      logger.error('Failed to record preference', error as Error, { userId, elementType });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Clear preferences for a user
   */
  async clearPreferences(userId: string, elementType?: string | null): Promise<{ success: boolean; error?: string }> {
    try {
      if (elementType) {
        await this.storage.delete(userId, elementType);
      } else {
        await (this.storage as InMemoryStorage).deleteAll(userId);
      }
      logger.info('Cleared preferences', { userId, elementType });
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear preferences', error as Error, { userId, elementType });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all preferences for a user (useful for analytics)
   */
  async getAllPreferences(userId: string): Promise<Record<string, UserPreferences>> {
    try {
      return await (this.storage as InMemoryStorage).getAllForUser(userId);
    } catch (error) {
      logger.error('Failed to get all preferences', error as Error, { userId });
      return {};
    }
  }
}

