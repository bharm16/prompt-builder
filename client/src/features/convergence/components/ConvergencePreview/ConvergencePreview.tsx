/**
 * ConvergencePreview Component
 *
 * Final preview screen showing the completed convergence flow results.
 * Displays the preview video/image, final prompt, dimension summary,
 * credits consumed, and action buttons for generation or editing.
 *
 * Features:
 * - Preview display with video or image
 * - PromptDisplay showing final prompt
 * - DimensionSummary with locked selections as badges
 * - TotalCreditsSummary showing credits consumed
 * - GenerateNowButton with model cost
 * - EditInStudioButton for handoff to Studio
 * - ModelCostTable showing all model costs
 *
 * @requirement 8.1 - Return complete prompt, locked dimensions, preview image URL
 * @requirement 8.5 - Call existing video generation API with finalized prompt
 * @requirement 17.2 - Switch to Studio mode with converged prompt pre-filled
 */

import React, { useState, useCallback } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Direction, FinalizeSessionResponse } from '@/features/convergence/types';
import { PromptDisplay } from './PromptDisplay';
import { DimensionSummary } from './DimensionSummary';
import { TotalCreditsSummary } from './TotalCreditsSummary';
import { GenerateNowButton } from './GenerateNowButton';
import { EditInStudioButton } from './EditInStudioButton';
import { ModelCostTable } from './ModelCostTable';
import { BackButton } from '../shared';

// ============================================================================
// Types
// ============================================================================

export interface ConvergencePreviewProps {
  /** Finalize response from the API */
  finalizeResponse: FinalizeSessionResponse;
  /** Direction selection */
  direction?: Direction | null;
  /** Preview video URL (from subject motion preview) */
  previewVideoUrl?: string | null;
  /** Selected model for generation */
  selectedModel: string;
  /** Selected aspect ratio */
  aspectRatio: string;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when back is clicked */
  onBack?: () => void;
  /** Callback when generation starts */
  onGenerationStart?: () => void;
  /** Callback when generation completes */
  onGenerationComplete?: (videoUrl: string) => void;
  /** Callback when generation fails */
  onGenerationError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default generation costs if not provided
 */
const DEFAULT_GENERATION_COSTS: Record<string, number> = {
  'sora-2': 80,
  'veo-3': 30,
  'kling-v2.1': 35,
  'luma-ray-3': 40,
  'wan-2.2': 15,
  'runway-gen4': 50,
};

// ============================================================================
// Component
// ============================================================================

/**
 * ConvergencePreview - Final preview screen for convergence flow
 *
 * @example
 * ```tsx
 * <ConvergencePreview
 *   finalizeResponse={response}
 *   direction="cinematic"
 *   selectedModel="sora-2"
 *   aspectRatio="16:9"
 *   onGenerationComplete={(url) => navigate('/generations')}
 * />
 * ```
 */
export const ConvergencePreview: React.FC<ConvergencePreviewProps> = ({
  finalizeResponse,
  direction,
  previewVideoUrl,
  selectedModel,
  aspectRatio,
  isLoading = false,
  error,
  onBack,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError,
  className,
}) => {
  const [showModelCosts, setShowModelCosts] = useState(false);

  const {
    finalPrompt,
    lockedDimensions,
    previewImageUrl,
    cameraMotion,
    subjectMotion,
    totalCreditsConsumed,
    generationCosts,
  } = finalizeResponse;

  // Use provided generation costs or defaults
  const costs = generationCosts && Object.keys(generationCosts).length > 0
    ? generationCosts
    : DEFAULT_GENERATION_COSTS;

  // Get cost for selected model
  const modelCost = costs[selectedModel] ?? costs['wan-2.2'] ?? 15;

  /**
   * Toggle model costs visibility
   */
  const toggleModelCosts = useCallback(() => {
    setShowModelCosts((prev) => !prev);
  }, []);

  const isDisabled = isLoading;

  return (
    <div
      className={cn(
        'flex flex-col w-full max-w-4xl mx-auto px-4 py-6',
        className
      )}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        {/* Title with icon */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10"
            aria-hidden="true"
          >
            <Sparkles className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Ready to Generate
            </h2>
            <p className="text-sm text-muted">
              Review your selections and generate your video
            </p>
          </div>
        </div>
      </div>

      {/* Preview Display (Task 25.1) */}
      <div className="mb-6">
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          {previewVideoUrl ? (
            // Video preview (from subject motion)
            <video
              src={previewVideoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              aria-label="Preview video"
            >
              Your browser does not support the video tag.
            </video>
          ) : previewImageUrl ? (
            // Image preview (last generated image)
            <img
              src={previewImageUrl}
              alt="Preview of your video"
              className="w-full h-full object-contain"
            />
          ) : (
            // Placeholder
            <div className="flex items-center justify-center w-full h-full bg-surface-2">
              <p className="text-muted">No preview available</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Prompt Display (Task 25.2) */}
          <PromptDisplay
            prompt={finalPrompt}
            defaultCollapsed={true}
            collapsedLines={4}
          />

          {/* Dimension Summary (Task 25.3) */}
          <DimensionSummary
            direction={direction}
            lockedDimensions={lockedDimensions}
            cameraMotion={cameraMotion}
            subjectMotion={subjectMotion}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Total Credits Summary (Task 25.4) */}
          <TotalCreditsSummary totalCreditsConsumed={totalCreditsConsumed} />

          {/* Model Costs Toggle (Task 25.7) - Touch-friendly tap target (Task 35.4) */}
          <div>
            <button
              type="button"
              onClick={toggleModelCosts}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 min-h-[44px]',
                'rounded-lg border border-border bg-surface-1',
                'text-sm font-medium text-foreground',
                'transition-all duration-200',
                'hover:bg-surface-2'
              )}
              aria-expanded={showModelCosts}
            >
              <span>View All Model Costs</span>
              {showModelCosts ? (
                <ChevronUp className="w-4 h-4 text-muted" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
              )}
            </button>

            {/* Model Cost Table (Task 25.7) */}
            {showModelCosts && (
              <div className="mt-3">
                <ModelCostTable
                  generationCosts={costs}
                  selectedModel={selectedModel}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Back Button */}
        <BackButton
          onBack={onBack ?? undefined}
          disabled={isDisabled}
          size="md"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Edit in Studio Button (Task 25.6) */}
        <EditInStudioButton
          prompt={finalPrompt}
          lockedDimensions={lockedDimensions}
          previewImageUrl={previewImageUrl}
          cameraMotion={cameraMotion}
          subjectMotion={subjectMotion}
          disabled={isDisabled}
        />

        {/* Generate Now Button (Task 25.5) */}
        <GenerateNowButton
          prompt={finalPrompt}
          selectedModel={selectedModel}
          aspectRatio={aspectRatio}
          modelCost={modelCost}
          lockedDimensions={lockedDimensions}
          cameraMotion={cameraMotion}
          subjectMotion={subjectMotion}
          previewImageUrl={previewImageUrl}
          disabled={isDisabled}
          onGenerationStart={onGenerationStart}
          onGenerationComplete={onGenerationComplete}
          onGenerationError={onGenerationError}
        />
      </div>

      {/* Keyboard Navigation Hint */}
      {!isLoading && (
        <p className="text-xs text-muted text-center mt-6">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">
            Escape
          </kbd>{' '}
          to go back
        </p>
      )}
    </div>
  );
};

ConvergencePreview.displayName = 'ConvergencePreview';

export default ConvergencePreview;
