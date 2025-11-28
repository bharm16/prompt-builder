import { cacheService } from '../../cache/CacheService.js';
import type { VideoConstraints } from '../services/types.js';

export interface EnhancementCacheParams {
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  isVideoPrompt: boolean;
  brainstormSignature: string;
  highlightedCategory: string | null;
  highlightWordCount: number;
  phraseRole: string | null;
  videoConstraints: VideoConstraints | null;
  editHistory: Array<{ original?: string; category?: string }>;
  modelTarget: string | null;
  promptSection: string | null;
}

/**
 * Cache Key Factory
 *
 * Generates cache keys for enhancement requests.
 * Handles edit fingerprint generation and cache key construction.
 */
export class CacheKeyFactory {
  /**
   * Generate cache key for enhancement request
   * Includes edit/model context for cache separation
   *
   * @param namespace - Cache namespace
   * @param params - Enhancement cache parameters
   * @returns Cache key string
   */
  static generateKey(namespace: string, params: EnhancementCacheParams): string {
    let editFingerprint: string | null = null;
    if (Array.isArray(params.editHistory) && params.editHistory.length > 0) {
      // Create compact fingerprint from recent edit patterns
      editFingerprint = params.editHistory
        .slice(-5) // Last 5 edits only
        .map((edit) => `${edit.category || 'n'}:${(edit.original || '').substring(0, 10)}`)
        .join('|');
    }

    return cacheService.generateKey(namespace, {
      highlightedText: params.highlightedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      fullPrompt: (params.fullPrompt || '').substring(0, 500),
      originalUserPrompt: (params.originalUserPrompt || '').substring(0, 500),
      isVideoPrompt: params.isVideoPrompt,
      brainstormSignature: params.brainstormSignature,
      highlightedCategory: params.highlightedCategory || null,
      highlightWordCount: params.highlightWordCount,
      phraseRole: params.phraseRole,
      videoConstraintMode: params.videoConstraints?.mode || null,
      editFingerprint: editFingerprint || null,
      modelTarget: params.modelTarget || null,
      promptSection: params.promptSection || null,
    });
  }
}

