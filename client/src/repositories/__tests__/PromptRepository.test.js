/**
 * PromptRepository Tests
 * 
 * Tests for repository delete methods following architecture patterns:
 * - Constructor dependency injection
 * - Mock at service boundaries
 * - Test behavior, not implementation
 * - AAA pattern
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptRepository, LocalStoragePromptRepository, PromptRepositoryError } from '../PromptRepository';
import { deleteDoc, doc } from 'firebase/firestore';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  arrayUnion: vi.fn(),
  deleteDoc: vi.fn(),
}));

describe('PromptRepository', () => {
  let repository;
  let mockFirestore;

  beforeEach(() => {
    mockFirestore = {
      collection: vi.fn(),
    };
    repository = new PromptRepository(mockFirestore);
    vi.clearAllMocks();
  });

  describe('deleteById', () => {
    it('should call deleteDoc with correct document reference when docId is provided', async () => {
      // Arrange
      const docId = 'test-doc-id-123';
      const mockDocRef = { id: docId };
      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      // Act
      await repository.deleteById(docId);

      // Assert
      expect(doc).toHaveBeenCalledWith(mockFirestore, 'prompts', docId);
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it('should throw error when docId is missing', async () => {
      // Arrange
      const docId = null;

      // Act & Assert
      await expect(repository.deleteById(docId)).rejects.toThrow(PromptRepositoryError);
      await expect(repository.deleteById(docId)).rejects.toThrow('Failed to delete prompt');
    });

    it('should throw error when docId is empty string', async () => {
      // Arrange
      const docId = '';

      // Act & Assert
      await expect(repository.deleteById(docId)).rejects.toThrow(PromptRepositoryError);
    });

    it('should throw PromptRepositoryError when Firestore deleteDoc fails', async () => {
      // Arrange
      const docId = 'test-doc-id-123';
      const mockDocRef = { id: docId };
      const firestoreError = new Error('Firestore network error');
      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(firestoreError);

      // Act & Assert
      await expect(repository.deleteById(docId)).rejects.toThrow(PromptRepositoryError);
      await expect(repository.deleteById(docId)).rejects.toThrow('Failed to delete prompt');
    });

    it('should handle permission-denied errors from Firestore', async () => {
      // Arrange
      const docId = 'test-doc-id-123';
      const mockDocRef = { id: docId };
      const permissionError = new Error('Permission denied');
      permissionError.code = 'permission-denied';
      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(permissionError);

      // Act & Assert
      await expect(repository.deleteById(docId)).rejects.toThrow(PromptRepositoryError);
    });
  });
});

describe('LocalStoragePromptRepository', () => {
  let repository;
  let mockLocalStorage;

  beforeEach(() => {
    repository = new LocalStoragePromptRepository('testPromptHistory');
    
    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
      setItem: vi.fn((key, value) => {
        mockLocalStorage.store[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockLocalStorage.store[key];
      }),
    };
    global.localStorage = mockLocalStorage;
    vi.clearAllMocks();
  });

  describe('deleteById', () => {
    it('should remove entry from localStorage by id', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
        { id: 2, input: 'Test 2', output: 'Output 2' },
        { id: 3, input: 'Test 3', output: 'Output 3' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);

      // Act
      await repository.deleteById(2);

      // Assert
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toHaveLength(2);
      expect(savedData.find(entry => entry.id === 2)).toBeUndefined();
      expect(savedData.find(entry => entry.id === 1)).toBeDefined();
      expect(savedData.find(entry => entry.id === 3)).toBeDefined();
    });

    it('should preserve other entries when deleting one', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1', timestamp: '2024-01-01' },
        { id: 2, input: 'Test 2', output: 'Output 2', timestamp: '2024-01-02' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);

      // Act
      await repository.deleteById(1);

      // Assert
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toEqual(mockHistory[1]);
    });

    it('should handle deleting non-existent entry gracefully', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);

      // Act
      await repository.deleteById(999);

      // Assert
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toEqual(mockHistory[0]);
    });

    it('should handle empty history gracefully', async () => {
      // Arrange
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify([]);

      // Act
      await repository.deleteById(1);

      // Assert
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toEqual([]);
    });

    it('should handle localStorage quota exceeded error', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);
      
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });

      // Act & Assert
      await expect(repository.deleteById(1)).rejects.toThrow(PromptRepositoryError);
    });

    it('should throw PromptRepositoryError when localStorage is unavailable', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);
      
      const storageError = new Error('Storage unavailable');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw storageError;
      });

      // Act & Assert
      await expect(repository.deleteById(1)).rejects.toThrow(PromptRepositoryError);
      await expect(repository.deleteById(1)).rejects.toThrow('Failed to delete from local storage');
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      // Arrange
      mockLocalStorage.store['testPromptHistory'] = 'invalid json {';
      
      // Act
      await repository.deleteById(1);
      
      // Assert
      // _getHistory() handles corrupted data by clearing it and returning empty array
      // deleteById will filter empty array and save it
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toEqual([]);
    });

    it('should work with string IDs', async () => {
      // Arrange
      const mockHistory = [
        { id: 'uuid-1', input: 'Test 1', output: 'Output 1' },
        { id: 'uuid-2', input: 'Test 2', output: 'Output 2' },
      ];
      mockLocalStorage.store['testPromptHistory'] = JSON.stringify(mockHistory);

      // Act
      await repository.deleteById('uuid-1');

      // Assert
      const savedData = JSON.parse(mockLocalStorage.store['testPromptHistory']);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('uuid-2');
    });
  });
});

