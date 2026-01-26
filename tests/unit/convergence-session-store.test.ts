/**
 * Unit tests for SessionStore
 *
 * Tests CRUD operations and specialized queries for managing
 * ConvergenceSession documents in Firestore.
 *
 * Requirements tested:
 * - 1.1: Session created with unique identifier and persisted to Firestore
 * - 1.2: Session updated with selection and timestamp
 * - 1.3: Allow retrieval of session by identifier
 * - 1.4: Sessions inactive for 24 hours marked as abandoned during cleanup
 * - 1.10: Only ONE active session per user at a time
 *
 * @module convergence-session-store.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConvergenceSession, GeneratedImage, LockedDimension } from '@services/convergence/types';

// Mock firebase-admin before importing SessionStore
vi.mock('@infrastructure/firebaseAdmin', () => {
  const mockTimestamp = {
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  };

  const mockFieldValue = {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    increment: vi.fn((n: number) => ({ _increment: n })),
  };

  const mockFirestore = {
    Timestamp: mockTimestamp,
    FieldValue: mockFieldValue,
  };

  return {
    admin: {
      firestore: mockFirestore,
    },
    getFirestore: vi.fn(() => ({
      collection: vi.fn(),
    })),
  };
});

// Import after mocking
import { SessionStore } from '@services/convergence/session/SessionStore';

/**
 * Creates a mock Firestore instance for testing
 */
function createMockFirestore() {
  const mockDocs: Map<string, Record<string, unknown>> = new Map();

  const mockDocRef = (id: string) => ({
    id,
    set: vi.fn(async (data: Record<string, unknown>) => {
      mockDocs.set(id, { ...data, id });
    }),
    get: vi.fn(async () => {
      const data = mockDocs.get(id);
      return {
        exists: !!data,
        data: () => data,
        id,
      };
    }),
    update: vi.fn(async (updates: Record<string, unknown>) => {
      const existing = mockDocs.get(id);
      if (existing) {
        mockDocs.set(id, { ...existing, ...updates });
      }
    }),
    delete: vi.fn(async () => {
      mockDocs.delete(id);
    }),
  });

  const mockCollection = {
    doc: vi.fn((id: string) => mockDocRef(id)),
    where: vi.fn(() => mockCollection),
    orderBy: vi.fn(() => mockCollection),
    limit: vi.fn(() => mockCollection),
    get: vi.fn(async () => ({
      empty: mockDocs.size === 0,
      docs: Array.from(mockDocs.entries()).map(([id, data]) => ({
        id,
        data: () => data,
        ref: mockDocRef(id),
      })),
    })),
  };

  const mockDb = {
    collection: vi.fn(() => mockCollection),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn(async () => {}),
    })),
  };

  return {
    db: mockDb,
    docs: mockDocs,
    collection: mockCollection,
    docRef: mockDocRef,
  };
}

/**
 * Creates a test session with default values
 */
