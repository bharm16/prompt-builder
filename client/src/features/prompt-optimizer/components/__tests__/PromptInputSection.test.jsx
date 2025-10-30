import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptInputSection } from '../PromptInputSection';

// Mock the context and PromptInput component
vi.mock('../../context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

vi.mock('../../PromptInput', () => ({
  PromptInput: vi.fn(({ inputPrompt, selectedMode, isProcessing }) => (
    <div data-testid="prompt-input">
      <div data-testid="prompt-input-value">{inputPrompt}</div>
      <div data-testid="prompt-input-mode">{selectedMode}</div>
      <div data-testid="prompt-input-processing">{String(isProcessing)}</div>
    </div>
  )),
}));

const { usePromptState } = await import('../../context/PromptStateContext');
const { PromptInput } = await import('../../PromptInput');

describe('PromptInputSection', () => {
  const mockOnOptimize = vi.fn();
  const mockOnShowBrainstorm = vi.fn();
  const mockSetInputPrompt = vi.fn();
  const mockSetSelectedMode = vi.fn();
  const mockAiNames = ['GPT-4', 'Claude'];

  const defaultMockState = {
    selectedMode: 'optimize',
    setSelectedMode: mockSetSelectedMode,
    modes: [
      { id: 'optimize', name: 'Standard' },
      { id: 'video', name: 'Video' },
    ],
    currentAIIndex: 0,
    promptOptimizer: {
      inputPrompt: 'Test prompt',
      setInputPrompt: mockSetInputPrompt,
      isProcessing: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usePromptState.mockReturnValue(defaultMockState);
  });

  /**
   * TEST CATEGORY 1: Conditional Rendering Logic
   * These tests verify that the component correctly chooses between
   * rendering PromptInput or LoadingSkeleton based on isProcessing state.
   */
  describe('Conditional Rendering Logic', () => {
    it('renders PromptInput when isProcessing is false', () => {
      /**
       * BUG IT CATCHES: If someone accidentally swaps the conditional
       * (e.g., changes `if (promptOptimizer.isProcessing)` to `if (!promptOptimizer.isProcessing)`),
       * this test will fail because PromptInput won't be found.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
      expect(screen.queryByText(/w-full max-w-4xl/)).not.toBeInTheDocument(); // LoadingSkeleton structure
    });

    it('renders LoadingSkeleton when isProcessing is true', () => {
      /**
       * BUG IT CATCHES: If the conditional logic is broken or removed entirely,
       * this test will fail. It specifically checks that:
       * 1. LoadingSkeleton container is present
       * 2. PromptInput is NOT rendered
       * This ensures the component doesn't accidentally render both or neither.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // LoadingSkeleton has this specific class structure
      const skeleton = screen.getByText((content, element) => {
        return element?.className?.includes('animate-pulse') || false;
      });
      expect(skeleton).toBeInTheDocument();

      // PromptInput should NOT be rendered
      expect(screen.queryByTestId('prompt-input')).not.toBeInTheDocument();
    });

    it('does not render PromptInput when LoadingSkeleton is shown', () => {
      /**
       * BUG IT CATCHES: Ensures mutual exclusivity. If someone accidentally
       * renders both components (e.g., by removing the if/else structure),
       * this test will catch it.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Explicitly verify PromptInput is NOT called/rendered
      expect(PromptInput).not.toHaveBeenCalled();
    });
  });

  /**
   * TEST CATEGORY 2: Prop Passing to PromptInput
   * These tests verify that ALL props are correctly passed to PromptInput
   * with exact values from context and component props.
   */
  describe('Prop Passing to PromptInput', () => {
    beforeEach(() => {
      // Reset mock to ensure clean call tracking
      PromptInput.mockClear();
    });

    it('passes all required props to PromptInput with correct values', () => {
      /**
       * BUG IT CATCHES: If any prop is missing or passed with wrong value,
       * this test will fail. This includes:
       * - Forgetting to pass a prop
       * - Passing wrong variable (e.g., inputPrompt instead of optimizedPrompt)
       * - Typos in prop names
       */
      const customPrompt = 'Custom test prompt';
      const customMode = 'reasoning';
      const customAIIndex = 1;

      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: customMode,
        currentAIIndex: customAIIndex,
        promptOptimizer: {
          inputPrompt: customPrompt,
          setInputPrompt: mockSetInputPrompt,
          isProcessing: false,
        },
      });

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      expect(PromptInput).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPrompt: customPrompt,
          onInputChange: mockSetInputPrompt,
          selectedMode: customMode,
          onModeChange: mockSetSelectedMode,
          onOptimize: mockOnOptimize,
          onShowBrainstorm: mockOnShowBrainstorm,
          isProcessing: false,
          modes: defaultMockState.modes,
          aiNames: mockAiNames,
          currentAIIndex: customAIIndex,
        }),
        expect.anything()
      );
    });

    it('passes onOptimize callback correctly', () => {
      /**
       * BUG IT CATCHES: If onOptimize is not passed, passed as undefined,
       * or passed with wrong function reference, this test fails.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];
      expect(passedProps.onOptimize).toBe(mockOnOptimize);
      expect(passedProps.onOptimize).toBeDefined();
      expect(typeof passedProps.onOptimize).toBe('function');
    });

    it('passes onShowBrainstorm callback correctly', () => {
      /**
       * BUG IT CATCHES: If onShowBrainstorm is not passed, passed as undefined,
       * or passed with wrong function reference, this test fails.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];
      expect(passedProps.onShowBrainstorm).toBe(mockOnShowBrainstorm);
      expect(passedProps.onShowBrainstorm).toBeDefined();
      expect(typeof passedProps.onShowBrainstorm).toBe('function');
    });

    it('passes context values from usePromptState correctly', () => {
      /**
       * BUG IT CATCHES: If context values are not extracted correctly from
       * usePromptState, or if wrong properties are accessed (e.g., using
       * state.selectedMode instead of destructured selectedMode), this fails.
       */
      const contextState = {
        selectedMode: 'socratic',
        setSelectedMode: mockSetSelectedMode,
        modes: [{ id: 'socratic', name: 'Socratic' }],
        currentAIIndex: 2,
        promptOptimizer: {
          inputPrompt: 'Context prompt',
          setInputPrompt: mockSetInputPrompt,
          isProcessing: false,
        },
      };

      usePromptState.mockReturnValue(contextState);

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];
      expect(passedProps.selectedMode).toBe('socratic');
      expect(passedProps.onModeChange).toBe(mockSetSelectedMode);
      expect(passedProps.modes).toEqual([{ id: 'socratic', name: 'Socratic' }]);
      expect(passedProps.currentAIIndex).toBe(2);
      expect(passedProps.inputPrompt).toBe('Context prompt');
      expect(passedProps.onInputChange).toBe(mockSetInputPrompt);
    });

    it('passes isProcessing as false to PromptInput when not processing', () => {
      /**
       * BUG IT CATCHES: If isProcessing is hardcoded or not passed from context,
       * this test will fail. Ensures the prop reflects actual state.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];
      expect(passedProps.isProcessing).toBe(false);
    });

    it('passes aiNames prop through to PromptInput', () => {
      /**
       * BUG IT CATCHES: If aiNames is forgotten or passed with wrong reference,
       * this test will fail.
       */
      const customAiNames = ['Model1', 'Model2', 'Model3'];

      render(
        <PromptInputSection
          aiNames={customAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];
      expect(passedProps.aiNames).toBe(customAiNames);
      expect(passedProps.aiNames).toHaveLength(3);
    });
  });

  /**
   * TEST CATEGORY 3: Mode-Specific Skeleton Rendering
   * These tests verify that the correct skeleton variant is rendered
   * based on the selectedMode value.
   */
  describe('Mode-Specific Skeleton Rendering', () => {
    beforeEach(() => {
      // Set isProcessing to true for all skeleton tests
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });
    });

    it('renders VideoModeSkeleton when selectedMode is "video"', () => {
      /**
       * BUG IT CATCHES: If the mode check is wrong (e.g., using === 'standard'
       * instead of === 'video'), or if the skeleton is accidentally swapped,
       * this test will fail by checking for the unique element count (7 lines
       * in the first group for video mode).
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'video',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // VideoModeSkeleton has 7 skeleton lines in first space-y-2 div
      const skeletonLines = container.querySelectorAll('.space-y-2:first-child .h-3');
      expect(skeletonLines.length).toBe(7);
    });

    it('renders ResearchModeSkeleton when selectedMode is "research"', () => {
      /**
       * BUG IT CATCHES: If wrong skeleton is rendered for research mode,
       * this test will fail. ResearchModeSkeleton has a specific structure
       * with 6 lines in its nested ml-2 section.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'research',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // ResearchModeSkeleton has 6 lines in its .ml-2 section
      const mlSection = container.querySelector('.ml-2');
      const linesInMlSection = mlSection?.querySelectorAll('.h-3');
      expect(linesInMlSection?.length).toBe(6);
    });

    it('renders SocraticModeSkeleton when selectedMode is "socratic"', () => {
      /**
       * BUG IT CATCHES: If wrong skeleton is rendered for socratic mode,
       * this test will fail. SocraticModeSkeleton has 3 sections with
       * 3, 4, and 5 lines respectively (mapped from [3, 4, 5] array).
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'socratic',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // SocraticModeSkeleton creates 3 sections, each with space-y-1.5 and ml-2
      // It maps over [3, 4, 5] to create sections with those line counts
      const mlSections = container.querySelectorAll('.ml-2.space-y-1\\.5');
      expect(mlSections.length).toBe(3);

      // Verify line counts in each section: 3, 4, 5
      expect(mlSections[0].querySelectorAll('.h-3').length).toBe(3);
      expect(mlSections[1].querySelectorAll('.h-3').length).toBe(4);
      expect(mlSections[2].querySelectorAll('.h-3').length).toBe(5);
    });

    it('renders ReasoningModeSkeleton when selectedMode is "reasoning"', () => {
      /**
       * BUG IT CATCHES: If wrong skeleton is rendered for reasoning mode,
       * this test will fail. ReasoningModeSkeleton has 4 skeleton lines
       * in its last .ml-2 section.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'reasoning',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // ReasoningModeSkeleton has multiple .ml-2 sections, last one has 4 lines
      const mlSections = container.querySelectorAll('.ml-2');
      const lastSection = mlSections[mlSections.length - 1];
      const linesInLastSection = lastSection?.querySelectorAll('.h-3');
      expect(linesInLastSection?.length).toBe(4);
    });

    it('renders StandardModeSkeleton when selectedMode is "optimize" (default)', () => {
      /**
       * BUG IT CATCHES: If the default case is broken or if wrong skeleton
       * is rendered for standard mode, this test will fail. StandardModeSkeleton
       * has 4 lines in its .ml-2 section.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'optimize',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // StandardModeSkeleton has 4 lines in its .ml-2 section
      const mlSection = container.querySelector('.ml-2');
      const linesInMlSection = mlSection?.querySelectorAll('.h-3');
      expect(linesInMlSection?.length).toBe(4);
    });

    it('renders StandardModeSkeleton for unknown mode (fallback)', () => {
      /**
       * BUG IT CATCHES: If the fallback case is removed or broken,
       * this test will fail. Ensures unknown modes gracefully fall back
       * to StandardModeSkeleton.
       */
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'unknown-mode',
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Should render StandardModeSkeleton (4 lines in .ml-2)
      const mlSection = container.querySelector('.ml-2');
      const linesInMlSection = mlSection?.querySelectorAll('.h-3');
      expect(linesInMlSection?.length).toBe(4);
    });
  });

  /**
   * TEST CATEGORY 4: Context Integration
   * These tests verify that the component correctly uses values from
   * the usePromptState context and responds to context changes.
   */
  describe('Context Integration', () => {
    it('calls usePromptState hook on render', () => {
      /**
       * BUG IT CATCHES: If the usePromptState hook is not called,
       * or called conditionally, this test will fail.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      expect(usePromptState).toHaveBeenCalled();
    });

    it('uses selectedMode from context for rendering decision', () => {
      /**
       * BUG IT CATCHES: If selectedMode is not used from context, or if
       * it's hardcoded, this test will fail when we change the context value.
       */
      const { rerender } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Initially should pass 'optimize' to PromptInput
      expect(PromptInput.mock.calls[0][0].selectedMode).toBe('optimize');

      // Change context
      usePromptState.mockReturnValue({
        ...defaultMockState,
        selectedMode: 'video',
      });

      rerender(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Should now pass 'video' to PromptInput
      expect(PromptInput.mock.calls[1][0].selectedMode).toBe('video');
    });

    it('uses isProcessing from context.promptOptimizer for conditional rendering', () => {
      /**
       * BUG IT CATCHES: If isProcessing is not read from context, or if
       * it's read from wrong place (e.g., directly from context instead of
       * context.promptOptimizer), this test will fail.
       */
      const { rerender } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Should render PromptInput when not processing
      expect(screen.getByTestId('prompt-input')).toBeInTheDocument();

      // Change to processing
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });

      rerender(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Should now render LoadingSkeleton
      expect(screen.queryByTestId('prompt-input')).not.toBeInTheDocument();
      const skeleton = screen.getByText((content, element) => {
        return element?.className?.includes('animate-pulse') || false;
      });
      expect(skeleton).toBeInTheDocument();
    });

    it('uses inputPrompt from context.promptOptimizer', () => {
      /**
       * BUG IT CATCHES: If inputPrompt is not extracted from
       * context.promptOptimizer correctly, this test will fail.
       */
      const testPrompt = 'Test prompt from context';
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          inputPrompt: testPrompt,
        },
      });

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      expect(PromptInput.mock.calls[0][0].inputPrompt).toBe(testPrompt);
    });

    it('uses setInputPrompt from context.promptOptimizer', () => {
      /**
       * BUG IT CATCHES: If setInputPrompt is not extracted from
       * context.promptOptimizer, or if a different function is passed,
       * this test will fail.
       */
      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      expect(PromptInput.mock.calls[0][0].onInputChange).toBe(mockSetInputPrompt);
    });

    it('passes all context values without modification', () => {
      /**
       * BUG IT CATCHES: If context values are accidentally transformed,
       * hardcoded, or replaced with different values, this test will fail.
       */
      const specificContext = {
        selectedMode: 'research',
        setSelectedMode: mockSetSelectedMode,
        modes: [
          { id: 'research', name: 'Research', icon: 'icon' },
          { id: 'video', name: 'Video', icon: 'icon2' },
        ],
        currentAIIndex: 3,
        promptOptimizer: {
          inputPrompt: 'Specific prompt',
          setInputPrompt: mockSetInputPrompt,
          isProcessing: false,
        },
      };

      usePromptState.mockReturnValue(specificContext);

      render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const passedProps = PromptInput.mock.calls[0][0];

      // Verify exact reference equality (not just value equality)
      expect(passedProps.modes).toBe(specificContext.modes);
      expect(passedProps.onModeChange).toBe(specificContext.setSelectedMode);
      expect(passedProps.onInputChange).toBe(specificContext.promptOptimizer.setInputPrompt);

      // Verify exact values
      expect(passedProps.selectedMode).toBe('research');
      expect(passedProps.currentAIIndex).toBe(3);
      expect(passedProps.inputPrompt).toBe('Specific prompt');
    });
  });

  /**
   * TEST CATEGORY 5: Animation and Styling
   * These tests verify that loading animations and styling classes
   * are correctly applied.
   */
  describe('Animation and Styling', () => {
    beforeEach(() => {
      usePromptState.mockReturnValue({
        ...defaultMockState,
        promptOptimizer: {
          ...defaultMockState.promptOptimizer,
          isProcessing: true,
        },
      });
    });

    it('applies animate-pulse class to LoadingSkeleton', () => {
      /**
       * BUG IT CATCHES: If the animate-pulse class is removed or
       * renamed, this test will fail. Ensures skeleton has pulsing animation.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const pulsingElement = container.querySelector('.animate-pulse');
      expect(pulsingElement).toBeInTheDocument();
      expect(pulsingElement?.className).toContain('animate-pulse');
    });

    it('includes shimmer animation element in LoadingSkeleton', () => {
      /**
       * BUG IT CATCHES: If the shimmer effect div is removed, this test
       * will fail. Verifies the presence of the animated shimmer overlay.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      // Shimmer has specific classes: absolute inset-0 -translate-x-full
      const shimmer = container.querySelector('.absolute.inset-0.-translate-x-full');
      expect(shimmer).toBeInTheDocument();
    });

    it('applies gradient background to LoadingSkeleton', () => {
      /**
       * BUG IT CATCHES: If the gradient classes are removed or changed,
       * this test will fail. Ensures skeleton has proper styling.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const gradientElement = container.querySelector('.bg-gradient-to-r.from-neutral-100');
      expect(gradientElement).toBeInTheDocument();
    });

    it('applies custom animation duration to LoadingSkeleton', () => {
      /**
       * BUG IT CATCHES: If the custom animationDuration style is removed,
       * this test will fail. Verifies skeleton has 1.5s pulse duration.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const pulsingElement = container.querySelector('.animate-pulse');
      expect(pulsingElement).toHaveStyle({ animationDuration: '1.5s' });
    });

    it('applies border and rounded styling to LoadingSkeleton', () => {
      /**
       * BUG IT CATCHES: If border or border-radius classes are removed,
       * this test will fail. Ensures skeleton has proper visual borders.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const skeleton = container.querySelector('.border.border-neutral-200.rounded-xl');
      expect(skeleton).toBeInTheDocument();
    });

    it('uses relative positioning for skeleton content', () => {
      /**
       * BUG IT CATCHES: If the relative class is removed from the inner
       * space-y-6 div, the shimmer effect may not work correctly. This
       * test ensures proper layering.
       */
      const { container } = render(
        <PromptInputSection
          aiNames={mockAiNames}
          onOptimize={mockOnOptimize}
          onShowBrainstorm={mockOnShowBrainstorm}
        />
      );

      const relativeContainer = container.querySelector('.relative.space-y-6');
      expect(relativeContainer).toBeInTheDocument();
    });
  });
});
