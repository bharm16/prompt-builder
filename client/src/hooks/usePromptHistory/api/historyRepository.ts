/**
 * History Repository Operations
 *
 * Wraps repository calls for prompt history CRUD operations.
 * Handles Firestore and localStorage fallback logic.
 */

import { getPromptRepositoryForUser } from '../../../repositories';
import { logger } from '../../../services/LoggingService';
import type { PromptHistoryEntry, SaveEntryParams, SaveResult } from '../types';

const log = logger.child('historyRepository');

/**
 * Normalize prompt entries to ensure consistent shape
 */
export function normalizeEntries(entries: PromptHistoryEntry[]): PromptHistoryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    brainstormContext: entry.brainstormContext ?? null,
    highlightCache: entry.highlightCache ?? null,
    versions: entry.versions ?? [],
  }));
}

/**
 * Load history from Firestore for authenticated user
 */
export async function loadFromFirestore(userId: string): Promise<PromptHistoryEntry[]> {
  log.debug('Loading from Firestore', { userId });
  logger.startTimer('loadFromFirestore');

  try {
    const repository = getPromptRepositoryForUser(true);
    const prompts = await repository.getUserPrompts(userId, 100);
    const normalized = normalizeEntries(prompts);

    const duration = logger.endTimer('loadFromFirestore');
    log.info('Loaded from Firestore', {
      entryCount: normalized.length,
      duration,
    });

    return normalized;
  } catch (error) {
    logger.endTimer('loadFromFirestore');
    log.error('Failed to load from Firestore', error as Error, { userId });
    throw error;
  }
}

/**
 * Load history from localStorage for unauthenticated user
 */
export async function loadFromLocalStorage(): Promise<PromptHistoryEntry[]> {
  log.debug('Loading from localStorage');

  try {
    const repository = getPromptRepositoryForUser(false);
    const prompts = await repository.getUserPrompts('', 100);
    return normalizeEntries(prompts);
  } catch (error) {
    log.error('Failed to load from localStorage', error as Error);
    throw error;
  }
}

/**
 * Save history to localStorage (for syncing Firestore data)
 */
export function syncToLocalStorage(entries: PromptHistoryEntry[]): { success: boolean; trimmed: boolean } {
  try {
    localStorage.setItem('promptHistory', JSON.stringify(entries));
    return { success: true, trimmed: false };
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      // Try with trimmed data
      const trimmed = entries.slice(0, 50);
      try {
        localStorage.setItem('promptHistory', JSON.stringify(trimmed));
        return { success: true, trimmed: true };
      } catch {
        return { success: false, trimmed: false };
      }
    }
    log.warn('Could not save to localStorage', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { success: false, trimmed: false };
  }
}

/**
 * Save a new entry to the repository
 */
export async function saveEntry(
  userId: string | undefined,
  params: SaveEntryParams
): Promise<SaveResult> {
  log.debug('Saving entry', {
    hasUser: !!userId,
    inputLength: params.input.length,
  });
  logger.startTimer('saveEntry');

  const repository = getPromptRepositoryForUser(!!userId);

  try {
    const result = await repository.save(userId ?? '', {
      input: params.input,
      output: params.output,
      score: params.score,
      mode: params.mode,
      brainstormContext: params.brainstormContext ?? null,
      highlightCache: params.highlightCache ?? null,
    });

    const duration = logger.endTimer('saveEntry');
    log.info('Entry saved', { uuid: result.uuid, duration });

    return { uuid: result.uuid, id: result.id };
  } catch (error) {
    logger.endTimer('saveEntry');
    log.error('Failed to save entry', error as Error);
    throw error;
  }
}

/**
 * Update highlight cache for an entry
 */
export async function updateHighlights(
  userId: string | undefined,
  uuid: string,
  highlightCache: unknown
): Promise<void> {
  const repository = getPromptRepositoryForUser(!!userId);

  if ('updateHighlights' in repository && typeof repository.updateHighlights === 'function') {
    const updateFn = repository.updateHighlights as (
      uuid: string,
      options: { highlightCache?: unknown; versionEntry?: unknown }
    ) => Promise<void>;

    try {
      await updateFn(uuid, { highlightCache });
    } catch (error) {
      log.warn('Unable to persist updated highlights', {
        uuid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Update output for an entry
 */
export async function updateOutput(
  userId: string | undefined,
  uuid: string,
  docId: string | null,
  output: string
): Promise<void> {
  const repository = getPromptRepositoryForUser(!!userId);

  if ('updateOutput' in repository && typeof repository.updateOutput === 'function') {
    const isFirestoreRepo = 'collectionName' in repository && userId;

    try {
      if (isFirestoreRepo && docId) {
        const updateFn = repository.updateOutput as (docId: string, output: string) => Promise<void>;
        await updateFn(docId, output);
      } else {
        const updateFn = repository.updateOutput as (uuid: string, output: string) => Promise<void>;
        await updateFn(uuid, output);
      }
    } catch (error) {
      log.warn('Unable to persist updated output', {
        uuid,
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Delete an entry by ID
 */
export async function deleteEntry(userId: string | undefined, entryId: string): Promise<void> {
  log.debug('Deleting entry', { entryId, hasUser: !!userId });
  logger.startTimer('deleteEntry');

  const repository = getPromptRepositoryForUser(!!userId);

  try {
    await repository.deleteById(entryId);
    const duration = logger.endTimer('deleteEntry');
    log.info('Entry deleted', { entryId, duration });
  } catch (error) {
    logger.endTimer('deleteEntry');
    log.error('Failed to delete entry', error as Error, { entryId });
    throw error;
  }
}

/**
 * Clear all history
 */
export async function clearAll(userId: string | undefined): Promise<void> {
  log.debug('Clearing all history', { hasUser: !!userId });
  logger.startTimer('clearAll');

  const repository = getPromptRepositoryForUser(!!userId);

  if ('clear' in repository && typeof repository.clear === 'function') {
    await repository.clear();
  }

  const duration = logger.endTimer('clearAll');
  log.info('History cleared', { duration });
}
