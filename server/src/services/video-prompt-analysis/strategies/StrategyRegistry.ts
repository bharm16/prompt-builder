/**
 * Registry for managing prompt optimization strategy instances
 * Provides centralized access to model-specific strategies
 */

import type { PromptOptimizationStrategy } from './types';

/**
 * StrategyRegistry manages the collection of prompt optimization strategies
 * Each strategy is registered by its modelId and can be retrieved for use
 */
export class StrategyRegistry {
  private strategies: Map<string, PromptOptimizationStrategy> = new Map();

  /**
   * Register a strategy for a specific model
   * @param strategy - The strategy implementation to register
   * @throws Error if a strategy with the same modelId is already registered
   */
  register(strategy: PromptOptimizationStrategy): void {
    if (this.strategies.has(strategy.modelId)) {
      throw new Error(
        `Strategy for model "${strategy.modelId}" is already registered`
      );
    }
    this.strategies.set(strategy.modelId, strategy);
  }

  /**
   * Get a strategy by model ID
   * @param modelId - The model identifier (e.g., "runway-gen45", "luma-ray3")
   * @returns The strategy if found, undefined otherwise
   */
  get(modelId: string): PromptOptimizationStrategy | undefined {
    return this.strategies.get(modelId);
  }

  /**
   * Get all registered strategies
   * @returns Array of all registered strategies
   */
  getAll(): PromptOptimizationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Check if a strategy is registered for a model
   * @param modelId - The model identifier to check
   * @returns true if a strategy exists for the model
   */
  has(modelId: string): boolean {
    return this.strategies.has(modelId);
  }

  /**
   * Get all registered model IDs
   * @returns Array of model IDs
   */
  getModelIds(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get the count of registered strategies
   * @returns Number of registered strategies
   */
  get size(): number {
    return this.strategies.size;
  }

  /**
   * Clear all registered strategies
   * Useful for testing or resetting the registry
   */
  clear(): void {
    this.strategies.clear();
  }
}
