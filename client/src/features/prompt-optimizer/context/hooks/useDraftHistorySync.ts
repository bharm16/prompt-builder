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

const areParamsEqual = (
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
};

export const useDraftHistorySync = ({
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
  promptOptimizer,
  selectedModel,
  generationParams,
}: UseDraftHistorySyncOptions): void => {
  const { updateEntryPersisted, history } = promptHistory;
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
          updateEntryPersisted(uuid, docId, {
            input,
            targetModel,
            generationParams: params,
          });
        },
        1000 // 1 second debounce
      ),
    [updateEntryPersisted]
  );

  useEffect(() => {
    if (!currentPromptUuid) return;
    
    // Only sync if it's a draft (no output)
    const entry = history.find((item) => item.uuid === currentPromptUuid);
    if (!entry) return;
    
    const isDraft = !entry.output || !entry.output.trim();
    if (!isDraft) return;

    const normalizedModel = selectedModel?.trim() ? selectedModel.trim() : null;
    const normalizedParams = generationParams ?? null;
    const hasInputChange = entry.input !== promptOptimizer.inputPrompt;
    const hasModelChange = (entry.targetModel ?? null) !== normalizedModel;
    const hasParamsChange = !areParamsEqual(entry.generationParams ?? null, normalizedParams);
    if (!hasInputChange && !hasModelChange && !hasParamsChange) return;

    debouncedSave(
      currentPromptUuid,
      currentPromptDocId,
      promptOptimizer.inputPrompt,
      normalizedModel,
      normalizedParams
    );

    return () => {
      debouncedSave.cancel();
    };
  }, [
    currentPromptUuid,
    currentPromptDocId,
    history,
    promptOptimizer.inputPrompt,
    selectedModel,
    generationParams,
    debouncedSave,
  ]);
};
