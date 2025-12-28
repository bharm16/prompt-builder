import { RobustLlmClient, type ProviderRequestOptions } from './RobustLlmClient';
import { parseJson, cleanJsonEnvelope } from '../utils/jsonUtils';
import type { LabelSpansResult } from '../types';
import { attemptJsonRepair } from '@clients/adapters/ResponseValidator';
import { logger } from '@infrastructure/Logger';

const log = logger.child({ service: 'GeminiLlmClient' });

/**
 * Gemini LLM Client for Span Labeling
 * 
 * Specialized client for Google's Gemini models.
 * Extends RobustLlmClient to reuse the "try, validate, repair" cycle.
 */
export class GeminiLlmClient extends RobustLlmClient {
  /**
   * HOOK: Get provider name for logging and prompt building
   */
  protected override _getProviderName(): string {
    return 'gemini';
  }

  /**
   * HOOK: Get provider-specific request options
   */
  protected override _getProviderRequestOptions(): ProviderRequestOptions {
    return {
      enableBookending: false, // Gemini follows instructions well without bookending
      useFewShot: false,      // Zero-shot works well with Flash 1.5/2.0
      useSeedFromConfig: false, // Gemini doesn't support seed in the same way as OpenAI
      enableLogprobs: false,   // Not typically used for Gemini JSON mode
    };
  }

  /**
   * HOOK: Post-process result with provider-specific adjustments
   */
  protected override _postProcessResult(result: LabelSpansResult): LabelSpansResult {
    // Gemini 1.5 Flash is very fast but can sometimes be verbose
    // No specific post-processing needed yet, but keeping hook available
    return result;
  }

  protected override _parseResponseText(text: string): ReturnType<typeof parseJson> {
    const parsed = parseJson(text);
    if (parsed.ok) return parsed;

    const spans = this._recoverSpansFromText(text);
    if (spans && spans.length > 0) {
      log.debug('Gemini response parsed via recovery', {
        operation: 'span_labeling',
        spanCount: spans.length,
        responseLength: text.length,
        responsePreview: text.slice(0, 200),
      });
      return { ok: true, value: { spans } };
    }

    log.warn('Gemini response parse failed', {
      operation: 'span_labeling',
      responseLength: text.length,
      responsePreview: text.slice(0, 200),
    });
    return parsed;
  }

  protected override _normalizeParsedResponse<T extends Record<string, unknown>>(value: T): T {
    const spanContainer = value as { spans?: unknown };
    if (!Array.isArray(spanContainer.spans)) {
      return value;
    }

    spanContainer.spans = spanContainer.spans.map((span) => {
      if (!span || typeof span !== 'object') {
        return span;
      }

      const spanRecord = span as Record<string, unknown>;
      if (typeof spanRecord.role !== 'string' && typeof spanRecord.category === 'string') {
        spanRecord.role = spanRecord.category;
      }
      if ('category' in spanRecord) {
        delete spanRecord.category;
      }

      return spanRecord;
    });

    return value;
  }

  private _recoverSpansFromText(text: string): Array<Record<string, unknown>> | null {
    const cleaned = this._stripCodeFences(cleanJsonEnvelope(text));
    const trimmed = this._trimToJsonStart(cleaned);
    const arraySection = this._extractSpanArraySection(trimmed);
    const searchText = arraySection ?? trimmed;

    const objects = this._extractJsonObjects(searchText);
    if (objects.length === 0) {
      return null;
    }

    const spans = objects
      .map((objectText) => this._safeParseObject(objectText))
      .filter((span): span is Record<string, unknown> => this._isSpanObject(span));

    return spans.length > 0 ? spans : null;
  }

  private _stripCodeFences(text: string): string {
    return text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  }

  private _trimToJsonStart(text: string): string {
    const trimmed = text.trim();
    const firstBrace = trimmed.indexOf('{');
    const firstBracket = trimmed.indexOf('[');

    if (firstBrace === -1 && firstBracket === -1) {
      return trimmed;
    }

    const startIndex = firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

    return startIndex > 0 ? trimmed.slice(startIndex) : trimmed;
  }

  private _extractSpanArraySection(text: string): string | null {
    const spansIndex = text.indexOf('"spans"');
    const arrayStart = spansIndex >= 0 ? text.indexOf('[', spansIndex) : text.indexOf('[');
    if (arrayStart === -1) return null;

    const arrayEnd = this._findMatchingBracket(text, arrayStart);
    if (arrayEnd === -1) {
      return text.slice(arrayStart + 1);
    }

    return text.slice(arrayStart + 1, arrayEnd);
  }

  private _findMatchingBracket(text: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '[') {
        depth += 1;
        continue;
      }

      if (char === ']') {
        depth -= 1;
        if (depth === 0) return index;
      }
    }

    return -1;
  }

  private _extractJsonObjects(text: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    let startIndex = -1;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          startIndex = index;
        }
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;
        if (depth === 0 && startIndex !== -1) {
          objects.push(text.slice(startIndex, index + 1));
          startIndex = -1;
        }
      }
    }

    return objects;
  }

  private _safeParseObject(raw: string): Record<string, unknown> | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const { repaired } = attemptJsonRepair(trimmed);
    try {
      const parsed = JSON.parse(repaired) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private _isSpanObject(value: Record<string, unknown> | null): boolean {
    if (!value) return false;
    const hasText = typeof value.text === 'string';
    const hasRole = typeof value.role === 'string' || typeof value.category === 'string';
    return hasText && hasRole;
  }
}
