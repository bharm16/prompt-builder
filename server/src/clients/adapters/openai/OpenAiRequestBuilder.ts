/**
 * OpenAiRequestBuilder - Builds request payloads for OpenAI-compatible APIs
 */

import type { CompletionOptions, OpenAiPayload } from './types.ts';
import { OpenAiMessageBuilder } from './OpenAiMessageBuilder.ts';

interface RequestBuilderConfig {
  defaultModel: string;
  supportsPredictedOutputs: boolean;
}

export class OpenAiRequestBuilder {
  constructor(
    private readonly messageBuilder: OpenAiMessageBuilder,
    private readonly config: RequestBuilderConfig
  ) {}

  buildPayload(
    systemPrompt: string,
    options: CompletionOptions,
    stream: boolean = false
  ): OpenAiPayload {
    const messages = this.messageBuilder.buildMessages(systemPrompt, options);

    const isStructuredOutput = !!(options.schema || options.responseFormat || options.jsonMode);
    const defaultTemp = isStructuredOutput ? 0.0 : 0.7;
    const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;

    const payload: OpenAiPayload = {
      model: options.model || this.config.defaultModel,
      messages,
      max_tokens: options.maxTokens || 2048,
      temperature,
      ...(stream ? { stream: true } : {}),
    };

    if (options.seed !== undefined) {
      payload.seed = options.seed;
    } else if (isStructuredOutput) {
      payload.seed = this.hashString(systemPrompt) % 2147483647;
    }

    if (!stream && options.logprobs) {
      payload.logprobs = true;
      payload.top_logprobs = Math.min(options.topLogprobs ?? 3, 20);
    }

    if (!stream && options.prediction && this.config.supportsPredictedOutputs) {
      payload.prediction = options.prediction;
    }

    if (options.schema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: options.schema,
        },
      };
    } else if (options.responseFormat) {
      payload.response_format = options.responseFormat;
    } else if (options.jsonMode && !options.isArray) {
      payload.response_format = { type: 'json_object' };
    }

    if (isStructuredOutput) {
      payload.frequency_penalty = 0;
    }

    if (temperature === 0) {
      payload.top_p = 1.0;
    }

    if (!stream && options.store !== undefined) {
      payload.store = options.store;
    }

    if (stream && options.streamOptions) {
      payload.stream_options = options.streamOptions;
    }

    return payload;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
