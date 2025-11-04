/**
 * Prompt Optimization Orchestrator
 * 
 * SOLID Principles Applied:
 * - SRP: Coordinates optimization flow, delegates to specialized services
 * - OCP: Uses ModeRegistry for extensible mode support
 * - DIP: All dependencies injected as abstractions
 */
export class PromptOptimizationOrchestrator {
  constructor({
    modeRegistry,
    contextInferenceService,
    twoStageService,
    cacheService,
    logger,
  }) {
    this.modeRegistry = modeRegistry;
    this.contextInferenceService = contextInferenceService;
    this.twoStageService = twoStageService;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  /**
   * Optimize a prompt
   * @param {Object} params - Optimization parameters
   * @returns {Promise<string>} Optimized prompt
   */
  async optimize({
    prompt,
    modeName,
    context = null,
    brainstormContext = null,
    useConstitutionalReview = false,
    useTwoStage = false,
    onDraft = null,
  }) {
    this.logger?.info('Optimizing prompt', { mode: modeName, promptLength: prompt.length });

    // Get mode implementation
    const mode = this.modeRegistry.get(modeName);

    // Infer context if needed
    if (modeName === 'reasoning' && !context) {
      this.logger?.info('Inferring context for reasoning mode');
      context = await this.contextInferenceService.infer(prompt);
    }

    // Check cache
    const cacheKey = this.cacheService.generateKey('prompt-optimization', {
      prompt: prompt.substring(0, 100),
      mode: modeName,
      context,
    });

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger?.debug('Cache hit');
      return cached;
    }

    // Perform optimization
    let optimized;
    if (useTwoStage) {
      const result = await this.twoStageService.optimize({
        prompt,
        mode,
        context,
        onDraft,
      });
      optimized = result.refined;
    } else {
      optimized = await this._singleStageOptimize(prompt, mode, context, brainstormContext);
    }

    // Cache result
    await this.cacheService.set(cacheKey, optimized, { ttl: 3600 });

    this.logger?.info('Optimization completed', {
      mode: modeName,
      outputLength: optimized.length,
    });

    return optimized;
  }

  async _singleStageOptimize(prompt, mode, context, brainstormContext) {
    // Generate domain content if mode supports it
    let domainContent = null;
    if (typeof mode.generateDomainContent === 'function') {
      domainContent = await mode.generateDomainContent(
        prompt,
        context,
        this.contextInferenceService.client
      );
    }

    // Generate system prompt
    const systemPrompt = mode.generateSystemPrompt(prompt, context, domainContent);

    // Call AI client
    const response = await this.twoStageService.refinementClient.complete(
      systemPrompt,
      {
        maxTokens: 4096,
        temperature: 0.7,
        timeout: mode.getName() === 'video' ? 90000 : 30000,
      }
    );

    return response?.text || response;
  }
}
