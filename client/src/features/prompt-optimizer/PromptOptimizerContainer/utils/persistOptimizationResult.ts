import type { MutableRefObject } from 'react';
import type { HighlightSnapshot } from '@/features/prompt-optimizer/context/types';

interface SaveResult {
  uuid: string;
  id?: string | null;
}

interface PersistOptimizationResultOptions {
  optimizedPrompt: string;
  saveResult: SaveResult | null;
  setCurrentPromptUuid: (uuid: string) => void;
  setCurrentPromptDocId: (id: string | null) => void;
  setDisplayedPromptSilently: (prompt: string) => void;
  setShowResults: (show: boolean) => void;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  resetEditStacks: () => void;
  persistedSignatureRef: MutableRefObject<string | null>;
  skipLoadFromUrlRef: MutableRefObject<boolean>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

export function applyOptimizationResult({
  optimizedPrompt,
  saveResult,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setDisplayedPromptSilently,
  setShowResults,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  persistedSignatureRef,
  skipLoadFromUrlRef,
  navigate,
}: PersistOptimizationResultOptions): boolean {
  if (!saveResult?.uuid) return false;

  skipLoadFromUrlRef.current = true;
  setCurrentPromptUuid(saveResult.uuid);
  setCurrentPromptDocId(saveResult.id ?? null);
  setDisplayedPromptSilently(optimizedPrompt);
  setShowResults(true);

  applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
  resetEditStacks();
  persistedSignatureRef.current = null;

  if (saveResult.id) {
    navigate(`/session/${saveResult.id}`, { replace: true });
  } else {
    navigate('/', { replace: true });
  }

  return true;
}
