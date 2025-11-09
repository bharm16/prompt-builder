/**
 * @test {PromptCanvas - Keyboard Shortcuts}
 * @description Test suite for keyboard shortcut functionality
 * 
 * Test Coverage:
 * - Keyboard event listener setup/cleanup
 * - Cmd/Ctrl+Z → calls onUndo when canUndo
 * - Cmd/Ctrl+Shift+Z → calls onRedo when canRedo
 * - Cmd/Ctrl+Y → calls onRedo when canRedo
 * - Disabled when can't undo/redo
 * - Toast notifications appear
 * - Platform detection (Mac vs Windows/Linux)
 * 
 * Pattern: Component test with userEvent for keyboard interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptCanvas } from '../PromptCanvas';

// Mock toast hook
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
};

vi.mock('../../components/Toast', () => ({
  useToast: () => mockToast
}));

// Mock other hooks and services
vi.mock('../hooks/useSpanLabeling.js', () => ({
  useSpanLabeling: () => ({
    labeledSpans: [],
    labeledMeta: null,
    labelingStatus: 'idle',
    labelingError: null,
    triggerLabeling: vi.fn(),
    resetLabeling: vi.fn()
  }),
  createHighlightSignature: () => 'test-signature'
}));

vi.mock('../../utils/canonicalText.js', () => ({
  createCanonicalText: (text) => text
}));

vi.mock('../hooks/useClipboard.js', () => ({
  useClipboard: () => ({ copied: false, copy: vi.fn() })
}));

vi.mock('../hooks/useShareLink.js', () => ({
  useShareLink: () => ({ shared: false, share: vi.fn() })
}));

vi.mock('../hooks/useHighlightRendering.js', () => ({
  useHighlightRendering: () => ({ renderKey: 0 }),
  useHighlightFingerprint: () => ({ fingerprint: null, updateFingerprint: vi.fn() })
}));

vi.mock('../../services/exportService.js', () => ({
  ExportService: {
    export: vi.fn()
  }
}));

describe('PromptCanvas - Keyboard Shortcuts', () => {
  let mockOnUndo;
  let mockOnRedo;
  let originalPlatform;

  beforeEach(() => {
    mockOnUndo = vi.fn();
    mockOnRedo = vi.fn();
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockToast.warning.mockClear();

    // Save original platform
    originalPlatform = navigator.platform;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original platform
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  const renderCanvas = (props = {}) => {
    const defaultProps = {
      inputPrompt: 'Test input',
      displayedPrompt: 'Test prompt',
      optimizedPrompt: 'Test optimized',
      qualityScore: 85,
      selectedMode: 'video',
      currentMode: { id: 'video', label: 'Video' },
      promptUuid: 'test-uuid',
      promptContext: null,
      onDisplayedPromptChange: vi.fn(),
      suggestionsData: null,
      onFetchSuggestions: vi.fn(),
      onCreateNew: vi.fn(),
      initialHighlights: null,
      initialHighlightsVersion: 0,
      onHighlightsPersist: vi.fn(),
      onUndo: mockOnUndo,
      onRedo: mockOnRedo,
      canUndo: true,
      canRedo: true,
      isDraftReady: false,
      isRefining: false,
      draftSpans: null,
      refinedSpans: null,
      ...props
    };

    return render(<PromptCanvas {...defaultProps} />);
  };

  // ============================================
  // Mac Platform - Cmd Key
  // ============================================

  describe('Mac Platform (Cmd key)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true
      });
    });

    it('should call onUndo when Cmd+Z is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act
      await user.keyboard('{Meta>}z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Undone');
    });

    it('should call onRedo when Cmd+Shift+Z is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: true });

      // Act
      await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Redone');
    });

    it('should call onRedo when Cmd+Y is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: true });

      // Act
      await user.keyboard('{Meta>}y{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Redone');
    });

    it('should not call onUndo when canUndo is false', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: false });

      // Act
      await user.keyboard('{Meta>}z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        // Expected to timeout
        expect(mockOnUndo).not.toHaveBeenCalled();
      });
    });

    it('should not call onRedo when canRedo is false', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: false });

      // Act
      await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        // Expected to timeout
        expect(mockOnRedo).not.toHaveBeenCalled();
      });
    });

    it('should not trigger undo on Cmd+Shift+Z (redo shortcut)', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true, canRedo: true });

      // Act
      await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
        expect(mockOnUndo).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Windows/Linux Platform - Ctrl Key
  // ============================================

  describe('Windows/Linux Platform (Ctrl key)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true
      });
    });

    it('should call onUndo when Ctrl+Z is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act
      await user.keyboard('{Control>}z{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Undone');
    });

    it('should call onRedo when Ctrl+Shift+Z is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: true });

      // Act
      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Redone');
    });

    it('should call onRedo when Ctrl+Y is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: true });

      // Act
      await user.keyboard('{Control>}y{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
      });
      expect(mockToast.info).toHaveBeenCalledWith('Redone');
    });

    it('should not call onUndo when canUndo is false', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: false });

      // Act
      await user.keyboard('{Control>}z{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        expect(mockOnUndo).not.toHaveBeenCalled();
      });
    });

    it('should not call onRedo when canRedo is false', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: false });

      // Act
      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnRedo).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        expect(mockOnRedo).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Event Listener Cleanup
  // ============================================

  describe('Event Listener Cleanup', () => {
    it('should cleanup event listener on unmount', () => {
      // Arrange
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderCanvas();

      // Act
      unmount();

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should re-attach listener when canUndo/canRedo changes', () => {
      // Arrange
      const { rerender } = renderCanvas({ canUndo: false, canRedo: false });

      // Act - update props
      rerender(
        <PromptCanvas
          inputPrompt="Test input"
          displayedPrompt="Test prompt"
          optimizedPrompt="Test optimized"
          qualityScore={85}
          selectedMode="video"
          currentMode={{ id: 'video', label: 'Video' }}
          promptUuid="test-uuid"
          promptContext={null}
          onDisplayedPromptChange={vi.fn()}
          suggestionsData={null}
          onFetchSuggestions={vi.fn()}
          onCreateNew={vi.fn()}
          initialHighlights={null}
          initialHighlightsVersion={0}
          onHighlightsPersist={vi.fn()}
          onUndo={mockOnUndo}
          onRedo={mockOnRedo}
          canUndo={true}
          canRedo={true}
          isDraftReady={false}
          isRefining={false}
          draftSpans={null}
          refinedSpans={null}
        />
      );

      // Assert - no errors, listener re-attached
      expect(document.addEventListener).toHaveBeenCalled();
    });
  });

  // ============================================
  // Toast Notifications
  // ============================================

  describe('Toast Notifications', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true
      });
    });

    it('should show "Undone" toast after undo', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act
      await user.keyboard('{Meta>}z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith('Undone');
      });
    });

    it('should show "Redone" toast after redo', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canRedo: true });

      // Act
      await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith('Redone');
      });
    });

    it('should not show toast when action is disabled', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: false });

      // Act
      await user.keyboard('{Meta>}z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockToast.info).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        expect(mockToast.info).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true
      });
    });

    it('should handle rapid keyboard presses', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act - press Cmd+Z multiple times quickly
      await user.keyboard('{Meta>}z{/Meta}');
      await user.keyboard('{Meta>}z{/Meta}');
      await user.keyboard('{Meta>}z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should not interfere with regular Z key presses', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act - press Z without modifier
      await user.keyboard('z');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {
        expect(mockOnUndo).not.toHaveBeenCalled();
      });
    });

    it('should handle case-insensitive keys', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act - uppercase Z
      await user.keyboard('{Meta>}Z{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalled();
      });
    });

    it('should work with both canUndo and canRedo true', async () => {
      // Arrange
      const user = userEvent.setup();
      renderCanvas({ canUndo: true, canRedo: true });

      // Act - undo then redo
      await user.keyboard('{Meta>}z{/Meta}');
      await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalledTimes(1);
        expect(mockOnRedo).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle unknown platform gracefully', async () => {
      // Arrange
      Object.defineProperty(navigator, 'platform', {
        value: 'UnknownOS',
        writable: true,
        configurable: true
      });

      const user = userEvent.setup();
      renderCanvas({ canUndo: true });

      // Act - should default to Ctrl behavior
      await user.keyboard('{Control>}z{/Control}');

      // Assert
      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================
  // Integration with FloatingToolbar
  // ============================================

  describe('Integration with Toolbar Buttons', () => {
    it('should have undo button that matches canUndo state', () => {
      // Arrange
      renderCanvas({ canUndo: true });

      // Assert - button should be enabled
      // Note: Actual button rendering is handled by FloatingToolbar component
      // This test verifies the prop is passed correctly
      expect(screen.queryByTitle('Undo')).toBeTruthy();
    });

    it('should have redo button that matches canRedo state', () => {
      // Arrange
      renderCanvas({ canRedo: true });

      // Assert - button should be enabled
      expect(screen.queryByTitle('Redo')).toBeTruthy();
    });
  });
});

