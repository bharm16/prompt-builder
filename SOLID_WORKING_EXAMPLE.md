# SOLID Refactoring - Complete Working Example

This document provides a complete, working example showing how the refactored code works together.

---

## Example: Optimizing a Reasoning Prompt

### Scenario
User submits a prompt in "reasoning" mode, and the system:
1. Infers context from the prompt
2. Generates domain-specific warnings/deliverables
3. Creates optimized prompt using two-stage optimization
4. Caches the result

---

## Complete Code Flow

### 1. Entry Point: API Route Handler

**File:** `server/src/routes/api.routes.js`

```javascript
import express from 'express';

export function createAPIRoutes({ promptOptimizationService }) {
  const router = express.Router();

  /**
   * POST /api/optimize
   * Optimize a prompt
   */
  router.post('/optimize', async (req, res, next) => {
    try {
      const { prompt, mode = 'reasoning', context = null } = req.body;

      // Delegate to service (injected via DI)
      const optimized = await promptOptimizationService.optimize({
        prompt,
        modeName: mode,
        context,
        useTwoStage: true,
      });

      res.json({
        optimized,
        mode,
        requestId: req.id,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

---

### 2. Orchestrator: Coordinates the Flow

**File:** `server/src/services/prompt-optimization/PromptOptimizationOrchestrator.js`

```javascript
/**
 * Main orchestrator that coordinates the optimization process
 * 
 * SOLID Compliance:
 * - SRP: Coordinates optimization flow only, delegates all work
 * - DIP: Depends on abstractions (injected dependencies)
 * - OCP: New modes/features added without modifying this class
 */
export class PromptOptimizationOrchestrator {
  constructor({
    modeRegistry,              // ← Manages optimization modes
    contextInferenceService,   // ← Infers context from prompts
    twoStageService,           // ← Handles two-stage optimization
    cacheService,              // ← Manages caching
    logger,                    // ← Logging
  }) {
    this.modeRegistry = modeRegistry;
    this.contextInferenceService = contextInferenceService;
    this.twoStageService = twoStageService;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  async optimize({
    prompt,
    modeName,
    context = null,
    useTwoStage = false,
    onDraft = null,
  }) {
    this.logger.info('Optimizing prompt', { mode: modeName });

    // STEP 1: Get mode implementation
    const mode = this.modeRegistry.get(modeName);

    // STEP 2: Infer context if needed
    if (modeName === 'reasoning' && !context) {
      this.logger.info('Inferring context for reasoning mode');
      context = await this.contextInferenceService.infer(prompt);
    }

    // STEP 3: Check cache
    const cacheKey = this.cacheService.generateKey('prompt-optimization', {
      prompt: prompt.substring(0, 100),
      mode: modeName,
      context,
    });

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit');
      return cached;
    }

    // STEP 4: Perform optimization
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
      optimized = await this._singleStageOptimize(prompt, mode, context);
    }

    // STEP 5: Cache result
    await this.cacheService.set(cacheKey, optimized);

    this.logger.info('Optimization completed', {
      outputLength: optimized.length,
    });

    return optimized;
  }

  async _singleStageOptimize(prompt, mode, context) {
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

    return response.text;
  }
}
```

---

### 3. Context Inference Service

**File:** `server/src/services/prompt-optimization/ContextInferenceService.js`

```javascript
/**
 * Infers context from user prompts
 * 
 * SOLID Compliance:
 * - SRP: Focused solely on context inference
 * - DIP: Depends on IAIClient abstraction
 */
export class ContextInferenceService {
  constructor({ client, logger }) {
    this.client = client;  // IAIClient (abstraction)
    this.logger = logger;
  }

