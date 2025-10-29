# SOLID Principles Refactored Code

## Table of Contents
1. [AI Client Abstractions](#1-ai-client-abstractions)
2. [Prompt Optimization Service Refactoring](#2-prompt-optimization-service-refactoring)
3. [Cache Service Refactoring](#3-cache-service-refactoring)
4. [Server Initialization Refactoring](#4-server-initialization-refactoring)
5. [Logger Refactoring](#5-logger-refactoring)
6. [Client Components Refactoring](#6-client-components-refactoring)

---

## 1. AI Client Abstractions

### Problem Addressed
- **DIP Violation**: PromptOptimizationService depends on concrete `OpenAIAPIClient`
- **LSP Violation**: OpenAIAPIClient transforms responses breaking substitutability
- **ISP Violation**: Fat interface with unnecessary methods

### Solution: Introduce Abstractions

#### 1.1 IAIClient Interface (New)

**File:** `server/src/interfaces/IAIClient.js`

```javascript
/**
 * AI Client Interface
 * Defines the contract for AI service clients
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface with only essential methods
 * - DIP: Abstraction that high-level modules depend on
 */
export class IAIClient {
  /**
   * Complete a prompt with the AI model
   * @param {string} systemPrompt - System instructions
   * @param {Object} options - Completion options
   * @param {string} [options.userMessage] - User message
   * @param {number} [options.maxTokens] - Maximum tokens to generate
   * @param {number} [options.temperature] - Temperature for generation
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {AbortSignal} [options.signal] - Abort signal for cancellation
   * @returns {Promise<AIResponse>} AI response
   * @throws {AIClientError} On API errors
   */
  async complete(systemPrompt, options = {}) {
    throw new Error('complete() must be implemented by subclass');
  }
}

/**
 * Standardized AI Response
 */
export class AIResponse {
  constructor(text, metadata = {}) {
    this.text = text;
    this.metadata = metadata; // model, tokens, finish_reason, etc.
  }
}

/**
 * Base AI Client Error
 */
export class AIClientError extends Error {
  constructor(message, statusCode, originalError = null) {
    super(message);
    this.name = 'AIClientError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}
```

---

#### 1.2 Refactored OpenAIAPIClient

**File:** `server/src/clients/OpenAIAPIClient.refactored.js`

```javascript
import { IAIClient, AIResponse, AIClientError } from '../interfaces/IAIClient.js';
import { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import { IConcurrencyLimiter } from '../interfaces/IConcurrencyLimiter.js';
import { ILogger } from '../interfaces/ILogger.js';
import { IMetricsCollector } from '../interfaces/IMetricsCollector.js';

/**
 * OpenAI API Client Implementation
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on OpenAI API communication
 * - LSP: Implements IAIClient contract without modifications
 * - DIP: Depends on logger, metrics, circuit breaker abstractions
 * - ISP: Clean interface for AI completion only
 */
export class OpenAIAPIClient extends IAIClient {
  constructor({
    apiKey,
    config = {},
    circuitBreaker,
    concurrencyLimiter,
    logger,
    metricsCollector,
  }) {
    super();
    
    this.apiKey = apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
    this.defaultTimeout = config.timeout || 60000;
    
    // Injected dependencies (DIP compliance)
    this.circuitBreaker = circuitBreaker;
    this.concurrencyLimiter = concurrencyLimiter;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Complete a prompt with OpenAI
   * Implements IAIClient.complete()
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    
    try {
      // Use concurrency limiter if available
      const executeRequest = async () => {
        return this.circuitBreaker 
          ? await this.circuitBreaker.execute(() => this._makeRequest(systemPrompt, options))
          : await this._makeRequest(systemPrompt, options);
      };
      
      const result = this.concurrencyLimiter
        ? await this.concurrencyLimiter.execute(executeRequest, options)
        : await executeRequest();
      
      const duration = Date.now() - startTime;
      
      this.logger?.debug('OpenAI API call succeeded', {
        duration,
        model: this.model,
      });
      
      this.metricsCollector?.recordSuccess('openai-api', duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger?.error('OpenAI API call failed', error, { duration });
      this.metricsCollector?.recordFailure('openai-api', duration);
      
      throw new AIClientError(
        `OpenAI API error: ${error.message}`,
        error.statusCode || 500,
        error
      );
    }
  }

  /**
   * Internal method to make the actual API request
   * @private
   */
  async _makeRequest(systemPrompt, options = {}) {
    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userMessage || 'Please proceed.' }
      ];

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature !== undefined ? options.temperature : 1.0,
        }),
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AIClientError(
          `OpenAI API error: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      const data = await response.json();
      
      // Return standardized AIResponse (LSP compliance)
      return new AIResponse(
        data.choices[0]?.message?.content || '',
        {
          model: data.model,
          usage: data.usage,
          finishReason: data.choices[0]?.finish_reason,
        }
      );
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AIClientError(`Request timeout after ${timeout}ms`, 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

#### 1.3 Circuit Breaker Abstraction

**File:** `server/src/interfaces/ICircuitBreaker.js`

```javascript
/**
 * Circuit Breaker Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface for circuit breaker functionality
 * - DIP: Abstraction for resilience patterns
 */
export class ICircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Function result
   * @throws {CircuitOpenError} When circuit is open
   */
  async execute(fn) {
    throw new Error('execute() must be implemented');
  }
  
  /**
   * Get current circuit state
   * @returns {string} 'open' | 'closed' | 'half-open'
   */
  getState() {
    throw new Error('getState() must be implemented');
  }
}

export class CircuitOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
```

---

#### 1.4 Concurrency Limiter Abstraction

**File:** `server/src/interfaces/IConcurrencyLimiter.js`

```javascript
/**
 * Concurrency Limiter Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Focused interface for concurrency control
 * - DIP: Abstraction for rate limiting patterns
 */
export class IConcurrencyLimiter {
  /**
   * Execute a function with concurrency limiting
   * @param {Function} fn - Function to execute
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Function result
   * @throws {QueueTimeoutError} When queued too long
   */
  async execute(fn, options = {}) {
    throw new Error('execute() must be implemented');
  }
}

export class QueueTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueTimeoutError';
    this.code = 'QUEUE_TIMEOUT';
  }
}
```

---

#### 1.5 Health Check Coordinator (Separate Concern)

**File:** `server/src/services/AIClientHealthCheck.js`

```javascript
import { ILogger } from '../interfaces/ILogger.js';
import { IAIClient } from '../interfaces/IAIClient.js';

/**
 * AI Client Health Check Service
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on health checking
 * - DIP: Depends on IAIClient abstraction
 */
export class AIClientHealthCheck {
  constructor({ client, logger }) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Perform health check on AI client
   * @returns {Promise<HealthStatus>}
   */
  async check() {
    try {
      const startTime = Date.now();
      
      await this.client.complete('Respond with "healthy"', {
        maxTokens: 10,
        timeout: 5000,
      });
      
      const duration = Date.now() - startTime;

      return {
        healthy: true,
        responseTime: duration,
      };
    } catch (error) {
      this.logger?.error('Health check failed', error);
      
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}
```

---

## 2. Prompt Optimization Service Refactoring

### Problem Addressed
- **SRP Violation**: 10+ responsibilities in one class (3,540 lines)
- **OCP Violation**: Switch statements for modes
- **DIP Violation**: Depends on concrete AI clients

### Solution: Decompose into Multiple Services

#### 2.1 Core Interfaces

**File:** `server/src/services/prompt-optimization/interfaces/IOptimizationMode.js`

```javascript
/**
 * Optimization Mode Interface
 * 
 * SOLID Principles Applied:
 * - OCP: New modes can be added without modifying existing code
 * - ISP: Clean interface for mode implementations
 */
export class IOptimizationMode {
  /**
   * Get the mode name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented');
  }
  
  /**
   * Generate system prompt for this mode
   * @param {string} prompt - User prompt
   * @param {Object} context - Optimization context
   * @param {Object} domainContent - Pre-generated domain content
   * @returns {string} System prompt
   */
  generateSystemPrompt(prompt, context, domainContent) {
    throw new Error('generateSystemPrompt() must be implemented');
  }
  
  /**
   * Generate domain-specific content for this mode
   * @param {string} prompt - User prompt
   * @param {Object} context - User context
   * @param {IAIClient} client - AI client for generation
   * @returns {Promise<Object>} Domain-specific content
   */
  async generateDomainContent(prompt, context, client) {
    throw new Error('generateDomainContent() must be implemented');
  }
  
  /**
   * Generate draft prompt for two-stage optimization
   * @param {string} prompt - User prompt
   * @param {Object} context - Optimization context
   * @returns {string} Draft system prompt
   */
  generateDraftPrompt(prompt, context) {
    throw new Error('generateDraftPrompt() must be implemented');
  }
}
```

---

#### 2.2 Mode Implementations

**File:** `server/src/services/prompt-optimization/modes/ReasoningMode.js`

```javascript
import { IOptimizationMode } from '../interfaces/IOptimizationMode.js';
import { AIResponse } from '../../../interfaces/IAIClient.js';

/**
 * Reasoning Optimization Mode
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only reasoning-specific logic
 * - OCP: Can be added/removed without affecting other modes
 * - LSP: Properly implements IOptimizationMode contract
 */
export class ReasoningMode extends IOptimizationMode {
  constructor({ logger }) {
    super();
    this.logger = logger;
  }

  getName() {
    return 'reasoning';
  }

  generateDraftPrompt(prompt, context) {
    return `You are a reasoning prompt draft generator. Create a concise structured prompt (100-150 words).

Include:
- Core problem statement
- Key analytical approach
- Expected reasoning pattern

Output ONLY the draft prompt, no explanations.`;
  }

  async generateDomainContent(prompt, context, client) {
    this.logger?.info('Generating reasoning domain content', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    const stage1Prompt = this._buildDomainContentPrompt(prompt, domain, expertiseLevel, useCase);

    try {
      const response = await client.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const domainContent = this._parseJSONResponse(response.text);

      this.logger?.info('Reasoning domain content generated', {
        warningCount: domainContent.warnings?.length || 0,
        deliverableCount: domainContent.deliverables?.length || 0,
        constraintCount: domainContent.constraints?.length || 0,
      });

      return domainContent;
      
    } catch (error) {
      this.logger?.error('Failed to generate reasoning domain content', error);
      
      // Return safe fallback
      return {
        warnings: [],
        deliverables: [],
        constraints: [],
      };
    }
  }

  generateSystemPrompt(prompt, context, domainContent) {
    // Build comprehensive reasoning template
    // (Implementation would include the full template from original)
    // For brevity, showing structure only
    
    const domainSection = this._buildDomainContentSection(domainContent, context);
    const transformationSteps = this._buildTransformationSteps(domainContent, context);
    
    return `You are an expert prompt engineer specializing in reasoning models.

${domainSection}

<transformation_process>
${transformationSteps}
</transformation_process>

<output_structure>
**Goal**
[Single sentence stating the objective]

**Return Format**
${domainContent?.deliverables?.length > 0 ? '[Using pre-generated deliverables]' : '[Generate specific deliverables]'}

**Warnings**
${domainContent?.warnings?.length > 0 ? '[Using pre-generated warnings]' : '[Generate domain-specific warnings]'}

**Context**
[Essential technical background]
</output_structure>`;
  }

  _buildDomainContentPrompt(prompt, domain, expertiseLevel, useCase) {
    // Full implementation from original service
    // Extracted to keep ReasoningMode focused
    return `Generate domain-specific content for reasoning...`;
  }

  _buildDomainContentSection(domainContent, context) {
    if (!domainContent || (!domainContent.warnings?.length && !domainContent.deliverables?.length)) {
      return '';
    }
    
    let section = '\n**PRE-GENERATED DOMAIN-SPECIFIC CONTENT:**\n';
    // ... rest of implementation
    return section;
  }

  _buildTransformationSteps(domainContent, context) {
    // Logic to build transformation steps based on content availability
    return '1. Extract the core objective\n2. Integrate domain content\n...';
  }

  _parseJSONResponse(text) {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    return JSON.parse(jsonText);
  }
}
```

---

**File:** `server/src/services/prompt-optimization/modes/VideoMode.js`

```javascript
import { IOptimizationMode } from '../interfaces/IOptimizationMode.js';

/**
 * Video Optimization Mode
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only video-specific logic
 * - OCP: Independent mode that doesn't affect others
 */
export class VideoMode extends IOptimizationMode {
  constructor({ logger, videoPromptTemplates }) {
    super();
    this.logger = logger;
    this.videoPromptTemplates = videoPromptTemplates;
  }

  getName() {
    return 'video';
  }

  generateDraftPrompt(prompt, context) {
    return `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action
- Essential visual details (lighting, camera angle)
- Specific cinematographic style

Output ONLY the draft prompt, no explanations or meta-commentary.`;
  }

  async generateDomainContent(prompt, context, client) {
    // Video mode doesn't use Stage 1 domain content generation
    // It relies on video prompt templates
    return null;
  }

  generateSystemPrompt(prompt, context, domainContent) {
    // Use video prompt templates service
    return this.videoPromptTemplates.generatePrompt(prompt, context);
  }
}
```

---

**File:** `server/src/services/prompt-optimization/modes/index.js`

```javascript
/**
 * Mode Registry
 * 
 * SOLID Principles Applied:
 * - OCP: New modes registered here without modifying mode implementations
 * - DIP: Depends on IOptimizationMode abstraction
 */
export class ModeRegistry {
  constructor() {
    this.modes = new Map();
  }

  /**
   * Register an optimization mode
   * @param {IOptimizationMode} mode - Mode implementation
   */
  register(mode) {
    this.modes.set(mode.getName(), mode);
  }

  /**
   * Get mode by name
   * @param {string} name - Mode name
   * @returns {IOptimizationMode}
   */
  get(name) {
    const mode = this.modes.get(name);
    if (!mode) {
      throw new Error(`Unknown optimization mode: ${name}`);
    }
    return mode;
  }

  /**
   * Check if mode exists
   * @param {string} name - Mode name
   * @returns {boolean}
   */
  has(name) {
    return this.modes.has(name);
  }

  /**
   * Get all registered mode names
   * @returns {string[]}
   */
  getAllModeNames() {
    return Array.from(this.modes.keys());
  }
}
```

---

#### 2.3 Context Inference Service

**File:** `server/src/services/prompt-optimization/ContextInferenceService.js`

```javascript
import { IAIClient } from '../../interfaces/IAIClient.js';
import { ILogger } from '../../interfaces/ILogger.js';

/**
 * Context Inference Service
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on context inference
 * - DIP: Depends on IAIClient and ILogger abstractions
 */
export class ContextInferenceService {
  constructor({ client, logger }) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Infer context from prompt
   * @param {string} prompt - User's original prompt
   * @returns {Promise<Object>} Inferred context
   */
  async infer(prompt) {
    this.logger?.info('Inferring context from prompt', { promptLength: prompt.length });

    try {
      const inferencePrompt = this._buildInferencePrompt(prompt);
      
      const response = await this.client.complete(inferencePrompt, {
        maxTokens: 500,
        temperature: 0.3,
        timeout: 15000,
      });

      const inferredContext = this._parseResponse(response.text);
      
      this.logger?.info('Successfully inferred context', {
        hasSpecificAspects: !!inferredContext.specificAspects,
        backgroundLevel: inferredContext.backgroundLevel,
        hasIntendedUse: !!inferredContext.intendedUse,
      });

      return inferredContext;
      
    } catch (error) {
      this.logger?.error('Failed to infer context', error);
      
      // Return minimal context on failure
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      };
    }
  }

  _buildInferencePrompt(prompt) {
    return `Analyze this prompt and infer appropriate context for optimization.

<prompt_to_analyze>
${prompt}
</prompt_to_analyze>

Your task: Reason through these analytical lenses to infer the appropriate context:

**LENS 1: Domain & Specificity**
What field or discipline does this belong to? What level of technical depth is implied?

**LENS 2: Expertise Level**
Based on language complexity and terminology usage, how expert is this person?
- novice: Uses general language, asks "what is" questions
- intermediate: Uses some domain terms, asks "how to" questions
- expert: Uses precise terminology, discusses trade-offs

**LENS 3: Key Focus Areas**
What are the 2-4 most important specific aspects in this prompt?

**LENS 4: Intended Use**
What is this person likely trying to do with the response?

Output ONLY a JSON object with this exact structure:

{
  "specificAspects": "2-4 key technical/domain-specific focus areas",
  "backgroundLevel": "novice|intermediate|expert",
  "intendedUse": "brief description of likely use case"
}`;
  }

  _parseResponse(text) {
    // Extract and parse JSON
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    // Validate and normalize
    const validLevels = ['novice', 'intermediate', 'expert'];
    if (!validLevels.includes(parsed.backgroundLevel)) {
      parsed.backgroundLevel = 'intermediate';
    }
    
    return parsed;
  }
}
```

---

#### 2.4 Two-Stage Optimization Service

**File:** `server/src/services/prompt-optimization/TwoStageOptimizationService.js`

```javascript
import { IAIClient } from '../../interfaces/IAIClient.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { IOptimizationMode } from './interfaces/IOptimizationMode.js';

/**
 * Two-Stage Optimization Service
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only two-stage optimization orchestration
 * - DIP: Depends on abstractions (IAIClient, IOptimizationMode)
 * - OCP: Works with any mode through IOptimizationMode interface
 */
export class TwoStageOptimizationService {
  constructor({ draftClient, refinementClient, logger, spanLabeler }) {
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
    
    // Parallel operations for video mode
    const operations = [
      this.draftClient.complete(draftPrompt, {
        userMessage: prompt,
        maxTokens: mode.getName() === 'video' ? 300 : 200,
        temperature: 0.7,
        timeout: 5000,
      }),
    ];
    
    // Add span labeling for video mode
    if (mode.getName() === 'video' && this.spanLabeler) {
      operations.push(
        this.spanLabeler.label(prompt).catch(err => {
          this.logger?.warn('Parallel span labeling failed', { error: err.message });
          return null;
        })
      );
    } else {
      operations.push(Promise.resolve(null));
    }

    const [draftResponse, spans] = await Promise.all(operations);

    return {
      draft: draftResponse.text,
      spans: spans || null,
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
```

---

#### 2.5 Main Orchestrator Service

**File:** `server/src/services/prompt-optimization/PromptOptimizationOrchestrator.js`

```javascript
import { ILogger } from '../../interfaces/ILogger.js';
import { ICacheService } from '../../interfaces/ICacheService.js';
import { ModeRegistry } from './modes/index.js';
import { ContextInferenceService } from './ContextInferenceService.js';
import { TwoStageOptimizationService } from './TwoStageOptimizationService.js';
import { ConstitutionalReviewService } from './ConstitutionalReviewService.js';

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
    constitutionalReviewService,
    cacheService,
    logger,
  }) {
    this.modeRegistry = modeRegistry;
    this.contextInferenceService = contextInferenceService;
    this.twoStageService = twoStageService;
    this.constitutionalReviewService = constitutionalReviewService;
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
    this.logger?.info('Optimizing prompt', {
      mode: modeName,
      promptLength: prompt.length,
    });

    // Get mode implementation
    const mode = this.modeRegistry.get(modeName);

    // Infer context if not provided and mode is reasoning
    if (modeName === 'reasoning' && !context) {
      context = await this.contextInferenceService.infer(prompt);
    }

    // Check cache
    const cacheKey = this._generateCacheKey(prompt, modeName, context);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger?.debug('Cache hit for prompt optimization');
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

    // Apply constitutional review if requested
    if (useConstitutionalReview) {
      optimized = await this.constitutionalReviewService.review(prompt, optimized);
    }

    // Cache result
    await this.cacheService.set(cacheKey, optimized);

    this.logger?.info('Prompt optimization completed', {
      mode: modeName,
      outputLength: optimized.length,
    });

    return optimized;
  }

  async _singleStageOptimize(prompt, mode, context, brainstormContext) {
    // Generate domain content if supported
    let domainContent = null;
    if (typeof mode.generateDomainContent === 'function') {
      domainContent = await mode.generateDomainContent(prompt, context, this.contextInferenceService.client);
    }

    // Generate system prompt
    const systemPrompt = mode.generateSystemPrompt(prompt, context, domainContent);

    // Call AI client (via two-stage service's refinement client)
    const response = await this.twoStageService.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: mode.getName() === 'video' ? 90000 : 30000,
    });

    return response.text;
  }

  _generateCacheKey(prompt, mode, context) {
    return this.cacheService.generateKey('prompt-optimization', {
      prompt: prompt.substring(0, 100),
      mode,
      context,
    });
  }
}
```

---

## 3. Cache Service Refactoring

### Problem Addressed
- **SRP Violation**: Handles cache operations, key generation, statistics, health checks, metrics
- **OCP Violation**: Hard-coded cache configurations
- **DIP Violation**: Depends on concrete `node-cache` implementation

### Solution: Decompose and Abstract

#### 3.1 Cache Abstraction

**File:** `server/src/interfaces/ICacheService.js`

```javascript
/**
 * Cache Service Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface for cache operations
 * - DIP: Abstraction that services depend on
 */
export class ICacheService {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    throw new Error('get() must be implemented');
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Object} options - Cache options (ttl, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, options = {}) {
    throw new Error('set() must be implemented');
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of deleted keys
   */
  async delete(key) {
    throw new Error('delete() must be implemented');
  }

  /**
   * Generate cache key from namespace and data
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to include in key
   * @returns {string} Cache key
   */
  generateKey(namespace, data) {
    throw new Error('generateKey() must be implemented');
  }
}
```

---

#### 3.2 Refactored NodeCache Implementation

**File:** `server/src/services/cache/NodeCacheAdapter.js`

```javascript
import NodeCache from 'node-cache';
import { ICacheService } from '../../interfaces/ICacheService.js';
import { ILogger } from '../../interfaces/ILogger.js';

/**
 * NodeCache Adapter
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache operations
 * - LSP: Properly implements ICacheService contract
 * - DIP: Logger injected as dependency
 */
export class NodeCacheAdapter extends ICacheService {
  constructor({ config = {}, keyGenerator, logger }) {
    super();
    
    this.cache = new NodeCache({
      stdTTL: config.defaultTTL || 3600,
      checkperiod: config.checkperiod || 600,
      useClones: false,
    });
    
    this.keyGenerator = keyGenerator;
    this.logger = logger;
    
    // Log cache events
    this.cache.on('expired', (key) => {
      this.logger?.debug('Cache key expired', { key });
    });
  }

  async get(key) {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.logger?.debug('Cache hit', { key });
      return value;
    }
    
    this.logger?.debug('Cache miss', { key });
    return null;
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.cache.options.stdTTL;
    const success = this.cache.set(key, value, ttl);
    
    if (success) {
      this.logger?.debug('Cache set', { key, ttl });
    } else {
      this.logger?.warn('Cache set failed', { key });
    }
    
    return success;
  }

  async delete(key) {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      this.logger?.debug('Cache key deleted', { key });
    }
    return deleted;
  }

  async flush() {
    this.cache.flushAll();
    this.logger?.info('Cache flushed');
  }

  generateKey(namespace, data) {
    return this.keyGenerator.generate(namespace, data);
  }
}
```

---

#### 3.3 Key Generation Service

**File:** `server/src/services/cache/CacheKeyGenerator.js`

```javascript
import crypto from 'crypto';

/**
 * Cache Key Generator
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on generating cache keys
 * - OCP: Can be extended with new generation strategies
 */
export class CacheKeyGenerator {
  constructor({ semanticEnhancer = null }) {
    this.semanticEnhancer = semanticEnhancer;
  }

  /**
   * Generate cache key from data
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to hash
   * @param {Object} options - Options for key generation
   * @returns {string} Cache key
   */
  generate(namespace, data, options = {}) {
    const {
      useSemantic = true,
      normalizeWhitespace = true,
      ignoreCase = true,
      sortKeys = true
    } = options;

    // Use semantic caching if enhancer available
    if (useSemantic && this.semanticEnhancer) {
      return this.semanticEnhancer.generateKey(namespace, data, {
        normalizeWhitespace,
        ignoreCase,
        sortKeys,
      });
    }

    // Fallback to standard hashing
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);

    return `${namespace}:${hash}`;
  }
}
```

---

#### 3.4 Cache Statistics Tracker

**File:** `server/src/services/cache/CacheStatisticsTracker.js`

```javascript
import { IMetricsCollector } from '../../interfaces/IMetricsCollector.js';

/**
 * Cache Statistics Tracker
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache statistics
 * - DIP: Depends on IMetricsCollector abstraction
 */
export class CacheStatisticsTracker {
  constructor({ metricsCollector }) {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    this.metricsCollector = metricsCollector;
  }

  recordHit(cacheType = 'default') {
    this.stats.hits++;
    this.metricsCollector?.recordCacheHit(cacheType);
    this._updateHitRate(cacheType);
  }

  recordMiss(cacheType = 'default') {
    this.stats.misses++;
    this.metricsCollector?.recordCacheMiss(cacheType);
    this._updateHitRate(cacheType);
  }

  recordSet() {
    this.stats.sets++;
  }

  getStatistics() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: hitRate.toFixed(2) + '%',
    };
  }

  _updateHitRate(cacheType) {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    this.metricsCollector?.updateCacheHitRate(cacheType, hitRate);
  }
}
```

---

#### 3.5 Cache with Statistics Decorator

**File:** `server/src/services/cache/CacheServiceWithStatistics.js`

```javascript
import { ICacheService } from '../../interfaces/ICacheService.js';
import { CacheStatisticsTracker } from './CacheStatisticsTracker.js';

/**
 * Cache Service with Statistics (Decorator Pattern)
 * 
 * SOLID Principles Applied:
 * - SRP: Adds statistics tracking to any cache implementation
 * - OCP: Extends cache behavior without modifying it
 * - DIP: Depends on ICacheService abstraction
 */
export class CacheServiceWithStatistics extends ICacheService {
  constructor({ cacheService, statisticsTracker }) {
    super();
    this.cacheService = cacheService;
    this.statisticsTracker = statisticsTracker;
  }

  async get(key, cacheType = 'default') {
    const value = await this.cacheService.get(key);
    
    if (value !== null) {
      this.statisticsTracker.recordHit(cacheType);
    } else {
      this.statisticsTracker.recordMiss(cacheType);
    }
    
    return value;
  }

  async set(key, value, options = {}) {
    const success = await this.cacheService.set(key, value, options);
    
    if (success) {
      this.statisticsTracker.recordSet();
    }
    
    return success;
  }

  async delete(key) {
    return this.cacheService.delete(key);
  }

  generateKey(namespace, data) {
    return this.cacheService.generateKey(namespace, data);
  }

  getStatistics() {
    return this.statisticsTracker.getStatistics();
  }
}
```

---

## 4. Server Initialization Refactoring

### Problem Addressed
- **SRP Violation**: 600+ lines handling environment, services, middleware, routes, lifecycle
- **DIP Violation**: Direct service instantiation with `new`
- **OCP Violation**: Adding services/middleware requires editing main file

### Solution: Dependency Injection Container & Modular Initialization

#### 4.1 Dependency Injection Container

**File:** `server/src/infrastructure/DependencyContainer.js`

```javascript
/**
 * Simple Dependency Injection Container
 * 
 * SOLID Principles Applied:
 * - SRP: Manages dependency creation and resolution
 * - OCP: New dependencies registered without modifying container
 * - DIP: Enables inversion of control
 */
export class DependencyContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function to create service
   * @param {Object} options - Registration options
   */
  register(name, factory, options = {}) {
    this.services.set(name, {
      factory,
      singleton: options.singleton !== false, // Default to singleton
    });
  }

  /**
   * Register a singleton instance
   * @param {string} name - Service name
   * @param {any} instance - Service instance
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @returns {any} Service instance
   */
  resolve(name) {
    // Check if singleton instance exists
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check if service registered
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not registered: ${name}`);
    }

    // Create instance
    const instance = service.factory(this);

    // Store if singleton
    if (service.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name) || this.singletons.has(name);
  }
}
```

---

#### 4.2 Service Registration Module

**File:** `server/src/infrastructure/ServiceRegistration.js`

```javascript
import { Logger } from '../infrastructure/Logger.js';
import { MetricsService } from '../infrastructure/MetricsService.js';
import { TracingService } from '../infrastructure/TracingService.js';
import { OpenAIAPIClient } from '../clients/OpenAIAPIClient.refactored.js';
import { GroqAPIClient } from '../clients/GroqAPIClient.js';
import { NodeCacheAdapter } from '../services/cache/NodeCacheAdapter.js';
import { CacheKeyGenerator } from '../services/cache/CacheKeyGenerator.js';
import { CacheStatisticsTracker } from '../services/cache/CacheStatisticsTracker.js';
import { CacheServiceWithStatistics } from '../services/cache/CacheServiceWithStatistics.js';
import { PromptOptimizationOrchestrator } from '../services/prompt-optimization/PromptOptimizationOrchestrator.js';
// ... other imports

/**
 * Service Registration
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on service registration
 * - OCP: New services added here without modifying container
 * - DIP: All services created through dependency injection
 */
export function registerServices(container, config) {
  // Infrastructure services
  container.register('logger', () => new Logger({
    level: config.logLevel,
  }));

  container.register('metricsService', (c) => new MetricsService({
    logger: c.resolve('logger'),
  }));

  container.register('tracingService', (c) => new TracingService({
    logger: c.resolve('logger'),
  }));

  // AI Clients
  container.register('openAIClient', (c) => new OpenAIAPIClient({
    apiKey: config.openAI.apiKey,
    config: {
      model: config.openAI.model,
      timeout: config.openAI.timeout,
    },
    circuitBreaker: c.resolve('circuitBreakerFactory').create('openai-api'),
    concurrencyLimiter: c.resolve('concurrencyLimiter'),
    logger: c.resolve('logger'),
    metricsCollector: c.resolve('metricsService'),
  }));

  if (config.groq?.apiKey) {
    container.register('groqClient', (c) => new GroqAPIClient({
      apiKey: config.groq.apiKey,
      config: {
        model: config.groq.model,
        timeout: config.groq.timeout,
      },
      circuitBreaker: c.resolve('circuitBreakerFactory').create('groq-api'),
      logger: c.resolve('logger'),
      metricsCollector: c.resolve('metricsService'),
    }));
  }

  // Cache services
  container.register('cacheKeyGenerator', (c) => new CacheKeyGenerator({
    semanticEnhancer: c.resolve('semanticCacheEnhancer'),
  }));

  container.register('cacheStatisticsTracker', (c) => new CacheStatisticsTracker({
    metricsCollector: c.resolve('metricsService'),
  }));

  container.register('baseCacheService', (c) => new NodeCacheAdapter({
    config: config.cache,
    keyGenerator: c.resolve('cacheKeyGenerator'),
    logger: c.resolve('logger'),
  }));

  container.register('cacheService', (c) => new CacheServiceWithStatistics({
    cacheService: c.resolve('baseCacheService'),
    statisticsTracker: c.resolve('cacheStatisticsTracker'),
  }));

  // Prompt optimization services
  container.register('contextInferenceService', (c) => new ContextInferenceService({
    client: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
  }));

  container.register('twoStageOptimizationService', (c) => new TwoStageOptimizationService({
    draftClient: config.groq?.apiKey ? c.resolve('groqClient') : null,
    refinementClient: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
    spanLabeler: c.resolve('spanLabeler'),
  }));

  container.register('promptOptimizationService', (c) => new PromptOptimizationOrchestrator({
    modeRegistry: c.resolve('modeRegistry'),
    contextInferenceService: c.resolve('contextInferenceService'),
    twoStageService: c.resolve('twoStageOptimizationService'),
    constitutionalReviewService: c.resolve('constitutionalReviewService'),
    cacheService: c.resolve('cacheService'),
    logger: c.resolve('logger'),
  }));

  // ... register other services
}
```

---

#### 4.3 Middleware Registration Module

**File:** `server/src/infrastructure/MiddlewareRegistration.js`

```javascript
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import express from 'express';

/**
 * Middleware Registration
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on middleware configuration
 * - OCP: New middleware added here without affecting main file
 */
export function registerMiddleware(app, container, config) {
  const logger = container.resolve('logger');
  const metricsService = container.resolve('metricsService');

  // Request ID middleware (must be first)
  app.use(container.resolve('requestIdMiddleware'));

  // Security middleware
  app.use(helmet(config.helmet));

  // Compression
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6,
  }));

  // Rate limiting (skip in test)
  if (config.enableRateLimiting) {
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: 'Too many requests from this IP',
    });
    app.use(limiter);
  }

  // CORS
  app.use(cors(config.cors));

  // Body parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // Request logging
  app.use(logger.requestLogger());

  // Metrics
  app.use(metricsService.middleware());

  // Request coalescing
  app.use(container.resolve('requestCoalescing').middleware());

  logger.info('Middleware registered successfully');
}
```

---

#### 4.4 Route Registration Module

**File:** `server/src/infrastructure/RouteRegistration.js`

```javascript
/**
 * Route Registration
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on route registration
 * - OCP: New routes added here without affecting main file
 */
