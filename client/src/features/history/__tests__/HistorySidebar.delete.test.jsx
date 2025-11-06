/**
 * HistorySidebar Delete Functionality Tests
 * 
 * Tests for delete UI and user interactions following architecture patterns:
 * - React Testing Library for user-centric testing
 * - userEvent for realistic user interactions
 * - Test behavior, not implementation
 * - AAA pattern
 * - Accessibility testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistorySidebar } from '../HistorySidebar';
import { MessageSquare, Video } from 'lucide-react';

// Mock the repositories module
vi.mock('../../../repositories', () => ({
  getAuthRepository: vi.fn(() => ({
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock the Toast component
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock the EmptyState component
vi.mock('../../../components/EmptyState', () => ({
  HistoryEmptyState: ({ onCreateNew }) => (
    <div data-testid="empty-state">
      <button onClick={onCreateNew}>Create New</button>
    </div>
  ),
}));

describe('HistorySidebar - Delete Functionality', () => {
  const mockModes = [
    { id: 'optimize', name: 'Standard', icon: MessageSquare },
    { id: 'video', name: 'Video', icon: Video },
  ];

  const mockHistory = [
    {
      id: 1,
      input: 'Test prompt 1',
      output: 'Optimized 1',
      mode: 'optimize',
      timestamp: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      input: 'Test prompt 2',
      output: 'Optimized 2',
      mode: 'video',
      timestamp: '2024-01-02T00:00:00Z',
    },
    {
      id: 3,
      input: 'Test prompt 3',
      output: 'Optimized 3',
      mode: 'optimize',
      timestamp: '2024-01-03T00:00:00Z',
    },
  ];

  let mockOnLoadFromHistory;
  let mockOnCreateNew;
  let mockOnDelete;

  beforeEach(() => {
    mockOnLoadFromHistory = vi.fn();
    mockOnCreateNew = vi.fn();
    mockOnDelete = vi.fn();
  });

  const renderSidebar = (props = {}) => {
    return render(
      <HistorySidebar
        showHistory={true}
        user={null}
        history={mockHistory}
        filteredHistory={mockHistory}
        isLoadingHistory={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        onLoadFromHistory={mockOnLoadFromHistory}
        onCreateNew={mockOnCreateNew}
        onDelete={mockOnDelete}
        modes={mockModes}
        {...props}
      />
    );
  };

  describe('Delete button visibility', () => {
    it('should show delete button when hovering over history item', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item
      const historyItems = screen.getAllByRole('button', { name: /load prompt/i });
      const firstItem = historyItems[0];

      // Act
      await user.hover(firstItem.closest('div.group'));

      // Assert
      const deleteButton = within(firstItem.closest('li')).getByRole('button', { name: /delete prompt/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should have proper aria-label for accessibility', () => {
      // Arrange
      renderSidebar();

      // Act
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);

      // Assert
      expect(deleteButtons.length).toBeGreaterThan(0);
      deleteButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label', 'Delete prompt');
      });
    });

    it('should have proper title attribute for tooltip', () => {
      // Arrange
      renderSidebar();

      // Act
      const deleteButtons = screen.getAllByTitle('Delete prompt');

      // Assert
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Delete confirmation flow', () => {
    it('should show confirmation UI when delete button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item and its delete button
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const firstDeleteButton = deleteButtons[0];

      // Act
      await user.click(firstDeleteButton);

      // Assert
      expect(screen.getByText('Delete this prompt?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should hide confirmation when cancel is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item and its delete button
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const firstDeleteButton = deleteButtons[0];

      // Show confirmation
      await user.click(firstDeleteButton);
      expect(screen.getByText('Delete this prompt?')).toBeInTheDocument();

      // Act
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert
      expect(screen.queryByText('Delete this prompt?')).not.toBeInTheDocument();
      // Original prompt text should be back
      expect(screen.getByText('Test prompt 1')).toBeInTheDocument();
    });

    it('should call onDelete with correct id when confirmed', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item and its delete button
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const firstDeleteButton = deleteButtons[0];

      // Show confirmation
      await user.click(firstDeleteButton);

      // Act
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Assert
      expect(mockOnDelete).toHaveBeenCalledWith(1); // First item has id: 1
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onLoadFromHistory when in confirmation mode', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item and its delete button
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const firstDeleteButton = deleteButtons[0];

      // Show confirmation
      await user.click(firstDeleteButton);

      // Act - Try to click the confirmation UI (not a specific button)
      // The load function shouldn't be triggered
      const confirmationText = screen.getByText('Delete this prompt?');
      await user.click(confirmationText);

      // Assert
      expect(mockOnLoadFromHistory).not.toHaveBeenCalled();
    });
  });

  describe('Multiple item deletion', () => {
    it('should delete the correct item when multiple items exist', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the second history item (id: 2)
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const secondDeleteButton = deleteButtons[1];

      // Act
      await user.click(secondDeleteButton);
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Assert
      expect(mockOnDelete).toHaveBeenCalledWith(2); // Second item has id: 2
    });

    it('should only show confirmation for one item at a time', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get delete buttons
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);

      // Act - Click first delete button
      await user.click(deleteButtons[0]);

      // Assert
      const confirmationMessages = screen.queryAllByText('Delete this prompt?');
      expect(confirmationMessages).toHaveLength(1);
    });
  });

  describe('Styling and visual feedback', () => {
    it('should use red styling for delete confirmation', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Get the first history item and its delete button
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      const firstDeleteButton = deleteButtons[0];

      // Act
      await user.click(firstDeleteButton);

      // Assert
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      expect(confirmButton).toHaveClass('bg-red-600');
      
      const confirmationContainer = screen.getByText('Delete this prompt?').closest('div');
      expect(confirmationContainer).toHaveClass('bg-red-50');
      expect(confirmationContainer).toHaveClass('border-red-200');
    });

    it('should show trash icon in delete button', async () => {
      // Arrange
      renderSidebar();

      // Act
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);

      // Assert
      // Each delete button should contain an SVG (Trash2 icon)
      deleteButtons.forEach(button => {
        const svg = button.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('Integration with sidebar', () => {
    it('should pass onDelete prop to HistoryItem components', () => {
      // Arrange & Act
      renderSidebar();

      // Assert
      // The delete buttons should exist for each history item
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      expect(deleteButtons).toHaveLength(mockHistory.length);
    });

    it('should work with filtered history', async () => {
      // Arrange
      const filteredHistory = [mockHistory[0]]; // Only first item
      const user = userEvent.setup();
      
      renderSidebar({ filteredHistory });

      // Act
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      await user.click(deleteButtons[0]);
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Assert
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });

    it('should show empty state when no history items', () => {
      // Arrange & Act
      renderSidebar({ history: [], filteredHistory: [] });

      // Assert
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Act - Tab to delete button and activate with Enter
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      deleteButtons[0].focus();
      await user.keyboard('{Enter}');

      // Assert
      expect(screen.getByText('Delete this prompt?')).toBeInTheDocument();
    });

    it('should allow keyboard navigation through confirmation', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Show confirmation
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      await user.click(deleteButtons[0]);

      // Act - Navigate with keyboard
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      confirmButton.focus();
      await user.keyboard('{Enter}');

      // Assert
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });

    it('should have proper button roles', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Act
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      await user.click(deleteButtons[0]);

      // Assert
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      expect(confirmButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      
      // Buttons should be clickable
      expect(confirmButton).toBeEnabled();
      expect(cancelButton).toBeEnabled();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid delete clicks gracefully', async () => {
      // Arrange
      const user = userEvent.setup();
      renderSidebar();

      // Act - Click delete button multiple times rapidly
      const deleteButtons = screen.getAllByLabelText(/delete prompt/i);
      await user.click(deleteButtons[0]);
      await user.click(deleteButtons[0]); // Click again while confirmation is showing

      // Assert - Should only show one confirmation
      const confirmButtons = screen.queryAllByRole('button', { name: /^delete$/i });
      expect(confirmButtons).toHaveLength(1);
    });

    it('should handle missing onDelete prop gracefully', () => {
      // Arrange & Act
      const { container } = renderSidebar({ onDelete: undefined });

      // Assert - Should render without crashing
      expect(container).toBeInTheDocument();
    });
  });
});

