/**
 * SessionStore - Firestore persistence for convergence sessions
 *
 * Provides CRUD operations and specialized queries for managing
 * ConvergenceSession documents in Firestore.
 *
 * Requirements:
 * - 1.1: Session created with unique identifier and persisted to Firestore
 * - 1.2: Session updated with selection and timestamp
 * - 1.3: Allow retrieval of session by identifier
 * - 1.4: Sessions inactive for 24 hours marked as abandoned during cleanup
 * - 1.10: Only ONE active session per user at a time
 */

import type { Firestore, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { ConvergenceSession, GeneratedImage, LockedDimension } from '../types';
import { SESSION_TTL_MS } from '../constants';

const COLLECTION_NAME = 'convergence_sessions';

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: number; details?: string; message?: string };
  const message = err.details ?? err.message ?? '';

  return err.code === 9 && message.includes('requires an index');
}

/**
 * Firestore document representation of a ConvergenceSession
 * Uses Firestore Timestamps for date fields
 */
interface ConvergenceSessionDocument {
  id: string;
  userId: string;
  intent: string;
  direction: string | null;
  lockedDimensions: LockedDimension[];
  currentStep: string;
  generatedImages: GeneratedImage[];
  imageHistory: Record<string, GeneratedImage[]>;
  regenerationCounts: Record<string, number>;
  depthMapUrl: string | null;
  cameraMotion: string | null;
  subjectMotion: string | null;
  finalPrompt: string | null;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Convert a Firestore document to a ConvergenceSession
 */
function documentToSession(doc: DocumentData): ConvergenceSession {
  return {
    id: doc.id,
    userId: doc.userId,
    intent: doc.intent,
    direction: doc.direction,
    lockedDimensions: doc.lockedDimensions || [],
    currentStep: doc.currentStep,
    generatedImages: (doc.generatedImages || []).map((img: DocumentData) => ({
      id: img.id,
      url: img.url,
      dimension: img.dimension,
      optionId: img.optionId,
      prompt: img.prompt,
      generatedAt: img.generatedAt?.toDate?.() || new Date(img.generatedAt),
    })),
    imageHistory: Object.fromEntries(
      Object.entries(doc.imageHistory || {}).map(([key, images]) => [
        key,
        (images as DocumentData[]).map((img) => ({
          id: img.id,
          url: img.url,
          dimension: img.dimension,
          optionId: img.optionId,
          prompt: img.prompt,
          generatedAt: img.generatedAt?.toDate?.() || new Date(img.generatedAt),
        })),
      ])
    ),
    regenerationCounts: doc.regenerationCounts || {},
    depthMapUrl: doc.depthMapUrl,
    cameraMotion: doc.cameraMotion,
    subjectMotion: doc.subjectMotion,
    finalPrompt: doc.finalPrompt,
    status: doc.status,
    createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
    updatedAt: doc.updatedAt?.toDate?.() || new Date(doc.updatedAt),
  };
}

/**
 * Convert a ConvergenceSession to Firestore document format
 */
function sessionToDocument(
  session: ConvergenceSession
): Omit<ConvergenceSessionDocument, 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp | FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
} {
  return {
    id: session.id,
    userId: session.userId,
    intent: session.intent,
    direction: session.direction,
    lockedDimensions: session.lockedDimensions,
    currentStep: session.currentStep,
    generatedImages: session.generatedImages.map((img) => ({
      ...img,
      generatedAt: img.generatedAt,
    })),
    imageHistory: session.imageHistory,
    regenerationCounts: session.regenerationCounts,
    depthMapUrl: session.depthMapUrl,
    cameraMotion: session.cameraMotion,
    subjectMotion: session.subjectMotion,
    finalPrompt: session.finalPrompt,
    status: session.status,
    createdAt: admin.firestore.Timestamp.fromDate(session.createdAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

export interface SessionStoreOptions {
  db?: Firestore;
}

/**
 * Repository for Firestore persistence of convergence sessions
 *
 * Firestore Indexes Required:
 * - convergence_sessions: status ASC, userId ASC, updatedAt DESC, __name__ DESC
 * - convergence_sessions: userId ASC, updatedAt DESC, __name__ DESC
 * - convergence_sessions: updatedAt ASC, status ASC
 */
export class SessionStore {
  private readonly db: Firestore;
  private readonly collection;
  private readonly log = logger.child({ service: 'SessionStore' });

  constructor(options: SessionStoreOptions = {}) {
    this.db = options.db || getFirestore();
    this.collection = this.db.collection(COLLECTION_NAME);
  }

  /**
   * Create a new convergence session
   * Requirement 1.1: Session created with unique identifier and persisted to Firestore
   */
  async create(session: ConvergenceSession): Promise<void> {
    const docRef = this.collection.doc(session.id);
    const docData = sessionToDocument(session);

    await docRef.set(docData);

    this.log.info('Session created', {
      sessionId: session.id,
      userId: session.userId,
      intent: session.intent.substring(0, 50),
    });
  }

  /**
   * Get a session by ID
   * Requirement 1.3: Allow retrieval of session by identifier
   */
  async get(sessionId: string): Promise<ConvergenceSession | null> {
    const snapshot = await this.collection.doc(sessionId).get();

    if (!snapshot.exists) {
      return null;
    }

    return documentToSession(snapshot.data()!);
  }

  /**
   * Update a session with partial data
   * Requirement 1.2: Session updated with selection and timestamp
   */
  async update(
    sessionId: string,
    updates: Partial<Omit<ConvergenceSession, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    const docRef = this.collection.doc(sessionId);

    // Convert Date fields to Timestamps if present
    const firestoreUpdates: Record<string, unknown> = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Handle generatedImages date conversion
    if (updates.generatedImages) {
      firestoreUpdates.generatedImages = updates.generatedImages.map((img) => ({
        ...img,
        generatedAt: img.generatedAt,
      }));
    }

    // Handle imageHistory date conversion
    if (updates.imageHistory) {
      firestoreUpdates.imageHistory = Object.fromEntries(
        Object.entries(updates.imageHistory).map(([key, images]) => [
          key,
          images.map((img) => ({
            ...img,
            generatedAt: img.generatedAt,
          })),
        ])
      );
    }

    await docRef.update(firestoreUpdates);

    this.log.debug('Session updated', {
      sessionId,
      updatedFields: Object.keys(updates),
    });
  }

  /**
   * Delete a session by ID
   */
  async delete(sessionId: string): Promise<void> {
    await this.collection.doc(sessionId).delete();

    this.log.info('Session deleted', { sessionId });
  }

  /**
   * Get the active session for a user (at most one)
   * Requirement 1.10: Only ONE active session per user at a time
   *
   * Uses index: userId ASC, status ASC, updatedAt DESC
   */
  async getActiveByUserId(userId: string): Promise<ConvergenceSession | null> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      if (!doc) {
        return null;
      }

      return documentToSession(doc.data());
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      this.log.warn('Missing Firestore index for active session lookup; using fallback query', {
        userId,
      });

      const fallbackSnapshot = await this.collection.where('userId', '==', userId).get();
      const sessions = fallbackSnapshot.docs.map((doc) => documentToSession(doc.data()));
      const activeSessions = sessions
        .filter((session) => session.status === 'active')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return activeSessions[0] ?? null;
    }
  }

  /**
   * Get session history for a user
   * Returns sessions ordered by most recently updated first
   *
   * Uses index: userId ASC, status ASC, updatedAt DESC
   */
  async getByUserId(userId: string, limit: number = 10): Promise<ConvergenceSession[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => documentToSession(doc.data()));
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      this.log.warn('Missing Firestore index for session history lookup; using fallback query', {
        userId,
      });

      const fallbackSnapshot = await this.collection.where('userId', '==', userId).get();
      const sessions = fallbackSnapshot.docs
        .map((doc) => documentToSession(doc.data()))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return sessions.slice(0, limit);
    }
  }

  /**
   * Cleanup expired sessions (inactive for 24 hours)
   * Requirement 1.4: Sessions inactive for 24 hours marked as abandoned during cleanup
   *
   * Uses index: updatedAt ASC, status ASC
   *
   * @returns Number of sessions marked as abandoned
   */
  async cleanupExpired(): Promise<number> {
    const cutoffTime = new Date(Date.now() - SESSION_TTL_MS);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);

    // Find active sessions that haven't been updated within the TTL
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .where('updatedAt', '<=', cutoffTimestamp)
      .get();

    if (snapshot.empty) {
      this.log.debug('No expired sessions to cleanup');
      return 0;
    }

    // Use batched writes for efficiency
    const batch = this.db.batch();
    const sessionIds: string[] = [];

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        status: 'abandoned',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      sessionIds.push(doc.id);
    }

    await batch.commit();

    this.log.info('Expired sessions cleaned up', {
      count: sessionIds.length,
      sessionIds,
    });

    return sessionIds.length;
  }

  /**
   * Abandon a session and optionally cleanup its associated storage
   * Task 2.6: Implement session cleanup for abandoned sessions
   *
   * @param sessionId - The session to abandon
   * @param storageService - Optional storage service for deleting session images
   * @returns The abandoned session with its image URLs for cleanup
   */
  async abandonSession(
    sessionId: string,
    options?: {
      deleteImages?: boolean;
      storageService?: {
        deleteFiles(userId: string, paths: string[]): Promise<unknown>;
      };
    }
  ): Promise<ConvergenceSession | null> {
    const session = await this.get(sessionId);

    if (!session) {
      this.log.warn('Cannot abandon non-existent session', { sessionId });
      return null;
    }

    if (session.status === 'abandoned') {
      this.log.debug('Session already abandoned', { sessionId });
      return session;
    }

    // Mark session as abandoned
    await this.update(sessionId, { status: 'abandoned' });

    // Optionally delete associated images from storage
    if (options?.deleteImages && options?.storageService) {
      const imageUrls = this.collectSessionImageUrls(session);

      if (imageUrls.length > 0) {
        try {
          // Extract storage paths from GCS URLs
          const storagePaths = imageUrls
            .map((url) => this.extractStoragePath(url))
            .filter((path): path is string => path !== null);

          if (storagePaths.length > 0) {
            await options.storageService.deleteFiles(session.userId, storagePaths);
            this.log.info('Session images deleted', {
              sessionId,
              deletedCount: storagePaths.length,
            });
          }
        } catch (error) {
          this.log.error('Failed to delete session images', error as Error, {
            sessionId,
            imageCount: imageUrls.length,
          });
          // Don't throw - session is already marked as abandoned
        }
      }
    }

    this.log.info('Session abandoned', {
      sessionId,
      userId: session.userId,
    });

    return { ...session, status: 'abandoned' };
  }

  /**
   * Collect all image URLs from a session (generatedImages + imageHistory + depthMap)
   */
  private collectSessionImageUrls(session: ConvergenceSession): string[] {
    const urls: string[] = [];

    // Add generated images
    for (const img of session.generatedImages) {
      urls.push(img.url);
    }

    // Add image history
    for (const images of Object.values(session.imageHistory)) {
      for (const img of images) {
        urls.push(img.url);
      }
    }

    // Add depth map if present
    if (session.depthMapUrl) {
      urls.push(session.depthMapUrl);
    }

    // Deduplicate
    return [...new Set(urls)];
  }

  /**
   * Extract storage path from a GCS URL
   * Example: https://storage.googleapis.com/bucket/path/to/file.jpg -> path/to/file.jpg
   */
  private extractStoragePath(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Handle storage.googleapis.com URLs
      if (urlObj.hostname === 'storage.googleapis.com') {
        // Path format: /bucket-name/path/to/file
        const pathParts = urlObj.pathname.split('/').slice(2); // Remove empty string and bucket name
        return pathParts.join('/');
      }

      // Handle storage.cloud.google.com URLs
      if (urlObj.hostname.endsWith('.storage.googleapis.com')) {
        return urlObj.pathname.slice(1); // Remove leading slash
      }

      return null;
    } catch {
      return null;
    }
  }
}

// Singleton instance
let instance: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!instance) {
    instance = new SessionStore();
  }
  return instance;
}

export default SessionStore;
