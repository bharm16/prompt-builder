import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { PromptHistory } from "../../context/types";

interface UseAutoSaveOptions {
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  displayedPrompt: string | null;
  isApplyingHistoryRef: MutableRefObject<boolean>;
  /** When true, auto-save is paused to prevent prompt edits from overwriting
   *  the session identity while a generation is in-flight. */
  isGeneratingRef?: MutableRefObject<boolean> | undefined;
  handleDisplayedPromptChange: (text: string) => void;
  updateEntryOutput: PromptHistory["updateEntryOutput"];
  setOutputSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setOutputLastSavedAt: (timestampMs: number | null) => void;
}

interface UseAutoSaveResult {
  handleDisplayedPromptChangeWithAutosave: (text: string) => void;
  /** Immediately persist any pending auto-save (e.g., before a reload or blocked action). */
  flushAutoSave: () => void;
}

export function useAutoSave({
  currentPromptUuid,
  currentPromptDocId,
  displayedPrompt,
  isApplyingHistoryRef,
  isGeneratingRef,
  handleDisplayedPromptChange,
  updateEntryOutput,
  setOutputSaveState,
  setOutputLastSavedAt,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const saveOutputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
    promptMetaRef.current = {
      uuid: currentPromptUuid,
      docId: currentPromptDocId,
    };
    lastSavedOutputRef.current = null;
    setOutputSaveState("idle");
    setOutputLastSavedAt(null);
    if (saveOutputTimeoutRef.current) {
      clearTimeout(saveOutputTimeoutRef.current);
      saveOutputTimeoutRef.current = null;
    }
  }, [
    currentPromptUuid,
    currentPromptDocId,
    setOutputLastSavedAt,
    setOutputSaveState,
  ]);

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
        lastSavedOutputRef.current = displayedPromptRef.current ?? "";
      }
      if (lastSavedOutputRef.current === newText) return;

      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }

      const scheduledUuid = currentUuid;
      const scheduledDocId = currentDocId;
      setOutputSaveState("saving");

      saveOutputTimeoutRef.current = setTimeout(() => {
        const currentPromptMeta = promptMetaRef.current;
        if (!scheduledUuid) return;
        if (isApplyingHistoryRef.current) return;
        // Don't persist prompt changes while a generation is in-flight —
        // overwriting the session's prompt would corrupt the render's identity.
        if (isGeneratingRef?.current) return;
        if (
          currentPromptMeta.uuid !== scheduledUuid ||
          currentPromptMeta.docId !== scheduledDocId
        ) {
          return;
        }
        if (lastSavedOutputRef.current === newText) return;

        void (async () => {
          try {
            await updateEntryOutputRef.current(
              scheduledUuid,
              scheduledDocId,
              newText,
            );
            lastSavedOutputRef.current = newText;
            setOutputSaveState("saved");
            setOutputLastSavedAt(Date.now());
          } catch {
            setOutputSaveState("error");
          }
        })();
        saveOutputTimeoutRef.current = null;
      }, 1000);
    },
    [
      isApplyingHistoryRef,
      isGeneratingRef,
      setOutputLastSavedAt,
      setOutputSaveState,
    ],
  );

  const flushAutoSave = useCallback((): void => {
    if (!saveOutputTimeoutRef.current) return;
    clearTimeout(saveOutputTimeoutRef.current);
    saveOutputTimeoutRef.current = null;
    const { uuid: currentUuid, docId: currentDocId } = promptMetaRef.current;
    if (!currentUuid) return;
    const currentText = displayedPromptRef.current ?? "";
    if (lastSavedOutputRef.current === currentText) return;

    void (async () => {
      try {
        await updateEntryOutputRef.current(
          currentUuid,
          currentDocId,
          currentText,
        );
        lastSavedOutputRef.current = currentText;
        setOutputSaveState("saved");
        setOutputLastSavedAt(Date.now());
      } catch {
        setOutputSaveState("error");
      }
    })();
  }, [setOutputLastSavedAt, setOutputSaveState]);

  return { handleDisplayedPromptChangeWithAutosave, flushAutoSave };
}
