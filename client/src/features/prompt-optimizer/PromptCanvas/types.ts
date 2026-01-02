/**
 * Types for PromptCanvas component
 */

import type { Mode } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CanonicalText } from '@utils/canonicalText';
import type { HighlightSpan } from '@features/span-highlighting/hooks/useHighlightRendering';

import type { SpanData } from '@features/span-highlighting/hooks/useHighlightSourceSelection';

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
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ParseResult {
  canonical: CanonicalText;
  spans: HighlightSpan[];
  meta: Record<string, unknown> | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: Error | null;
  displayText: string;
}

export interface SuggestionPayload {
  highlightedText?: string;
  originalText?: string;
  displayedPrompt?: string;
  range?: Range | null;
  offsets?: { start?: number; end?: number } | null;
  metadata?: Record<string, unknown> | null;
  trigger?: 'selection' | 'highlight' | 'bento-grid';
  allLabeledSpans?: Array<{
    start: number;
    end: number;
    category?: string;
    confidence?: number;
    [key: string]: unknown;
  }>;
}

export interface SpanClickPayload {
  quote: string;
  start: number;
  end: number;
  category?: string;
  source?: string;
  spanId?: string;
  startGrapheme?: number;
  endGrapheme?: number;
  validatorPass?: boolean;
  confidence?: number;
  leftCtx?: string;
  rightCtx?: string;
  idempotencyKey?: string;
  id?: string;
}

export interface SuggestionItem {
  id?: string;
  text?: string;
  category?: string;
  suggestions?: SuggestionItem[];
  compatibility?: number;
  explanation?: string;
  [key: string]: unknown;
}

export interface SuggestionsData {
  show: boolean;
  selectedText: string;
  originalText: string;
  suggestions: SuggestionItem[];
  isLoading: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  isPlaceholder: boolean;
  fullPrompt: string;
  range?: Range | null;
  offsets?: { start?: number; end?: number } | null;
  metadata?: {
    category?: string;
    span?: {
      category?: string;
      confidence?: number;
      startIndex?: number;
      [key: string]: unknown;
    };
    confidence?: number;
    leftCtx?: string;
    rightCtx?: string;
    idempotencyKey?: string | null;
    [key: string]: unknown;
  } | null;
  onRetry?: () => void;
  setSuggestions?: (suggestions: SuggestionItem[], category?: string) => void;
  onSuggestionClick?: (suggestion: SuggestionItem | string) => void | Promise<void>;
  onClose?: () => void;
  [key: string]: unknown;
}

export interface PromptCanvasState {
  showExportMenu: boolean;
  showModelMenu: boolean;
  showLegend: boolean;
  rightPaneMode: 'refine' | 'preview';
  showHighlights: boolean;
  visualLastGeneratedAt: number | null;
  videoLastGeneratedAt: number | null;
  visualGenerateRequestId: number;
  videoGenerateRequestId: number;
  isEditing: boolean;
  originalInputPrompt: string;
  originalSelectedModel: string | undefined;
  selectedSpanId: string | null;
  lastAppliedSpanId: string | null;
  hasInteracted: boolean;
  hoveredSpanId: string | null;
  lastSwapTime: number | null;
  promptState: 'generated' | 'edited' | 'synced';
  generatedTimestamp: number | null;
  justReplaced: { from: string; to: string } | null;
}

export type PromptCanvasAction =
  | { type: 'MERGE_STATE'; payload: Partial<PromptCanvasState> }
  | { type: 'INCREMENT_VISUAL_REQUEST_ID' }
  | { type: 'INCREMENT_VIDEO_REQUEST_ID' };

export interface ValidSpan {
  start: number;
  end: number;
  category: string;
  confidence: number;
}

export interface PromptCanvasProps {
  inputPrompt: string;
  onInputPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string) => Promise<void>;
  displayedPrompt: string | null;
  optimizedPrompt: string;
  previewPrompt?: string | null;
  previewAspectRatio?: string | null;
  qualityScore: number | null;
  selectedMode: string;
  currentMode: Mode;
  promptUuid: string | null;
  promptContext: PromptContext | null;
  onDisplayedPromptChange: (text: string) => void;
  suggestionsData: SuggestionsData | null;
  onFetchSuggestions?: (payload: SuggestionPayload) => void;
  onSuggestionClick?: (suggestion: SuggestionItem | string) => void;
  onCreateNew: () => void;
  initialHighlights?: HighlightSnapshot | null;
  initialHighlightsVersion?: number;
  onHighlightsPersist?: (result: {
    spans: Array<{
      start: number;
      end: number;
      category: string;
      confidence: number;
    }>;
    meta: Record<string, unknown> | null;
    signature: string;
    cacheId?: string | null;
    source?: string;
    [key: string]: unknown;
  }) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isDraftReady?: boolean;
  isRefining?: boolean;
  isProcessing?: boolean;
  draftSpans?: SpansData | null;
  refinedSpans?: SpansData | null;
}
