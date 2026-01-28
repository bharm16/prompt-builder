import { GeminiAdapter } from '../../../../clients/adapters/GeminiAdapter';
import type { VideoPromptIR } from '../../types';
import type { RewriteConstraints } from '../../strategies/types';
import { resolveModelPromptStrategy } from './strategies';

/**
 * Service that uses an LLM to rewrite and reoptimize prompts for specific video models.
 */
export class VideoPromptLLMRewriter {
  private adapter: GeminiAdapter | null = null;

  private getAdapter(): GeminiAdapter {
    if (!this.adapter) {
      this.adapter = new GeminiAdapter({
        apiKey: process.env.GEMINI_API_KEY || '',
        defaultModel: 'gemini-2.5-flash',
      });
    }
    return this.adapter;
  }

  /**
   * Rewrite the prompt for a specific model using an LLM.
   */
  async rewrite(
    ir: VideoPromptIR,
    modelId: string,
    constraints: RewriteConstraints = {}
  ): Promise<string | Record<string, unknown>> {
    const strategy = resolveModelPromptStrategy(modelId);
    const prompt = strategy.buildPrompt({ ir, modelId, constraints });
    const adapter = this.getAdapter();
    
    if (strategy.output.format === 'structured') {
      const response = await adapter.generateStructuredOutput(prompt, strategy.output.schema);
      return response;
    }

    const response = await adapter.generateText(prompt, {
      temperature: 0.4, // Keep it relatively deterministic but creative
      maxTokens: 8192,
    });

    return response.trim();
  }
}
