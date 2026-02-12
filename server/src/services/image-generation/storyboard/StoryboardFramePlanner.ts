import type { LLMClient } from '@clients/LLMClient';
import { logger } from '@infrastructure/Logger';
import { extractResponseText } from '@utils/JsonExtractor';
import { STORYBOARD_FRAME_TIMESTAMPS } from './constants';
import { fetchImageAsDataUrl } from './fetchImageAsDataUrl';
import {
  buildFallbackDeltas,
  buildRepairSystemPrompt,
  buildSystemPrompt,
  buildVisionDeltaUserPrompt,
} from './prompts';
import {
  parseStoryboardDeltas,
  type StoryboardDeltasParseResult,
} from './planParser';

type StoryboardPartialDeltas = Extract<StoryboardDeltasParseResult, { ok: false }>['partial'];

export interface StoryboardFramePlannerOptions {
  llmClient: LLMClient;
  /** Vision-capable LLM for image-aware delta planning (GPT-4o). Falls back to llmClient if null. */
  visionLlmClient?: LLMClient | null;
  timeoutMs?: number;
  /** Timeout for vision requests (image fetch + LLM call). */
  visionTimeoutMs?: number;
}

export class StoryboardFramePlanner {
  private readonly llmClient: LLMClient;
  private readonly visionLlmClient: LLMClient | null;
  private readonly timeoutMs: number;
  private readonly visionTimeoutMs: number;
  private readonly log = logger.child({ service: 'StoryboardFramePlanner' });

  constructor(options: StoryboardFramePlannerOptions) {
    this.llmClient = options.llmClient;
    this.visionLlmClient = options.visionLlmClient ?? null;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.visionTimeoutMs = options.visionTimeoutMs ?? 15000;
  }