export function registerRoutes(app, container) {
  const logger = container.resolve('logger');

  // Health routes
  const healthRoutes = container.resolve('healthRoutes');
  app.use('/', healthRoutes);

  // API routes (with auth)
  const apiAuth = container.resolve('apiAuthMiddleware');
  const apiRoutes = container.resolve('apiRoutes');
  app.use('/api', apiAuth, apiRoutes);

  // LLM routes
  const llmRoutes = container.resolve('llmRoutes');
  app.use('/llm', apiAuth, llmRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      requestId: req.id,
    });
  });

  logger.info('Routes registered successfully');
}
```

---

#### 4.5 Refactored Main Server File

**File:** `server/index.refactored.js`

```javascript
import './instrument.mjs';
import express from 'express';
import dotenv from 'dotenv';
import { DependencyContainer } from './src/infrastructure/DependencyContainer.js';
import { registerServices } from './src/infrastructure/ServiceRegistration.js';
import { registerMiddleware } from './src/infrastructure/MiddlewareRegistration.js';
import { registerRoutes } from './src/infrastructure/RouteRegistration.js';
import { loadConfiguration } from './src/config/ConfigLoader.js';
import { validateEnvironment } from './src/utils/validateEnv.js';

/**
 * Refactored Server Entry Point
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on server lifecycle only
 * - DIP: All dependencies injected through container
 * - OCP: Services/middleware/routes registered in separate modules
 */

