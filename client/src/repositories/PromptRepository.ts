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
  deleteDoc,
  type Firestore,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import type { PromptHistoryEntry } from '../hooks/types';

export interface PromptData {
  highlightCache?: unknown | null;
  versions?: unknown[];
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  brainstormContext?: unknown | null;
  [key: string]: unknown;
}

export interface SavedPromptResult {
  id: string;
  uuid: string;
}

export interface UpdateHighlightsOptions {
  highlightCache?: unknown | null;
  versionEntry?: {
    timestamp?: string;
    [key: string]: unknown;
  };
}

interface FirestoreError extends Error {
  code?: string;
  message?: string;
}

function isFirestoreError(error: unknown): error is FirestoreError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

function convertTimestamp(timestamp: Timestamp | string | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

function convertHighlightCache(cache: { updatedAt?: Timestamp | string; [key: string]: unknown } | null | undefined): { updatedAt?: string; [key: string]: unknown } | null {
  if (!cache) {
    return null;
  }
  const converted = { ...cache };
  if (converted.updatedAt && typeof converted.updatedAt === 'object' && 'toDate' in converted.updatedAt) {
    converted.updatedAt = (converted.updatedAt as Timestamp).toDate().toISOString();
  }
  return converted;
}

function convertVersions(versions: Array<{ timestamp?: Timestamp | string; [key: string]: unknown }> | undefined): Array<{ timestamp?: string; [key: string]: unknown }> {
  if (!Array.isArray(versions)) {
    return [];
  }
  return versions.map((entry) => {
    const item = { ...entry };
    if (item.timestamp && typeof item.timestamp === 'object' && 'toDate' in item.timestamp) {
      item.timestamp = (item.timestamp as Timestamp).toDate().toISOString();
    }
    return item;
  });
}

/**
 * Repository for managing prompt data
 */
export class PromptRepository {
  private db: Firestore;
  private collectionName: string;

  constructor(firestore: Firestore) {
    this.db = firestore;
    this.collectionName = 'prompts';
  }

  /**
   * Save a new prompt
   */
  async save(userId: string, promptData: PromptData): Promise<SavedPromptResult> {
    try {
      const uuid = uuidv4();
      const payload: PromptData = {
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
   */
  async getUserPrompts(userId: string, limitCount: number = 10): Promise<PromptHistoryEntry[]> {
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
      if (isFirestoreError(error) && (error.code === 'failed-precondition' || error.message?.includes('index'))) {
        return [];
      }

      console.error('Error fetching prompts:', error);
      throw new PromptRepositoryError('Failed to fetch user prompts', error);
    }
  }

  /**
   * Get a single prompt by UUID
   */
  async getByUuid(uuid: string): Promise<PromptHistoryEntry | null> {
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
   */
  async updateHighlights(docId: string, { highlightCache, versionEntry }: UpdateHighlightsOptions): Promise<void> {
    try {
      if (!docId) return;

      const updatePayload: Record<string, unknown> = {};

      if (highlightCache) {
        updatePayload.highlightCache = {
          ...(highlightCache as Record<string, unknown>),
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
      // EXPECTED BEHAVIOR: Firestore permission errors are handled gracefully
      // This is NOT a bug - it's a security feature working as designed.
      //
      // When permission errors occur:
      // - Unauthenticated users: Cannot write to Firestore (expected)
      // - Authenticated users: Can only update their own prompts
      // - Expired sessions: Will get permission denied until re-authenticated
      //
      // The app continues to work locally even without Firestore write permissions.
      // This graceful degradation prevents crashes while maintaining security.
      if (isFirestoreError(error) && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions'))) {
        console.warn('Skipping highlight update due to insufficient Firestore permissions.');
        return;
      }

      console.error('Error updating prompt highlights:', error);
      throw new PromptRepositoryError('Failed to update highlights', error);
    }
  }

  /**
   * Update prompt output text
   */
  async updateOutput(docId: string, output: string): Promise<void> {
    try {
      if (!docId || !output) return;

      await updateDoc(doc(this.db, this.collectionName, docId), {
        output,
      });
    } catch (error) {
      // EXPECTED BEHAVIOR: Firestore permission errors are handled gracefully
      // This is NOT a bug - it's a security feature working as designed.
      //
      // When permission errors occur:
      // - Unauthenticated users: Cannot write to Firestore (expected)
      // - Authenticated users: Can only update their own prompts
      // - Expired sessions: Will get permission denied until re-authenticated
      //
      // The app continues to work locally even without Firestore write permissions.
      // This graceful degradation prevents crashes while maintaining security.
      if (isFirestoreError(error) && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions'))) {
        console.warn('Skipping output update due to insufficient Firestore permissions.');
        return;
      }

      console.error('Error updating prompt output:', error);
      throw new PromptRepositoryError('Failed to update output', error);
    }
  }

  /**
   * Delete a prompt by its document ID
   */
  async deleteById(docId: string): Promise<void> {
    try {
      if (!docId) {
        throw new Error('Document ID is required for deletion');
      }

      const docRef = doc(this.db, this.collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw new PromptRepositoryError('Failed to delete prompt', error);
    }
  }

  /**
   * Map Firestore document to prompt object
   * @private
   */
  private _mapDocumentToPrompt(doc: QueryDocumentSnapshot<DocumentData>): PromptHistoryEntry {
    const data = doc.data();

    // Convert Firestore timestamp to ISO string
    const timestamp = convertTimestamp(data.timestamp as Timestamp | string | undefined);

    // Convert highlight cache timestamps
    const highlightCache = convertHighlightCache(data.highlightCache as { updatedAt?: Timestamp | string; [key: string]: unknown } | null | undefined);

    // Convert version timestamps
    const versions = convertVersions(data.versions as Array<{ timestamp?: Timestamp | string; [key: string]: unknown }> | undefined);

    return {
      id: doc.id,
      ...data,
      timestamp,
      highlightCache,
      versions,
    } as PromptHistoryEntry;
  }
}

/**
 * Custom error class for repository errors
 */
export class PromptRepositoryError extends Error {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
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
  private storageKey: string;

  constructor(storageKey: string = 'promptHistory') {
    this.storageKey = storageKey;
  }

  /**
   * Save a prompt to localStorage
   */
  async save(userId: string, promptData: PromptData): Promise<SavedPromptResult> {
    try {
      const uuid = uuidv4();
      const entry: PromptHistoryEntry = {
        id: String(Date.now()),
        uuid,
        timestamp: new Date().toISOString(),
        input: promptData.input,
        output: promptData.output,
        score: promptData.score ?? null,
        mode: promptData.mode,
        brainstormContext: promptData.brainstormContext ?? null,
        highlightCache: promptData.highlightCache ?? null,
        versions: promptData.versions ?? [],
      };

      const history = this._getHistory();
      const updatedHistory = [entry, ...history].slice(0, 100);

      try {
        localStorage.setItem(this.storageKey, JSON.stringify(updatedHistory));
      } catch (storageError) {
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          // Try to save with fewer items
          const trimmedHistory = [entry, ...history].slice(0, 50);
          localStorage.setItem(this.storageKey, JSON.stringify(trimmedHistory));
        } else {
          throw storageError;
        }
      }

      return { uuid, id: entry.id };
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw new PromptRepositoryError('Failed to save to local storage', error);
    }
  }

  /**
   * Get all prompts from localStorage
   */
  async getUserPrompts(userId: string, limitCount: number = 10): Promise<PromptHistoryEntry[]> {
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
  async getByUuid(uuid: string): Promise<PromptHistoryEntry | null> {
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
  async updateHighlights(uuid: string, { highlightCache }: { highlightCache?: unknown | null }): Promise<void> {
    try {
      const history = this._getHistory();
      const updated = history.map(entry =>
        entry.uuid === uuid
          ? { ...entry, highlightCache: highlightCache ?? null }
          : entry
      );

      try {
        localStorage.setItem(this.storageKey, JSON.stringify(updated));
      } catch (storageError) {
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          // Try to save with fewer items, keeping the updated one
          const trimmed = updated.slice(0, 50);
          localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
          console.warn('Storage limit reached, keeping only 50 most recent items');
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      console.warn('Unable to persist highlights to localStorage:', error);
    }
  }

  /**
   * Update output text in localStorage
   */
  async updateOutput(uuid: string, output: string): Promise<void> {
    try {
      if (!uuid || !output) return;

      const history = this._getHistory();
      const updated = history.map(entry =>
        entry.uuid === uuid
          ? { ...entry, output }
          : entry
      );

      try {
        localStorage.setItem(this.storageKey, JSON.stringify(updated));
      } catch (storageError) {
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          // Try to save with fewer items, keeping the updated one
          const trimmed = updated.slice(0, 50);
          localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
          console.warn('Storage limit reached, keeping only 50 most recent items');
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      console.warn('Unable to persist output update to localStorage:', error);
    }
  }

  /**
   * Clear all prompts
   */
  async clear(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Delete a prompt by its ID from localStorage
   */
  async deleteById(id: string | number): Promise<void> {
    try {
      const history = this._getHistory();
      const filtered = history.filter(entry => entry.id !== String(id));
      
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      } catch (storageError) {
        console.error('Error deleting from localStorage:', storageError);
        throw storageError;
      }
    } catch (error) {
      console.error('Error deleting prompt from localStorage:', error);
      throw new PromptRepositoryError('Failed to delete from local storage', error);
    }
  }

  /**
   * Get history from localStorage
   * @private
   */
  private _getHistory(): PromptHistoryEntry[] {
    try {
      const savedHistory = localStorage.getItem(this.storageKey);
      if (!savedHistory) return [];

      const parsed = JSON.parse(savedHistory) as unknown;
      return Array.isArray(parsed) ? parsed as PromptHistoryEntry[] : [];
    } catch (error) {
      console.error('Error parsing localStorage history:', error);
      localStorage.removeItem(this.storageKey);
      return [];
    }
  }
}

