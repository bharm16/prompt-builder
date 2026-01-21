import type { LLMClient } from '@clients/LLMClient';
import { logger } from '@infrastructure/Logger';
import { extractResponseText } from '@utils/JsonExtractor';
import {
  buildFallbackDeltas,
  buildRepairSystemPrompt,
  buildSystemPrompt,
} from './prompts';
import {
  parseStoryboardDeltas,
  type StoryboardDeltasParseResult,
} from './planParser';

export interface StoryboardFramePlannerOptions {
  llmClient: LLMClient;
  timeoutMs?: number;
}

export class StoryboardFramePlanner {
  private readonly llmClient: LLMClient;
  private readonly timeoutMs: number;
  private readonly log = logger.child({ service: 'StoryboardFramePlanner' });

  constructor(options: StoryboardFramePlannerOptions) {
    this.llmClient = options.llmClient;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async planDeltas(prompt: string, frameCount: number): Promise<string[]> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return [];
    }

    const expectedCount = this.resolveExpectedCount(frameCount);
    if (expectedCount === 0) {
      return [];
    }

    const responseText = await this.requestPlan(trimmed, expectedCount);
    const parsed = this.parseDeltas(responseText, expectedCount);
    if (parsed.ok) {
      return parsed.deltas;
    }

    this.log.warn('Storyboard plan parse failed; attempting repair', {
      error: parsed.error,
      expectedCount,
      responseLength: responseText.length,
    });

    const repairText = await this.requestRepair(trimmed, responseText, expectedCount);
    const repaired = this.parseDeltas(repairText, expectedCount);
    if (repaired.ok) {
      return repaired.deltas;
    }

    const repairErrorInstance = new Error(repaired.error);
    this.log.error(
      'Storyboard plan parse failed after repair; using fallback deltas',
      repairErrorInstance,
      {
        error: repaired.error,
        expectedCount,
        responseLength: repairText.length,
      }
    );

    return buildFallbackDeltas(expectedCount);
  }

  private resolveExpectedCount(frameCount: number): number {
    const normalizedFrameCount = Number.isFinite(frameCount) ? Math.floor(frameCount) : 0;
    return Math.max(0, normalizedFrameCount - 1);
  }

  private async requestPlan(prompt: string, expectedCount: number): Promise<string> {
    const response = await this.llmClient.complete(buildSystemPrompt(expectedCount), {
      userMessage: prompt,
      maxTokens: 400,
      temperature: 0.4,
      timeout: this.timeoutMs,
      jsonMode: true,
    });
    return extractResponseText(response);
  }

  private async requestRepair(
    prompt: string,
    responseText: string,
    expectedCount: number
  ): Promise<string> {
    const repairResponse = await this.llmClient.complete(
      buildRepairSystemPrompt(expectedCount),
      {
        userMessage: `Base prompt:\n${prompt}\n\nInvalid response:\n${responseText}`,
        maxTokens: 400,
        temperature: 0,
        timeout: this.timeoutMs,
        jsonMode: true,
      }
    );
    return extractResponseText(repairResponse);
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
}
