/**
 * @test {WizardVideoBuilder}
 * @description Gold standard test example for React components
 * 
 * This test demonstrates:
 * - Dependency injection (not fetch mocking)
 * - Clear AAA pattern
 * - User behavior testing (not implementation)
 * - Comprehensive edge cases
 * - Accessibility testing
 * - Proper cleanup
 * 
 * Use this as the reference pattern for all frontend component tests
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import WizardVideoBuilder from '../WizardVideoBuilder';

// Extend matchers
expect.extend(toHaveNoViolations);

describe('WizardVideoBuilder', () => {
  // ============================================
  // SETUP - Dependency Injection Pattern
  // ============================================
  
  let mockAiWizardService;
  let mockAnalyticsService;
  let mockOnConceptComplete;
  let mockOnSave;
  
  beforeEach(() => {
    // Mock services at boundary (not fetch!)
    mockAiWizardService = {
      getSuggestions: vi.fn(),
      generatePrompt: vi.fn(),
      getCompletionPercentage: vi.fn(),
      validateField: vi.fn()
    };
    
    mockAnalyticsService = {
      trackEvent: vi.fn(),
      trackTiming: vi.fn()
    };
    
    // Mock callbacks
    mockOnConceptComplete = vi.fn();
    mockOnSave = vi.fn();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Mock matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)' ? false : true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const renderComponent = (props = {}) => {
    const defaultProps = {
      onConceptComplete: mockOnConceptComplete,
      onSave: mockOnSave,
      aiService: mockAiWizardService,
      analyticsService: mockAnalyticsService
    };
    
    return render(
      <WizardVideoBuilder {...defaultProps} {...props} />
    );
  };
  
  const fillRequiredFields = async (user) => {
    const subjectInput = screen.getByRole('textbox', { name: /subject/i });
    const actionInput = screen.getByRole('textbox', { name: /action/i });
    const locationInput = screen.getByRole('textbox', { name: /location/i });
    
    await user.type(subjectInput, 'A golden retriever');
    await user.type(actionInput, 'jumping through hoops');
    await user.type(locationInput, 'a sunny park');
    
    return { subjectInput, actionInput, locationInput };
  };
  
  // ============================================
  // TEST SUITE - RENDERING
  // ============================================
  
  describe('Rendering', () => {
    it('should render entry page by default', () => {
      // Arrange & Act
      renderComponent();
      
      // Assert
      expect(screen.getByRole('heading', { name: /let's bring your idea to life/i }))
        .toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get started/i }))
        .toBeInTheDocument();
    });
    
    it('should render all required fields after getting started', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      
      // Act
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Assert
      expect(screen.getByRole('textbox', { name: /subject/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /action/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /location/i })).toBeInTheDocument();
    });
    
    it('should show validation indicators for completed fields', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.type(subjectInput, 'A cat');
      await user.tab(); // Blur the field
      
      // Assert
      const subjectContainer = subjectInput.closest('.field-container');
      expect(within(subjectContainer).getByTestId('check-icon')).toBeInTheDocument();
      expect(subjectContainer).toHaveClass('field-valid');
    });
  });
  
  // ============================================
  // TEST SUITE - USER INTERACTIONS
  // ============================================
  
  describe('User Interactions', () => {
    it('should navigate through wizard steps sequentially', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act - Fill required fields and navigate
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Assert - Should be on atmosphere step
      expect(screen.getByRole('heading', { name: /atmosphere/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /mood/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /style/i })).toBeInTheDocument();
    });
    
    it('should allow navigation back to previous steps', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Act - Go back
      await user.click(screen.getByRole('button', { name: /back|previous/i }));
      
      // Assert - Should be back on core concept
      expect(screen.getByRole('textbox', { name: /subject/i })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /mood/i })).not.toBeInTheDocument();
    });
    
    it('should request AI suggestions when user focuses on a field', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.getSuggestions.mockResolvedValue([
        'A playful puppy',
        'An elegant swan',
        'A majestic eagle'
      ]);
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.click(subjectInput);
      
      // Assert
      await waitFor(() => {
        expect(mockAiWizardService.getSuggestions).toHaveBeenCalledWith(
          'subject',
          '',
          expect.objectContaining({
            subject: '',
            action: '',
            location: ''
          })
        );
      });
      
      // Verify suggestions appear
      expect(await screen.findByText('A playful puppy')).toBeInTheDocument();
      expect(screen.getByText('An elegant swan')).toBeInTheDocument();
    });
    
    it('should apply suggestion when clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.getSuggestions.mockResolvedValue(['A playful puppy']);
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.click(subjectInput);
      const suggestion = await screen.findByRole('button', { name: /a playful puppy/i });
      await user.click(suggestion);
      
      // Assert
      expect(subjectInput).toHaveValue('A playful puppy');
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        'suggestion_applied',
        expect.objectContaining({
          field: 'subject',
          suggestion: 'A playful puppy'
        })
      );
    });
  });
  
  // ============================================
  // TEST SUITE - FORM VALIDATION
  // ============================================
  
  describe('Form Validation', () => {
    it('should prevent proceeding without required fields', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act - Try to proceed without filling fields
      const nextButton = screen.getByRole('button', { name: /continue|next/i });
      await user.click(nextButton);
      
      // Assert
      expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
      expect(screen.getByText(/action is required/i)).toBeInTheDocument();
      expect(screen.getByText(/location is required/i)).toBeInTheDocument();
      // Should not navigate
      expect(screen.queryByRole('heading', { name: /atmosphere/i })).not.toBeInTheDocument();
    });
    
    it('should validate field content on blur', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.validateField.mockResolvedValue({
        isValid: false,
        message: 'Please be more specific'
      });
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.type(subjectInput, 'thing');
      await user.tab();
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/please be more specific/i)).toBeInTheDocument();
      });
      expect(mockAiWizardService.validateField).toHaveBeenCalledWith('subject', 'thing');
    });
    
    it('should clear validation errors when field is corrected', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Create validation error
      const nextButton = screen.getByRole('button', { name: /continue|next/i });
      await user.click(nextButton);
      expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
      
      // Act - Fix the error
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.type(subjectInput, 'A golden retriever');
      
      // Assert
      expect(screen.queryByText(/subject is required/i)).not.toBeInTheDocument();
    });
  });
  
  // ============================================
  // TEST SUITE - AUTO-SAVE FUNCTIONALITY
  // ============================================
  
  describe('Auto-Save', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });
    
    it('should auto-save to localStorage after 2 seconds of inactivity', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null }); // No delay for fake timers
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.type(subjectInput, 'A dog');
      
      // Fast-forward time
      vi.advanceTimersByTime(2000);
      
      // Assert
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'wizard_video_builder_draft',
        expect.stringContaining('"subject":"A dog"')
      );
    });
    
    it('should restore from localStorage on mount with user confirmation', async () => {
      // Arrange
      const savedData = {
        formData: {
          subject: 'Saved cat',
          action: 'running',
          location: 'garden'
        },
        currentStep: 1,
        timestamp: Date.now()
      };
      window.localStorage.getItem.mockReturnValue(JSON.stringify(savedData));
      window.confirm = vi.fn().mockReturnValue(true);
      
      // Act
      renderComponent();
      
      // Assert
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('found a saved draft')
      );
      
      // Verify restored data is loaded
      await waitFor(() => {
        expect(screen.getByDisplayValue('Saved cat')).toBeInTheDocument();
        expect(screen.getByDisplayValue('running')).toBeInTheDocument();
      });
    });
    
    it('should clear localStorage when wizard is completed', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.generatePrompt.mockReturnValue('Generated video prompt');
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      await fillRequiredFields(user);
      
      // Navigate to review
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Act - Complete wizard
      await user.click(screen.getByRole('button', { name: /generate|complete/i }));
      
      // Assert
      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('wizard_video_builder_draft');
      });
    });
  });
  
  // ============================================
  // TEST SUITE - RESPONSIVE BEHAVIOR
  // ============================================
  
  describe('Responsive Design', () => {
    it('should render mobile view on small screens', async () => {
      // Arrange
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));
      
      // Act
      renderComponent();
      
      // Assert
      expect(screen.getByTestId('mobile-field-view')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-view')).not.toBeInTheDocument();
    });
    
    it('should show one field at a time on mobile', async () => {
      // Arrange
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Assert - Only subject field visible initially
      expect(screen.getByRole('textbox', { name: /subject/i })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /action/i })).not.toBeInTheDocument();
      
      // Act - Navigate to next field
      await user.type(screen.getByRole('textbox', { name: /subject/i }), 'A cat');
      await user.click(screen.getByRole('button', { name: /next field/i }));
      
      // Assert - Now only action field visible
      expect(screen.queryByRole('textbox', { name: /subject/i })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /action/i })).toBeInTheDocument();
    });
  });
  
  // ============================================
  // TEST SUITE - KEYBOARD NAVIGATION
  // ============================================
  
  describe('Keyboard Navigation', () => {
    it('should navigate fields with Tab key', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      await user.tab();
      
      // Assert
      expect(screen.getByRole('textbox', { name: /subject/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('textbox', { name: /action/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('textbox', { name: /location/i })).toHaveFocus();
    });
    
    it('should submit form with Enter key when valid', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      await fillRequiredFields(user);
      
      // Act - Press Enter in last field
      await user.keyboard('{Enter}');
      
      // Assert - Should navigate to next step
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /atmosphere/i })).toBeInTheDocument();
      });
    });
    
    it('should navigate back with Escape key', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Act
      await user.keyboard('{Escape}');
      
      // Assert - Should go back to previous step
      expect(screen.getByRole('textbox', { name: /subject/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /atmosphere/i })).not.toBeInTheDocument();
    });
  });
  
  // ============================================
  // TEST SUITE - ERROR HANDLING
  // ============================================
  
  describe('Error Handling', () => {
    it('should handle AI service errors gracefully', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.getSuggestions.mockRejectedValue(new Error('Service unavailable'));
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      const subjectInput = screen.getByRole('textbox', { name: /subject/i });
      await user.click(subjectInput);
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/suggestions unavailable/i)).toBeInTheDocument();
      });
      // User should still be able to type manually
      await user.type(subjectInput, 'Manual input');
      expect(subjectInput).toHaveValue('Manual input');
    });
    
    it('should handle localStorage quota exceeded', async () => {
      // Arrange
      const user = userEvent.setup({ delay: null });
      vi.useFakeTimers();
      window.localStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act
      await user.type(screen.getByRole('textbox', { name: /subject/i }), 'Test');
      vi.advanceTimersByTime(2000);
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/auto-save disabled/i)).toBeInTheDocument();
      });
      vi.useRealTimers();
    });
    
    it('should validate props and provide defaults', () => {
      // Arrange & Act
      renderComponent({ onConceptComplete: undefined });
      
      // Assert - Should not crash, use default no-op
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });
  });
  
  // ============================================
  // TEST SUITE - ACCESSIBILITY
  // ============================================
  
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      // Arrange
      const { container } = renderComponent();
      
      // Act
      const results = await axe(container);
      
      // Assert
      expect(results).toHaveNoViolations();
    });
    
    it('should announce validation errors to screen readers', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act - Trigger validation error
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Assert
      const errorMessage = screen.getByText(/subject is required/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
    
    it('should have proper ARIA labels for all interactive elements', () => {
      // Arrange & Act
      renderComponent();
      
      // Assert
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
    
    it('should manage focus properly during navigation', async () => {
      // Arrange
      const user = userEvent.setup();
      renderComponent();
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Act - Navigate to next step
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Assert - Focus should move to first field of new step
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /time/i })).toHaveFocus();
      });
    });
  });
  
  // ============================================
  // TEST SUITE - INTEGRATION
  // ============================================
  
  describe('Complete User Flow', () => {
    it('should complete entire wizard flow successfully', async () => {
      // Arrange
      const user = userEvent.setup();
      mockAiWizardService.generatePrompt.mockReturnValue(
        'A golden retriever jumping through hoops in a sunny park during golden hour with joyful mood'
      );
      mockAiWizardService.getCompletionPercentage.mockReturnValue(85);
      renderComponent();
      
      // Act - Complete entire flow
      // Step 1: Get started
      await user.click(screen.getByRole('button', { name: /get started/i }));
      
      // Step 2: Fill core concept
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Step 3: Fill atmosphere (optional)
      await user.type(screen.getByRole('textbox', { name: /time/i }), 'golden hour');
      await user.type(screen.getByRole('textbox', { name: /mood/i }), 'joyful');
      await user.click(screen.getByRole('button', { name: /continue|next/i }));
      
      // Step 4: Review and generate
      expect(screen.getByText(/review your video concept/i)).toBeInTheDocument();
      expect(screen.getByText(/golden retriever/i)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument(); // Completion percentage
      
      await user.click(screen.getByRole('button', { name: /generate|complete/i }));
      
      // Assert
      await waitFor(() => {
        expect(mockOnConceptComplete).toHaveBeenCalledWith(
          expect.stringContaining('golden retriever jumping'),
          expect.objectContaining({
            subject: 'A golden retriever',
            action: 'jumping through hoops',
            location: 'a sunny park',
            time: 'golden hour',
            mood: 'joyful'
          }),
          expect.objectContaining({
            format: 'wizard',
            validationScore: 85
          })
        );
      });
      
      // Verify analytics tracking
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        'wizard_completed',
        expect.objectContaining({
          steps_completed: 4,
          completion_percentage: 85,
          has_optional_fields: true
        })
      );
    });
  });
});
