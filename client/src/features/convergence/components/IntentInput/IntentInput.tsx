/**
 * IntentInput Component
 *
 * The initial input component for the Visual Convergence flow.
 * Styled to match Runway's minimal aesthetic.
 *
 * @requirement 16.7 - Display IntentInput when no session is active
 * @requirement 15.1 - Display estimated total credit cost for completion
 */

import React, { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Lightbulb, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@promptstudio/system/components/ui/button';
import { cn } from '@/utils/cn';

import { EstimatedCostBadge } from '../shared';

// ============================================================================
// Example Prompts
// ============================================================================

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
  value?: string;
  onChange?: (value: string) => void;
  onSubmit: (intent: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const IntentInput: React.FC<IntentInputProps> = ({
  value: controlledValue,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Describe your video concept... e.g., "A lone astronaut exploring an alien planet at sunset"',
  className,
  disabled = false,
}) => {
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
        'flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-6 py-16',
        className
      )}
    >
      {/* Header - Runway uses light serif italic */}
      <div className="text-center mb-12">
        <h1 className="text-[32px] font-light italic text-white tracking-[-0.02em] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          Create Your Video
        </h1>
        <p className="text-[#71717a] text-[15px]">
          Describe your vision and we'll guide you through visual choices to bring it to life.
        </p>
      </div>

      {/* Main Input Area */}
      <div className="w-full space-y-5">
        {/* Textarea - Runway style: minimal, no visible container */}
        <div className="relative">
          <textarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={4}
            className={cn(
              'w-full resize-none bg-transparent',
              'border-0 border-b border-white/[0.05]',
              'px-0 py-4 text-white/90 text-[15px] leading-relaxed',
              'placeholder:text-[#3f3f46]',
              'focus:outline-none focus:border-white/[0.12]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150'
            )}
            aria-label="Video concept description"
          />
        </div>

        {/* Submit Row */}
        <div className="flex items-center justify-between gap-4 pt-2">
          {/* Cost Badge - very subtle */}
          <EstimatedCostBadge
            size="sm"
            variant="subtle"
            showTooltip={true}
          />

          {/* Submit Button - Runway purple */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={cn(
              'gap-2 px-5 h-10 rounded-lg font-medium text-[14px]',
              'bg-[#7c3aed] text-white border-0',
              'hover:bg-[#8b5cf6]',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-colors duration-150'
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

        {/* Helper text - very subtle */}
        <p className="text-[12px] text-[#3f3f46] text-center">
          Press Enter to submit
        </p>
      </div>

      {/* Example Prompts - Runway style: nearly invisible chips */}
      <div className="w-full mt-14">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-3.5 w-3.5 text-[#3f3f46]" aria-hidden="true" />
          <span className="text-[13px] text-[#3f3f46]">Try an example</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              disabled={isLoading || disabled}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[13px]',
                'bg-transparent text-[#52525b]',
                // Runway-style: nearly invisible border
                'border border-white/[0.04]',
                'hover:bg-white/[0.04] hover:text-[#71717a]',
                'focus:outline-none',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'transition-all duration-150'
              )}
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
