import type { PromptKeyframe, PromptVersionEntry } from '@hooks/types';

export type PromptData = {
  uuid?: string;
  title?: string | null;
  generationParams?: Record<string, unknown> | null;
  keyframes?: PromptKeyframe[] | null;
  highlightCache?: Record<string, unknown> | null;
  versions?: PromptVersionEntry[];
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  brainstormContext?: Record<string, unknown> | null;
};

export type SavedPromptResult = {
  id: string;
  uuid: string;
};

export type UpdateHighlightsOptions = {
  highlightCache?: Record<string, unknown> | null;
  versionEntry?: {
    timestamp?: string;
  };
};

export type UpdatePromptOptions = {
  title?: string | null;
  input?: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
  keyframes?: PromptKeyframe[] | null;
  mode?: string;
};

export class PromptRepositoryError extends Error {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = 'PromptRepositoryError';
    this.originalError = originalError;
  }
}
