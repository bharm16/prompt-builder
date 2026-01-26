/**
 * GenerateNowButton Component
 *
 * Button to trigger final video generation with the converged prompt.
 * Shows the selected model and its credit cost.
 *
 * @requirement 8.5 - Call existing video generation API with finalized prompt
 * @requirement 8.6 - Pass converged prompt to VideoGenerationService
 * @requirement 15.4 - Display final generation cost for each model
 */

import React, { useState, useCallback } from 'react';
import { Play, Loader2, Coins, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { generateVideoPreview } from '@/features/preview/api/previewApi';
import type { LockedDimension } from '@/features/convergence/types';

// ============================================================================
// Types
// ============================================================================

export interface GenerateNowButtonProps {
  /** The final prompt to use for generation */
  prompt: string;
  /** Selected video generation model */
  selectedModel: string;
  /** Selected aspect ratio */
  aspectRatio: string;
  /** Credit cost for the selected model */
  modelCost: number;
  /** Locked dimensions metadata to pass to generation */
  lockedDimensions?: LockedDimension[] | undefined;
  /** Camera motion selection */
  cameraMotion?: string | null | undefined;
  /** Subject motion description */
  subjectMotion?: string | null | undefined;
  /** Preview image URL to use as reference */
  previewImageUrl?: string | undefined;
  /** Whether the button is disabled */
  disabled?: boolean | undefined;
  /** Callback when generation starts */
  onGenerationStart?: (() => void) | undefined;
  /** Callback when generation completes successfully */
  onGenerationComplete?: ((videoUrl: string) => void) | undefined;
  /** Callback when generation fails */
  onGenerationError?: ((error: string) => void) | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
}

// ============================================================================
// Component
// ============================================================================

/**
 * GenerateNowButton - Triggers final video generation
 *
 * @example
 * ```tsx
 * <GenerateNowButton
 *   prompt="A cinematic shot of a cat..."
 *   selectedModel="sora-2"
 *   aspectRatio="16:9"
 *   modelCost={80}
 *   onGenerationComplete={(url) => navigate('/generations')}
 * />
 * ```
 */
export const GenerateNowButton: React.FC<GenerateNowButtonProps> = ({
  prompt,
  selectedModel,
  aspectRatio,
  modelCost,
  lockedDimensions,
  cameraMotion,
  subjectMotion,
  previewImageUrl,
  disabled = false,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError,
  className,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle generate button click
   */
  const handleGenerate = useCallback(async () => {
    if (isGenerating || disabled || !prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    onGenerationStart?.();

    try {
      // Build generation options with convergence metadata
      const options: {
        startImage?: string;
        generationParams?: Record<string, unknown>;
      } = {};

      // Use preview image as reference if available
      if (previewImageUrl) {
        options.startImage = previewImageUrl;
      }

      // Pass convergence metadata as generation params
      const convergenceMetadata: Record<string, unknown> = {
        source: 'convergence',
      };

      if (lockedDimensions && lockedDimensions.length > 0) {
        convergenceMetadata.lockedDimensions = lockedDimensions.map((d) => ({
          type: d.type,
          optionId: d.optionId,
          label: d.label,
        }));
      }

      if (cameraMotion) {
        convergenceMetadata.cameraMotion = cameraMotion;
      }

      if (subjectMotion) {
        convergenceMetadata.subjectMotion = subjectMotion;
      }

      options.generationParams = convergenceMetadata;

      // Call the video generation API
      const response = await generateVideoPreview(
        prompt,
        aspectRatio,
        selectedModel,
        Object.keys(options).length > 0 ? options : undefined
      );

      if (response.success && response.videoUrl) {
        onGenerationComplete?.(response.videoUrl);
      } else if (response.success && response.jobId) {
        // Job started - the caller should handle polling
        onGenerationComplete?.(response.jobId);
      } else {
        throw new Error(response.error || response.message || 'Failed to start video generation');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate video';
      setError(errorMessage);
      onGenerationError?.(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    disabled,
    prompt,
    selectedModel,
    aspectRatio,
    previewImageUrl,
    lockedDimensions,
    cameraMotion,
    subjectMotion,
    onGenerationStart,
    onGenerationComplete,
    onGenerationError,
  ]);

  const isDisabled = disabled || isGenerating || !prompt.trim();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Main Button - Touch-friendly tap target (Task 35.4) */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px]',
          'rounded-lg font-semibold text-base',
          'bg-primary text-primary-foreground',
          'transition-all duration-200',
          !isDisabled && 'hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={`Generate video for ${modelCost} credits`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" aria-hidden="true" />
            <span>Generate Now</span>
            {/* Cost Badge */}
            <span
              className="inline-flex items-center gap-1 ml-2 px-2.5 py-1 rounded-full bg-white/20 text-sm"
              aria-label={`Costs ${modelCost} credits`}
            >
              <Coins className="w-4 h-4" aria-hidden="true" />
              {modelCost}
            </span>
          </>
        )}
      </button>

      {/* Model Info */}
      <p className="text-xs text-muted text-center">
        Using <span className="font-medium text-foreground">{selectedModel}</span> at{' '}
        <span className="font-medium text-foreground">{aspectRatio}</span>
      </p>

      {/* Error Display */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

GenerateNowButton.displayName = 'GenerateNowButton';

export default GenerateNowButton;
