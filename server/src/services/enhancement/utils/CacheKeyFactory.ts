import type { CacheService } from "@services/cache/CacheService";
import { sha256Hex } from "@utils/hash";
import type {
  VideoConstraints,
  BrainstormSignature,
  EditHistoryEntry,
} from "../services/types.js";

export interface EnhancementCacheParams {
  engineVersion: "v2";
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  isVideoPrompt: boolean;
  brainstormSignature: BrainstormSignature | null;
  highlightedCategory: string | null;
  highlightWordCount: number;
  phraseRole: string | null;
  videoConstraints: VideoConstraints | null;
  editHistory: EditHistoryEntry[];
  modelTarget: string | null;
  promptSection: string | null;
  policyVersion?: string | null;
  spanFingerprint?: string | null;
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
  static generateKey(
    namespace: string,
    params: EnhancementCacheParams,
    cacheService: Pick<CacheService, "generateKey">,
  ): string {
    let editFingerprint: string | null = null;
    if (Array.isArray(params.editHistory) && params.editHistory.length > 0) {
      // Create compact fingerprint from recent edit patterns
      editFingerprint = params.editHistory
        .slice(-5) // Last 5 edits only
        .map(
          (edit) =>
            `${edit.category || "n"}:${(edit.original || "").substring(0, 10)}`,
        )
        .join("|");
    }

    // Hash the long-text fields rather than truncating them. Truncation
    // produced collisions: two distinct prompts that shared the first
    // PROMPT_PREVIEW_LIMIT (6000) chars of fullPrompt — or the first 500 of
    // originalUserPrompt — yielded the same cache key, so users editing the
    // tail of a long prompt could receive cached suggestions for an earlier
    // version. getCustomSuggestions already hashes its full inputs (see
    // EnhancementService.ts:562); this propagates that pattern.
    return cacheService.generateKey(namespace, {
      engineVersion: params.engineVersion,
      highlightedText: params.highlightedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      fullPrompt: params.fullPrompt ? sha256Hex(params.fullPrompt, 16) : "",
      originalUserPrompt: params.originalUserPrompt
        ? sha256Hex(params.originalUserPrompt, 16)
        : "",
      isVideoPrompt: params.isVideoPrompt,
      brainstormSignature: params.brainstormSignature,
      highlightedCategory: params.highlightedCategory || null,
      highlightWordCount: params.highlightWordCount,
      phraseRole: params.phraseRole,
      videoConstraintMode: params.videoConstraints?.mode || null,
      editFingerprint: editFingerprint || null,
      modelTarget: params.modelTarget || null,
      promptSection: params.promptSection || null,
      policyVersion: params.policyVersion || null,
      spanFingerprint: params.spanFingerprint || null,
    });
  }
}
