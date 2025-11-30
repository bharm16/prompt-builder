/**
 * Mini-Max Routing Service
 * 
 * GPT-4o Best Practices: Intelligent routing between GPT-4o-mini and GPT-4o
 * Routes simple tasks to GPT-4o-mini (cost-effective) and complex tasks to GPT-4o (reliable)
 * Automatically falls back to GPT-4o if GPT-4o-mini fails validation
 * 
 * Architecture:
 * - Tier 1 (Simple): Route to GPT-4o-mini (e.g., "Extract the date from this email")
 * - Tier 2 (Complex): Route to GPT-4o (e.g., "Draft a legal response to this email")
 * - Fallback: If Tier 1 fails validation, automatically retry with GPT-4o
 */

import { logger } from '@infrastructure/Logger';
import type { AIService } from './AIModelService';
import type { AIResponse } from '@interfaces/IAIClient';

interface RoutingDecision {
  useMini: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface RoutingOptions {
  operation: string;
  systemPrompt: string;
  userMessage?: string;
  schema?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  validateResponse?: (response: AIResponse) => { valid: boolean; errors?: string[] };
}

export class MiniMaxRouter {
  constructor(private aiService: AIService) {}

  /**
   * Route request intelligently between GPT-4o-mini and GPT-4o
   * 
   * @param options Routing options
   * @returns AI response from appropriate model
   */
  async route(options: RoutingOptions): Promise<AIResponse> {
    const decision = this._analyzeComplexity(options);
    
    logger.debug('Mini-Max routing decision', {
      operation: options.operation,
      useMini: decision.useMini,
      reason: decision.reason,
      confidence: decision.confidence,
    });

    // Try Tier 1 (GPT-4o-mini) first if decision suggests it
    if (decision.useMini && decision.confidence !== 'low') {
      try {
        const response = await this._executeWithMini(options);
        
        // Validate response if validator provided
        if (options.validateResponse) {
          const validation = options.validateResponse(response);
          if (validation.valid) {
            logger.debug('Mini-Max: GPT-4o-mini succeeded validation', {
              operation: options.operation,
            });
            return response;
          } else {
            logger.info('Mini-Max: GPT-4o-mini failed validation, falling back to GPT-4o', {
              operation: options.operation,
              errors: validation.errors,
            });
            // Fall through to GPT-4o fallback
          }
        } else {
          // No validator, trust mini response
          return response;
        }
      } catch (error) {
        logger.warn('Mini-Max: GPT-4o-mini request failed, falling back to GPT-4o', {
          operation: options.operation,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to GPT-4o fallback
      }
    }

    // Tier 2: Use GPT-4o (either by decision or fallback)
    return this._executeWithGPT4o(options);
  }

  /**
   * Analyze request complexity to determine routing
   * 
   * Heuristics:
   * - Simple: Short prompts, simple extraction, basic categorization
   * - Complex: Long prompts, multi-step reasoning, complex schemas, legal/technical content
   */
  private _analyzeComplexity(options: RoutingOptions): RoutingDecision {
    const promptLength = (options.systemPrompt + (options.userMessage || '')).length;
    const hasComplexSchema = options.schema && this._isComplexSchema(options.schema);
    const hasComplexKeywords = this._hasComplexKeywords(options.systemPrompt + (options.userMessage || ''));

    // High confidence: Simple tasks
    if (promptLength < 2000 && !hasComplexSchema && !hasComplexKeywords) {
      return {
        useMini: true,
        reason: 'Short prompt, simple schema, no complex keywords',
        confidence: 'high',
      };
    }

    // High confidence: Complex tasks
    if (promptLength > 10000 || hasComplexSchema || hasComplexKeywords) {
      return {
        useMini: false,
        reason: hasComplexSchema 
          ? 'Complex schema detected' 
          : hasComplexKeywords 
            ? 'Complex keywords detected' 
            : 'Long prompt (>10k chars)',
        confidence: 'high',
      };
    }

    // Medium confidence: Borderline cases
    if (promptLength < 5000 && !hasComplexSchema) {
      return {
        useMini: true,
        reason: 'Medium-length prompt, simple schema',
        confidence: 'medium',
      };
    }

    // Default to GPT-4o for safety
    return {
      useMini: false,
      reason: 'Defaulting to GPT-4o for reliability',
      confidence: 'medium',
    };
  }

  /**
   * Check if schema is complex (deep nesting, many fields, complex enums)
   */
  private _isComplexSchema(schema: Record<string, unknown>): boolean {
    const schemaStr = JSON.stringify(schema);
    const depth = this._calculateDepth(schema);
    const fieldCount = schemaStr.match(/"(type|properties|items|enum)"/g)?.length || 0;

    // Consider complex if: depth > 3, or >20 fields, or has nested arrays/objects
    return depth > 3 || fieldCount > 20 || schemaStr.includes('"items"') || schemaStr.includes('"properties"');
  }

  /**
   * Calculate nesting depth of schema
   */
  private _calculateDepth(obj: unknown, currentDepth = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    if (Array.isArray(obj)) {
      return Math.max(...obj.map(item => this._calculateDepth(item, currentDepth + 1)));
    }

    const values = Object.values(obj);
    if (values.length === 0) {
      return currentDepth;
    }

    return Math.max(...values.map(value => this._calculateDepth(value, currentDepth + 1)));
  }

  /**
   * Check for complex keywords that suggest need for GPT-4o
   */
  private _hasComplexKeywords(text: string): boolean {
    const complexKeywords = [
      'legal', 'contract', 'agreement', 'lawsuit', 'litigation',
      'medical', 'diagnosis', 'treatment', 'prescription',
      'financial', 'investment', 'portfolio', 'derivative',
      'scientific', 'research', 'hypothesis', 'methodology',
      'multi-step', 'reasoning', 'analysis', 'synthesis',
      'complex', 'sophisticated', 'nuanced', 'subtle',
    ];

    const lowerText = text.toLowerCase();
    return complexKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Execute request with GPT-4o-mini
   */
  private async _executeWithMini(options: RoutingOptions): Promise<AIResponse> {
    // Determine mini operation name (try operation_mini, fallback to operation)
    const miniOperation = options.operation.endsWith('_mini') 
      ? options.operation 
      : `${options.operation}_mini`;

    try {
      return await this.aiService.execute(miniOperation, {
        systemPrompt: options.systemPrompt,
        userMessage: options.userMessage,
        schema: options.schema,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        timeout: options.timeout,
        enableBookending: true, // Enable bookending for mini
      });
    } catch (error) {
      // If mini operation doesn't exist, fall back to original operation with mini model override
      if (error instanceof Error && error.message.includes('not found')) {
        return await this.aiService.execute(options.operation, {
          systemPrompt: options.systemPrompt,
          userMessage: options.userMessage,
          schema: options.schema,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          timeout: options.timeout,
          model: 'gpt-4o-mini-2024-07-18', // Override to mini
          enableBookending: true,
        });
      }
      throw error;
    }
  }

  /**
   * Execute request with GPT-4o
   */
  private async _executeWithGPT4o(options: RoutingOptions): Promise<AIResponse> {
    return await this.aiService.execute(options.operation, {
      systemPrompt: options.systemPrompt,
      userMessage: options.userMessage,
      schema: options.schema,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeout: options.timeout,
      model: 'gpt-4o-2024-08-06', // Ensure GPT-4o
      enableBookending: true,
    });
  }
}

