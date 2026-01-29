/**
 * Types for usePromptHistory hook
 *
 * Re-exports shared types from @hooks/types and defines hook-specific types.
 */

// Re-export shared types to maintain backward compatibility
export type {
  User,
  PromptKeyframe,
  PromptHistoryEntry,
  PromptVersionEdit,
  PromptVersionPreview,
  PromptVersionVideo,
  PromptVersionEntry,
  Toast,
} from '@hooks/types';

import type { PromptHistoryEntry, PromptKeyframe, PromptVersionEntry } from '@hooks/types';

export interface HistoryState {
  history: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
}

export interface SaveEntryParams {
  uuid?: string;
  title?: string | null;
  input: string;
  output: string;
  score: number | null;
  mode: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
  keyframes?: PromptKeyframe[] | null;
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
  versions?: PromptVersionEntry[];
}

export interface SaveResult {
  uuid: string;
  id: string;
}
