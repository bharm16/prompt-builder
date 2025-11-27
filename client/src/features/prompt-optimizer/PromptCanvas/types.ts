/**
 * Types for PromptCanvas component
 */

import type { Mode } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';

import type { SpanData } from '../span-highlighting/hooks/useHighlightSourceSelection';

export interface SpansData {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
  source: string;
  timestamp: number;
}

export interface HighlightSnapshot {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta?: Record<string, unknown> | null;
  signature?: string;
  cacheId?: string | null;
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
  onFetchSuggestions?: (payload: {
    highlightedText?: string;
    originalText?: string;
    displayedPrompt?: string;
    range?: Range | null;
    offsets?: { start?: number; end?: number } | null;
    metadata?: Record<string, unknown> | null;
    trigger?: string;
    allLabeledSpans?: unknown[];
  }) => void;
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