  async infer(prompt) {
    this.logger.info('Inferring context', { promptLength: prompt.length });

    try {
      const inferencePrompt = this._buildInferencePrompt(prompt);
      
      // Call AI client (any implementation of IAIClient works)
      const response = await this.client.complete(inferencePrompt, {
        maxTokens: 500,
        temperature: 0.3,
        timeout: 15000,
      });

      // Parse and validate response
      const inferredContext = this._parseResponse(response.text);
      
      this.logger.info('Context inferred', {
        backgroundLevel: inferredContext.backgroundLevel,
      });

      return inferredContext;
      
    } catch (error) {
      this.logger.error('Context inference failed', error);
      
      // Safe fallback
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      };
    }
  }

  _buildInferencePrompt(prompt) {
    return `Analyze this prompt and infer context.

<prompt>${prompt}</prompt>

Output JSON:
{
  "specificAspects": "key focus areas",
  "backgroundLevel": "novice|intermediate|expert",
  "intendedUse": "use case"
}`;
  }

  _parseResponse(text) {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate background level
    const validLevels = ['novice', 'intermediate', 'expert'];
    if (!validLevels.includes(parsed.backgroundLevel)) {
      parsed.backgroundLevel = 'intermediate';
    }
    
    return parsed;
  }
}
```

---

### 4. Reasoning Mode Implementation

**File:** `server/src/services/prompt-optimization/modes/ReasoningMode.js`

```javascript
import { IOptimizationMode } from '../interfaces/IOptimizationMode.js';

/**
 * Reasoning Mode Implementation
 * 
 * SOLID Compliance:
 * - SRP: Handles only reasoning mode logic
 * - LSP: Properly implements IOptimizationMode interface
 * - OCP: Can be added/removed without affecting other modes
 */
export class ReasoningMode extends IOptimizationMode {
  constructor({ logger }) {
    super();
    this.logger = logger;
  }

  getName() {
    return 'reasoning';
  }

  async generateDomainContent(prompt, context, client) {
    this.logger.info('Generating reasoning domain content');

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';

    const stage1Prompt = `Generate domain-specific warnings and deliverables.

Prompt: "${prompt}"
Domain: ${domain}
Expertise: ${expertiseLevel}

Output JSON:
{
  "warnings": ["warning 1", "warning 2", ...],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "constraints": ["constraint 1", ...]
}`;

    try {
      const response = await client.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const domainContent = this._parseJSON(response.text);

      this.logger.info('Domain content generated', {
        warningCount: domainContent.warnings?.length || 0,
        deliverableCount: domainContent.deliverables?.length || 0,
      });

      return domainContent;
      
    } catch (error) {
      this.logger.error('Domain content generation failed', error);
      return {
        warnings: [],
        deliverables: [],
        constraints: [],
      };
    }
  }

  generateSystemPrompt(prompt, context, domainContent) {
    // Build comprehensive reasoning template
    let systemPrompt = `You are a prompt optimization expert.

Transform this prompt into a structured reasoning prompt:

<user_prompt>${prompt}</user_prompt>
`;

    // Add domain content if available
    if (domainContent && domainContent.warnings?.length > 0) {
      systemPrompt += `\n<domain_warnings>\n`;
      domainContent.warnings.forEach((warning, i) => {
        systemPrompt += `${i + 1}. ${warning}\n`;
      });
      systemPrompt += `</domain_warnings>\n`;
    }

    if (domainContent && domainContent.deliverables?.length > 0) {
      systemPrompt += `\n<domain_deliverables>\n`;
      domainContent.deliverables.forEach((deliverable, i) => {
        systemPrompt += `${i + 1}. ${deliverable}\n`;
      });
      systemPrompt += `</domain_deliverables>\n`;
    }

    systemPrompt += `
Output structure:
**Goal**
[One sentence objective]

**Return Format**
[Use domain deliverables if provided, or generate specific ones]

**Warnings**
[Use domain warnings if provided, or generate specific ones]

**Context**
[Essential background information]
`;

    return systemPrompt;
  }

  generateDraftPrompt(prompt, context) {
    return `Create a concise reasoning prompt (100-150 words).

Include:
- Core problem statement
- Key analytical approach
- Expected reasoning pattern

Output ONLY the draft prompt.`;
  }

