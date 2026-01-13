/**
 * OpenAiResponseParser - Normalizes OpenAI-compatible responses
 */

import type { AIResponse, CompletionOptions, LogprobInfo, OpenAIResponseData } from './types.ts';

export class OpenAiResponseParser {
  constructor(private readonly providerName: string) {}

  parseResponse(data: OpenAIResponseData, options: CompletionOptions): AIResponse {
    const text = data.choices?.[0]?.message?.content || '';

    let logprobsInfo: LogprobInfo[] | undefined;
    let averageConfidence: number | undefined;

    if (options.logprobs && data.choices?.[0]?.logprobs?.content) {
      logprobsInfo = data.choices[0].logprobs.content.map((item) => ({
        token: item.token,
        logprob: item.logprob,
        probability: Math.exp(item.logprob),
      }));

      if (logprobsInfo.length > 0) {
        const sum = logprobsInfo.reduce((acc, item) => acc + item.probability, 0);
        averageConfidence = sum / logprobsInfo.length;
      }
    }

    const optimizations: string[] = [];
    if (options.schema) optimizations.push('structured-outputs-strict');
    if (options.developerMessage) optimizations.push('developer-role');
    if (options.enableBookending) optimizations.push('bookending');
    if (options.seed !== undefined) optimizations.push('seed-deterministic');
    if (options.logprobs) optimizations.push('logprobs-confidence');
    if (options.prediction) optimizations.push('predicted-outputs');

    const metadata = {
      usage: data.usage,
      raw: data,
      _original: data,
      provider: this.providerName,
      optimizations,
      ...(data.model ? { model: data.model } : {}),
      ...(data.choices?.[0]?.finish_reason ? { finishReason: data.choices[0].finish_reason } : {}),
      ...(data.system_fingerprint ? { systemFingerprint: data.system_fingerprint } : {}),
      ...(data.id ? { requestId: data.id } : {}),
      ...(logprobsInfo ? { logprobs: logprobsInfo } : {}),
      ...(typeof averageConfidence === 'number' ? { averageConfidence } : {}),
    };

    return {
      text,
      metadata,
    };
  }
}
