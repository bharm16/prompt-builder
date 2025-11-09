/**
 * @test {usePromptOptimizer}
 * @description Comprehensive test suite for usePromptOptimizer hook
 * 
 * Test Coverage:
 * - State initialization and management
 * - Optimization with API service
 * - Quality score calculation
 * - Error handling
 * - State reset functionality
 * 
 * Mocking Strategy:
 * - promptOptimizationApiV2 mocked at service boundary
 * - useToast mocked via context
 * - No direct fetch mocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptOptimizer } from '../usePromptOptimizer';
import React from 'react';

// Mock the service layer (not fetch!)
vi.mock('../../services', () => {
  const mockApi = {
    optimize: vi.fn(),
    optimizeWithFallback: vi.fn(),
    calculateQualityScore: vi.fn(),
  };
  
  return {
    promptOptimizationApiV2: mockApi,
  };
});

// Mock Toast context
const mockToastFunctions = {
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../components/Toast.jsx', () => ({
  useToast: () => mockToastFunctions,
  ToastProvider: ({ children }) => children,
}));

import { promptOptimizationApiV2 } from '../../services';

describe('usePromptOptimizer', () => {
  // ============================================
  // SETUP - Service Boundary Mocking
  // ============================================
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    promptOptimizationApiV2.calculateQualityScore.mockImplementation((input, output) => {
      // Simple mock implementation
      const hasStructure = output.includes('Goal') || output.includes('Context');
      return hasStructure ? 85 : 50;
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  // ============================================
  // TEST SUITE - Initialization
  // ============================================
  
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePromptOptimizer('code'));
      
      // Assert
      expect(result.current.inputPrompt).toBe('');
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.optimizedPrompt).toBe('');
      expect(result.current.qualityScore).toBe(null);
    });
    
    it('should initialize with selected mode', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePromptOptimizer('creative'));
      
      // Assert - mode should be passed to optimization calls
      expect(result.current).toBeDefined();
    });
  });
  
  // ============================================
  // TEST SUITE - Optimization
  // ============================================
  
  describe('Optimization', () => {
    it('should show warning when optimizing empty prompt', async () => {
      // Arrange
      const { result } = renderHook(() => usePromptOptimizer('code'));
      
      // Act
      let optimizeResult;
      await act(async () => {
        optimizeResult = await result.current.optimize('');
      });
      
      // Assert
      expect(optimizeResult).toBeNull();
      expect(mockToastFunctions.warning).toHaveBeenCalledWith('Please enter a prompt');
    });
    
    it('should optimize successfully with two-stage mode', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        // Simulate refined callback
        if (options.onRefined) {
          options.onRefined('Optimized: **Goal**\nAchieve task\n\n**Context**\nDetailed context\n\n**Return Format**\nJSON', {});
        }
        
        return {
          refined: 'Optimized: **Goal**\nAchieve task\n\n**Context**\nDetailed context\n\n**Return Format**\nJSON',
          usedFallback: false,
        };
      });
      
      promptOptimizationApiV2.calculateQualityScore.mockReturnValue(85);
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        result.current.setInputPrompt('short prompt');
        await result.current.optimize('short prompt');
      });
      
      // Assert
      expect(promptOptimizationApiV2.optimizeWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'short prompt',
          mode: 'code',
        })
      );
      expect(result.current.optimizedPrompt).toContain('Optimized');
      expect(result.current.qualityScore).toBe(85);
    });
    
    it('should handle draft callback in two-stage optimization', async () => {
      // Arrange
      let capturedOnDraft;
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        capturedOnDraft = options.onDraft;
        
        // Simulate draft callback
        if (capturedOnDraft) {
          capturedOnDraft('Draft: Initial optimization');
        }
        
        return {
          refined: 'Refined: Complete optimization with details',
          usedFallback: false,
        };
      });
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(result.current.isDraftReady).toBe(true);
      expect(mockToastFunctions.info).toHaveBeenCalledWith('Draft ready! Refining in background...');
    });
    
    it('should show warning when two-stage falls back to single-stage', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockResolvedValue({
        refined: 'Optimized prompt',
        usedFallback: true,
      });
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(mockToastFunctions.warning).toHaveBeenCalledWith(
        expect.stringContaining('Fast optimization unavailable')
      );
    });
  });
  
  // ============================================
  // TEST SUITE - Error Handling
  // ============================================
  
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockRejectedValue(
        new Error('API request failed')
      );
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      let optimizeResult;
      await act(async () => {
        optimizeResult = await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(optimizeResult).toBeNull();
      expect(mockToastFunctions.error).toHaveBeenCalledWith(
        'Failed to optimize. Make sure the server is running.'
      );
      expect(result.current.isProcessing).toBe(false);
    });
    
    it('should set isProcessing to false after error', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockRejectedValue(
        new Error('Network error')
      );
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.isRefining).toBe(false);
    });
  });
  
  // ============================================
  // TEST SUITE - State Management
  // ============================================
  
  describe('State Management', () => {
    it('should reset all state when resetPrompt is called', () => {
      // Arrange
      const { result } = renderHook(() => usePromptOptimizer('code'));
      
      // Set up some state
      act(() => {
        result.current.setInputPrompt('test input');
        result.current.setOptimizedPrompt('test optimized');
        result.current.setDisplayedPrompt('test displayed');
        result.current.setSkipAnimation(true);
        result.current.setImprovementContext({ key: 'value' });
      });
      
      // Act
      act(() => {
        result.current.resetPrompt();
      });
      
      // Assert
      expect(result.current.inputPrompt).toBe('');
      expect(result.current.optimizedPrompt).toBe('');
      expect(result.current.displayedPrompt).toBe('');
      expect(result.current.qualityScore).toBe(null);
      expect(result.current.skipAnimation).toBe(false);
      expect(result.current.improvementContext).toBe(null);
      expect(result.current.draftPrompt).toBe('');
      expect(result.current.isDraftReady).toBe(false);
    });
    
    it('should update inputPrompt when setInputPrompt is called', () => {
      // Arrange
      const { result } = renderHook(() => usePromptOptimizer('code'));
      
      // Act
      act(() => {
        result.current.setInputPrompt('new prompt value');
      });
      
      // Assert
      expect(result.current.inputPrompt).toBe('new prompt value');
    });
  });
  
  // ============================================
  // TEST SUITE - Quality Score
  // ============================================
  
  describe('Quality Score', () => {
    it('should set quality score after successful optimization', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        // Simulate refined callback which triggers score calculation
        if (options.onRefined) {
          options.onRefined('**Goal**\nTest\n\n**Context**\nDetails\n\n**Return Format**\nJSON', {});
        }
        
        return {
          refined: '**Goal**\nTest\n\n**Context**\nDetails\n\n**Return Format**\nJSON',
          usedFallback: false,
        };
      });
      
      promptOptimizationApiV2.calculateQualityScore.mockReturnValue(90);
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(result.current.qualityScore).toBe(90);
    });
    
    it('should show success toast for high quality scores', async () => {
      // Arrange
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        // Simulate refined callback which triggers toast
        if (options.onRefined) {
          options.onRefined('High quality optimized prompt', {});
        }
        
        return {
          refined: 'High quality optimized prompt',
          usedFallback: false,
        };
      });
      
      promptOptimizationApiV2.calculateQualityScore.mockReturnValue(85);
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(mockToastFunctions.success).toHaveBeenCalledWith(
        expect.stringContaining('Quality score: 85%')
      );
    });
  });
  
  // ============================================
  // TEST SUITE - Two-Stage Optimization
  // ============================================
  
  describe('Two-Stage Optimization', () => {
    it('should handle onRefined callback', async () => {
      // Arrange
      let capturedOnRefined;
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        capturedOnRefined = options.onRefined;
        
        // Simulate refined callback
        if (capturedOnRefined) {
          capturedOnRefined('Refined prompt with improvements', { score: 95 });
        }
        
        return {
          refined: 'Refined prompt with improvements',
          usedFallback: false,
        };
      });
      
      promptOptimizationApiV2.calculateQualityScore.mockReturnValue(95);
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(result.current.optimizedPrompt).toBe('Refined prompt with improvements');
      expect(result.current.isRefining).toBe(false);
    });
    
    it('should handle onSpans callback for highlight data', async () => {
      // Arrange
      let capturedOnSpans;
      promptOptimizationApiV2.optimizeWithFallback.mockImplementation(async (options) => {
        capturedOnSpans = options.onSpans;
        
        // Simulate spans callback
        if (capturedOnSpans) {
          capturedOnSpans([{ start: 0, end: 10, category: 'goal' }], 'draft', {});
        }
        
        return {
          refined: 'Optimized prompt',
          usedFallback: false,
        };
      });
      
      const { result } = renderHook(() => usePromptOptimizer('code', true));
      
      // Act
      await act(async () => {
        await result.current.optimize('test prompt');
      });
      
      // Assert
      expect(result.current.draftSpans).toBeDefined();
      expect(result.current.draftSpans.spans).toHaveLength(1);
    });
  });
});
