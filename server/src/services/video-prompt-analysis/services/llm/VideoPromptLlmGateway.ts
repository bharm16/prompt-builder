import type { AIResponse } from '@interfaces/IAIClient';
import type { AIModelService } from '@services/ai-model/AIModelService';

const DEFAULT_REWRITE_TEMPERATURE = 0.4;
const DEFAULT_REWRITE_MAX_TOKENS = 8192;

export interface VideoPromptLlmGateway {
  extractIr(prompt: string, schema: Record<string, unknown>): Promise<unknown>;
  rewriteStructured(prompt: string, schema: Record<string, unknown>): Promise<unknown>;
  rewriteText(prompt: string): Promise<string>;
}

function responseText(response: AIResponse): string {
  return (response.text || response.content?.[0]?.text || '').trim();
}

function parseStructuredResponse(response: AIResponse): unknown {
  const validationParsed = response.metadata?.validation?.parsed;
  if (validationParsed !== undefined) {
    return validationParsed;
  }

  const raw = responseText(response);
  if (!raw) {
    return null;
  }

  const fencedJson = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedJson?.[1] ?? raw;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export class AIServiceVideoPromptLlmGateway implements VideoPromptLlmGateway {
  constructor(private readonly aiService: AIModelService) {}

  async extractIr(prompt: string, schema: Record<string, unknown>): Promise<unknown> {
    const response = await this.aiService.execute('video_prompt_ir_extraction', {
      systemPrompt: prompt,
      schema,
      jsonMode: true,
      responseFormat: { type: 'json_object' },
    });

    return parseStructuredResponse(response);
  }

  async rewriteStructured(prompt: string, schema: Record<string, unknown>): Promise<unknown> {
    const response = await this.aiService.execute('video_prompt_rewrite', {
      systemPrompt: prompt,
      schema,
      jsonMode: true,
      responseFormat: { type: 'json_object' },
    });

    return parseStructuredResponse(response);
  }

  async rewriteText(prompt: string): Promise<string> {
    const response = await this.aiService.execute('video_prompt_rewrite', {
      systemPrompt: prompt,
      temperature: DEFAULT_REWRITE_TEMPERATURE,
      maxTokens: DEFAULT_REWRITE_MAX_TOKENS,
    });

    return responseText(response);
  }
}
