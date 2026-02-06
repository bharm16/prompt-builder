/**
 * useHistoryPersistence - Persistence + promotion logic for prompt history
 *
 * Handles repository writes, draft promotion, and persistence-related toasts.
 */

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../services/LoggingService';
import {
  loadFromFirestore,
  loadFromLocalStorage,
  syncToLocalStorage,
  saveEntry,
  updateHighlights,
  updateOutput,
  updateVersions,
  updatePrompt,
  deleteEntry,
  clearAll,
} from '../api';
import type { User, PromptHistoryEntry, PromptVersionEntry, Toast, SaveResult } from '../types';
import { enforceImmutableKeyframes, enforceImmutableVersions } from '../utils/immutableMedia';
import type { UpdatePromptOptions } from '../../../repositories/promptRepositoryTypes';

interface UseHistoryPersistenceOptions {
  user: User | null;
  history: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  setHistory: (history: PromptHistoryEntry[]) => void;
  addEntry: (entry: PromptHistoryEntry) => void;
  updateEntry: (uuid: string, updates: Partial<PromptHistoryEntry>) => void;
  removeEntry: (entryId: string) => void;
  clearEntries: () => void;
  setIsLoadingHistory: (loading: boolean) => void;
  toast: Toast;
}

interface UseHistoryPersistenceReturn {
  loadHistoryFromFirestore: (userId: string) => Promise<void>;
  loadHistoryFromLocalStorage: () => Promise<void>;
  saveToHistory: (
    input: string,
    output: string,
    score: number | null,
    selectedMode: string,
    targetModel?: string | null,
    generationParams?: Record<string, unknown> | null,
    keyframes?: PromptHistoryEntry['keyframes'],
    brainstormContext?: unknown,
    highlightCache?: unknown,
    existingUuid?: string | null,
    title?: string | null
  ) => Promise<SaveResult | null>;
  createDraft: (params: {
    mode: string;
    targetModel: string | null;
    generationParams: Record<string, unknown> | null;
    keyframes?: PromptHistoryEntry['keyframes'];
    uuid?: string;
  }) => SaveResult;
  updateEntryLocal: (uuid: string, updates: Partial<PromptHistoryEntry>) => void;
  updateEntryPersisted: (uuid: string, docId: string | null, updates: UpdatePromptOptions) => void;
  updateEntryHighlight: (uuid: string, highlightCache: unknown) => void;
  updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  updateEntryVersions: (uuid: string, docId: string | null, versions: PromptVersionEntry[]) => void;
  clearHistory: () => Promise<void>;
  deleteFromHistory: (entryId: string) => Promise<void>;
}

const log = logger.child('useHistoryPersistence');

