export type ActiveStatusLabelParams = {
  inputPrompt: string;
  displayedPrompt: string;
  isProcessing: boolean;
  isRefining: boolean;
  hasHighlights: boolean;
};

export const resolveActiveStatusLabel = (params: ActiveStatusLabelParams): string => {
  const hasInput = params.inputPrompt.trim().length > 0;
  const hasOutput = params.displayedPrompt.trim().length > 0;

  if (params.isRefining) return 'Refining';
  if (params.isProcessing) return 'Optimizing';
  if (!hasInput && !hasOutput) return 'Draft';
  if (hasOutput && params.hasHighlights) return 'Generated';
  if (hasOutput) return 'Optimized';
  if (hasInput) return 'Draft';
  return 'Incomplete';
};

export const resolveActiveModelLabel = (selectedModel: string | null | undefined): string => {
  return selectedModel?.trim() ? selectedModel.trim() : 'Default';
};
