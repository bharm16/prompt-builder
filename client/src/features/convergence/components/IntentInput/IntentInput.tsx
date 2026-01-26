/**
 * IntentInput Component
 *
 * The initial input component for the Visual Convergence flow.
 * Allows users to enter their creative intent and start a new session.
 *
 * Features:
 * - Text input with placeholder
 * - Example prompts that users can click to use
 * - Estimated cost badge showing ~22 credits
 * - Enter key to submit
 * - Loading state during session start
 *
 * @requirement 16.7 - Display IntentInput when no session is active
 * @requirement 15.1 - Display estimated total credit cost for completion
 */

import React, { useState, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import { Button } from '@promptstudio/system/components/ui/button';
import { Loader2, Sparkles, Lightbulb } from 'lucide-react';
import { EstimatedCostBadge } from '../shared';

// ============================================================================
// Example Prompts
// ============================================================================

/**
 * Example prompts to help users get started
 */
const EXAMPLE_PROMPTS = [
  'A lone astronaut exploring an alien planet at sunset',
  'A cozy coffee shop on a rainy day in Tokyo',
  'A majestic eagle soaring over snow-capped mountains',
  'A vintage car driving through a neon-lit city at night',
  'A dancer performing in an abandoned theater',
  'A mysterious forest with glowing mushrooms',
];

// ============================================================================
// Types
// ============================================================================

export interface IntentInputProps {
  /** Current intent value (controlled) */
  value?: string;
  /** Callback when intent value changes */
  onChange?: (value: string) => void;
  /** Callback when user submits the intent */
  onSubmit: (intent: string) => void;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * IntentInput - Initial input for the Visual Convergence flow
 *
 * @example
 * ```tsx
 * <IntentInput
 *   onSubmit={(intent) => actions.startSession(intent)}
 *   isLoading={state.isLoading}
 * />
 * ```
 */
export const IntentInput: React.FC<IntentInputProps> = ({
  value: controlledValue,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Describe your video concept... e.g., "A lone astronaut exploring an alien planet at sunset"',
  className,
  disabled = false,
}) => {
  // Use internal state if not controlled
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue ?? internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (onChange) {
        onChange(newValue);
      } else {
        setInternalValue(newValue);
      }
    },
    [onChange]
  );

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isLoading && !disabled) {
      onSubmit(trimmedValue);
    }
  }, [value, isLoading, disabled, onSubmit]);

  /**
   * Handle Enter key to submit (Task 19.4)
   * Shift+Enter creates a new line
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /**
   * Handle clicking an example prompt (Task 19.2)
   */
  const handleExampleClick = useCallback(
    (example: string) => {
      if (onChange) {
        onChange(example);
      } else {
        setInternalValue(example);
      }
    },
    [onChange]
  );

  const isSubmitDisabled = !value.trim() || isLoading || disabled;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4',
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Create Your Video
        </h1>
        <p className="text-muted text-sm">
          Describe your vision and we'll guide you through visual choices to bring it to life.
        </p>
      </div>

      {/* Main Input Area */}
      <div className="w-full space-y-4">
        {/* Text Input (Task 19.1) */}
        <div className="relative">
          <Textarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className={cn(
              'min-h-[120px] w-full resize-none rounded-lg',
              'border border-border bg-surface-1',
              'px-4 py-3 text-foreground text-base',
              'placeholder:text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200'
            )}
            aria-label="Video concept description"
            aria-describedby="intent-helper-text"
          />
          <p
            id="intent-helper-text"
            className="sr-only"
          >
            Press Enter to submit, Shift+Enter for new line
          </p>
        </div>

        {/* Submit Button and Cost Badge */}
        <div className="flex items-center justify-between gap-4">
          {/* Estimated Cost Badge (Task 19.3) */}
          <EstimatedCostBadge
            size="md"
            variant="subtle"
            showTooltip={true}
          />

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={cn(
              'gap-2 px-6 py-2 rounded-lg font-medium',
              'bg-accent text-white',
              'hover:bg-accent/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Start Creating</span>
              </>
            )}
          </Button>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-muted text-center">
          Press <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">Enter</kbd> to submit
        </p>
      </div>

      {/* Example Prompts Section (Task 19.2) */}
      <div className="w-full mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span className="text-sm font-medium text-muted">Try an example</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              disabled={isLoading || disabled}
              className={cn(
                // Touch-friendly tap targets: min 44px height (Task 35.4)
                'px-4 py-2.5 min-h-[44px] rounded-full text-sm',
                'bg-surface-2 text-foreground',
                'border border-border',
                'hover:bg-surface-3 hover:border-border-strong',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              aria-label={`Use example: ${example}`}
            >
              {example.length > 40 ? `${example.slice(0, 40)}...` : example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

IntentInput.displayName = 'IntentInput';

export default IntentInput;
