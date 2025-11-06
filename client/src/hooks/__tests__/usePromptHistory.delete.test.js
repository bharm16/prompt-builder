/**
 * usePromptHistory Delete Functionality Tests
 * 
 * Tests for deleteFromHistory function following architecture patterns:
 * - renderHook for testing React hooks
 * - Mock repository at service boundaries
 * - Test behavior, not implementation
 * - AAA pattern
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePromptHistory } from '../usePromptHistory';
import * as repositories from '../../repositories';

// Mock the Toast component
vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock the repository module
vi.mock('../../repositories', () => ({
  getPromptRepositoryForUser: vi.fn(),
}));

describe('usePromptHistory - deleteFromHistory', () => {
  let mockRepository;
  let mockUser;

  beforeEach(() => {
    mockRepository = {
      getUserPrompts: vi.fn(),
      save: vi.fn(),
      deleteById: vi.fn(),
      clear: vi.fn(),
      updateHighlights: vi.fn(),
    };

    repositories.getPromptRepositoryForUser.mockReturnValue(mockRepository);
    mockUser = null;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful deletion', () => {
    it('should remove entry from state optimistically', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1', timestamp: '2024-01-01' },
        { id: 2, input: 'Test 2', output: 'Output 2', timestamp: '2024-01-02' },
        { id: 3, input: 'Test 3', output: 'Output 3', timestamp: '2024-01-03' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(mockUser));

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.history.length).toBe(3);
      });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory(2);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
        expect(result.current.history.find(entry => entry.id === 2)).toBeUndefined();
        expect(result.current.history.find(entry => entry.id === 1)).toBeDefined();
        expect(result.current.history.find(entry => entry.id === 3)).toBeDefined();
      });
    });

    it('should call repository.deleteById with correct id', async () => {
      // Arrange
      const mockHistory = [
        { id: 'uuid-1', input: 'Test 1', output: 'Output 1' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(mockUser));

      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory('uuid-1');
      });

      // Assert
      expect(mockRepository.deleteById).toHaveBeenCalledWith('uuid-1');
    });

    it('should work for unauthenticated users (localStorage)', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
        { id: 2, input: 'Test 2', output: 'Output 2' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(null)); // null user = unauthenticated

      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
      });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory(1);
      });

      // Assert
      expect(mockRepository.deleteById).toHaveBeenCalledWith(1);
      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });
    });

    it('should work for authenticated users (Firestore)', async () => {
      // Arrange
      const authenticatedUser = { uid: 'user-123', email: 'test@example.com' };
      const mockHistory = [
        { id: 'firestore-id-1', input: 'Test 1', output: 'Output 1' },
        { id: 'firestore-id-2', input: 'Test 2', output: 'Output 2' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(authenticatedUser));

      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
      }, { timeout: 1000 });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory('firestore-id-1');
      });

      // Assert
      expect(mockRepository.deleteById).toHaveBeenCalledWith('firestore-id-1');
      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });
    });
  });

  describe('Error handling', () => {
    it('should revert optimistic update on error for unauthenticated users', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
        { id: 2, input: 'Test 2', output: 'Output 2' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => usePromptHistory(null));

      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
      });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory(1);
      });

      // Assert
      // Should have reverted - history should still have both entries
      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
        expect(result.current.history.find(entry => entry.id === 1)).toBeDefined();
        expect(result.current.history.find(entry => entry.id === 2)).toBeDefined();
      });
    });

    it('should revert optimistic update on error for authenticated users', async () => {
      // Arrange
      const authenticatedUser = { uid: 'user-123', email: 'test@example.com' };
      const mockHistory = [
        { id: 'firestore-id-1', input: 'Test 1', output: 'Output 1' },
        { id: 'firestore-id-2', input: 'Test 2', output: 'Output 2' },
      ];
      
      const repositoryWithError = {
        ...mockRepository,
        deleteById: vi.fn().mockRejectedValue(new Error('Firestore permission denied')),
        getUserPrompts: vi.fn()
          .mockResolvedValueOnce(mockHistory) // Initial load
          .mockResolvedValueOnce(mockHistory), // Revert after error
      };

      repositories.getPromptRepositoryForUser.mockReturnValue(repositoryWithError);

      const { result } = renderHook(() => usePromptHistory(authenticatedUser));

      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
      }, { timeout: 1000 });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory('firestore-id-1');
      });

      // Assert
      // Should have attempted to reload from Firestore to revert
      await waitFor(() => {
        expect(result.current.history.length).toBe(2);
      });
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePromptHistory(null));

      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });

      // Act & Assert - should not throw
      await act(async () => {
        await expect(result.current.deleteFromHistory(1)).resolves.not.toThrow();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle deleting non-existent entry', async () => {
      // Arrange
      const mockHistory = [
        { id: 1, input: 'Test 1', output: 'Output 1' },
      ];
      
      mockRepository.getUserPrompts.mockResolvedValue(mockHistory);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(null));

      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });

      // Act
      await act(async () => {
        await result.current.deleteFromHistory(999); // Non-existent ID
      });

      // Assert - should not throw, history remains
      expect(result.current.history.length).toBe(1);
    });

    it('should handle deleting from empty history', async () => {
      // Arrange
      mockRepository.getUserPrompts.mockResolvedValue([]);
      mockRepository.deleteById.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePromptHistory(null));

      await waitFor(() => {
        expect(result.current.history.length).toBe(0);
      });

      // Act & Assert - should not throw
      await act(async () => {
        await expect(result.current.deleteFromHistory(1)).resolves.not.toThrow();
      });
    });
  });
});

