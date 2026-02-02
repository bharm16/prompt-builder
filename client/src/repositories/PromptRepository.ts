/**
 * PromptRepository - Session-backed data access layer for prompts
 *
 * Uses unified sessions API as the canonical store.
 */

import type { SessionDto } from '@shared/types/session';
import { apiClient } from '@/services/ApiClient';
import { logger } from '../services/LoggingService';
import type { PromptHistoryEntry, PromptKeyframe, PromptVersionEntry } from '../hooks/types';
import type { PromptData, SavedPromptResult, UpdateHighlightsOptions, UpdatePromptOptions } from './promptRepositoryTypes';
import { PromptRepositoryError } from './promptRepositoryTypes';

const log = logger.child('PromptRepository');

/**
 * Repository for managing prompt data
 */
export class PromptRepository {
  /**
   * Save a new prompt
   */
  async save(userId: string, promptData: PromptData): Promise<SavedPromptResult> {
    try {
      void userId;
      const response = await apiClient.post('/v2/sessions', {
        name: promptData.title ?? undefined,
        prompt: {
          uuid: promptData.uuid,
          title: promptData.title ?? undefined,
          input: promptData.input,
          output: promptData.output,
          score: promptData.score ?? null,
          mode: promptData.mode,
          targetModel: promptData.targetModel ?? null,
          generationParams: promptData.generationParams ?? null,
          keyframes: promptData.keyframes ?? null,
          brainstormContext: promptData.brainstormContext ?? null,
          highlightCache: promptData.highlightCache ?? null,
          versions: Array.isArray(promptData.versions) ? promptData.versions : [],
        },
      });
      const data = (response as { data?: SessionDto }).data;
      if (!data) {
        throw new Error('Invalid session response');
      }
      const uuid = data.prompt?.uuid ?? promptData.uuid ?? '';
      return { id: data.id, uuid };
    } catch (error) {
      log.error('Error saving prompt', error as Error);
      throw new PromptRepositoryError('Failed to save prompt', error);
    }
  }

  /**
   * Get prompts for a user
   */
  async getUserPrompts(userId: string, limitCount: number = 10): Promise<PromptHistoryEntry[]> {
    try {
      void userId;
      const response = await apiClient.get(
        `/v2/sessions?limit=${encodeURIComponent(String(limitCount))}&includeContinuity=false&includePrompt=true`
      );
      const data = (response as { data?: SessionDto[] }).data ?? [];
      return data
        .map((session) => this._mapSessionToPrompt(session))
        .filter((entry): entry is PromptHistoryEntry => Boolean(entry));
    } catch (error) {
      log.error('Error fetching prompts', error as Error);
      throw new PromptRepositoryError('Failed to fetch user prompts', error);
    }
  }

  /**
   * Get a single prompt by UUID
   */
  async getByUuid(uuid: string): Promise<PromptHistoryEntry | null> {
    try {
      const response = await apiClient.get(`/v2/sessions/by-prompt/${encodeURIComponent(uuid)}`);
      const data = (response as { data?: SessionDto }).data;
      if (!data) return null;
      return this._mapSessionToPrompt(data);
    } catch (error) {
      log.error('Error fetching prompt by UUID', error as Error);
      throw new PromptRepositoryError('Failed to fetch prompt by UUID', error);
    }
  }

  /**
   * Get a single prompt by Session ID
   */
  async getById(sessionId: string): Promise<PromptHistoryEntry | null> {
    try {
      const response = await apiClient.get(`/v2/sessions/${encodeURIComponent(sessionId)}`);
      const data = (response as { data?: SessionDto }).data;
      if (!data) return null;
      return this._mapSessionToPrompt(data);
    } catch (error) {
      log.error('Error fetching prompt by session id', error as Error);
      throw new PromptRepositoryError('Failed to fetch prompt by session id', error);
    }
  }

