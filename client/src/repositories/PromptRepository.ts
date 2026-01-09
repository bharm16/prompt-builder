/**
 * PromptRepository - Firestore data access layer for prompts
 *
 * Centralizes Firestore prompt operations to keep data access isolated.
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
  updateDoc,
  arrayUnion,
  deleteDoc,
  type Firestore,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/LoggingService';
import type { PromptHistoryEntry, PromptVersionEntry } from '../hooks/types';
import type { PromptData, SavedPromptResult, UpdateHighlightsOptions, UpdatePromptOptions } from './promptRepositoryTypes';
import { PromptRepositoryError } from './promptRepositoryTypes';

const log = logger.child('PromptRepository');

interface FirestoreError extends Error {
  code?: string;
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
  const { updatedAt, ...rest } = cache;
  const normalized: { updatedAt?: string; [key: string]: unknown } = { ...rest };

  if (typeof updatedAt === 'string') {
    normalized.updatedAt = updatedAt;
  } else if (updatedAt && typeof updatedAt === 'object' && 'toDate' in updatedAt) {
    normalized.updatedAt = (updatedAt as Timestamp).toDate().toISOString();
  }

  return normalized;
}

function convertVersions(versions: Array<{ timestamp?: Timestamp | string; [key: string]: unknown }> | undefined): Array<{ timestamp?: string; [key: string]: unknown }> {
  if (!Array.isArray(versions)) {
    return [];
  }
  return versions.map((entry) => {
    const { timestamp, ...rest } = entry;
    const normalized: { timestamp?: string; [key: string]: unknown } = { ...rest };

    if (typeof timestamp === 'string') {
      normalized.timestamp = timestamp;
    } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      normalized.timestamp = (timestamp as Timestamp).toDate().toISOString();
    }

    return normalized;
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
      const providedUuid = typeof promptData.uuid === 'string' ? promptData.uuid.trim() : '';
      const resolvedUuid = providedUuid ? providedUuid : uuidv4();
      const basePayload: Record<string, unknown> = {
        userId,
        uuid: resolvedUuid,
        input: promptData.input,
        output: promptData.output,
        score: promptData.score ?? null,
        ...(promptData.mode !== undefined ? { mode: promptData.mode } : {}),
        ...(promptData.targetModel !== undefined ? { targetModel: promptData.targetModel } : {}),
        ...(promptData.generationParams !== undefined ? { generationParams: promptData.generationParams } : {}),
        ...(promptData.brainstormContext !== undefined ? { brainstormContext: promptData.brainstormContext } : {}),
        ...(promptData.highlightCache !== undefined ? { highlightCache: promptData.highlightCache } : {}),
        timestamp: serverTimestamp(),
      };

      if (providedUuid) {
        const q = query(
          collection(this.db, this.collectionName),
          where('uuid', '==', resolvedUuid),
          limit(5)
        );
        const snap = await getDocs(q);
        const match =
          snap.docs.find((doc) => (doc.data() as { userId?: string }).userId === userId) ??
          null;

        if (match) {
          const updatePayload: Record<string, unknown> = { ...basePayload };
          if (Array.isArray(promptData.versions)) {
            updatePayload.versions = promptData.versions;
          }
          await updateDoc(doc(this.db, this.collectionName, match.id), updatePayload);
          return { id: match.id, uuid: resolvedUuid };
        }
      }

      const docRef = await addDoc(collection(this.db, this.collectionName), {
        ...basePayload,
        versions: Array.isArray(promptData.versions) ? promptData.versions : [],
      });

      return { id: docRef.id, uuid: resolvedUuid };
    } catch (error) {
      log.error('Error saving prompt', error as Error);
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

      log.error('Error fetching prompts', error as Error);
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
      if (!doc) {
        return null;
      }
      return this._mapDocumentToPrompt(doc);
    } catch (error) {
      log.error('Error fetching prompt by UUID', error as Error);
      throw new PromptRepositoryError('Failed to fetch prompt by UUID', error);
    }
  }

  /**
   * Update prompt details (input, model, params)
   */
  async updatePrompt(docId: string, updates: UpdatePromptOptions): Promise<void> {
    try {
      if (!docId) return;

      // Guard against uninitialized db
      if (!this.db) {
        log.warn('Firestore db not initialized, skipping prompt update');
        return;
      }

      const updatePayload: Record<string, unknown> = {};

      if (updates.input !== undefined) {
        updatePayload.input = updates.input;
      }
      if (updates.mode !== undefined) {
        updatePayload.mode = updates.mode;
      }
      if (updates.targetModel !== undefined) {
        updatePayload.targetModel = updates.targetModel;
      }
      if (updates.generationParams !== undefined) {
        updatePayload.generationParams = updates.generationParams;
      }

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      await updateDoc(doc(this.db, this.collectionName, docId), updatePayload);
    } catch (error) {
      if (isFirestoreError(error) && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions'))) {
        log.warn('Skipping prompt update due to insufficient Firestore permissions');
        return;
      }

      log.error('Error updating prompt', error as Error);
      throw new PromptRepositoryError('Failed to update prompt', error);
    }
  }

  /**
   * Update prompt highlights
   */
  async updateHighlights(docId: string, { highlightCache, versionEntry }: UpdateHighlightsOptions): Promise<void> {
    try {
      if (!docId) return;

      // Guard against uninitialized db
      if (!this.db) {
        log.warn('Firestore db not initialized, skipping highlight update');
        return;
      }

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
        log.warn('Skipping highlight update due to insufficient Firestore permissions');
        return;
      }

      log.error('Error updating prompt highlights', error as Error);
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
        log.warn('Skipping output update due to insufficient Firestore permissions');
        return;
      }

      log.error('Error updating prompt output', error as Error);
      throw new PromptRepositoryError('Failed to update output', error);
    }
  }

  /**
   * Replace versions array for a prompt
   */
  async updateVersions(docId: string, versions: PromptVersionEntry[]): Promise<void> {
    try {
      if (!docId) return;

      // Guard against uninitialized db
      if (!this.db) {
        log.warn('Firestore db not initialized, skipping version update');
        return;
      }

      await updateDoc(doc(this.db, this.collectionName, docId), {
        versions: Array.isArray(versions) ? versions : [],
      });
    } catch (error) {
      if (isFirestoreError(error) && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions'))) {
        log.warn('Skipping version update due to insufficient Firestore permissions');
        return;
      }

      log.error('Error updating prompt versions', error as Error);
      throw new PromptRepositoryError('Failed to update versions', error);
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
      log.error('Error deleting prompt', error as Error);
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
    const versions = convertVersions(
      data.versions as Array<{ timestamp?: Timestamp | string; [key: string]: unknown }> | undefined
    ) as unknown as PromptVersionEntry[];
    const input = typeof data.input === 'string' ? data.input : '';
    const output = typeof data.output === 'string' ? data.output : '';

    const entry: PromptHistoryEntry = {
      id: doc.id,
      input,
      output,
      timestamp,
      highlightCache,
      versions,
    };

    if (typeof data.uuid === 'string') {
      entry.uuid = data.uuid;
    }
    if (typeof data.score === 'number' || data.score === null) {
      entry.score = data.score;
    }
    if (typeof data.mode === 'string') {
      entry.mode = data.mode;
    }
    if (typeof data.targetModel === 'string' || data.targetModel === null) {
      entry.targetModel = data.targetModel;
    }
    if (data.generationParams === null) {
      entry.generationParams = null;
    } else if (data.generationParams && typeof data.generationParams === 'object') {
      entry.generationParams = data.generationParams as Record<string, unknown>;
    }
    if (data.brainstormContext !== undefined) {
      entry.brainstormContext = data.brainstormContext as unknown;
    }
    if (data.highlightCache !== undefined) {
      entry.highlightCache = highlightCache;
    }

    return entry;
  }
}
