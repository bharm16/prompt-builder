import type { VideoPromptIR } from '../../types';
import type { RewriteConstraints } from '../../strategies/types';
import type { VideoPromptLlmGateway } from '../llm/VideoPromptLlmGateway';
import { resolveModelPromptStrategy } from './strategies';

/**
 * Service that uses an LLM to rewrite and reoptimize prompts for specific video models.
 */
export class VideoPromptLLMRewriter {
  constructor(private readonly gateway: VideoPromptLlmGateway | null = null) {}

  /**
   * Rewrite the prompt for a specific model using an LLM.
   */
  async rewrite(
    ir: VideoPromptIR,
    modelId: string,
    constraints: RewriteConstraints = {}
  ): Promise<string | Record<string, unknown>> {
    if (!this.gateway) {
      throw new Error('Video prompt LLM gateway unavailable');
    }

    const strategy = resolveModelPromptStrategy(modelId);
    const prompt = strategy.buildPrompt({ ir, modelId, constraints });

    if (strategy.output.format === 'structured') {
      const response = await this.gateway.rewriteStructured(prompt, strategy.output.schema);
      if (response && typeof response === 'object') {
        return response as Record<string, unknown>;
      }

      throw new Error('Structured rewrite returned invalid payload');
    }

    const response = await this.gateway.rewriteText(prompt);
    return response.trim();
  }
}
