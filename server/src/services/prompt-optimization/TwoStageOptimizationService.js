/**
 * Two-Stage Optimization Service
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only two-stage optimization orchestration
 * - DIP: Depends on IAIClient and IOptimizationMode abstractions
 * - OCP: Works with any mode through IOptimizationMode interface
 */
export class TwoStageOptimizationService {
  constructor({ draftClient = null, refinementClient, logger = null, spanLabeler = null }) {
    this.draftClient = draftClient; // Fast client (e.g., Groq)
    this.refinementClient = refinementClient; // Quality client (e.g., OpenAI)
    this.logger = logger;
    this.spanLabeler = spanLabeler;
  }

  /**
   * Perform two-stage optimization
   * @param {Object} params - Optimization parameters
   * @returns {Promise<Object>} Draft and refined results
   */
  async optimize({ prompt, mode, context, onDraft }) {
    this.logger?.info('Starting two-stage optimization', {
      mode: mode.getName(),
      hasDraftClient: !!this.draftClient,
    });

    // Fallback to single-stage if no draft client
    if (!this.draftClient) {
      this.logger?.warn('No draft client available, using single-stage');
      return this._singleStageOptimization(prompt, mode, context);
    }

    const startTime = Date.now();

    try {
      // STAGE 1: Generate draft
      const draftResult = await this._generateDraft(prompt, mode, context);
      const draftDuration = Date.now() - startTime;

      this.logger?.info('Draft generated', {
        duration: draftDuration,
        draftLength: draftResult.draft.length,
        hasSpans: !!draftResult.spans,
      });

      // Call onDraft callback
      if (onDraft && typeof onDraft === 'function') {
        onDraft(draftResult.draft, draftResult.spans);
      }

      // STAGE 2: Refine draft
      const refinementStartTime = Date.now();
      const refined = await this._refineDraft(draftResult.draft, mode, context);
      const refinementDuration = Date.now() - refinementStartTime;

      const totalDuration = Date.now() - startTime;

      this.logger?.info('Two-stage optimization complete', {
        draftDuration,
        refinementDuration,
        totalDuration,
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
      this.logger?.error('Two-stage optimization failed', error);
      
      // Fallback to single-stage
      const fallback = await this._singleStageOptimization(prompt, mode, context);
      return {
        draft: fallback,
        refined: fallback,
        usedFallback: true,
        error: error.message,
      };
    }
  }

  async _generateDraft(prompt, mode, context) {
    const draftPrompt = mode.generateDraftPrompt(prompt, context);
    
    const response = await this.draftClient.complete(draftPrompt, {
      userMessage: prompt,
      maxTokens: mode.getName() === 'video' ? 300 : 200,
      temperature: 0.7,
      timeout: 5000,
    });

    return {
      draft: response.text,
      spans: null,
    };
  }

  async _refineDraft(draft, mode, context) {
    const systemPrompt = mode.generateSystemPrompt(draft, context, null);
    
    const response = await this.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: mode.getName() === 'video' ? 90000 : 30000,
    });

    return response.text;
  }

  async _singleStageOptimization(prompt, mode, context) {
    const systemPrompt = mode.generateSystemPrompt(prompt, context, null);
    
    const response = await this.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: mode.getName() === 'video' ? 90000 : 30000,
    });

    return response.text;
  }
}
