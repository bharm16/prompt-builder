/**
 * OpenAiStreamParser - Parses SSE streams for OpenAI-compatible APIs
 */

import { logger } from '@infrastructure/Logger';

export class OpenAiStreamParser {
  async readStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed: unknown = JSON.parse(data);
              const content = this.extractDeltaContent(parsed);
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch {
              logger.debug('Skipping malformed SSE chunk', { chunk: data.substring(0, 100) });
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  private extractDeltaContent(parsed: unknown): string | null {
    if (!this.isRecord(parsed)) return null;
    const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    const firstChoice = choices[0];
    if (!this.isRecord(firstChoice)) return null;
    const delta = firstChoice.delta;
    if (!this.isRecord(delta)) return null;
    return typeof delta.content === 'string' ? delta.content : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