export function useHistoryPersistence({
  user,
  history,
  isLoadingHistory,
  setHistory,
  addEntry,
  updateEntry,
  removeEntry,
  clearEntries,
  setIsLoadingHistory,
  toast,
}: UseHistoryPersistenceOptions): UseHistoryPersistenceReturn {
  // Track UUIDs currently being promoted from draft to Firestore to prevent duplicates
  const promotingDraftsRef = useRef<Set<string>>(new Set());
  // Queue of latest versions received during an in-flight promotion (flushed after save)
  const pendingVersionsRef = useRef<Map<string, PromptVersionEntry[]>>(new Map());
  // Bug 1/2 fix: ref for fresh history in async callbacks
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Bug 18 fix: ref for isLoadingHistory so debounced callbacks read the latest value.
  // While history is loading from Firestore, Firestore writes are suppressed to prevent
  // stale localStorage data from overwriting good Firestore data.
  const isLoadingHistoryRef = useRef(isLoadingHistory);
  useEffect(() => {
    isLoadingHistoryRef.current = isLoadingHistory;
  }, [isLoadingHistory]);

  // Bug 18 safeguard: monotonic flag that becomes true after the first successful load.
  // This is a belt-and-suspenders guard - even if isLoadingHistory gets set incorrectly,
  // we never write to Firestore until we've loaded data at least once.
  const initialLoadCompleteRef = useRef(false);

  // Bug 17 fix: debounce Firestore version writes to prevent concurrent writes
  // from clobbering each other. Local state (updateEntry) is always immediate;
  // only the Firestore write is debounced so the last data always wins.
  const versionWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingVersionWriteRef = useRef<{
    uuid: string;
    docId: string | null;
    versions: PromptVersionEntry[];
  } | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Flush any pending debounced version write on unmount
  useEffect(() => {
    return () => {
      if (versionWriteTimerRef.current !== null) {
        clearTimeout(versionWriteTimerRef.current);
        versionWriteTimerRef.current = null;
        const pending = pendingVersionWriteRef.current;
        if (pending) {
          pendingVersionWriteRef.current = null;
          // Bug 18 fix: don't flush stale data on unmount while loading
          if (isLoadingHistoryRef.current || !initialLoadCompleteRef.current) {
            log.debug('Skipping unmount flush — history not ready', {
              uuid: pending.uuid,
              versionCount: pending.versions.length,
              isLoading: isLoadingHistoryRef.current,
              initialLoadComplete: initialLoadCompleteRef.current,
            });
            return;
          }
          log.debug('Flushing debounced version write on unmount', {
            uuid: pending.uuid,
            versionCount: pending.versions.length,
          });
          updateVersions(userRef.current?.uid, pending.uuid, pending.docId, pending.versions);
        }
      }
    };
  }, []);

  const loadHistoryFromFirestore = useCallback(
    async (userId: string) => {
      setIsLoadingHistory(true);

      try {
        const entries = await loadFromFirestore(userId);
        setHistory(entries);
        // Bug 18 safeguard: mark initial load as complete so writes are allowed
        initialLoadCompleteRef.current = true;

        const syncResult = syncToLocalStorage(entries);
        if (syncResult.trimmed) {
          toast.warning('Storage limit reached. Keeping only recent 50 items.');
        } else if (!syncResult.success) {
          toast.error('Browser storage full. Please clear browser data.');
        }
      } catch (error) {
        log.error('Error loading history', error as Error, { userId });

        // Fallback to localStorage
        try {
          const localEntries = await loadFromLocalStorage();
          setHistory(localEntries);
          // Even on fallback, mark load complete so writes can proceed
          initialLoadCompleteRef.current = true;
        } catch (localError) {
          log.error('Error loading from localStorage fallback', localError as Error);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [setHistory, setIsLoadingHistory, toast]
  );

  const loadHistoryFromLocalStorage = useCallback(async () => {
    try {
      const entries = await loadFromLocalStorage();
      setHistory(entries);
      // Mark load complete for non-authenticated users
      initialLoadCompleteRef.current = true;
    } catch (error) {
      log.error('Error loading history from localStorage', error as Error);
    }
  }, [setHistory]);

  const saveToHistory = useCallback(
    async (
      input: string,
      output: string,
      score: number | null,
      selectedMode: string,
      targetModel: string | null = null,
      generationParams: Record<string, unknown> | null = null,
      keyframes: PromptHistoryEntry['keyframes'] = null,
      brainstormContext: unknown = null,
      highlightCache: unknown = null,
      existingUuid: string | null = null,
      title: string | null = null
    ): Promise<SaveResult | null> => {
      const normalizedTargetModel =
        typeof targetModel === 'string' && targetModel.trim()
          ? targetModel.trim()
          : null;

      log.debug('Saving to history', {
        mode: selectedMode,
        targetModel: normalizedTargetModel,
        hasUser: !!user,
        inputLength: input.length,
      });

      try {
        const result = await saveEntry(user?.uid, {
          ...(existingUuid ? { uuid: existingUuid } : {}),
          ...(title !== null ? { title } : {}),
          input,
          output,
          score,
          mode: selectedMode,
          ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
          ...(generationParams ? { generationParams } : {}),
          ...(keyframes ? { keyframes } : {}),
          brainstormContext,
          highlightCache,
        });

        const newEntry: PromptHistoryEntry = {
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          title,
          input,
          output,
          score,
          mode: selectedMode,
          ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
          generationParams: generationParams ?? null,
          keyframes: keyframes ?? null,
          brainstormContext: brainstormContext ?? null,
          highlightCache: highlightCache ?? null,
        };

        // Bug 1 fix: read latest history from ref to avoid stale closure
        if (existingUuid && historyRef.current.some((entry) => entry.uuid === existingUuid)) {
          updateEntry(existingUuid, newEntry);
        } else {
          addEntry(newEntry);
        }
        return result;
      } catch (error) {
        log.error('Error saving to history', error as Error, {
          userId: user?.uid,
          mode: selectedMode,
        });
        toast.error(user ? 'Failed to save to cloud' : 'Failed to save to history');
        return null;
      }
    },
    [user, toast, addEntry, updateEntry]
  );

  const createDraft = useCallback(
    (params: {
      mode: string;
      targetModel: string | null;
      generationParams: Record<string, unknown> | null;
      keyframes?: PromptHistoryEntry['keyframes'];
      uuid?: string;
    }): SaveResult => {
      const uuid = typeof params.uuid === 'string' && params.uuid.trim() ? params.uuid.trim() : uuidv4();
      const id = `draft-${Date.now()}`;

      const entry: PromptHistoryEntry = {
        id,
        uuid,
        timestamp: new Date().toISOString(),
        title: null,
        input: '',
        output: '',
        score: null,
        mode: params.mode,
        targetModel: params.targetModel ?? null,
        generationParams: params.generationParams ?? null,
        keyframes: params.keyframes ?? null,
        brainstormContext: null,
        highlightCache: null,
        versions: [],
      };

      addEntry(entry);
      return { uuid, id };
    },
    [addEntry]
  );

  const updateEntryLocal = useCallback(
    (uuid: string, updates: Partial<PromptHistoryEntry>) => {
      updateEntry(uuid, updates);
    },
    [updateEntry]
  );

  // Bug 3 fix: add .catch() to fire-and-forget persistence calls
  const updateEntryPersisted = useCallback(
    (uuid: string, docId: string | null, updates: UpdatePromptOptions) => {
      const entry = historyRef.current.find((item) => item.uuid === uuid);
      let effectiveUpdates = updates;
      if (updates.keyframes !== undefined) {
        const mergedKeyframes = enforceImmutableKeyframes(entry?.keyframes ?? null, updates.keyframes ?? null);
        if (mergedKeyframes.warnings.length) {
          log.warn('Preserved immutable keyframe references during persist', {
            uuid,
            docId,
            warningCount: mergedKeyframes.warnings.length,
          });
        }
        effectiveUpdates = {
          ...updates,
          keyframes: mergedKeyframes.keyframes ?? null,
        };
      }

      updatePrompt(user?.uid, uuid, docId, effectiveUpdates)?.catch?.((error: unknown) => {
        log.warn('Failed to persist prompt update', error as Error, { uuid, docId });
      });

      const localUpdates: Partial<PromptHistoryEntry> = {};
      if (effectiveUpdates.input !== undefined) localUpdates.input = effectiveUpdates.input;
      if (effectiveUpdates.title !== undefined) localUpdates.title = effectiveUpdates.title;
      if (effectiveUpdates.mode !== undefined) localUpdates.mode = effectiveUpdates.mode;
      if (effectiveUpdates.targetModel !== undefined) localUpdates.targetModel = effectiveUpdates.targetModel;
      if (effectiveUpdates.generationParams !== undefined) localUpdates.generationParams = effectiveUpdates.generationParams;
      if (effectiveUpdates.keyframes !== undefined) localUpdates.keyframes = effectiveUpdates.keyframes;

      updateEntry(uuid, localUpdates);
    },
    [user, updateEntry]
  );

  const updateEntryHighlight = useCallback(
    (uuid: string, highlightCache: unknown) => {
      const entry = historyRef.current.find((item) => item.uuid === uuid);
      const docId = entry?.id ?? null;
      updateHighlights(user?.uid, uuid, docId, highlightCache)?.catch?.((error: unknown) => {
        log.warn('Failed to persist highlight update', error as Error, { uuid, docId });
      });
      updateEntry(uuid, { highlightCache: highlightCache ?? null });
    },
    [user, updateEntry]
  );

  const updateEntryOutput = useCallback(
    (uuid: string, docId: string | null, output: string) => {
      updateOutput(user?.uid, uuid, docId, output)?.catch?.((error: unknown) => {
        log.warn('Failed to persist output update', error as Error, { uuid, docId });
      });
      updateEntry(uuid, { output });
    },
    [user, updateEntry]
  );

  const updateEntryVersions = useCallback(
    (uuid: string, docId: string | null, versions: PromptVersionEntry[]) => {
      const entry = historyRef.current.find((item) => item.uuid === uuid);
      const enforced = enforceImmutableVersions(entry ?? null, versions);
      if (enforced.warnings.length) {
        log.warn('Preserved immutable media references during version persist', {
          uuid,
          docId,
          warningCount: enforced.warnings.length,
        });
      }
      const nextVersions = enforced.versions;
      const generationCount = nextVersions.reduce(
        (sum, v) => sum + (Array.isArray(v.generations) ? v.generations.length : 0),
        0
      );
      log.debug('updateEntryVersions called', {
        uuid,
        docId,
        versionCount: nextVersions.length,
        generationCount,
      });

      updateEntry(uuid, { versions: nextVersions });

      const isDraftId = typeof docId === 'string' && docId.startsWith('draft-');
      if (isDraftId && user?.uid) {
        if (promotingDraftsRef.current.has(uuid)) {
          pendingVersionsRef.current.set(uuid, nextVersions);
          log.debug('Draft promotion in progress, queuing version update', { uuid });
          return;
        }

        // Bug 2 fix: read latest history from ref to avoid stale snapshot during async promotion
        const entry = historyRef.current.find((item) => item.uuid === uuid);
        if (!entry) {
          log.warn('Draft entry not found in local state for promotion', { uuid, docId });
          return;
        }

        promotingDraftsRef.current.add(uuid);
        log.info('Promoting draft entry to Firestore for version persistence', {
          uuid,
          draftId: docId,
          versionCount: versions.length,
        });

        saveEntry(user.uid, {
          uuid,
          input: entry.input || '',
          output: entry.output || '',
          score: entry.score ?? null,
          mode: entry.mode || 'video',
          ...(entry.title !== undefined && entry.title !== null ? { title: entry.title } : {}),
          ...(entry.targetModel ? { targetModel: entry.targetModel } : {}),
          ...(entry.generationParams ? { generationParams: entry.generationParams } : {}),
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: nextVersions,
        })
          .then((result) => {
            promotingDraftsRef.current.delete(uuid);
            log.info('Draft promoted to Firestore', { uuid, realDocId: result.id });
            updateEntry(uuid, { id: result.id });

            const pendingVersions = pendingVersionsRef.current.get(uuid);
            if (pendingVersions) {
              pendingVersionsRef.current.delete(uuid);
              log.debug('Flushing queued versions after promotion', {
                uuid,
                realDocId: result.id,
                versionCount: pendingVersions.length,
              });
              updateVersions(user?.uid, uuid, result.id, pendingVersions);
            }
          })
          .catch((error) => {
            promotingDraftsRef.current.delete(uuid);
            pendingVersionsRef.current.delete(uuid);
            log.error('Failed to promote draft to Firestore', error as Error, { uuid, docId });
          });
        return;
      }

      // Bug 17 fix: debounce the Firestore write. Rapid successive calls
      // (e.g., ADD_GENERATION → UPDATE_GENERATION → media refresh) each trigger
      // syncVersionGenerations → persistVersions → updateEntryVersions. Without
      // debouncing, multiple concurrent Firestore writes race each other and an
      // earlier write with stale data can land after a later write with complete data.
      // By debouncing, only the latest (most complete) data is written.
      if (versionWriteTimerRef.current !== null) {
        clearTimeout(versionWriteTimerRef.current);
      }
      pendingVersionWriteRef.current = { uuid, docId, versions: nextVersions };
      versionWriteTimerRef.current = setTimeout(() => {
        versionWriteTimerRef.current = null;
        const pending = pendingVersionWriteRef.current;
        if (pending) {
          // Bug 18 fix: while Firestore history is still loading, skip the write.
          // On mount, highlights/generations sync may trigger persistVersions with
          // stale localStorage data. Writing this to Firestore would overwrite the
          // real data. Once loadFromFirestore completes and calls setHistory(),
          // isLoadingHistory becomes false and normal writes resume.
          //
          // Belt-and-suspenders: also check initialLoadCompleteRef. Even if
          // isLoadingHistory gets set incorrectly, we never write before first load.
          if (isLoadingHistoryRef.current || !initialLoadCompleteRef.current) {
            log.debug('Version write skipped — history not ready', {
              uuid: pending.uuid,
              isLoading: isLoadingHistoryRef.current,
              initialLoadComplete: initialLoadCompleteRef.current,
            });
            pendingVersionWriteRef.current = null;
            return;
          }
          pendingVersionWriteRef.current = null;
          const debouncedGenerationCount = pending.versions.reduce(
            (sum, v) => sum + (Array.isArray(v.generations) ? v.generations.length : 0),
            0
          );
          log.debug('Debounced version write executing', {
            uuid: pending.uuid,
            versionCount: pending.versions.length,
            generationCount: debouncedGenerationCount,
          });
          updateVersions(userRef.current?.uid, pending.uuid, pending.docId, pending.versions);
        }
      }, 500);
    },
    [user, updateEntry]
  );

  // Bug 5 fix: removed history.length from deps (only used for debug log)
  const clearHistory = useCallback(async () => {
    log.debug('Clearing history', {
      hasUser: !!user,
      currentCount: historyRef.current.length,
    });

    await clearAll(user?.uid);
    clearEntries();
    toast.success('History cleared');
  }, [user, toast, clearEntries]);

  const deleteFromHistory = useCallback(
    async (entryId: string) => {
      log.debug('Deleting from history', { entryId, hasUser: !!user });

      removeEntry(entryId);

      try {
        await deleteEntry(user?.uid, entryId);
        toast.success('Prompt deleted');
      } catch (error) {
        log.error('Error deleting prompt', error as Error, {
          entryId,
          userId: user?.uid,
        });

        if (user) {
          await loadHistoryFromFirestore(user.uid);
        } else {
          await loadHistoryFromLocalStorage();
        }

        toast.error('Failed to delete prompt');
      }
    },
    [user, toast, removeEntry, loadHistoryFromFirestore, loadHistoryFromLocalStorage]
  );

  return {
    loadHistoryFromFirestore,
    loadHistoryFromLocalStorage,
    saveToHistory,
    createDraft,
    updateEntryLocal,
    updateEntryPersisted,
    updateEntryHighlight,
    updateEntryOutput,
    updateEntryVersions,
    clearHistory,
    deleteFromHistory,
  };
}
