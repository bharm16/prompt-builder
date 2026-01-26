/**
 * ModelCostTable Component
 *
 * Displays a table of all available video generation models and their costs.
 * Helps users understand the credit cost for final video generation.
 *
 * @requirement 15.4 - Display final generation cost for each available model
 */

import React from 'react';
import { cn } from '@/utils/cn';
import { Coins, Zap, Star, Clock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ModelCostTableProps {
  /** Map of model ID to credit cost */
  generationCosts: Record<string, number>;
  /** Currently selected model (to highlight) */
  selectedModel?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Model display names and metadata
 */
const MODEL_INFO: Record<string, { name: string; description: string; badge?: string }> = {
  'sora-2': {
    name: 'Sora 2',
    description: 'OpenAI\'s flagship video model',
    badge: 'Premium',
  },
  'veo-3': {
    name: 'Veo 3',
    description: 'Google\'s latest video generation',
    badge: 'New',
  },
  'kling-v2.1': {
    name: 'Kling v2.1',
    description: 'High-quality cinematic output',
  },
  'luma-ray-3': {
    name: 'Luma Ray 3',
    description: 'Fast and efficient generation',
  },
  'wan-2.2': {
    name: 'Wan 2.2',
    description: 'Budget-friendly option',
    badge: 'Value',
  },
  'runway-gen4': {
    name: 'Runway Gen-4',
    description: 'Professional-grade results',
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * ModelCostTable - Shows all model costs
 *
 * @example
 * ```tsx
 * <ModelCostTable
 *   generationCosts={{
 *     'sora-2': 80,
 *     'veo-3': 30,
 *     'wan-2.2': 15,
 *   }}
 *   selectedModel="sora-2"
 * />
 * ```
 */
export const ModelCostTable: React.FC<ModelCostTableProps> = ({
  generationCosts,
  selectedModel,
  className,
}) => {
  // Sort models by cost (ascending)
  const sortedModels = Object.entries(generationCosts).sort(([, a], [, b]) => a - b);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface-1 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/50">
        <Zap className="w-4 h-4 text-muted" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Generation Costs</h3>
      </div>

      {/* Table */}
      <div className="divide-y divide-border">
        {sortedModels.map(([modelId, cost]) => {
          const info = MODEL_INFO[modelId] || {
            name: modelId,
            description: 'Video generation model',
          };
          const isSelected = selectedModel === modelId;

          return (
            <div
              key={modelId}
              className={cn(
                'flex items-center justify-between px-4 py-3',
                'transition-colors duration-200',
                isSelected && 'bg-primary/5'
              )}
            >
              {/* Model Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {info.name}
                    </span>
                    {info.badge && (
                      <ModelBadge badge={info.badge} />
                    )}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        <Star className="w-3 h-3" aria-hidden="true" />
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">{info.description}</p>
                </div>
              </div>

              {/* Cost */}
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'font-medium text-sm',
                  isSelected
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                )}
                role="status"
                aria-label={`${cost} credits`}
              >
                <Coins
                  className={cn(
                    'w-4 h-4',
                    isSelected ? 'text-primary' : 'text-amber-500'
                  )}
                  aria-hidden="true"
                />
                <span>{cost}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 bg-surface-2/30 border-t border-border">
        <p className="text-xs text-muted flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          Generation time varies by model. Premium models may take longer.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface ModelBadgeProps {
  badge: string;
}

/**
 * Badge for model features
 */
const ModelBadge: React.FC<ModelBadgeProps> = ({ badge }) => {
  const badgeStyles: Record<string, string> = {
    Premium: 'bg-purple-100 text-purple-700 border-purple-200',
    New: 'bg-green-100 text-green-700 border-green-200',
    Value: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border',
        badgeStyles[badge] || 'bg-gray-100 text-gray-700 border-gray-200'
      )}
    >
      {badge}
    </span>
  );
};

ModelCostTable.displayName = 'ModelCostTable';

export default ModelCostTable;
