/**
 * Types for PromptCanvas component
 */

import type { Mode } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';

export interface SpansData {
  spans: unknown[];
  meta: unknown | null;
  source: string;
  timestamp: number;
}

export interface HighlightSnapshot {
  signature: string;
  [key: string]: unknown;
}

export interface PromptCanvasProps {
  inputPrompt: string;
  displayedPrompt: string | null;
  optimizedPrompt: string;
  qualityScore: number | null;
  selectedMode: string;
  currentMode: Mode;
  promptUuid: string | null;
  promptContext: PromptContext | null;
  onDisplayedPromptChange: (text: string) => void;
  suggestionsData: unknown | null;
  onFetchSuggestions?: (text: string, trigger: string) => void;
  onSuggestionClick?: (suggestion: unknown) => void;
  onCreateNew: () => void;
  initialHighlights?: HighlightSnapshot | null;
  initialHighlightsVersion?: number;
  onHighlightsPersist?: (result: unknown) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isDraftReady?: boolean;
  isRefining?: boolean;
  draftSpans?: SpansData | null;
  refinedSpans?: SpansData | null;
}