// Load environment
dotenv.config();

// Validate environment
try {
  validateEnvironment();
  console.log('✅ Environment validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

// Load configuration
const config = loadConfiguration();

// Create dependency container
const container = new DependencyContainer();

// Register all services
registerServices(container, config);

// Create Express app
const app = express();

// Register middleware
registerMiddleware(app, container, config);

// Register routes
registerRoutes(app, container);

// Error handling (must be last)
app.use(container.resolve('errorHandler'));

// Start server (only if not in test)
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.port;
  const logger = container.resolve('logger');
  
  const server = app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: config.environment,
      nodeVersion: process.version,
    });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // Configure server timeouts
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    server.close(async () => {
      await container.resolve('shutdownService').shutdown();
      process.exit(0);
    });
  });
}

export default app;
export { container };
```

---

## 5. Logger Refactoring

### Problem Addressed
- **SRP Violation**: Mixes logging with HTTP middleware concerns

### Solution: Extract HTTP Middleware

#### 5.1 Refactored Logger (Core Only)

**File:** `server/src/infrastructure/Logger.refactored.js`

```javascript
import pino from 'pino';
import { ILogger } from '../interfaces/ILogger.js';

/**
 * Logger Implementation
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on logging operations
 * - LSP: Implements ILogger interface
 * - DIP: Uses pino library through composition
 */