function createTestSession(overrides: Partial<ConvergenceSession> = {}): ConvergenceSession {
  return {
    id: 'test-session-id',
    userId: 'test-user-id',
    intent: 'A beautiful sunset over the ocean',
    aspectRatio: '16:9',
    direction: null,
    lockedDimensions: [],
    currentStep: 'direction',
    generatedImages: [],
    imageHistory: {},
    regenerationCounts: {},
    startingPointMode: 'converge',
    finalFrameUrl: null,
    finalFrameRegenerations: 0,
    uploadedImageUrl: null,
    depthMapUrl: null,
    cameraMotion: null,
    subjectMotion: null,
    finalPrompt: null,
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a test generated image
 */
function createTestImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'test-image-id',
    url: 'https://storage.googleapis.com/bucket/test-image.png',
    dimension: 'direction',
    optionId: 'cinematic',
    prompt: 'A beautiful sunset, cinematic composition',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SessionStore', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let sessionStore: SessionStore;

  beforeEach(() => {
    mockFirestore = createMockFirestore();
    sessionStore = new SessionStore({ db: mockFirestore.db as unknown as import('firebase-admin/firestore').Firestore });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    /**
     * Requirement 1.1: Session created with unique identifier and persisted to Firestore
     */
    it('should create a new session in Firestore', async () => {
      const session = createTestSession();

      await sessionStore.create(session);

      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });

    it('should persist all session fields', async () => {
      const session = createTestSession({
        direction: 'cinematic',
        lockedDimensions: [
          {
            type: 'mood',
            optionId: 'dramatic',
            label: 'Dramatic',
            promptFragments: ['high contrast lighting', 'deep shadows'],
          },
        ],
        generatedImages: [createTestImage()],
      });

      await sessionStore.create(session);

      // Verify the doc was created with the session ID
      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });
  });

  describe('get', () => {
    /**
     * Requirement 1.3: Allow retrieval of session by identifier
     */
    it('should retrieve an existing session by ID', async () => {
      const session = createTestSession();

      // First create the session
      await sessionStore.create(session);

      // Then retrieve it
      const retrieved = await sessionStore.get(session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await sessionStore.get('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    /**
     * Requirement 1.2: Session updated with selection and timestamp
     */
    it('should update session fields', async () => {
      const session = createTestSession();
      await sessionStore.create(session);

      await sessionStore.update(session.id, {
        direction: 'cinematic',
        currentStep: 'mood',
      });

      // Verify update was called on the collection
      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });

    it('should update generatedImages with proper date handling', async () => {
      const session = createTestSession();
      await sessionStore.create(session);

      const newImages = [createTestImage({ id: 'new-image-1' }), createTestImage({ id: 'new-image-2' })];

      await sessionStore.update(session.id, {
        generatedImages: newImages,
      });

      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });

    it('should update imageHistory with proper date handling', async () => {
      const session = createTestSession();
      await sessionStore.create(session);

      const imageHistory = {
        direction: [createTestImage()],
        mood: [createTestImage({ dimension: 'mood', optionId: 'dramatic' })],
      };

      await sessionStore.update(session.id, {
        imageHistory,
      });

      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });
  });

  describe('delete', () => {
    it('should delete a session by ID', async () => {
      const session = createTestSession();
      await sessionStore.create(session);

      await sessionStore.delete(session.id);

      // Verify the doc method was called with the session ID
      expect(mockFirestore.collection.doc).toHaveBeenCalledWith(session.id);
    });
  });

  describe('getActiveByUserId', () => {
    /**
     * Requirement 1.10: Only ONE active session per user at a time
     */
    it('should return the active session for a user', async () => {
      // Create a mock that returns an active session
      const activeSession = createTestSession({ status: 'active' });

      mockFirestore.collection.get = vi.fn(async () => ({
        empty: false,
        docs: [
          {
            id: activeSession.id,
            data: () => ({
              ...activeSession,
              createdAt: { toDate: () => activeSession.createdAt },
              updatedAt: { toDate: () => activeSession.updatedAt },
            }),
          },
        ],
      }));

      const result = await sessionStore.getActiveByUserId(activeSession.userId);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('active');
    });

    it('should return null when no active session exists', async () => {
      mockFirestore.collection.get = vi.fn(async () => ({
        empty: true,
        docs: [],
      }));

      const result = await sessionStore.getActiveByUserId('user-without-session');

      expect(result).toBeNull();
    });

    it('should query with correct filters for active sessions', async () => {
      mockFirestore.collection.get = vi.fn(async () => ({
        empty: true,
        docs: [],
      }));

      await sessionStore.getActiveByUserId('test-user');

      expect(mockFirestore.collection.where).toHaveBeenCalledWith('userId', '==', 'test-user');
      expect(mockFirestore.collection.where).toHaveBeenCalledWith('status', '==', 'active');
      expect(mockFirestore.collection.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(mockFirestore.collection.limit).toHaveBeenCalledWith(1);
    });
  });

  describe('getByUserId', () => {
    it('should return sessions for a user ordered by updatedAt', async () => {
      const sessions = [
        createTestSession({ id: 'session-1', status: 'completed' }),
        createTestSession({ id: 'session-2', status: 'active' }),
      ];

      mockFirestore.collection.get = vi.fn(async () => ({
        empty: false,
        docs: sessions.map((s) => ({
          id: s.id,
          data: () => ({
            ...s,
            createdAt: { toDate: () => s.createdAt },
            updatedAt: { toDate: () => s.updatedAt },
          }),
        })),
      }));

      const result = await sessionStore.getByUserId('test-user');

      expect(result).toHaveLength(2);
      expect(mockFirestore.collection.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('should respect the limit parameter', async () => {
      mockFirestore.collection.get = vi.fn(async () => ({
        empty: true,
        docs: [],
      }));

      await sessionStore.getByUserId('test-user', 5);

      expect(mockFirestore.collection.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('cleanupExpired', () => {
    /**
     * Requirement 1.4: Sessions inactive for 24 hours marked as abandoned during cleanup
     */
    it('should mark expired sessions as abandoned', async () => {
      const expiredSession = createTestSession({
        id: 'expired-session',
        status: 'active',
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });

      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn(async () => {}),
      };

      mockFirestore.db.batch = vi.fn(() => mockBatch);
      mockFirestore.collection.get = vi.fn(async () => ({
        empty: false,
        docs: [
          {
            id: expiredSession.id,
            data: () => expiredSession,
            ref: mockFirestore.docRef(expiredSession.id),
          },
        ],
      }));

      const count = await sessionStore.cleanupExpired();

      expect(count).toBe(1);
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should return 0 when no expired sessions exist', async () => {
      mockFirestore.collection.get = vi.fn(async () => ({
        empty: true,
        docs: [],
      }));

      const count = await sessionStore.cleanupExpired();

      expect(count).toBe(0);
    });
  });

  describe('abandonSession', () => {
    it('should mark session as abandoned', async () => {
      const session = createTestSession({ status: 'active' });

      // Mock get to return the session
      const docRef = mockFirestore.docRef(session.id);
      docRef.get = vi.fn(async () => ({
        exists: true,
        data: () => ({
          ...session,
          createdAt: { toDate: () => session.createdAt },
          updatedAt: { toDate: () => session.updatedAt },
        }),
        id: session.id,
      }));

      mockFirestore.collection.doc = vi.fn(() => docRef);

      const result = await sessionStore.abandonSession(session.id);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('abandoned');
    });

    it('should return null for non-existent session', async () => {
      const docRef = mockFirestore.docRef('non-existent');
      docRef.get = vi.fn(async () => ({
        exists: false,
        data: () => null,
        id: 'non-existent',
      }));

      mockFirestore.collection.doc = vi.fn(() => docRef);

      const result = await sessionStore.abandonSession('non-existent');

      expect(result).toBeNull();
    });

    it('should return session if already abandoned', async () => {
      const session = createTestSession({ status: 'abandoned' });

      const docRef = mockFirestore.docRef(session.id);
      docRef.get = vi.fn(async () => ({
        exists: true,
        data: () => ({
          ...session,
          createdAt: { toDate: () => session.createdAt },
          updatedAt: { toDate: () => session.updatedAt },
        }),
        id: session.id,
      }));

      mockFirestore.collection.doc = vi.fn(() => docRef);

      const result = await sessionStore.abandonSession(session.id);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('abandoned');
    });
  });
});
