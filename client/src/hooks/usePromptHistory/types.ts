/**
 * Types for usePromptHistory hook
 */

export interface User {
  uid: string;
  [key: string]: unknown;
}

export interface PromptHistoryEntry {
  id?: string;
  uuid?: string;
  timestamp?: string;
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
  versions?: unknown[];
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
  input: string;
  output: string;
  score: number | null;
  mode: string;
  targetModel?: string | null;
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
}

export interface SaveResult {
  uuid: string;
  id: string;
}
