/**
 * Prompt Builder Interface
 * 
 * Defines the contract for building enhancement prompts.
 * Provider-specific implementations optimize for their target LLM.
 */

import type {
  PromptBuildParams,
  CustomPromptParams,
} from '../types.js';

/**
 * Result from building a prompt, including any provider-specific options
 */
export interface PromptBuildResult {
  /** The system prompt */
  systemPrompt: string;
  /** Optional developer message (OpenAI-specific, highest priority) */
  developerMessage?: string;
  /** Optional user message override */
  userMessage?: string;
  /** Whether to use strict schema mode */
  useStrictSchema?: boolean;
  /** Provider hint for downstream processing */
  provider: 'openai' | 'groq';
  /** Optional reasoning effort for Qwen models */
  reasoningEffort?: 'none' | 'default';
}

/**
 * Interface for prompt builders
 * Each provider has its own implementation
 */
export interface IPromptBuilder {
  /**
   * Build a prompt based on params and mode
   */
  buildPrompt(params: PromptBuildParams): PromptBuildResult;

  /**
   * Build a rewrite prompt (for replacing existing text)
   */
  buildRewritePrompt(params: PromptBuildParams): PromptBuildResult;

  /**
   * Build a placeholder prompt (for filling in placeholders)
   */
  buildPlaceholderPrompt(params: PromptBuildParams): PromptBuildResult;

  /**
   * Build a custom prompt based on user request
   */
  buildCustomPrompt(params: CustomPromptParams): PromptBuildResult;

  /**
   * Get the provider this builder is optimized for
   */
  getProvider(): 'openai' | 'groq';
}

/**
 * Shared context object used during prompt building
 */
export interface SharedPromptContext {
  highlightedText: string;
  inlineContext: string;
  prefix: string;
  suffix: string;
  promptPreview: string;
  constraintLine: string;
  modelLine: string;
  sectionLine: string;
  slotLabel: string;
  guidance: string;
  highlightWordCount: number | null;
  mode: 'rewrite' | 'placeholder';
  replacementInstruction: string;
}