export class Logger extends ILogger {
  constructor(config = {}) {
    super();
    
    this.logger = pino({
      level: config.level || process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      } : undefined,
    });
  }

  info(message, meta = {}) {
    this.logger.info(meta, message);
  }

  error(message, error, meta = {}) {
    const errorMeta = error ? {
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error,
      },
    } : {};
    this.logger.error({ ...meta, ...errorMeta }, message);
  }

  warn(message, meta = {}) {
    this.logger.warn(meta, message);
  }

  debug(message, meta = {}) {
    this.logger.debug(meta, message);
  }

  child(bindings) {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}
```

---

#### 5.2 HTTP Request Logging Middleware (Extracted)

**File:** `server/src/middleware/requestLogging.js`

```javascript
import { ILogger } from '../interfaces/ILogger.js';

/**
 * HTTP Request Logging Middleware
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on HTTP request logging
 * - DIP: Depends on ILogger abstraction
 */
export function createRequestLoggingMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.id,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      };

      if (res.statusCode >= 500) {
        logger.error('HTTP Request Error', null, logData);
      } else if (res.statusCode >= 400) {
        logger.warn('HTTP Request Warning', logData);
      } else {
        logger.debug('HTTP Request', logData);
      }
    });

    next();
  };
}
```

---

## 6. Client Components Refactoring

### Problem Addressed
- **SRP Violation**: PromptOptimizerContainer still handles 7+ concerns

### Solution: Further Decomposition with Custom Hooks

#### 6.1 URL Prompt Loading Hook

**File:** `client/src/features/prompt-optimizer/hooks/useUrlPromptLoader.js`

```javascript
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../components/Toast';
import { getPromptRepository } from '../../../repositories';
import { PromptContext } from '../../../utils/PromptContext';