  /**
   * Update prompt details (input, model, params)
   */
  async updatePrompt(docId: string, updates: UpdatePromptOptions): Promise<void> {
    try {
      if (!docId) return;
      await apiClient.patch(`/v2/sessions/${encodeURIComponent(docId)}/prompt`, {
        ...(updates.input !== undefined ? { input: updates.input } : {}),
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.targetModel !== undefined ? { targetModel: updates.targetModel } : {}),
        ...(updates.generationParams !== undefined ? { generationParams: updates.generationParams } : {}),
        ...(updates.keyframes !== undefined ? { keyframes: updates.keyframes } : {}),
        ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
      });
    } catch (error) {
      log.error('Error updating prompt', error as Error);
      throw new PromptRepositoryError('Failed to update prompt', error);
    }
  }

  /**
   * Update prompt highlights
   */
  async updateHighlights(docId: string, { highlightCache, versionEntry }: UpdateHighlightsOptions): Promise<void> {
    try {
      if (!docId) return;
      const sessionId = await this.resolveSessionId(docId);
      await apiClient.patch(`/v2/sessions/${encodeURIComponent(sessionId)}/highlights`, {
        ...(highlightCache !== undefined ? { highlightCache } : {}),
        ...(versionEntry ? { versionEntry } : {}),
      });
    } catch (error) {
      log.error('Error updating prompt highlights', error as Error);
      throw new PromptRepositoryError('Failed to update highlights', error);
    }
  }

  /**
   * Update prompt output text
   */
  async updateOutput(docId: string, output: string): Promise<void> {
    try {
      if (!docId) return;
      await apiClient.patch(`/v2/sessions/${encodeURIComponent(docId)}/output`, { output });
    } catch (error) {
      log.error('Error updating prompt output', error as Error);
      throw new PromptRepositoryError('Failed to update output', error);
    }
  }

  /**
   * Replace versions array for a prompt
   */
  async updateVersions(docId: string, versions: PromptVersionEntry[]): Promise<void> {
    try {
      if (!docId) return;
      await apiClient.patch(`/v2/sessions/${encodeURIComponent(docId)}/versions`, { versions });
    } catch (error) {
      log.error('Error updating prompt versions', error as Error);
      throw new PromptRepositoryError('Failed to update versions', error);
    }
  }

  /**
   * Delete a prompt by its document ID
   */
  async deleteById(docId: string): Promise<void> {
    try {
      if (!docId) {
        throw new Error('Document ID is required for deletion');
      }
      await apiClient.delete(`/v2/sessions/${encodeURIComponent(docId)}`);
    } catch (error) {
      log.error('Error deleting prompt', error as Error);
      throw new PromptRepositoryError('Failed to delete prompt', error);
    }
  }

  private _mapSessionToPrompt(session: SessionDto | null | undefined): PromptHistoryEntry | null {
    if (!session?.prompt) return null;
    const prompt = session.prompt;
    return {
      id: session.id,
      uuid: prompt.uuid ?? undefined,
      timestamp: session.updatedAt,
      title: prompt.title ?? null,
      input: prompt.input,
      output: prompt.output,
      score: prompt.score ?? null,
      mode: prompt.mode,
      targetModel: prompt.targetModel ?? null,
      generationParams: (prompt.generationParams as Record<string, unknown>) ?? null,
      keyframes: (prompt.keyframes as PromptKeyframe[]) ?? null,
      brainstormContext: (prompt.brainstormContext as Record<string, unknown>) ?? null,
      highlightCache: (prompt.highlightCache as Record<string, unknown>) ?? null,
      versions: (prompt.versions as PromptVersionEntry[]) ?? [],
    };
  }

  private async resolveSessionId(sessionIdOrUuid: string): Promise<string> {
    try {
      const response = await apiClient.get(`/v2/sessions/${encodeURIComponent(sessionIdOrUuid)}`);
      const data = (response as { data?: { id: string } }).data;
      if (data?.id) return data.id;
    } catch {
      // fall through
    }

    const response = await apiClient.get(`/v2/sessions/by-prompt/${encodeURIComponent(sessionIdOrUuid)}`);
    const data = (response as { data?: { id: string } }).data;
    if (!data?.id) {
      throw new Error('Session not found for highlight update');
    }
    return data.id;
  }
}
