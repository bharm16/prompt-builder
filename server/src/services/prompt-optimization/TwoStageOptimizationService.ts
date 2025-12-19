/**
 * Two-Stage Optimization Service
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only two-stage optimization orchestration
 * - DIP: Depends on IAIClient and IOptimizationMode abstractions
 * - OCP: Works with any mode through IOptimizationMode interface
 */

import { logger } from '@infrastructure/Logger';

interface AIClient {
  complete(prompt: string, options: {
    userMessage?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{ text: string }>;
}

interface OptimizationMode {
  getName(): string;
  generateDraftPrompt(prompt: string, context: unknown): string;
  generateSystemPrompt(prompt: string, context: unknown, shotPlan: unknown): string;
}

interface SpanLabeler {
  labelSpans?(text: string): Promise<unknown>;
}

interface TwoStageOptimizationOptions {
  draftClient?: AIClient | null;
  refinementClient: AIClient;
  spanLabeler?: SpanLabeler | null;
}

interface TwoStageOptimizationParams {
  prompt: string;
  mode: OptimizationMode;
  context?: unknown;
  onDraft?: (draft: string, spans?: unknown) => void;
}

interface TwoStageOptimizationResult {
  draft: string;
  refined: string;
  draftSpans?: unknown | null;
  refinedSpans?: unknown | null;
  metadata?: {
    draftDuration?: number;
    refinementDuration?: number;
    totalDuration?: number;
    usedTwoStage?: boolean;
  };
  usedFallback?: boolean;
  error?: string;
}

export class TwoStageOptimizationService {
  private readonly draftClient: AIClient | null;
  private readonly refinementClient: AIClient;
  private readonly spanLabeler: SpanLabeler | null;
  private readonly log = logger.child({ service: 'TwoStageOptimizationService' });

  constructor({ draftClient = null, refinementClient, spanLabeler = null }: TwoStageOptimizationOptions) {
    this.draftClient = draftClient; // Fast client (e.g., ChatGPT)
    this.refinementClient = refinementClient; // Quality client (e.g., OpenAI)
    this.spanLabeler = spanLabeler;
  }

  /**
   * Perform two-stage optimization
   */
  async optimize({ prompt, mode, context, onDraft }: TwoStageOptimizationParams): Promise<TwoStageOptimizationResult> {
    const startTime = performance.now();
    const operation = 'optimize';
    const modeName = mode.getName();

    this.log.debug('Starting two-stage optimization', {
      operation,
      mode: modeName,
      hasDraftClient: !!this.draftClient,
      promptLength: prompt.length,
    });

    // Fallback to single-stage if no draft client
    if (!this.draftClient) {
      this.log.warn('No draft client available, using single-stage', {
        operation,
        mode: modeName,
      });
      const fallbackResult = await this._singleStageOptimization(prompt, mode, context);
      const duration = Math.round(performance.now() - startTime);
      
      this.log.info('Single-stage optimization complete', {
        operation,
        mode: modeName,
        duration,
        usedFallback: true,
      });
      
      return {
        draft: fallbackResult,
        refined: fallbackResult,
        usedFallback: true,
      };
    }

    try {
      // STAGE 1: Generate draft
      const draftStartTime = performance.now();
      const draftResult = await this._generateDraft(prompt, mode, context);
      const draftDuration = Math.round(performance.now() - draftStartTime);

      this.log.debug('Draft generated', {
        operation: 'generateDraft',
        mode: modeName,
        duration: draftDuration,
        draftLength: draftResult.draft.length,
        hasSpans: !!draftResult.spans,
      });

      // Call onDraft callback
      if (onDraft && typeof onDraft === 'function') {
        onDraft(draftResult.draft, draftResult.spans);
      }

      // STAGE 2: Refine draft
      const refinementStartTime = performance.now();
      const refined = await this._refineDraft(draftResult.draft, mode, context);
      const refinementDuration = Math.round(performance.now() - refinementStartTime);

      const totalDuration = Math.round(performance.now() - startTime);

      this.log.info('Two-stage optimization complete', {
        operation,
        mode: modeName,
        draftDuration,
        refinementDuration,
        totalDuration,
        draftLength: draftResult.draft.length,
        refinedLength: refined.length,
      });

      return {
        draft: draftResult.draft,
        refined,
        draftSpans: draftResult.spans,
        refinedSpans: null, // Skip for performance
        metadata: {
          draftDuration,
          refinementDuration,
          totalDuration,
          usedTwoStage: true,
        }
      };

    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.log.error('Two-stage optimization failed', error as Error, {
        operation,
        mode: modeName,
        duration,
        promptLength: prompt.length,
      });
      
      // Fallback to single-stage
      try {
        const fallback = await this._singleStageOptimization(prompt, mode, context);
        const fallbackDuration = Math.round(performance.now() - startTime);
        
        this.log.info('Fallback single-stage optimization complete', {
          operation: 'fallbackOptimization',
          mode: modeName,
          duration: fallbackDuration,
          usedFallback: true,
        });
        
        return {
          draft: fallback,
          refined: fallback,
          usedFallback: true,
          error: (error as Error).message,
        };
      } catch (fallbackError) {
        const fallbackDuration = Math.round(performance.now() - startTime);
        
        this.log.error('Fallback optimization also failed', fallbackError as Error, {
          operation: 'fallbackOptimization',
          mode: modeName,
          duration: fallbackDuration,
        });
        
        throw fallbackError;
      }
    }
  }

  private async _generateDraft(prompt: string, mode: OptimizationMode, context: unknown): Promise<{ draft: string; spans: unknown | null }> {
    const startTime = performance.now();
    const operation = '_generateDraft';
    const modeName = mode.getName();
    
    this.log.debug('Generating draft', {
      operation,
      mode: modeName,
    });
    
    try {
      const draftPrompt = mode.generateDraftPrompt(prompt, context);
      
      const response = await this.draftClient!.complete(draftPrompt, {
        userMessage: prompt,
        maxTokens: modeName === 'video' ? 300 : 200,
        temperature: 0.7,
        timeout: 5000,
      });

      const duration = Math.round(performance.now() - startTime);
      
      this.log.debug('Draft generation completed', {
        operation,
        mode: modeName,
        duration,
        draftLength: response.text.length,
      });

      return {
        draft: response.text,
        spans: null,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.log.error('Draft generation failed', error as Error, {
        operation,
        mode: modeName,
        duration,
      });
      
      throw error;
    }
  }

  private async _refineDraft(draft: string, mode: OptimizationMode, context: unknown): Promise<string> {
    const startTime = performance.now();
    const operation = '_refineDraft';
    const modeName = mode.getName();
    
    this.log.debug('Refining draft', {
      operation,
      mode: modeName,
      draftLength: draft.length,
    });
    
    try {
      const systemPrompt = mode.generateSystemPrompt(draft, context, null);
      
      const response = await this.refinementClient.complete(systemPrompt, {
        maxTokens: 4096,
        temperature: 0.7,
        timeout: modeName === 'video' ? 90000 : 30000,
      });

      const duration = Math.round(performance.now() - startTime);
      
      this.log.debug('Draft refinement completed', {
        operation,
        mode: modeName,
        duration,
        refinedLength: response.text.length,
      });

      return response.text;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.log.error('Draft refinement failed', error as Error, {
        operation,
        mode: modeName,
        duration,
        draftLength: draft.length,
      });
      
      throw error;
    }
  }

  private async _singleStageOptimization(prompt: string, mode: OptimizationMode, context: unknown): Promise<string> {
    const startTime = performance.now();
    const operation = '_singleStageOptimization';
    const modeName = mode.getName();
    
    this.log.debug('Performing single-stage optimization', {
      operation,
      mode: modeName,
      promptLength: prompt.length,
    });
    
    try {
      const systemPrompt = mode.generateSystemPrompt(prompt, context, null);
      
      const response = await this.refinementClient.complete(systemPrompt, {
        maxTokens: 4096,
        temperature: 0.7,
        timeout: modeName === 'video' ? 90000 : 30000,
      });

      const duration = Math.round(performance.now() - startTime);
      
      this.log.debug('Single-stage optimization completed', {
        operation,
        mode: modeName,
        duration,
        resultLength: response.text.length,
      });

      return response.text;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.log.error('Single-stage optimization failed', error as Error, {
        operation,
        mode: modeName,
        duration,
        promptLength: prompt.length,
      });
      
      throw error;
    }
  }
}

