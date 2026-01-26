/**
 * FinalFrameConfirmation Component
 *
 * Displays the final frame and confirms before camera motion.
 */

import React from 'react';
import { Check, RefreshCw, Upload } from 'lucide-react';

import { cn } from '@/utils/cn';
import { BackButton } from '../shared';

export interface FinalFrameConfirmationProps {
  imageUrl: string;
  regenerationCount: number;
  maxRegenerations: number;
  isLoading: boolean;
  isRegenerating: boolean;
  onConfirm: () => void;
  onRegenerate: () => void;
  onUploadNew: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export const FinalFrameConfirmation: React.FC<FinalFrameConfirmationProps> = ({
  imageUrl,
  regenerationCount,
  maxRegenerations,
  isLoading,
  isRegenerating,
  onConfirm,
  onRegenerate,
  onUploadNew,
  onBack,
  disabled = false,
}) => {
  const remainingRegenerations = Math.max(0, maxRegenerations - regenerationCount);
  const isDisabled = disabled || isLoading;
  const hasImage = Boolean(imageUrl);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4">
      <BackButton onBack={onBack} disabled={isDisabled} />

      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Confirm Your Starting Frame
        </h2>
        <p className="text-sm text-muted">
          This image will anchor the rest of your video motion.
        </p>
      </div>

      <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-2 border border-border">
        {hasImage ? (
          <img
            src={imageUrl}
            alt="Final frame preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isRegenerating && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isDisabled || remainingRegenerations <= 0}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'border border-border text-foreground',
            !isDisabled && 'hover:border-primary/50 hover:bg-primary/5',
            (isDisabled || remainingRegenerations <= 0) && 'opacity-60 cursor-not-allowed'
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Regenerate ({remainingRegenerations} left)
        </button>

        <button
          type="button"
          onClick={onUploadNew}
          disabled={isDisabled}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'border border-border text-foreground',
            !isDisabled && 'hover:border-primary/50 hover:bg-primary/5',
            isDisabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Change Starting Point
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isDisabled || !hasImage}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            (isDisabled || !hasImage) && 'opacity-60 cursor-not-allowed'
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Use This Frame
        </button>
      </div>
    </div>
  );
};

export default FinalFrameConfirmation;
