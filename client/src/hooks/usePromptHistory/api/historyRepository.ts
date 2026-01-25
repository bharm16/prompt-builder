/**
 * History Repository Operations
 *
 * Wraps repository calls for prompt history CRUD operations.
 * Handles Firestore and localStorage fallback logic.
 */

import { getLocalPromptRepository, getPromptRepositoryForUser } from '../../../repositories';
import { logger } from '../../../services/LoggingService';
import type { PromptHistoryEntry, PromptVersionEntry, SaveEntryParams, SaveResult } from '../types';
import type { UpdatePromptOptions } from '../../../repositories/promptRepositoryTypes';

const log = logger.child('historyRepository');

const isValidFirestoreDocId = (docId: string | null | undefined): docId is string => {
  if (!docId) {
    return false;
  }
  const normalized = docId.trim();
  return normalized.length > 0 && !normalized.startsWith('draft-');
};

/**
 * Normalize prompt entries to ensure consistent shape
 */
export function normalizeEntries(entries: PromptHistoryEntry[]): PromptHistoryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    title: entry.title ?? null,
    brainstormContext: entry.brainstormContext ?? null,
    generationParams: entry.generationParams ?? null,
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

    // Log generation data from loaded entries for persistence debugging
    const entriesWithGenerations = normalized.filter(
      (entry) => entry.versions?.some((v) => Array.isArray(v.generations) && v.generations.length > 0)
    );
    console.debug('[PERSIST-DEBUG][loadFromFirestore] loaded entries', {
      totalEntries: normalized.length,
      entriesWithGenerations: entriesWithGenerations.length,
      generationDetails: entriesWithGenerations.slice(0, 5).map((entry) => ({
        uuid: entry.uuid,
        docId: entry.id,
        versionCount: entry.versions?.length ?? 0,
        versions: entry.versions?.map((v) => ({
          versionId: v.versionId,
          generationCount: v.generations?.length ?? 0,
          generations: v.generations?.map((g) => ({
            id: g.id.slice(-6),
            status: g.status,
            mediaType: g.mediaType,
            mediaUrlCount: g.mediaUrls?.length ?? 0,
            mediaAssetIdCount: g.mediaAssetIds?.length ?? 0,
            hasThumbnail: Boolean(g.thumbnailUrl),
            firstUrl: g.mediaUrls?.[0]?.slice(0, 60) ?? null,
          })),
        })),
      })),
    });

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
  const repository = getLocalPromptRepository();
  return repository.syncEntries(entries);
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
      ...(params.uuid ? { uuid: params.uuid } : {}),
      ...(params.title !== undefined ? { title: params.title } : {}),
      input: params.input,
      output: params.output,
      score: params.score,
      mode: params.mode,
      ...(params.targetModel ? { targetModel: params.targetModel } : {}),
      ...(params.generationParams ? { generationParams: params.generationParams } : {}),
      brainstormContext: params.brainstormContext ?? null,
      highlightCache: params.highlightCache ?? null,
      ...(Array.isArray(params.versions) ? { versions: params.versions } : {}),
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
 * Update prompt details (persisted)
 */
export async function updatePrompt(
  userId: string | undefined,
  uuid: string,
  docId: string | null,
  updates: UpdatePromptOptions
): Promise<void> {
  const repository = getPromptRepositoryForUser(!!userId);

  if ('updatePrompt' in repository && typeof repository.updatePrompt === 'function') {
    const isFirestoreRepo = 'collectionName' in repository && userId;
    const canUseFirestoreDoc = isValidFirestoreDocId(docId);

    try {
      if (isFirestoreRepo) {
        if (!canUseFirestoreDoc) {
          return;
        }
        await repository.updatePrompt(docId, updates);
        return;
      }
      await repository.updatePrompt(uuid, updates);
    } catch (error) {
      log.warn('Unable to persist updated prompt', {
        uuid,
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
    try {
      await repository.updateHighlights(uuid, { highlightCache });
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
    const canUseFirestoreDoc = isValidFirestoreDocId(docId);

    try {
      if (isFirestoreRepo) {
        if (!canUseFirestoreDoc) {
          return;
        }
        await repository.updateOutput(docId, output);
        return;
      }
      await repository.updateOutput(uuid, output);
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
 * Update versions array for an entry
 */
export async function updateVersions(
  userId: string | undefined,
  uuid: string,
  docId: string | null,
  versions: PromptVersionEntry[]
): Promise<void> {
  const repository = getPromptRepositoryForUser(!!userId);

  if ('updateVersions' in repository && typeof repository.updateVersions === 'function') {
    const isFirestoreRepo = 'collectionName' in repository && userId;
    const canUseFirestoreDoc = isValidFirestoreDocId(docId);

    const generationCount = versions.reduce(
      (sum, v) => sum + (Array.isArray(v.generations) ? v.generations.length : 0),
      0
    );

    // Detailed generation data logging for persistence debugging
    const generationDetails = versions.flatMap((v) =>
      (v.generations ?? []).map((g) => ({
        versionId: v.versionId,
        genId: g.id.slice(-6),
        status: g.status,
        mediaType: g.mediaType,
        mediaUrlCount: g.mediaUrls?.length ?? 0,
        mediaAssetIdCount: g.mediaAssetIds?.length ?? 0,
        hasThumbnail: Boolean(g.thumbnailUrl),
        firstUrl: g.mediaUrls?.[0]?.slice(0, 60) ?? null,
        firstAssetId: g.mediaAssetIds?.[0]?.slice(0, 60) ?? null,
      }))
    );

    console.debug('[PERSIST-DEBUG][historyRepository.updateVersions] called', {
      userId: userId ? userId.slice(0, 8) + '...' : null,
      uuid,
      docId,
      isFirestoreRepo,
      canUseFirestoreDoc,
      versionCount: versions.length,
      generationCount,
      generationDetails,
    });

    try {
      if (isFirestoreRepo) {
        if (!canUseFirestoreDoc) {
          console.warn('[PERSIST-DEBUG][historyRepository.updateVersions] SKIPPED — draft/invalid docId', {
            uuid,
            docId,
            versionCount: versions.length,
            generationCount,
          });
          log.warn('Skipping Firestore version update — draft or invalid docId', {
            uuid,
            docId,
            versionCount: versions.length,
            generationCount,
          });
          return;
        }
        await repository.updateVersions(docId, versions);
        console.debug('[PERSIST-DEBUG][historyRepository.updateVersions] SUCCESS (Firestore)', {
          uuid,
          docId,
          versionCount: versions.length,
          generationCount,
        });
        log.debug('Versions persisted to Firestore', {
          uuid,
          docId,
          versionCount: versions.length,
          generationCount,
        });
        return;
      }
      await repository.updateVersions(uuid, versions);
      console.debug('[PERSIST-DEBUG][historyRepository.updateVersions] SUCCESS (localStorage)', {
        uuid,
        versionCount: versions.length,
        generationCount,
      });
    } catch (error) {
      console.error('[PERSIST-DEBUG][historyRepository.updateVersions] FAILED', {
        uuid,
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      log.error('Failed to persist versions to Firestore', error as Error, {
        uuid,
        docId,
        versionCount: versions.length,
        generationCount,
      });
    }
  } else {
    console.warn('[PERSIST-DEBUG][historyRepository.updateVersions] repository has no updateVersions method', {
      uuid,
      docId,
    });
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
