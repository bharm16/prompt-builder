import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';

export interface Span {
  text: string;
  start: number;
  end: number;
  category?: string;
  confidence?: number;
}

export interface ValidationIssue {
  type: string;
  missingParent?: string;
  affectedSpans?: Span[];
  message: string;
  count?: number;
}

export interface ValidationSuggestion {
  action: string;
  parentCategory?: string;
  message: string;
  example?: string;
  priority?: string;
}

export interface ValidationResult {
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  isValid: boolean;
  hasOrphans: boolean;
  orphanCount: number;
}

export interface HierarchyValidationOptions {
  enabled?: boolean;
  strictMode?: boolean;
  showSuggestions?: boolean;
}

export interface CanAddCategoryResult {
  canAdd: boolean;
  warning: string | null;
  missingParent: string | null;
}

export interface PromptDebuggerState {
  inputPrompt: string;
  displayedPrompt?: string;
  optimizedPrompt?: string;
  selectedMode?: string;
  promptContext?: Record<string, unknown> | null;
  highlights?: Highlight[];
}

export interface Highlight {
  text: string;
  category?: string;
  confidence?: number;
}

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
}

export type PromptKeyframeSource = 'upload' | 'library' | 'generation' | 'asset';

export interface PromptKeyframe {
  id?: string;
  url: string;
  source?: PromptKeyframeSource;
  assetId?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
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
  keyframes?: PromptKeyframe[] | null;
  brainstormContext?: Record<string, unknown> | null;
  highlightCache?: Record<string, unknown> | null;
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
  storagePath?: string | null;
  assetId?: string | null;
  viewUrlExpiresAt?: string | null;
}

export interface PromptVersionVideo {
  generatedAt: string;
  videoUrl?: string | null;
  model?: string | null;
  generationParams?: Record<string, unknown> | null;
  storagePath?: string | null;
  assetId?: string | null;
  viewUrlExpiresAt?: string | null;
}

export interface PromptVersionEntry {
  versionId: string;
  label?: string;
  signature: string;
  prompt: string;
  timestamp: string;
  highlights?: Record<string, unknown>;
  editCount?: number;
  edits?: PromptVersionEdit[];
  preview?: PromptVersionPreview;
  video?: PromptVersionVideo;
  generations?: Generation[];
}

export interface Toast {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}
