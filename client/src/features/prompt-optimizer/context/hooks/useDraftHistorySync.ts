import { useEffect } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptHistory, PromptOptimizer } from '../types';

interface UseDraftHistorySyncOptions {
  currentPromptUuid: string | null;
  promptHistory: PromptHistory;
  promptOptimizer: PromptOptimizer;
  selectedModel: string;
  generationParams: CapabilityValues;
}

export const useDraftHistorySync = ({
  currentPromptUuid,
  promptHistory,
  promptOptimizer,
  selectedModel,
  generationParams,
}: UseDraftHistorySyncOptions): void => {
  useEffect(() => {
    if (!currentPromptUuid) return;
    const entry = promptHistory.history.find((item) => item.uuid === currentPromptUuid);
    if (!entry) return;
    const isDraft = !entry.output || !entry.output.trim();
    if (!isDraft) return;

    promptHistory.updateEntryLocal(currentPromptUuid, {
      input: promptOptimizer.inputPrompt,
      targetModel: selectedModel?.trim() ? selectedModel.trim() : null,
      generationParams: generationParams ?? null,
    });
  }, [
    currentPromptUuid,
    promptHistory,
    promptHistory.history,
    promptOptimizer.inputPrompt,
    selectedModel,
    generationParams,
  ]);
};