/**
 * URL Prompt Loading Hook
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on loading prompts from URL
 * - DIP: Depends on repository abstraction
 */
export function useUrlPromptLoader({
  currentPromptUuid,
  setDisplayedPrompt,
  setOptimizedPrompt,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setShowResults,
  setPromptContext,
  applyHighlightSnapshot,
  resetEditStacks,
}) {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const skipLoadRef = useRef(false);

  useEffect(() => {
    const loadPrompt = async () => {
      if (!uuid || skipLoadRef.current || currentPromptUuid === uuid) {
        return;
      }

      try {
        const promptRepository = getPromptRepository();
        const promptData = await promptRepository.getByUuid(uuid);
        
        if (promptData) {
          setOptimizedPrompt(promptData.output);
          setDisplayedPrompt(promptData.output);
          setCurrentPromptUuid(promptData.uuid);
          setCurrentPromptDocId(promptData.id || null);
          setShowResults(true);

          // Handle highlights
          if (promptData.highlightCache) {
            applyHighlightSnapshot(promptData.highlightCache);
          }
          resetEditStacks();

          // Handle context
          if (promptData.brainstormContext) {
            try {
              const contextData =
                typeof promptData.brainstormContext === 'string'
                  ? JSON.parse(promptData.brainstormContext)
                  : promptData.brainstormContext;
              setPromptContext(PromptContext.fromJSON(contextData));
            } catch (error) {
              console.error('Failed to restore context:', error);
              setPromptContext(null);
            }
          }
        } else {
          toast.error('Prompt not found');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Error loading prompt:', error);
        toast.error('Failed to load prompt');
        navigate('/', { replace: true });
      }
    };

    loadPrompt();
  }, [uuid, currentPromptUuid]);

  return {
    skipLoad: skipLoadRef,
  };
}
```

---

#### 6.2 Highlight Persistence Hook

**File:** `client/src/features/prompt-optimizer/hooks/useHighlightPersistence.js`

```javascript
import { useCallback, useRef } from 'react';
import { getPromptRepository } from '../../../repositories';

/**
 * Highlight Persistence Hook
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on persisting highlights
 * - DIP: Depends on repository abstraction
 */
export function useHighlightPersistence({
  user,
  currentPromptUuid,
  currentPromptDocId,
  applyHighlightSnapshot,
  updateHistoryHighlight,
}) {
  const latestHighlightRef = useRef(null);
  const persistedSignatureRef = useRef(null);

  const persistHighlights = useCallback(async (result) => {
    if (!result || !Array.isArray(result.spans) || !result.signature) {
      return;
    }

    const snapshot = {
      spans: result.spans,
      meta: result.meta ?? null,
      signature: result.signature,
      cacheId: currentPromptUuid ? String(currentPromptUuid) : null,
      updatedAt: new Date().toISOString(),
    };

    latestHighlightRef.current = snapshot;
    applyHighlightSnapshot(snapshot, { bumpVersion: false });

    if (!currentPromptUuid) return;

    // Update history
    if (result.source === 'network' || result.source === 'cache-fallback') {
      updateHistoryHighlight(currentPromptUuid, snapshot);
    }

    // Persist to database if authenticated
    if (!user || !currentPromptDocId || result.source !== 'network') {
      return;
    }

    if (persistedSignatureRef.current === result.signature) {
      return;
    }

    try {
      const promptRepository = getPromptRepository();
      await promptRepository.updateHighlights(currentPromptDocId, {
        highlightCache: snapshot,
        versionEntry: {
          versionId: `v-${Date.now()}`,
          signature: result.signature,
          spansCount: result.spans.length,
          timestamp: new Date().toISOString(),
        },
      });
      persistedSignatureRef.current = result.signature;
    } catch (error) {
      console.error('Failed to persist highlights:', error);
    }
  }, [user, currentPromptUuid, currentPromptDocId, applyHighlightSnapshot, updateHistoryHighlight]);

  return {
    persistHighlights,
    latestHighlightRef,
    persistedSignatureRef,
  };
}
```

---

#### 6.3 Undo/Redo Hook

**File:** `client/src/features/prompt-optimizer/hooks/useUndoRedo.js`

```javascript
import { useCallback, useRef } from 'react';

/**
 * Undo/Redo Hook
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on undo/redo functionality
 */
export function useUndoRedo({
  displayedPrompt,
  setDisplayedPrompt,
  applyHighlightSnapshot,
  latestHighlightRef,
}) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isApplyingHistory = useRef(false);

  const handleChange = useCallback((newText) => {
    if (isApplyingHistory.current) {
      isApplyingHistory.current = false;
      setDisplayedPrompt(newText);
      return;
    }

    if (displayedPrompt !== newText) {
      undoStack.current = [...undoStack.current, {
        text: displayedPrompt,
        highlight: latestHighlightRef.current,
      }].slice(-100);
      redoStack.current = [];
    }

    setDisplayedPrompt(newText);
  }, [displayedPrompt, setDisplayedPrompt, latestHighlightRef]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;

    const previous = undoStack.current.pop();
    redoStack.current = [...redoStack.current, {
      text: displayedPrompt,
      highlight: latestHighlightRef.current,
    }].slice(-100);

    isApplyingHistory.current = true;
    setDisplayedPrompt(previous.text);
    applyHighlightSnapshot(previous.highlight);
  }, [displayedPrompt, setDisplayedPrompt, applyHighlightSnapshot, latestHighlightRef]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;

    const next = redoStack.current.pop();
    undoStack.current = [...undoStack.current, {
      text: displayedPrompt,
      highlight: latestHighlightRef.current,
    }].slice(-100);

    isApplyingHistory.current = true;
    setDisplayedPrompt(next.text);
    applyHighlightSnapshot(next.highlight);
  }, [displayedPrompt, setDisplayedPrompt, applyHighlightSnapshot, latestHighlightRef]);

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  return {
    handleChange,
    undo,
    redo,
    reset,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
```

---

#### 6.4 Refactored Container (Simplified)

**File:** `client/src/features/prompt-optimizer/PromptOptimizerContainer.refactored.jsx`

```javascript
import React from 'react';
import { usePromptState, PromptStateProvider } from './context/PromptStateContext';
import { useUrlPromptLoader } from './hooks/useUrlPromptLoader';
import { useHighlightPersistence } from './hooks/useHighlightPersistence';
import { useUndoRedo } from './hooks/useUndoRedo';
import { PromptInputSection } from './components/PromptInputSection';
import { PromptResultsSection } from './components/PromptResultsSection';
import { PromptModals } from './components/PromptModals';
import { PromptTopBar } from './components/PromptTopBar';
import { PromptSidebar } from './components/PromptSidebar';

/**
 * Refactored Prompt Optimizer Container
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on orchestrating sub-features through hooks
 * - DIP: Depends on repository abstractions (injected through hooks)
 * - OCP: New features added as hooks without modifying container
 */
function PromptOptimizerContent({ user }) {
  const { state, actions } = usePromptState();

  // URL prompt loading (extracted)
  const { skipLoad } = useUrlPromptLoader({
    currentPromptUuid: state.currentPromptUuid,
    setDisplayedPrompt: actions.setDisplayedPrompt,
    setOptimizedPrompt: actions.setOptimizedPrompt,
    setCurrentPromptUuid: actions.setCurrentPromptUuid,
    setCurrentPromptDocId: actions.setCurrentPromptDocId,
    setShowResults: actions.setShowResults,
    setPromptContext: actions.setPromptContext,
    applyHighlightSnapshot: actions.applyHighlightSnapshot,
    resetEditStacks: () => undoRedo.reset(),
  });

  // Highlight persistence (extracted)
  const {
    persistHighlights,
    latestHighlightRef,
    persistedSignatureRef,
  } = useHighlightPersistence({
    user,
    currentPromptUuid: state.currentPromptUuid,
    currentPromptDocId: state.currentPromptDocId,
    applyHighlightSnapshot: actions.applyHighlightSnapshot,
    updateHistoryHighlight: actions.updateHistoryHighlight,
  });

  // Undo/redo (extracted)
  const undoRedo = useUndoRedo({
    displayedPrompt: state.displayedPrompt,
    setDisplayedPrompt: actions.setDisplayedPrompt,
    applyHighlightSnapshot: actions.applyHighlightSnapshot,
    latestHighlightRef,
  });

  // Optimization handler (simplified)
  const handleOptimize = async (promptToOptimize, context) => {
    const result = await actions.optimize(
      promptToOptimize || state.inputPrompt,
      context || state.improvementContext,
      state.promptContext
    );
    
    if (result?.uuid) {
      actions.setDisplayedPrompt(result.optimized);
      actions.setShowResults(true);
      actions.applyHighlightSnapshot(null);
      undoRedo.reset();
    }
  };

  return (
    <div className="h-screen overflow-hidden gradient-neutral">
      <PromptModals />
      <PromptTopBar />
      <PromptSidebar user={user} />
      
      <main className="relative flex h-screen flex-col">
        {!state.showResults && (
          <PromptInputSection onOptimize={handleOptimize} />
        )}
        
        <PromptResultsSection
          onDisplayedPromptChange={undoRedo.handleChange}
          onHighlightsPersist={persistHighlights}
          onUndo={undoRedo.undo}
          onRedo={undoRedo.redo}
          canUndo={undoRedo.canUndo}
          canRedo={undoRedo.canRedo}
        />
      </main>
    </div>
  );
}

// Outer component with auth state
function PromptOptimizerContainer() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const authRepository = getAuthRepository();
    return authRepository.onAuthStateChanged(setUser);
  }, []);

  return (
    <PromptStateProvider user={user}>
      <PromptOptimizerContent user={user} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerContainer;
```

---

*Document continues with implementation details, testing strategies, and migration guides in the next sections.*
