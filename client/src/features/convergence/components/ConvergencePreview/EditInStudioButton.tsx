/**
 * EditInStudioButton Component
 *
 * Button to switch to Studio mode with the converged prompt pre-filled.
 * Passes convergence handoff data via shared React context.
 *
 * @requirement 17.2 - Switch to Studio mode with converged prompt pre-filled
 * @requirement 17.3 - Preserve locked dimension metadata for reference
 * @requirement 17.6 - Pass data via shared React context
 */

import React, { useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppShell } from '@/contexts/AppShellContext';
import type { LockedDimension, ConvergenceHandoff } from '@/features/convergence/types';

// ============================================================================
// Types
// ============================================================================

export interface EditInStudioButtonProps {
  /** The final prompt to pass to Studio */
  prompt: string;
  /** Locked dimensions metadata */
  lockedDimensions: LockedDimension[];
  /** Preview image URL */
  previewImageUrl: string;
  /** Selected camera motion */
  cameraMotion: string;
  /** Subject motion description */
  subjectMotion: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * EditInStudioButton - Switches to Studio with handoff data
 *
 * @example
 * ```tsx
 * <EditInStudioButton
 *   prompt="A cinematic shot of a cat..."
 *   lockedDimensions={[...]}
 *   previewImageUrl="https://..."
 *   cameraMotion="pan_left"
 *   subjectMotion="Walking slowly"
 * />
 * ```
 */
export const EditInStudioButton: React.FC<EditInStudioButtonProps> = ({
  prompt,
  lockedDimensions,
  previewImageUrl,
  cameraMotion,
  subjectMotion,
  disabled = false,
  className,
}) => {
  const { setActiveTool, setConvergenceHandoff } = useAppShell();

  /**
   * Handle edit in studio click
   */
  const handleEditInStudio = useCallback(() => {
    if (disabled) {
      return;
    }

    // Create handoff data (Requirement 17.6)
    const handoff: ConvergenceHandoff = {
      prompt,
      lockedDimensions,
      previewImageUrl,
      cameraMotion,
      subjectMotion,
    };

    // Set handoff data in context (Task 25.6.1)
    setConvergenceHandoff(handoff);

    // Switch to Studio mode (Task 25.6.2)
    setActiveTool('studio');
  }, [
    disabled,
    prompt,
    lockedDimensions,
    previewImageUrl,
    cameraMotion,
    subjectMotion,
    setConvergenceHandoff,
    setActiveTool,
  ]);

  return (
    <button
      type="button"
      onClick={handleEditInStudio}
      disabled={disabled}
      className={cn(
        // Touch-friendly tap target: min 44px height (Task 35.4)
        'inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px]',
        'rounded-lg font-semibold text-base',
        'border-2 border-border bg-surface-1 text-foreground',
        'transition-all duration-200',
        !disabled && 'hover:bg-surface-2 hover:border-primary/30',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label="Edit prompt in Studio"
    >
      <Pencil className="w-5 h-5" aria-hidden="true" />
      <span>Edit in Studio</span>
    </button>
  );
};

EditInStudioButton.displayName = 'EditInStudioButton';

export default EditInStudioButton;
