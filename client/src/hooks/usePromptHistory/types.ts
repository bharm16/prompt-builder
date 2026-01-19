/**
 * Types for usePromptHistory hook
 */

import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';

export interface User {
  uid: string;
  [key: string]: unknown;
}

export interface PromptHistoryEntry {
  id?: string;
  uuid?: string;
  timestamp?: string;
  title?: string | null;
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
  versions?: PromptVersionEntry[];
}

export interface PromptVersionEdit {
  timestamp: string;
  delta?: number;
  source?: 'manual' | 'suggestion' | 'unknown';
}

export interface PromptVersionPreview {
  generatedAt: string;
  imageUrl?: string | null;
  aspectRatio?: string | null;
}

export interface PromptVersionVideo {
  generatedAt: string;
  videoUrl?: string | null;
  model?: string | null;
  generationParams?: Record<string, unknown> | null;
}

export interface PromptVersionEntry {
  versionId: string;
  label?: string;
  signature: string;
  prompt: string;
  timestamp: string;
  highlights?: unknown | null;
  editCount?: number;
  edits?: PromptVersionEdit[];
  preview?: PromptVersionPreview | null;
  video?: PromptVersionVideo | null;
  generations?: Generation[] | null;
}

export interface Toast {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

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
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
}

export interface SaveResult {
  uuid: string;
  id: string;
}
