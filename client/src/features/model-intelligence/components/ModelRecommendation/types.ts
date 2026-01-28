import type { ModelRecommendation } from '../../types';

export interface ModelRecommendationProps {
  prompt: string;
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
  onSelectModel: (modelId: string) => void;
  onCompareModels?: (models: [string, string]) => void;
  className?: string;
  recommendation?: ModelRecommendation | null;
  isLoading?: boolean;
  error?: string | null;
}
