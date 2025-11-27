/**
 * Two-Stage Optimization Service
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only two-stage optimization orchestration
 * - DIP: Depends on IAIClient and IOptimizationMode abstractions
 * - OCP: Works with any mode through IOptimizationMode interface
 */

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

interface Logger {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, error: Error) => void;
}

interface SpanLabeler {
  labelSpans?(text: string): Promise<unknown>;
}

interface TwoStageOptimizationOptions {
  draftClient?: AIClient | null;
  refinementClient: AIClient;
  logger?: Logger | null;
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
  private readonly logger: Logger | null;
  private readonly spanLabeler: SpanLabeler | null;

  constructor({ draftClient = null, refinementClient, logger = null, spanLabeler = null }: TwoStageOptimizationOptions) {
    this.draftClient = draftClient; // Fast client (e.g., Groq)
    this.refinementClient = refinementClient; // Quality client (e.g., OpenAI)
    this.logger = logger;
    this.spanLabeler = spanLabeler;
  }

  /**
   * Perform two-stage optimization
   */
  async optimize({ prompt, mode, context, onDraft }: TwoStageOptimizationParams): Promise<TwoStageOptimizationResult> {
    this.logger?.info?.('Starting two-stage optimization', {
      mode: mode.getName(),
      hasDraftClient: !!this.draftClient,
    });

    // Fallback to single-stage if no draft client
    if (!this.draftClient) {
      this.logger?.warn?.('No draft client available, using single-stage');
      return {
        draft: await this._singleStageOptimization(prompt, mode, context),
        refined: await this._singleStageOptimization(prompt, mode, context),
        usedFallback: true,
      };
    }

    const startTime = Date.now();

    try {
      // STAGE 1: Generate draft
      const draftResult = await this._generateDraft(prompt, mode, context);
      const draftDuration = Date.now() - startTime;

      this.logger?.info?.('Draft generated', {
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

      this.logger?.info?.('Two-stage optimization complete', {
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
      this.logger?.error?.('Two-stage optimization failed', error as Error);
      
      // Fallback to single-stage
      const fallback = await this._singleStageOptimization(prompt, mode, context);
      return {
        draft: fallback,
        refined: fallback,
        usedFallback: true,
        error: (error as Error).message,
      };
    }
  }

  private async _generateDraft(prompt: string, mode: OptimizationMode, context: unknown): Promise<{ draft: string; spans: unknown | null }> {
    const draftPrompt = mode.generateDraftPrompt(prompt, context);
    
    const response = await this.draftClient!.complete(draftPrompt, {
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

  private async _refineDraft(draft: string, mode: OptimizationMode, context: unknown): Promise<string> {
    const systemPrompt = mode.generateSystemPrompt(draft, context, null);
    
    const response = await this.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: mode.getName() === 'video' ? 90000 : 30000,
    });

    return response.text;
  }

  private async _singleStageOptimization(prompt: string, mode: OptimizationMode, context: unknown): Promise<string> {
    const systemPrompt = mode.generateSystemPrompt(prompt, context, null);
    
    const response = await this.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: mode.getName() === 'video' ? 90000 : 30000,
    });

    return response.text;
  }
}

