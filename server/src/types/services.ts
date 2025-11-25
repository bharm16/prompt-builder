/**
 * Service Types
 *
 * Types for service interfaces and implementations
 */

import type { PromptOptimizationRequest, SuggestionRequest } from './requests.js';

export interface OptimizationResult {
  optimizedPrompt: string;
  improvements: string[];
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score?: number;
  breakdown?: Record<string, unknown>;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface Suggestion {
  text: string;
  confidence?: number;
  category?: string;
  reasoning?: string;
  [key: string]: unknown;
}

export interface EnhancementResult {
  suggestions: Suggestion[];
  isPlaceholder?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SpanLabel {
  text: string;
  start: number;
  end: number;
  role: string;
  category?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface SpanLabelingResult {
  spans: SpanLabel[];
  metadata?: Record<string, unknown>;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl?: number;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

