/**
 * PromptRepository - Data Access Layer for Prompts
 *
 * Abstracts all prompt-related data operations (Firestore, localStorage, etc.)
 * This allows us to:
 * - Swap data providers without changing business logic
 * - Mock easily for testing
 * - Centralize data access logic
 * - Follow the Repository pattern
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for managing prompt data
 */
export class PromptRepository {
  constructor(firestore) {
    this.db = firestore;
    this.collectionName = 'prompts';
  }

  /**
   * Save a new prompt
   * @param {string} userId - User ID
   * @param {Object} promptData - Prompt data
   * @returns {Promise<{id: string, uuid: string}>}
   */
  async save(userId, promptData) {
    try {
      const uuid = uuidv4();
      const payload = {
        highlightCache: promptData.highlightCache ?? null,
        versions: Array.isArray(promptData.versions) ? promptData.versions : [],
        ...promptData,
      };

      const docRef = await addDoc(collection(this.db, this.collectionName), {
        userId,
        uuid,
        ...payload,
        timestamp: serverTimestamp(),
      });

      return { id: docRef.id, uuid };
    } catch (error) {
      console.error('Error saving prompt:', error);
      throw new PromptRepositoryError('Failed to save prompt', error);
    }
  }

  /**
   * Get prompts for a user
   * @param {string} userId - User ID
   * @param {number} limitCount - Maximum number of prompts to fetch
   * @returns {Promise<Array>}
   */
  async getUserPrompts(userId, limitCount = 10) {
    try {
      const q = query(
        collection(this.db, this.collectionName),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => this._mapDocumentToPrompt(doc));
    } catch (error) {
      // Check for index error - return empty array gracefully
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.info('Firestore index not yet created. History will be available once the index is built.');
        return [];
      }

      console.error('Error fetching prompts:', error);
      throw new PromptRepositoryError('Failed to fetch user prompts', error);
    }
  }

  /**
   * Get a single prompt by UUID
   * @param {string} uuid - Prompt UUID
   * @returns {Promise<Object|null>}
   */
  async getByUuid(uuid) {
    try {
      const q = query(
        collection(this.db, this.collectionName),
        where('uuid', '==', uuid),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return this._mapDocumentToPrompt(doc);
    } catch (error) {
      console.error('Error fetching prompt by UUID:', error);
      throw new PromptRepositoryError('Failed to fetch prompt by UUID', error);
    }
  }

  /**
   * Update prompt highlights
   * @param {string} docId - Document ID
   * @param {Object} options - Update options
   * @param {Object} options.highlightCache - Highlight cache data
   * @param {Object} options.versionEntry - Version entry to append
   * @returns {Promise<void>}
   */
  async updateHighlights(docId, { highlightCache, versionEntry }) {
    try {
      if (!docId) return;

      const updatePayload = {};

      if (highlightCache) {
        updatePayload.highlightCache = {
          ...highlightCache,
          updatedAt: new Date().toISOString(),
        };
      }

      if (versionEntry) {
        updatePayload.versions = arrayUnion({
          ...versionEntry,
          timestamp: versionEntry.timestamp || new Date().toISOString(),
        });
      }

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      await updateDoc(doc(this.db, this.collectionName, docId), updatePayload);
    } catch (error) {
      console.error('Error updating prompt highlights:', error);
      throw new PromptRepositoryError('Failed to update highlights', error);
    }
  }

  /**
   * Map Firestore document to prompt object
   * @private
   */
  _mapDocumentToPrompt(doc) {
    const data = doc.data();

    // Convert Firestore timestamp to ISO string
    let timestamp = data.timestamp;
    if (timestamp && timestamp.toDate) {
      timestamp = timestamp.toDate().toISOString();
    } else if (!timestamp) {
      timestamp = new Date().toISOString();
    }

    // Convert highlight cache timestamps
    let highlightCache = data.highlightCache ?? null;
    if (highlightCache) {
      const converted = { ...highlightCache };
      if (converted.updatedAt?.toDate) {
        converted.updatedAt = converted.updatedAt.toDate().toISOString();
      }
      highlightCache = converted;
    }

    // Convert version timestamps
    let versions = Array.isArray(data.versions) ? data.versions : [];
    versions = versions.map((entry) => {
      const item = { ...entry };
      if (item.timestamp?.toDate) {
        item.timestamp = item.timestamp.toDate().toISOString();
      }
      return item;
    });

    return {
      id: doc.id,
      ...data,
      timestamp,
      highlightCache,
      versions,
    };
  }
}

/**
 * Custom error class for repository errors
 */
export class PromptRepositoryError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'PromptRepositoryError';
    this.originalError = originalError;
  }
}

/**
 * Local storage implementation of prompt repository
 * Used for non-authenticated users
 */
export class LocalStoragePromptRepository {
  constructor(storageKey = 'promptHistory') {
    this.storageKey = storageKey;
  }

  /**
   * Save a prompt to localStorage
   */
  async save(userId, promptData) {
    try {
      const uuid = uuidv4();
      const entry = {
        id: Date.now(),
        uuid,
        timestamp: new Date().toISOString(),
        ...promptData,
      };

      const history = this._getHistory();
      const updatedHistory = [entry, ...history].slice(0, 100);

      localStorage.setItem(this.storageKey, JSON.stringify(updatedHistory));

      return { uuid, id: entry.id };
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw new PromptRepositoryError('Failed to save to local storage', error);
    }
  }

  /**
   * Get all prompts from localStorage
   */
  async getUserPrompts(userId, limitCount = 10) {
    try {
      const history = this._getHistory();
      return history.slice(0, limitCount);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return [];
    }
  }

  /**
   * Get prompt by UUID from localStorage
   */
  async getByUuid(uuid) {
    try {
      const history = this._getHistory();
      return history.find(entry => entry.uuid === uuid) || null;
    } catch (error) {
      console.error('Error fetching from localStorage:', error);
      return null;
    }
  }

  /**
   * Update highlights in localStorage
   */
  async updateHighlights(uuid, { highlightCache }) {
    try {
      const history = this._getHistory();
      const updated = history.map(entry =>
        entry.uuid === uuid
          ? { ...entry, highlightCache: highlightCache ?? null }
          : entry
      );

      localStorage.setItem(this.storageKey, JSON.stringify(updated));
    } catch (error) {
      console.warn('Unable to persist highlights to localStorage:', error);
    }
  }

  /**
   * Clear all prompts
   */
  async clear() {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get history from localStorage
   * @private
   */
  _getHistory() {
    try {
      const savedHistory = localStorage.getItem(this.storageKey);
      if (!savedHistory) return [];

      const parsed = JSON.parse(savedHistory);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing localStorage history:', error);
      localStorage.removeItem(this.storageKey);
      return [];
    }
  }
}
