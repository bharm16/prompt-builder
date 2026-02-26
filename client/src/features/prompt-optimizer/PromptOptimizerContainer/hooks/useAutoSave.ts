import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { PromptHistory } from '../../context/types';

interface UseAutoSaveOptions {
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  displayedPrompt: string | null;
  isApplyingHistoryRef: MutableRefObject<boolean>;
  handleDisplayedPromptChange: (text: string) => void;
  updateEntryOutput: PromptHistory['updateEntryOutput'];
  setOutputSaveState: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
  setOutputLastSavedAt: (timestampMs: number | null) => void;
}

interface UseAutoSaveResult {
  handleDisplayedPromptChangeWithAutosave: (text: string) => void;
}

export function useAutoSave({
  currentPromptUuid,
  currentPromptDocId,
  displayedPrompt,
  isApplyingHistoryRef,
  handleDisplayedPromptChange,
  updateEntryOutput,
  setOutputSaveState,
  setOutputLastSavedAt,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const saveOutputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedOutputRef = useRef<string | null>(null);
  const displayedPromptRef = useRef<string | null>(displayedPrompt);
  displayedPromptRef.current = displayedPrompt;
  const handleDisplayedPromptChangeRef = useRef(handleDisplayedPromptChange);
  handleDisplayedPromptChangeRef.current = handleDisplayedPromptChange;
  const updateEntryOutputRef = useRef(updateEntryOutput);
  updateEntryOutputRef.current = updateEntryOutput;
  const promptMetaRef = useRef<{ uuid: string | null; docId: string | null }>({
    uuid: currentPromptUuid,
    docId: currentPromptDocId,
  });

  useEffect(() => {
    promptMetaRef.current = { uuid: currentPromptUuid, docId: currentPromptDocId };
    lastSavedOutputRef.current = null;
    setOutputSaveState('idle');
    setOutputLastSavedAt(null);
    if (saveOutputTimeoutRef.current) {
      clearTimeout(saveOutputTimeoutRef.current);
      saveOutputTimeoutRef.current = null;
    }
  }, [currentPromptUuid, currentPromptDocId, setOutputLastSavedAt, setOutputSaveState]);

  useEffect(() => {
    return () => {
      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }
    };
  }, []);

  const handleDisplayedPromptChangeWithAutosave = useCallback(
    (newText: string): void => {
      handleDisplayedPromptChangeRef.current(newText);

      const { uuid: currentUuid, docId: currentDocId } = promptMetaRef.current;
      if (!currentUuid) return;
      if (isApplyingHistoryRef.current) return;
      if (lastSavedOutputRef.current === null) {
        lastSavedOutputRef.current = displayedPromptRef.current ?? '';
      }
      if (lastSavedOutputRef.current === newText) return;

      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }

      const scheduledUuid = currentUuid;
      const scheduledDocId = currentDocId;
      setOutputSaveState('saving');

      saveOutputTimeoutRef.current = setTimeout(() => {
        const currentPromptMeta = promptMetaRef.current;
        if (!scheduledUuid) return;
        if (isApplyingHistoryRef.current) return;
        if (
          currentPromptMeta.uuid !== scheduledUuid ||
          currentPromptMeta.docId !== scheduledDocId
        ) {
          return;
        }
        if (lastSavedOutputRef.current === newText) return;

        void (async () => {
          try {
            await updateEntryOutputRef.current(scheduledUuid, scheduledDocId, newText);
            lastSavedOutputRef.current = newText;
            setOutputSaveState('saved');
            setOutputLastSavedAt(Date.now());
          } catch {
            setOutputSaveState('error');
          }
        })();
        saveOutputTimeoutRef.current = null;
      }, 1000);
    },
    [
      isApplyingHistoryRef,
      setOutputLastSavedAt,
      setOutputSaveState,
    ]
  );

  return { handleDisplayedPromptChangeWithAutosave };
}
