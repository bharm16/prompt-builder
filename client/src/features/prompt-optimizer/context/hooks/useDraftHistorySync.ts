import { useEffect, useMemo } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptHistory, PromptOptimizer } from '../types';
import { debounce } from '../../utils/debounce';

interface UseDraftHistorySyncOptions {
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  promptHistory: PromptHistory;
  promptOptimizer: PromptOptimizer;
  selectedModel: string;
  generationParams: CapabilityValues;
}

export const useDraftHistorySync = ({
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
  promptOptimizer,
  selectedModel,
  generationParams,
}: UseDraftHistorySyncOptions): void => {
  const debouncedSave = useMemo(
    () =>
      debounce(
        (
          uuid: string,
          docId: string | null,
          input: string,
          targetModel: string | null,
          params: CapabilityValues
        ) => {
          promptHistory.updateEntryPersisted(uuid, docId, {
            input,
            targetModel,
            generationParams: params,
          });
        },
        1000 // 1 second debounce
      ),
    [promptHistory]
  );

  useEffect(() => {
    if (!currentPromptUuid) return;
    
    // Only sync if it's a draft (no output)
    const entry = promptHistory.history.find((item) => item.uuid === currentPromptUuid);
    if (!entry) return;
    
    const isDraft = !entry.output || !entry.output.trim();
    if (!isDraft) return;

    debouncedSave(
      currentPromptUuid,
      currentPromptDocId,
      promptOptimizer.inputPrompt,
      selectedModel?.trim() ? selectedModel.trim() : null,
      generationParams ?? null
    );

    return () => {
      debouncedSave.cancel();
    };
  }, [
    currentPromptUuid,
    currentPromptDocId,
    promptHistory.history,
    promptOptimizer.inputPrompt,
    selectedModel,
    generationParams,
    debouncedSave,
  ]);
};