  _parseJSON(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }
}
```

---

### 5. Two-Stage Optimization Service

**File:** `server/src/services/prompt-optimization/TwoStageOptimizationService.js`

```javascript
/**
 * Handles two-stage optimization (draft + refinement)
 * 
 * SOLID Compliance:
 * - SRP: Handles only two-stage orchestration
 * - DIP: Depends on IAIClient abstraction
 */
export class TwoStageOptimizationService {
  constructor({ draftClient, refinementClient, logger }) {
    this.draftClient = draftClient;       // Fast client (e.g., Groq)
    this.refinementClient = refinementClient; // Quality client (e.g., OpenAI)
    this.logger = logger;
  }

  async optimize({ prompt, mode, context, onDraft }) {
    this.logger.info('Starting two-stage optimization', {
      mode: mode.getName(),
    });

    // Fallback to single-stage if no draft client
    if (!this.draftClient) {
      return this._singleStage(prompt, mode, context);
    }

    const startTime = Date.now();

    try {
      // STAGE 1: Generate draft
      const draftResult = await this._generateDraft(prompt, mode, context);
      
      this.logger.info('Draft generated', {
        duration: Date.now() - startTime,
        length: draftResult.draft.length,
      });

      // Call onDraft callback
      if (onDraft) {
        onDraft(draftResult.draft, draftResult.spans);
      }

      // STAGE 2: Refine draft
      const refined = await this._refineDraft(draftResult.draft, mode, context);
      
      this.logger.info('Two-stage optimization complete', {
        totalDuration: Date.now() - startTime,
      });

      return {
        draft: draftResult.draft,
        refined,
        metadata: {
          usedTwoStage: true,
          totalDuration: Date.now() - startTime,
        }
      };

    } catch (error) {
      this.logger.error('Two-stage optimization failed', error);
      
      // Fallback to single-stage
      const fallback = await this._singleStage(prompt, mode, context);
      return {
        draft: fallback,
        refined: fallback,
        usedFallback: true,
      };
    }
  }

  async _generateDraft(prompt, mode, context) {
    const draftPrompt = mode.generateDraftPrompt(prompt, context);
    
    const response = await this.draftClient.complete(draftPrompt, {
      userMessage: prompt,
      maxTokens: 200,
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
      timeout: 30000,
    });

    return response.text;
  }

  async _singleStage(prompt, mode, context) {
    const systemPrompt = mode.generateSystemPrompt(prompt, context, null);
    
    const response = await this.refinementClient.complete(systemPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
    });

    return response.text;
  }
}
```

---

### 6. Mode Registry

**File:** `server/src/services/prompt-optimization/modes/ModeRegistry.js`

```javascript
/**
 * Registry for optimization modes
 * 
 * SOLID Compliance:
 * - OCP: New modes registered without modifying this class
 * - DIP: Manages IOptimizationMode abstractions
 */
export class ModeRegistry {
  constructor() {
    this.modes = new Map();
  }

  register(mode) {
    this.modes.set(mode.getName(), mode);
  }

  get(name) {
    const mode = this.modes.get(name);
    if (!mode) {
      throw new Error(`Unknown mode: ${name}`);
    }
    return mode;
  }

  has(name) {
    return this.modes.has(name);
  }

  getAllModeNames() {
    return Array.from(this.modes.keys());
  }
}
```

---

### 7. Cache Service (with Decorator)

**File:** `server/src/services/cache/CacheServiceWithStatistics.js`

```javascript
import { ICacheService } from '../../interfaces/ICacheService.js';

