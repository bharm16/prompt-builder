import React, { type ReactElement, useCallback, useMemo } from 'react';
import { useModelRecommendation } from '../../hooks/useModelRecommendation';
import { useModelComparison } from '../../hooks/useModelComparison';
import { getModelLabel, normalizeModelIdForSelection } from '../../utils/modelLabels';
import type { ModelRecommendationProps } from './types';
import { ModelScoreCard } from './ModelScoreCard';
import { ModelComparison } from '../ModelComparison/ModelComparison';
import { cn } from '@/utils/cn';

const confidenceStyles: Record<string, string> = {
  high: 'bg-green-500/15 text-green-400',
  medium: 'bg-yellow-500/15 text-yellow-400',
  low: 'bg-zinc-500/20 text-zinc-300',
};

const reasonLabels: Record<string, string> = {
  missing_credentials: 'Missing credentials',
  unsupported_model: 'Unsupported',
  image_input_unsupported: 'No image input',
  insufficient_credits: 'Insufficient credits',
  not_entitled: 'Not entitled',
  video_generation_unavailable: 'Unavailable',
  unavailable: 'Unavailable',
};

const formatReason = (reason: string): string => reasonLabels[reason] ?? 'Unavailable';

export function ModelRecommendation({
  prompt,
  mode = 't2v',
  durationSeconds,
  onSelectModel,
  onCompareModels,
  className,
  recommendation: recommendationOverride,
  isLoading: isLoadingOverride,
  error: errorOverride,
}: ModelRecommendationProps): ReactElement | null {
  const hasExternal =
    recommendationOverride !== undefined ||
    isLoadingOverride !== undefined ||
    errorOverride !== undefined;

  const { recommendation: fetchedRecommendation, isLoading: fetchedLoading, error: fetchedError } =
    useModelRecommendation(prompt, {
      mode,
      durationSeconds,
      enabled: !hasExternal && Boolean(prompt && prompt.trim().length > 0),
    });

  const recommendation = hasExternal ? (recommendationOverride ?? null) : fetchedRecommendation;
  const isLoading = hasExternal ? Boolean(isLoadingOverride) : fetchedLoading;
  const error = hasExternal ? errorOverride ?? null : fetchedError;

  const summary = recommendation?.recommended;
  const efficient = recommendation?.alsoConsider;
  const filteredOut = recommendation?.filteredOut ?? [];
  const comparisonModels = recommendation?.suggestComparison ? recommendation?.comparisonModels : undefined;

  const { comparison, isOpen, openComparison, closeComparison } = useModelComparison({
    recommendations: recommendation?.recommendations,
    comparisonModels,
  });

  const handleSelectModel = useCallback(
    (modelId: string) => {
      onSelectModel(normalizeModelIdForSelection(modelId));
    },
    [onSelectModel]
  );

  const bestLabel = useMemo(
    () => (summary ? getModelLabel(summary.modelId) : ''),
    [summary]
  );

  const efficientLabel = useMemo(
    () => (efficient ? getModelLabel(efficient.modelId) : ''),
    [efficient]
  );

  const recommendedScore = useMemo(() => {
    if (!summary || !recommendation?.recommendations.length) return null;
    return (
      recommendation.recommendations.find((score) => score.modelId === summary.modelId) ??
      recommendation.recommendations[0]
    );
  }, [recommendation, summary]);

  const efficientScore = useMemo(() => {
    if (!efficient || !recommendation?.recommendations.length) return null;
    return recommendation.recommendations.find((score) => score.modelId === efficient.modelId) ?? null;
  }, [efficient, recommendation]);

  const requirementSummary = useMemo(() => {
    const req = recommendation?.requirements;
    if (req) {
      const labels: string[] = [];
      if (req.physics.hasComplexPhysics || req.physics.physicsComplexity === 'complex') {
        labels.push('Complex physics');
      }
      if (req.physics.hasParticleSystems) {
        labels.push('Particle effects');
      }
      if (req.character.requiresFacialPerformance) {
        labels.push('Facial performance');
      }
      if (req.environment.hasUrbanElements) {
        labels.push('Urban environment');
      }
      if (req.environment.hasNature) {
        labels.push('Natural environment');
      }
      if (req.lighting.requiresAtmospherics) {
        labels.push('Atmospherics');
      }
      if (req.style.isStylized) {
        labels.push('Stylized look');
      }
      if (req.motion.hasMorphing) {
        labels.push('Morphing');
      }
      if (labels.length) {
        return labels.slice(0, 2).join(', ');
      }
    }

    const topFactors = recommendation?.recommendations?.[0]?.factorScores ?? [];
    if (!topFactors.length) return null;
    const sorted = [...topFactors].sort((a, b) => b.contribution - a.contribution);
    const labels = sorted.slice(0, 2).map((factor) => factor.label);
    return labels.length ? labels.join(', ') : null;
  }, [recommendation]);

  const canCompare = useMemo(() => {
    if (!comparisonModels || !recommendation?.recommendations?.length) return false;
    const [leftId, rightId] = comparisonModels;
    const left = recommendation.recommendations.find((score) => score.modelId === leftId);
    const right = recommendation.recommendations.find((score) => score.modelId === rightId);
    return Boolean(left && right);
  }, [comparisonModels, recommendation]);

  const filteredSummary = useMemo(() => {
    if (!filteredOut.length) return null;
    const maxItems = 2;
    const entries = filteredOut.slice(0, maxItems).map((entry) => {
      const label = getModelLabel(entry.modelId);
      const reason = formatReason(entry.reason);
      return `${label} (${reason})`;
    });
    const extraCount = filteredOut.length - maxItems;
    const suffix = extraCount > 0 ? ` +${extraCount} more` : '';
    return `Unavailable: ${entries.join(', ')}${suffix}`;
  }, [filteredOut]);

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border border-[#29292D] bg-[#1E1F25] p-3', className)}>
        <div className="h-3 w-32 rounded bg-[#2A2B31] animate-pulse" />
        <div className="mt-2 h-6 w-full rounded bg-[#2A2B31] animate-pulse" />
      </div>
    );
  }

  if (error || !recommendation || !summary) {
    return null;
  }

  const confidenceKey = summary.confidence ?? 'low';
  const confidenceClass = confidenceStyles[confidenceKey] ?? confidenceStyles.low;

  return (
    <div className={cn('rounded-lg border border-[#29292D] bg-[#1E1F25] p-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#A1AFC5]">Model Recommendation</span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide', confidenceClass)}>
          {confidenceKey} confidence
        </span>
      </div>

      {requirementSummary && (
        <div className="mt-1 text-[11px] text-[#7F8CA3]">Prompt requires: {requirementSummary}</div>
      )}
      {summary.reasoning && (
        <div className="mt-1 text-[11px] text-[#A1AFC5]">{summary.reasoning}</div>
      )}

      {recommendedScore && (
        <div className="mt-3">
          <ModelScoreCard
            score={recommendedScore}
            label={`Best Match: ${bestLabel}`}
            variant="primary"
            onSelect={handleSelectModel}
          />
        </div>
      )}

      {efficientScore && efficient && efficient.modelId !== summary.modelId && (
        <div className="mt-2">
          {efficient.reasoning && (
            <div className="mb-1 text-[11px] text-[#7F8CA3]">{efficient.reasoning}</div>
          )}
          <ModelScoreCard
            score={efficientScore}
            label={`Efficient Option: ${efficientLabel}`}
            variant="secondary"
            onSelect={handleSelectModel}
          />
        </div>
      )}

      {comparisonModels && canCompare && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-[#7F8CA3]">
            Compare {getModelLabel(comparisonModels[0])} vs {getModelLabel(comparisonModels[1])}
          </div>
          <button
            type="button"
            onClick={() => {
              onCompareModels?.(comparisonModels);
              openComparison(comparisonModels);
            }}
            className="h-7 px-2 rounded-md border border-[#29292D] text-[#A1AFC5] text-xs font-semibold hover:bg-[#1B1E23]"
          >
            {isOpen ? 'Hide' : 'Compare Both'}
          </button>
        </div>
      )}

      {isOpen && comparison && (
        <div className="mt-3">
          <ModelComparison
            left={comparison.left}
            right={comparison.right}
            onSelectModel={handleSelectModel}
            onClose={closeComparison}
          />
        </div>
      )}

      {filteredSummary && (
        <div className="mt-2 text-[11px] text-[#7F8CA3]">{filteredSummary}</div>
      )}
    </div>
  );
}
