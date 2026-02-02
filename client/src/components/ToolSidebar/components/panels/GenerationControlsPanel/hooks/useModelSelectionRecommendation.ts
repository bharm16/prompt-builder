import { useMemo } from 'react';
import { useModelRecommendation } from '@/features/model-intelligence';
import { MIN_PROMPT_LENGTH_FOR_RECOMMENDATION } from '@/features/model-intelligence/constants';
import { normalizeModelIdForSelection } from '@/features/model-intelligence/utils/modelLabels';
import { VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import type { HighlightSnapshot } from '@/features/prompt-optimizer/context/types';
import type { ModelRecommendation, ModelRecommendationSpan } from '@/features/model-intelligence/types';

interface UseModelSelectionRecommendationOptions {
  prompt: string;
  activeTab: 'image' | 'video';
  keyframesCount: number;
  durationSeconds: number;
  selectedModel: string;
  promptHighlights?: HighlightSnapshot | null;
}

interface UseModelSelectionRecommendationResult {
  recommendationMode: 'i2v' | 't2v';
  modelRecommendation: ModelRecommendation | null;
  isRecommendationLoading: boolean;
  recommendationError: string | null;
  recommendedModelId?: string;
  efficientModelId?: string;
  renderModelOptions: Array<{ id: string; label: string }>;
  renderModelId: string;
  recommendationAgeMs: number | null;
}

const buildRecommendationSpans = (
  prompt: string,
  spans: HighlightSnapshot['spans'] | undefined
): ModelRecommendationSpan[] | undefined => {
  if (!spans?.length) return undefined;
  if (!prompt.trim()) return undefined;

  const maxIndex = prompt.length;
  const normalizedSpans = spans
    .map((span) => {
      const start = Math.max(0, Math.min(maxIndex, Math.floor(span.start)));
      const end = Math.max(0, Math.min(maxIndex, Math.floor(span.end)));
      if (start >= end) return null;
      const text = prompt.slice(start, end).trim();
      if (!text) return null;
      return {
        text,
        start,
        end,
        category: span.category,
        confidence: span.confidence,
      };
    })
    .filter((span): span is ModelRecommendationSpan => Boolean(span));

  return normalizedSpans.length ? normalizedSpans : undefined;
};

export function useModelSelectionRecommendation({
  prompt,
  activeTab,
  keyframesCount,
  durationSeconds,
  selectedModel,
  promptHighlights,
}: UseModelSelectionRecommendationOptions): UseModelSelectionRecommendationResult {
  const trimmedPrompt = prompt.trim();
  const trimmedPromptLength = trimmedPrompt.length;

  const recommendationSpans = useMemo(
    () => buildRecommendationSpans(prompt, promptHighlights?.spans),
    [prompt, promptHighlights?.spans]
  );

  const recommendationMode = useMemo(
    () => (keyframesCount > 0 ? 'i2v' : 't2v'),
    [keyframesCount]
  );

  const shouldLoadRecommendations = useMemo(
    () => activeTab === 'video' && trimmedPromptLength >= MIN_PROMPT_LENGTH_FOR_RECOMMENDATION,
    [activeTab, trimmedPromptLength]
  );

  const {
    recommendation: modelRecommendation,
    isLoading: isRecommendationLoading,
    error: recommendationError,
  } = useModelRecommendation(prompt, {
    mode: recommendationMode,
    durationSeconds,
    spans: recommendationSpans,
    enabled: shouldLoadRecommendations,
  });

  const recommendedModelId = useMemo(() => {
    const modelId = modelRecommendation?.recommended?.modelId;
    return modelId ? normalizeModelIdForSelection(modelId) : undefined;
  }, [modelRecommendation?.recommended?.modelId]);

  const efficientModelId = useMemo(() => {
    const modelId = modelRecommendation?.alsoConsider?.modelId;
    return modelId ? normalizeModelIdForSelection(modelId) : undefined;
  }, [modelRecommendation?.alsoConsider?.modelId]);

  const renderModelOptions = useMemo(
    () => VIDEO_RENDER_MODELS.map((model) => ({ id: model.id, label: model.label })),
    []
  );

  const renderModelId = useMemo(() => {
    if (selectedModel && VIDEO_RENDER_MODELS.some((model) => model.id === selectedModel)) {
      return selectedModel;
    }
    return VIDEO_RENDER_MODELS[0]?.id ?? '';
  }, [selectedModel]);

  const recommendationAgeMs = useMemo(() => {
    const computedAt = modelRecommendation?.computedAt;
    if (!computedAt || typeof computedAt !== 'string') return null;
    const timestamp = Date.parse(computedAt);
    if (!Number.isFinite(timestamp)) return null;
    return Date.now() - timestamp;
  }, [modelRecommendation?.computedAt]);

  return {
    recommendationMode,
    modelRecommendation,
    isRecommendationLoading,
    recommendationError,
    recommendedModelId,
    efficientModelId,
    renderModelOptions,
    renderModelId,
    recommendationAgeMs,
  };
}