/**
 * Cache decorator that adds statistics tracking
 * 
 * SOLID Compliance:
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

### 8. Dependency Injection Setup

**File:** `server/src/infrastructure/ServiceRegistration.js`

```javascript
import { Logger } from '../infrastructure/Logger.refactored.js';
import { OpenAIAPIClient } from '../clients/OpenAIAPIClient.refactored.js';
import { GroqAPIClient } from '../clients/GroqAPIClient.js';
import { NodeCacheAdapter } from '../services/cache/NodeCacheAdapter.js';
import { CacheKeyGenerator } from '../services/cache/CacheKeyGenerator.js';
import { CacheStatisticsTracker } from '../services/cache/CacheStatisticsTracker.js';
import { CacheServiceWithStatistics } from '../services/cache/CacheServiceWithStatistics.js';
import { ModeRegistry } from '../services/prompt-optimization/modes/ModeRegistry.js';
import { ReasoningMode } from '../services/prompt-optimization/modes/ReasoningMode.js';
import { ContextInferenceService } from '../services/prompt-optimization/ContextInferenceService.js';
import { TwoStageOptimizationService } from '../services/prompt-optimization/TwoStageOptimizationService.js';
import { PromptOptimizationOrchestrator } from '../services/prompt-optimization/PromptOptimizationOrchestrator.js';

/**
 * Register all services in DI container
 * 
 * SOLID Compliance:
 * - DIP: All dependencies injected through constructor
 * - OCP: New services added without modifying existing ones
 */
