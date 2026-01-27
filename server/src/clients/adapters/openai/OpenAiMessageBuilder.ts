/**
 * OpenAiMessageBuilder - Handles message construction for OpenAI-compatible APIs
 *
 * Single responsibility: Build message arrays and apply prompt strategies
 * like developer-role injection and bookending.
 */

import type { CompletionOptions, OpenAiMessage } from './types.ts';
import type { MessageContent } from '@interfaces/IAIClient';

export class OpenAiMessageBuilder {
  buildMessages(systemPrompt: string, options: CompletionOptions): OpenAiMessage[] {
    if (options.messages && Array.isArray(options.messages)) {
      return this.buildFromMessageHistory(options);
    }

    return this.buildSimpleMessage(systemPrompt, options);
  }

  private buildFromMessageHistory(options: CompletionOptions): OpenAiMessage[] {
    const messages: OpenAiMessage[] = [];

    if (options.developerMessage) {
      messages.push({ role: 'developer', content: options.developerMessage });
    }

    messages.push(...options.messages!);

    if (options.enableBookending) {
      const totalTokens = messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
      if (totalTokens > 30000) {
        const systemMsg = messages.find((m) => m.role === 'system');
        const systemText = systemMsg ? this.stringifyContent(systemMsg.content) : '';
        const criticalInstructions = systemText
          ? this.extractCriticalInstructions(systemText)
          : 'Remember to follow the format constraints defined in the system message.';
        messages.push({
          role: 'user',
          content: `Based on the context above, perform the requested task. ${criticalInstructions}`,
        });
      }
    }

    return messages;
  }

  private buildSimpleMessage(systemPrompt: string, options: CompletionOptions): OpenAiMessage[] {
    const messages: OpenAiMessage[] = [];

    if (options.developerMessage) {
      messages.push({ role: 'developer', content: options.developerMessage });
    }

    messages.push({ role: 'system', content: systemPrompt });

    const userMessage = options.userMessage || 'Please proceed.';
    messages.push({ role: 'user', content: userMessage });

    if (options.enableBookending) {
      const totalTokens = this.estimateTokens(systemPrompt + userMessage);
      if (totalTokens > 30000) {
        const criticalInstructions = this.extractCriticalInstructions(systemPrompt);
        messages.push({
          role: 'user',
          content: `Based on the context above, perform the requested task. ${criticalInstructions}`,
        });
      }
    }

    return messages;
  }

  private estimateTokens(content: MessageContent): number {
    const text = this.stringifyContent(content);
    return Math.ceil(text.length / 4);
  }

  private stringifyContent(content: MessageContent): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          if (part && typeof part === 'object') {
            if ('text' in part && typeof part.text === 'string') {
              return part.text;
            }
            if ('type' in part && part.type === 'text' && typeof part.text === 'string') {
              return part.text;
            }
          }
          return '';
        })
        .join('');
    }

    if (content && typeof content === 'object') {
      if ('text' in content && typeof content.text === 'string') {
        return content.text;
      }
    }

    return '';
  }

  private extractCriticalInstructions(systemPrompt: string): string {
    const criticalPatterns = [
      /respond\\s+only\\s+with\\s+valid\\s+json/i,
      /output\\s+only\\s+valid\\s+json/i,
      /no\\s+markdown/i,
      /follow\\s+the\\s+format\\s+constraints/i,
      /required\\s+fields/i,
      /validation\\s+requirements/i,
    ];

    const matches: string[] = [];
    for (const pattern of criticalPatterns) {
      const match = systemPrompt.match(pattern);
      if (match) {
        const index = systemPrompt.indexOf(match[0]);
        const start = Math.max(0, index - 50);
        const end = Math.min(systemPrompt.length, index + match[0].length + 50);
        matches.push(systemPrompt.substring(start, end).trim());
      }
    }

    if (matches.length > 0) {
      const firstMatch = matches[0];
      if (firstMatch) {
        return firstMatch;
      }
    }

    return 'Remember to follow the format constraints defined in the system message.';
  }
}
