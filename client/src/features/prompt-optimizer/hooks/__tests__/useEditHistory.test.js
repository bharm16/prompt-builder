/**
 * @test {useEditHistory}
 * @description Comprehensive test suite for undo/redo state management
 * 
 * Test Coverage:
 * - Undo/redo state management (promptHistory, historyIndex)
 * - saveState() - adds state to history
 * - undo() / redo() - navigation
 * - canUndo / canRedo - availability checks
 * - getUndoPreview() / getRedoPreview() - preview states
 * - History size limits (maxHistorySize: 100)
 * - Discard future states when editing after undo
 * - Edit history tracking (original feature)
 * 
 * Pattern: Custom hook testing with renderHook
 * 
 * Note: Uses act() for all state mutations and flushes state between operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEditHistory } from '../useEditHistory.js';

describe('useEditHistory', () => {
  // ============================================
  // Initial State
  // ============================================

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      // Act
      const { result } = renderHook(() => useEditHistory());

      // Assert
      expect(result.current.edits).toEqual([]);
      expect(result.current.editCount).toBe(0);
      expect(result.current.hasEdits).toBe(false);
      expect(result.current.promptHistory).toEqual([]);
      expect(result.current.historyIndex).toBe(-1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  // ============================================
  // saveState - Undo/Redo History
  // ============================================

  describe('saveState', () => {
    it('should save prompt state to history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.saveState('First prompt', { action: 'initial' });
      });

      // Assert
      expect(result.current.promptHistory).toHaveLength(1);
      expect(result.current.promptHistory[0].prompt).toBe('First prompt');
      expect(result.current.promptHistory[0].metadata).toEqual({ action: 'initial' });
      expect(result.current.historyIndex).toBe(0);
    });

    it('should append multiple states to history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
        result.current.saveState('Third');
      });

      // Assert
      expect(result.current.promptHistory).toHaveLength(3);
      expect(result.current.promptHistory[0].prompt).toBe('First');
      expect(result.current.promptHistory[1].prompt).toBe('Second');
      expect(result.current.promptHistory[2].prompt).toBe('Third');
      expect(result.current.historyIndex).toBe(2);
    });

    it('should not save null or undefined prompts', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.saveState(null);
        result.current.saveState(undefined);
        result.current.saveState('');
      });

      // Assert
      expect(result.current.promptHistory).toHaveLength(0);
    });

    it('should discard future states when saving after undo', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
        result.current.saveState('Third');
      });

      // Act - undo twice, then save new state
      act(() => {
        result.current.undo();
        result.current.undo();
        result.current.saveState('New path');
      });

      // Assert - future states (Third) should be discarded
      expect(result.current.promptHistory).toHaveLength(2);
      expect(result.current.promptHistory[0].prompt).toBe('First');
      expect(result.current.promptHistory[1].prompt).toBe('New path');
      expect(result.current.historyIndex).toBe(1);
    });

    it('should limit history to maxHistorySize (100)', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act - save 105 states
      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.saveState(`Prompt ${i}`);
        }
      });

      // Assert - should keep only last 100
      expect(result.current.promptHistory).toHaveLength(100);
      expect(result.current.promptHistory[0].prompt).toBe('Prompt 5'); // First 5 discarded
      expect(result.current.promptHistory[99].prompt).toBe('Prompt 104');
      expect(result.current.historyIndex).toBe(99);
    });
  });

  // ============================================
  // undo
  // ============================================

  describe('undo', () => {
    it('should move back one state in history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });
      
      act(() => {
        result.current.saveState('Second');
      });

      // Act
      let undoResult;
      act(() => {
        undoResult = result.current.undo();
      });

      // Assert
      expect(result.current.historyIndex).toBe(0);
      expect(undoResult).toEqual(result.current.promptHistory[0]);
      expect(undoResult.prompt).toBe('First');
    });

    it('should support multiple undos', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
        result.current.saveState('Third');
      });

      // Act - separate undos to ensure state updates flush
      act(() => {
        result.current.undo(); // Back to Second
      });
      
      act(() => {
        result.current.undo(); // Back to First
      });

      // Assert
      expect(result.current.historyIndex).toBe(0);
    });

    it('should return null when at beginning of history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });

      // Act - undo past beginning
      let undoResult1, undoResult2;
      act(() => {
        undoResult1 = result.current.undo();
        undoResult2 = result.current.undo();
      });

      // Assert
      expect(undoResult1).toBeNull();
      expect(undoResult2).toBeNull();
      expect(result.current.historyIndex).toBe(0);
    });

    it('should return null when no history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      let undoResult;
      act(() => {
        undoResult = result.current.undo();
      });

      // Assert
      expect(undoResult).toBeNull();
      expect(result.current.historyIndex).toBe(-1);
    });
  });

  // ============================================
  // redo
  // ============================================

  describe('redo', () => {
    it('should move forward one state in history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
      });
      
      act(() => {
        result.current.undo(); // Back to First
      });

      // Act
      let redoResult;
      act(() => {
        redoResult = result.current.redo();
      });

      // Assert
      expect(result.current.historyIndex).toBe(1);
      expect(redoResult).toEqual(result.current.promptHistory[1]);
      expect(redoResult.prompt).toBe('Second');
    });

    it('should support multiple redos', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
        result.current.saveState('Third');
      });
      
      act(() => {
        result.current.undo();
      });
      
      act(() => {
        result.current.undo();
      });

      // Act - separate redos to ensure state updates flush
      act(() => {
        result.current.redo(); // Forward to Second
      });
      
      act(() => {
        result.current.redo(); // Forward to Third
      });

      // Assert
      expect(result.current.historyIndex).toBe(2);
    });

    it('should return null when at end of history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });

      // Act - redo past end
      let redoResult;
      act(() => {
        redoResult = result.current.redo();
      });

      // Assert
      expect(redoResult).toBeNull();
      expect(result.current.historyIndex).toBe(0);
    });

    it('should return null when no history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      let redoResult;
      act(() => {
        redoResult = result.current.redo();
      });

      // Assert
      expect(redoResult).toBeNull();
    });
  });

  // ============================================
  // canUndo / canRedo
  // ============================================

  describe('canUndo / canRedo', () => {
    it('should update canUndo based on history position', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Initial state
      expect(result.current.canUndo).toBe(false);

      // After first save
      act(() => {
        result.current.saveState('First');
      });
      expect(result.current.canUndo).toBe(false); // At beginning (index 0, need index > 0 to undo)

      // After second save
      act(() => {
        result.current.saveState('Second');
      });
      expect(result.current.canUndo).toBe(true); // Can undo (index 1 > 0)

      // After undo
      act(() => {
        result.current.undo();
      });
      expect(result.current.canUndo).toBe(false); // Back at beginning (index 0)
    });

    it('should update canRedo based on history position', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Initial state
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.saveState('First');
      });
      
      act(() => {
        result.current.saveState('Second');
      });

      // At end of history
      expect(result.current.canRedo).toBe(false);

      // After undo
      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      // After redo
      act(() => {
        result.current.redo();
      });
      expect(result.current.canRedo).toBe(false);
    });
  });

  // ============================================
  // Preview Methods
  // ============================================

  describe('getUndoPreview / getRedoPreview', () => {
    it('should preview undo state without changing index', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });
      
      act(() => {
        result.current.saveState('Second');
      });

      // Act
      const preview = result.current.getUndoPreview();

      // Assert
      expect(preview).toEqual(result.current.promptHistory[0]);
      expect(preview.prompt).toBe('First');
      expect(result.current.historyIndex).toBe(1); // Unchanged
    });

    it('should return null when undo not available', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });

      // Act
      const preview = result.current.getUndoPreview();

      // Assert
      expect(preview).toBeNull();
    });

    it('should preview redo state without changing index', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });
      
      act(() => {
        result.current.saveState('Second');
      });
      
      act(() => {
        result.current.undo();
      });

      // Act
      const preview = result.current.getRedoPreview();

      // Assert
      expect(preview).toEqual(result.current.promptHistory[1]);
      expect(preview.prompt).toBe('Second');
      expect(result.current.historyIndex).toBe(0); // Unchanged
    });

    it('should return null when redo not available', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
      });

      // Act
      const preview = result.current.getRedoPreview();

      // Assert
      expect(preview).toBeNull();
    });
  });

  // ============================================
  // getCurrentState
  // ============================================

  describe('getCurrentState', () => {
    it('should return current state from history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
      });

      // Act
      const current = result.current.getCurrentState();

      // Assert
      expect(current).toEqual(result.current.promptHistory[1]);
      expect(current.prompt).toBe('Second');
    });

    it('should return null when no history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      const current = result.current.getCurrentState();

      // Assert
      expect(current).toBeNull();
    });
  });

  // ============================================
  // clearHistoryStates
  // ============================================

  describe('clearHistoryStates', () => {
    it('should clear prompt history but keep edit history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.addEdit({
          original: 'old',
          replacement: 'new',
          category: 'test'
        });
      });

      // Act
      act(() => {
        result.current.clearHistoryStates();
      });

      // Assert
      expect(result.current.promptHistory).toEqual([]);
      expect(result.current.historyIndex).toBe(-1);
      expect(result.current.edits).toHaveLength(1); // Edit history preserved
    });
  });

  // ============================================
  // Edit History (Original Feature)
  // ============================================

  describe('addEdit - Original Feature', () => {
    it('should add edit to history', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.addEdit({
          original: 'harsh light',
          replacement: 'soft light',
          category: 'lighting',
          position: 10,
          confidence: 0.9
        });
      });

      // Assert
      expect(result.current.edits).toHaveLength(1);
      expect(result.current.edits[0].original).toBe('harsh light');
      expect(result.current.edits[0].replacement).toBe('soft light');
      expect(result.current.edits[0].category).toBe('lighting');
      expect(result.current.editCount).toBe(1);
      expect(result.current.hasEdits).toBe(true);
    });

    it('should not add edit when original and replacement are same', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.addEdit({
          original: 'same',
          replacement: 'same',
          category: 'test'
        });
      });

      // Assert
      expect(result.current.edits).toHaveLength(0);
    });

    it('should limit edits to maxEdits (50)', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act - add 55 edits
      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.addEdit({
            original: `old ${i}`,
            replacement: `new ${i}`,
            category: 'test'
          });
        }
      });

      // Assert - should keep only last 50
      expect(result.current.edits).toHaveLength(50);
      expect(result.current.edits[0].original).toBe('old 5'); // First 5 discarded
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle rapid consecutive saves', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.saveState(`Prompt ${i}`);
        }
      });

      // Assert
      expect(result.current.promptHistory).toHaveLength(10);
      expect(result.current.historyIndex).toBe(9);
    });

    it('should handle undo/redo cycles', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      act(() => {
        result.current.saveState('First');
        result.current.saveState('Second');
        result.current.saveState('Third');
      });

      // Starting at index 2 (Third)
      expect(result.current.historyIndex).toBe(2);

      // Act - undo, redo, undo, redo cycles
      // Each operation needs its own act() to properly flush state updates
      act(() => {
        result.current.undo(); // 2 -> 1 (back to Second)
      });
      
      act(() => {
        result.current.redo(); // 1 -> 2 (forward to Third)
      });
      
      act(() => {
        result.current.undo(); // 2 -> 1 (back to Second)
      });
      
      act(() => {
        result.current.undo(); // 1 -> 0 (back to First)
      });
      
      act(() => {
        result.current.redo(); // 0 -> 1 (forward to Second)
      });

      // Assert - should be at index 1 (Second)
      expect(result.current.historyIndex).toBe(1);
    });

    it('should handle empty string prompts', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());

      // Act
      act(() => {
        result.current.saveState('');
      });

      // Assert
      expect(result.current.promptHistory).toHaveLength(0);
    });

    it('should include timestamp in saved states', () => {
      // Arrange
      const { result } = renderHook(() => useEditHistory());
      const beforeTime = Date.now();

      // Act
      act(() => {
        result.current.saveState('Test');
      });

      const afterTime = Date.now();

      // Assert
      expect(result.current.promptHistory[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.current.promptHistory[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});

