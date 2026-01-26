/**
 * StartingPointSelector Component
 *
 * Allows users to choose how to start the convergence flow.
 */

import React, { useCallback, useState } from 'react';
import { Layers, Sparkles, Upload } from 'lucide-react';

import { cn } from '@/utils/cn';
import { STARTING_POINT_OPTIONS, type StartingPointMode } from '@/features/convergence/types';
import { EstimatedCostBadge } from '../shared';
import { ImageUploader } from './ImageUploader';

const iconMap: Record<StartingPointMode, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  quick: Sparkles,
  converge: Layers,
};

export interface StartingPointSelectorProps {
  intent: string;
  onSelect: (mode: StartingPointMode, imageUrl?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const StartingPointSelector: React.FC<StartingPointSelectorProps> = ({
  intent,
  onSelect,
  isLoading,
  disabled = false,
}) => {
  const [selectedMode, setSelectedMode] = useState<StartingPointMode | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const handleModeSelect = useCallback(
    (mode: StartingPointMode) => {
      setSelectedMode(mode);

      if (mode !== 'upload') {
        onSelect(mode);
      }
    },
    [onSelect]
  );

  const handleImageUploaded = useCallback((url: string) => {
    setUploadedImageUrl(url);
  }, []);

  const handleUploadConfirm = useCallback(() => {
    if (uploadedImageUrl) {
      onSelect('upload', uploadedImageUrl);
    }
  }, [uploadedImageUrl, onSelect]);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          How would you like to start?
        </h2>
        <p className="text-sm text-muted">
          Pick the best starting point for your visual exploration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STARTING_POINT_OPTIONS.map((option) => {
          const Icon = iconMap[option.id];
          const isSelected = selectedMode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleModeSelect(option.id)}
              disabled={disabled || isLoading}
              className={cn(
                'relative flex flex-col text-left rounded-xl border p-5 transition-all',
                'bg-surface-2 border-border hover:border-primary/50 hover:bg-primary/5',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                isSelected && 'border-primary bg-primary/10',
                (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="h-6 w-6 text-primary mb-4" aria-hidden="true" />
              <h3 className="text-base font-semibold text-foreground mb-2">
                {option.label}
              </h3>
              <p className="text-sm text-muted mb-4">
                {option.description}
              </p>
              <EstimatedCostBadge
                estimatedCost={option.creditCost}
                size="sm"
                variant="subtle"
                showTooltip={false}
                className="self-start"
              />
            </button>
          );
        })}
      </div>

      {selectedMode === 'upload' && (
        <div className="mt-8">
          <ImageUploader
            onImageUploaded={handleImageUploaded}
            onConfirm={handleUploadConfirm}
            uploadedUrl={uploadedImageUrl}
            isLoading={isLoading}
            disabled={disabled}
          />
        </div>
      )}

      {!selectedMode && intent.trim().length > 0 && (
        <p className="text-xs text-muted text-center mt-6">
          Your intent will guide the quick and exploration paths.
        </p>
      )}
    </div>
  );
};

export default StartingPointSelector;