  async planDeltas(prompt: string, frameCount: number, baseImageUrl?: string): Promise<string[]> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return [];
    }

    const expectedCount = this.resolveExpectedCount(frameCount);
    if (expectedCount === 0) {
      return [];
    }

    const responseText = await this.requestPlan(trimmed, expectedCount, baseImageUrl);
    const parsed = this.parseDeltas(responseText, expectedCount);
    if (parsed.ok) {
      return parsed.deltas;
    }

    this.log.warn('Storyboard plan parse failed; attempting repair', {
      parseError: parsed.error,
      expectedCount,
      responseLength: responseText.length,
      partialCount: parsed.partial?.actualCount ?? 0,
      partialSource: parsed.partial?.source,
    });

    const repairText = await this.requestRepair(
      trimmed,
      responseText,
      expectedCount,
      parsed.partial?.deltas,
      baseImageUrl
    );
    const repaired = this.parseDeltas(repairText, expectedCount);
    if (repaired.ok) {
      return repaired.deltas;
    }

    const bestPartial = this.pickBestPartial(parsed.partial, repaired.partial);
    if (bestPartial) {
      this.log.warn('Storyboard plan parse failed after repair; padding with fallback deltas', {
        parseError: repaired.error,
        expectedCount,
        responseLength: repairText.length,
        partialCount: bestPartial.actualCount,
        partialSource: bestPartial.source,
      });

      return this.padDeltas(bestPartial.deltas, expectedCount);
    }

    this.log.warn('Storyboard plan parse failed after repair; using fallback deltas', {
      parseError: repaired.error,
      expectedCount,
      responseLength: repairText.length,
    });

    return buildFallbackDeltas(expectedCount);
  }

  private resolveExpectedCount(frameCount: number): number {
    const normalizedFrameCount = Number.isFinite(frameCount) ? Math.floor(frameCount) : 0;
    return Math.max(0, normalizedFrameCount - 1);
  }

  private async requestPlan(
    prompt: string,
    expectedCount: number,
    baseImageUrl?: string
  ): Promise<string> {
    if (baseImageUrl && this.visionLlmClient) {
      return this.requestVisionPlan(prompt, expectedCount, baseImageUrl);
    }

    return this.requestTextPlan(prompt, expectedCount);
  }

  private async requestTextPlan(prompt: string, expectedCount: number): Promise<string> {
    const response = await this.llmClient.complete(
      buildSystemPrompt(expectedCount, STORYBOARD_FRAME_TIMESTAMPS),
      {
        userMessage: prompt,
        maxTokens: 400,
        temperature: 0.4,
        timeout: this.timeoutMs,
        jsonMode: true,
      }
    );
    return extractResponseText(response);
  }

  private async requestRepair(
    prompt: string,
    responseText: string,
    expectedCount: number,
    partialDeltas?: string[],
    baseImageUrl?: string
  ): Promise<string> {
    const partialSection =
      partialDeltas && partialDeltas.length > 0
        ? `\n\nParsed deltas (${partialDeltas.length}):\n${partialDeltas
            .map((delta, index) => `${index + 1}. ${delta}`)
            .join('\n')}\n\nReturn a full list of ${expectedCount} deltas, reusing these when valid.`
        : '';

    const repairUserMessage = `Base prompt:\n${prompt}\n\nPrevious response:\n${responseText}${partialSection}`;

    if (baseImageUrl && this.visionLlmClient) {
      let dataUrl: string;
      try {
        dataUrl = await fetchImageAsDataUrl(baseImageUrl, {
          timeoutMs: Math.min(this.visionTimeoutMs, 8000),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log.warn('Vision repair image fetch failed, falling back to text-only', {
          error: message,
          imageUrl: baseImageUrl.slice(0, 120),
        });
        dataUrl = '';
      }

      if (dataUrl) {
        const repairSystemPrompt = buildRepairSystemPrompt(
          expectedCount,
          STORYBOARD_FRAME_TIMESTAMPS
        );
        const repairVisionResponse = await this.visionLlmClient.complete(repairSystemPrompt, {
          messages: [
            { role: 'system', content: repairSystemPrompt },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: repairUserMessage },
              ],
            },
          ],
          maxTokens: 400,
          temperature: 0,
          timeout: this.visionTimeoutMs,
          jsonMode: true,
        });
        return extractResponseText(repairVisionResponse);
      }
    }

    const repairResponse = await this.llmClient.complete(
      buildRepairSystemPrompt(expectedCount, STORYBOARD_FRAME_TIMESTAMPS),
      {
        userMessage: repairUserMessage,
        maxTokens: 400,
        temperature: 0,
        timeout: this.timeoutMs,
        jsonMode: true,
      }
    );
    return extractResponseText(repairResponse);
  }

  private async requestVisionPlan(
    prompt: string,
    expectedCount: number,
    baseImageUrl: string
  ): Promise<string> {
    const visionClient = this.visionLlmClient;
    if (!visionClient) {
      return this.requestTextPlan(prompt, expectedCount);
    }

    let dataUrl: string;
    try {
      dataUrl = await fetchImageAsDataUrl(baseImageUrl, {
        timeoutMs: Math.min(this.visionTimeoutMs, 8000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn('Vision plan image fetch failed, falling back to text-only', {
        error: message,
        imageUrl: baseImageUrl.slice(0, 120),
      });
      return this.requestTextPlan(prompt, expectedCount);
    }

    const systemPrompt = buildSystemPrompt(expectedCount, STORYBOARD_FRAME_TIMESTAMPS);
    const response = await visionClient.complete(systemPrompt, {
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: buildVisionDeltaUserPrompt(prompt) },
          ],
        },
      ],
      maxTokens: 400,
      temperature: 0.4,
      timeout: this.visionTimeoutMs,
      jsonMode: true,
    });
    return extractResponseText(response);
  }

  private parseDeltas(
    responseText: string,
    expectedCount: number
  ): StoryboardDeltasParseResult {
    const parsed = parseStoryboardDeltas(responseText, expectedCount);
    if (parsed.ok && parsed.truncated) {
      this.log.warn('Storyboard planner returned extra deltas, truncating', {
        expectedCount,
        actualCount: parsed.actualCount,
        source: parsed.source,
      });
    }
    return parsed;
  }

  private pickBestPartial(
    ...partials: Array<StoryboardPartialDeltas | undefined>
  ): StoryboardPartialDeltas | undefined {
    let best: StoryboardPartialDeltas | undefined;
    for (const partial of partials) {
      if (!partial || partial.actualCount <= 0) {
        continue;
      }
      if (!best || partial.actualCount > best.actualCount) {
        best = partial;
      }
    }
    return best;
  }

  private padDeltas(deltas: string[], expectedCount: number): string[] {
    if (deltas.length >= expectedCount) {
      return deltas.slice(0, expectedCount);
    }
    const fallback = buildFallbackDeltas(expectedCount);
    return deltas.concat(fallback.slice(deltas.length));
  }
}
