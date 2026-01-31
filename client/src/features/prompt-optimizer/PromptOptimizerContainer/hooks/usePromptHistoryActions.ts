import { useCallback } from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { PromptHistoryEntry } from '@hooks/types';
import type { PromptHistory } from '../../context/types';
import { hydrateKeyframes } from '../../utils/keyframeTransforms';

type UsePromptHistoryActionsParams = {
  promptHistory: Pick<PromptHistory, 'saveToHistory' | 'updateEntryPersisted'>;
  setKeyframes: (tiles: KeyframeTile[] | null | undefined) => void;
  loadFromHistory: (entry: PromptHistoryEntry) => void;
  handleCreateNew: () => void;
};

export type UsePromptHistoryActionsResult = {
  handleLoadFromHistory: (entry: PromptHistoryEntry) => void;
  handleCreateNewWithKeyframes: () => void;
  handleDuplicate: (entry: PromptHistoryEntry) => Promise<void>;
  handleRename: (entry: PromptHistoryEntry, title: string) => void;
};

export function usePromptHistoryActions({
  promptHistory,
  setKeyframes,
  loadFromHistory,
  handleCreateNew,
}: UsePromptHistoryActionsParams): UsePromptHistoryActionsResult {
  const handleLoadFromHistory = useCallback(
    (entry: PromptHistoryEntry): void => {
      setKeyframes(hydrateKeyframes(entry.keyframes ?? []));
      loadFromHistory(entry);
    },
    [loadFromHistory, setKeyframes]
  );

  const handleCreateNewWithKeyframes = useCallback((): void => {
    setKeyframes([]);
    handleCreateNew();
  }, [handleCreateNew, setKeyframes]);

  const handleDuplicate = useCallback(
    async (entry: PromptHistoryEntry): Promise<void> => {
      const mode =
        typeof entry.mode === 'string' && entry.mode.trim()
          ? entry.mode.trim()
          : 'video';
      const result = await promptHistory.saveToHistory(
        entry.input,
        entry.output,
        entry.score ?? null,
        mode,
        entry.targetModel ?? null,
        (entry.generationParams as Record<string, unknown>) ?? null,
        entry.keyframes ?? null,
        entry.brainstormContext ?? null,
        entry.highlightCache ?? null,
        null,
        entry.title ?? null
      );

      if (result?.uuid) {
        handleLoadFromHistory({
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          title: entry.title ?? null,
          input: entry.input,
          output: entry.output,
          score: entry.score ?? null,
          mode,
          targetModel: entry.targetModel ?? null,
          generationParams: entry.generationParams ?? null,
          keyframes: entry.keyframes ?? null,
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: Array.isArray(entry.versions) ? entry.versions : [],
        });
      }
    },
    [handleLoadFromHistory, promptHistory]
  );

  const handleRename = useCallback(
    (entry: PromptHistoryEntry, title: string): void => {
      if (!entry.uuid) return;
      promptHistory.updateEntryPersisted(entry.uuid, entry.id ?? null, { title });
    },
    [promptHistory]
  );

  return {
    handleLoadFromHistory,
    handleCreateNewWithKeyframes,
    handleDuplicate,
    handleRename,
  };
}
