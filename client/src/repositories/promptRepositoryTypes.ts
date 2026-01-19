import type { PromptVersionEntry } from '@hooks/types';

export type PromptData = {
  uuid?: string;
  title?: string | null;
  generationParams?: Record<string, unknown> | null;
  highlightCache?: unknown | null;
  versions?: PromptVersionEntry[];
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  brainstormContext?: unknown | null;
  [key: string]: unknown;
};

export type SavedPromptResult = {
  id: string;
  uuid: string;
};

export type UpdateHighlightsOptions = {
  highlightCache?: unknown | null;
  versionEntry?: {
    timestamp?: string;
    [key: string]: unknown;
  };
};

export type UpdatePromptOptions = {
  title?: string | null;
  input?: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
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
