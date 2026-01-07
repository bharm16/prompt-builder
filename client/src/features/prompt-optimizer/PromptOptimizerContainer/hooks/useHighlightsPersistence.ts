import { useCallback } from 'react';
import { getPromptRepository } from '@repositories/index';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';

interface Span {
  id?: string;
  start: number;
  end: number;
  category: string;
  confidence: number;
  [key: string]: unknown;
}

interface PersistenceResult {
  spans: Span[];
  meta?: Record<string, unknown> | null;
  signature: string;
  cacheId?: string | null;
  source?: string;
}

interface User {
  uid: string;
  [key: string]: unknown;
}

interface PromptHistory {
  updateEntryHighlight: (uuid: string, snapshot: HighlightSnapshot) => void;
  [key: string]: unknown;
}

interface UseHighlightsPersistenceParams {
  currentPromptUuid: string | null | undefined;
  currentPromptDocId: string | null | undefined;
  user: User | null | undefined;
  toast: Toast;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  promptHistory: PromptHistory;
  latestHighlightRef: React.MutableRefObject<HighlightSnapshot | null>;
  persistedSignatureRef: React.MutableRefObject<string | null>;
}

/**
 * Custom hook for persisting highlight snapshots
 * Handles both local state updates and remote persistence
 */
export function useHighlightsPersistence({
  currentPromptUuid,
  currentPromptDocId,
  user,
  toast,
  applyInitialHighlightSnapshot,
  promptHistory,
  latestHighlightRef,
  persistedSignatureRef,
}: UseHighlightsPersistenceParams): {
  handleHighlightsPersist: (result: PersistenceResult) => Promise<void>;
} {
  const handleHighlightsPersist = useCallback(
    async (result: PersistenceResult): Promise<void> => {
      if (!result || !Array.isArray(result.spans) || !result.signature) {
        return;
      }

      const snapshot: HighlightSnapshot = {
        spans: result.spans,
        meta: result.meta ?? null,
        signature: result.signature,
        cacheId:
          result.cacheId ??
          (currentPromptUuid ? String(currentPromptUuid) : null),
        updatedAt: new Date().toISOString(),
      };

      // Check cache ID consistency
      const activeCacheId = currentPromptUuid ? String(currentPromptUuid) : null;
      if (
        activeCacheId &&
        snapshot.cacheId &&
        snapshot.cacheId !== activeCacheId
      ) {
        return;
      }

      // Update local state
      latestHighlightRef.current = snapshot;
      applyInitialHighlightSnapshot(snapshot, {
        bumpVersion: false,
        markPersisted: false,
      });

      // Early return if no UUID
      if (!currentPromptUuid) {
        return;
      }

      // Update history for network-sourced highlights
      if (result.source === 'network' || result.source === 'cache-fallback') {
        promptHistory.updateEntryHighlight(currentPromptUuid, snapshot);
      }

      // Early return if can't persist remotely
      if (!user || !currentPromptDocId || result.source !== 'network') {
        return;
      }

      // Skip if already persisted
      if (persistedSignatureRef.current === result.signature) {
        return;
      }

      // Persist to remote repository
      try {
        const promptRepository = getPromptRepository();
        await promptRepository.updateHighlights(currentPromptDocId, {
          highlightCache: snapshot,
        });
        persistedSignatureRef.current = result.signature;
      } catch (error) {
        console.error('Failed to persist highlight snapshot:', error);
        // Silent failure for background highlight persistence - not critical to user workflow
        // Only show error if it's a permission issue
        const err = error as Error & { code?: string };
        if (err.code === 'permission-denied') {
          toast.warning('Unable to save highlights. You may need to sign in.');
        }
      }
    },
    [
      applyInitialHighlightSnapshot,
      currentPromptDocId,
      currentPromptUuid,
      promptHistory,
      user,
      latestHighlightRef,
      persistedSignatureRef,
      toast,
    ]
  );

  return { handleHighlightsPersist };
}