export function registerServices(container, config) {
  // Infrastructure
  container.register('logger', () => new Logger({
    level: config.logLevel,
  }));

  // AI Clients
  container.register('openAIClient', (c) => new OpenAIAPIClient({
    apiKey: config.openAI.apiKey,
    config: {
      model: config.openAI.model,
      timeout: config.openAI.timeout,
    },
    circuitBreaker: c.resolve('circuitBreakerFactory').create('openai'),
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
      circuitBreaker: c.resolve('circuitBreakerFactory').create('groq'),
      logger: c.resolve('logger'),
      metricsCollector: c.resolve('metricsService'),
    }));
  }

  // Cache services
  container.register('cacheKeyGenerator', () => new CacheKeyGenerator({
    semanticEnhancer: null, // Could inject semantic enhancer
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

  // Mode registry
  container.register('modeRegistry', (c) => {
    const registry = new ModeRegistry();
    const logger = c.resolve('logger');
    
    // Register modes
    registry.register(new ReasoningMode({ logger }));
    // registry.register(new ResearchMode({ logger }));
    // registry.register(new SocraticMode({ logger }));
    // ... other modes
    
    return registry;
  });

  // Prompt optimization services
  container.register('contextInferenceService', (c) => new ContextInferenceService({
    client: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
  }));

  container.register('twoStageOptimizationService', (c) => new TwoStageOptimizationService({
    draftClient: config.groq?.apiKey ? c.resolve('groqClient') : null,
    refinementClient: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
  }));

  container.register('promptOptimizationService', (c) => new PromptOptimizationOrchestrator({
    modeRegistry: c.resolve('modeRegistry'),
    contextInferenceService: c.resolve('contextInferenceService'),
    twoStageService: c.resolve('twoStageOptimizationService'),
    cacheService: c.resolve('cacheService'),
    logger: c.resolve('logger'),
  }));
}
```

---

### 9. Main Server Entry Point

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
 * SOLID Compliance:
 * - SRP: Focused on application lifecycle only
 * - DIP: All dependencies injected through container
 * - OCP: Services/middleware/routes registered in separate modules
 */

// Load and validate environment
dotenv.config();

try {
  validateEnvironment();
  console.log('✅ Environment validated');
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

// Load configuration
const config = loadConfiguration();

// Create dependency injection container
const container = new DependencyContainer();

// Register all services
registerServices(container, config);

// Create Express app
const app = express();

// Register middleware
registerMiddleware(app, container, config);

// Register routes
registerRoutes(app, container);

// Error handling
app.use(container.resolve('errorHandler'));

// Start server
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.port;
  const logger = container.resolve('logger');
  
  const server = app.listen(PORT, () => {
    logger.info('Server started', { port: PORT });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    server.close(() => {
      container.resolve('shutdownService').shutdown();
      process.exit(0);
    });
  });
}

export default app;
export { container };
```

---

## Complete Request Flow

### Request: `POST /api/optimize`

```json
{
  "prompt": "help me analyze the performance bottleneck in my React app",
  "mode": "reasoning"
}
```

### Step-by-Step Execution:

1. **Route Handler** receives request
   - Extracts `prompt`, `mode` from body
   - Calls `promptOptimizationService.optimize()`

2. **PromptOptimizationOrchestrator.optimize()**
   - Gets ReasoningMode from ModeRegistry
   - No context provided, so calls ContextInferenceService

3. **ContextInferenceService.infer()**
   - Builds inference prompt
   - Calls OpenAIClient.complete()
   - Parses response: `{backgroundLevel: "intermediate", specificAspects: "React performance, bottleneck analysis", ...}`
   - Returns inferred context

4. **Back to Orchestrator**
   - Checks cache (miss)
   - Calls TwoStageOptimizationService.optimize()

5. **TwoStageOptimizationService.optimize()**
   - Calls ReasoningMode.generateDomainContent() with OpenAI client
   
6. **ReasoningMode.generateDomainContent()**
   - Builds domain content prompt with expertise level "intermediate"
   - Calls OpenAI to generate warnings/deliverables
   - Returns: `{warnings: ["Avoid premature optimization...", "Consider profiler data..."], deliverables: [...]}`

7. **Back to TwoStageService**
   - Stage 1: Calls GroqClient.complete() for draft (fast)
   - Draft generated in 300ms
   - Stage 2: Calls ReasoningMode.generateSystemPrompt() with domain content
   - Calls OpenAIClient.complete() for refinement (quality)
   - Refinement completed in 3s

8. **Back to Orchestrator**
   - Caches result
   - Returns optimized prompt

9. **Route Handler**
   - Returns JSON response

### Response:
```json
{
  "optimized": "**Goal**\nIdentify and resolve the primary performance bottleneck in your React application using profiler data and metrics.\n\n**Return Format**\n- Root cause analysis with specific component/function names\n- Profiler screenshots showing render times\n- Recommended optimization approach with code examples\n- Before/after performance metrics\n\n**Warnings**\n- Avoid premature optimization - profile first to identify actual bottleneck\n- Consider that React.memo() and useMemo() add overhead - only use when profiler shows benefit\n- Ensure you're measuring production build, not development (10x difference)\n- Account for network waterfalls in addition to render performance\n\n**Context**\nReact performance bottlenecks typically fall into three categories: excessive re-renders, heavy computations during render, or inefficient data fetching patterns...",
  "mode": "reasoning",
  "requestId": "req-123"
}
```

---

## Testing the Refactored Code

### Unit Test: ContextInferenceService

```javascript
import { ContextInferenceService } from '../ContextInferenceService';

describe('ContextInferenceService', () => {
  it('infers context from prompt', async () => {
    // Arrange
    const mockClient = {
      complete: jest.fn().mockResolvedValue({
        text: '{"specificAspects": "React performance", "backgroundLevel": "intermediate", "intendedUse": "debugging"}'
      })
    };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    
    const service = new ContextInferenceService({
      client: mockClient,
      logger: mockLogger,
    });

    // Act
    const result = await service.infer('help me debug my React app');

    // Assert
    expect(result).toEqual({
      specificAspects: 'React performance',
      backgroundLevel: 'intermediate',
      intendedUse: 'debugging',
    });
    expect(mockClient.complete).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Context inferred',
      expect.any(Object)
    );
  });

  it('returns fallback on error', async () => {
    // Arrange
    const mockClient = {
      complete: jest.fn().mockRejectedValue(new Error('API error'))
    };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    
    const service = new ContextInferenceService({
      client: mockClient,
      logger: mockLogger,
    });

    // Act
    const result = await service.infer('test');

    // Assert
    expect(result).toEqual({
      specificAspects: '',
      backgroundLevel: 'intermediate',
      intendedUse: '',
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
```

### Unit Test: ReasoningMode

```javascript
import { ReasoningMode } from '../ReasoningMode';

describe('ReasoningMode', () => {
  it('generates domain content', async () => {
    // Arrange
    const mockClient = {
      complete: jest.fn().mockResolvedValue({
        text: '{"warnings": ["warning 1"], "deliverables": ["deliverable 1"], "constraints": []}'
      })
    };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    
    const mode = new ReasoningMode({ logger: mockLogger });
    const context = {
      specificAspects: 'React performance',
      backgroundLevel: 'intermediate',
    };

    // Act
    const result = await mode.generateDomainContent(
      'test prompt',
      context,
      mockClient
    );

    // Assert
    expect(result).toEqual({
      warnings: ['warning 1'],
      deliverables: ['deliverable 1'],
      constraints: [],
    });
    expect(mockClient.complete).toHaveBeenCalledWith(
      expect.stringContaining('Generate domain-specific'),
      expect.any(Object)
    );
  });

  it('returns name', () => {
    const mode = new ReasoningMode({ logger: null });
    expect(mode.getName()).toBe('reasoning');
  });
});
```

### Integration Test: Full Optimization

```javascript
import { DependencyContainer } from '../infrastructure/DependencyContainer';
import { registerServices } from '../infrastructure/ServiceRegistration';

describe('Prompt Optimization Integration', () => {
  let container;
  let mockOpenAIClient;

  beforeEach(() => {
    // Create mock AI client
    mockOpenAIClient = {
      complete: jest.fn()
        .mockResolvedValueOnce({
          // First call: context inference
          text: '{"backgroundLevel": "intermediate", "specificAspects": "React", "intendedUse": "debugging"}'
        })
        .mockResolvedValueOnce({
          // Second call: domain content
          text: '{"warnings": ["w1"], "deliverables": ["d1"], "constraints": []}'
        })
        .mockResolvedValueOnce({
          // Third call: optimization
          text: 'Optimized prompt result'
        })
    };

    // Setup container with mocks
    container = new DependencyContainer();
    registerServices(container, testConfig);
    
    // Override AI client with mock
    container.registerInstance('openAIClient', mockOpenAIClient);
    container.registerInstance('groqClient', null); // No draft client
  });

  it('optimizes reasoning prompt end-to-end', async () => {
    // Arrange
    const orchestrator = container.resolve('promptOptimizationService');

    // Act
    const result = await orchestrator.optimize({
      prompt: 'help me debug my React app',
      modeName: 'reasoning',
    });

    // Assert
    expect(result).toBe('Optimized prompt result');
    expect(mockOpenAIClient.complete).toHaveBeenCalledTimes(3);
    
    // Verify context inference was called
    expect(mockOpenAIClient.complete).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Analyze this prompt'),
      expect.any(Object)
    );
    
    // Verify domain content generation was called
    expect(mockOpenAIClient.complete).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Generate domain-specific'),
      expect.any(Object)
    );
    
    // Verify optimization was called
    expect(mockOpenAIClient.complete).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('You are a prompt optimization expert'),
      expect.any(Object)
    );
  });
});
```

---

## Key Takeaways

### SOLID Principles in Action:

1. **Single Responsibility Principle**
   - Each service has ONE job
   - ContextInferenceService: Context inference only
   - ReasoningMode: Reasoning prompt logic only
   - TwoStageService: Two-stage orchestration only

2. **Open/Closed Principle**
   - Add new mode: Create new class, register in ModeRegistry
   - No modifications to existing code
   
   ```javascript
   // Add new mode (no changes to existing code)
   class CodeReviewMode extends IOptimizationMode {
     getName() { return 'code-review'; }
     // ... implementation
   }
   
   modeRegistry.register(new CodeReviewMode({ logger }));
   ```

3. **Liskov Substitution Principle**
   - Any IAIClient can be substituted
   - OpenAIClient, ClaudeClient, GroqClient all work identically
   
   ```javascript
   // Works with any IAIClient implementation
   const result = await client.complete(prompt, options);
   ```

4. **Interface Segregation Principle**
   - Clients only depend on methods they need
   - IAIClient has single method: complete()
   
5. **Dependency Inversion Principle**
   - All services depend on abstractions (IAIClient, ICacheService, ILogger)
   - Easy to test with mocks
   - Easy to swap implementations

---

*This example demonstrates how the refactored architecture works in practice while maintaining all original functionality and achieving SOLID compliance.*
