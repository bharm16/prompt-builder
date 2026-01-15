import type { LLMClient } from '@clients/LLMClient';
import { logger } from '@infrastructure/Logger';
import { extractAndParse, extractResponseText } from '@utils/JsonExtractor';

type StoryboardPlan = {
  deltas: string[];
};

const buildSystemPrompt = (deltaCount: number): string => `You are a storyboard frame planner.

You will receive a base image prompt. Return exactly ${deltaCount} edit instructions for subsequent frames.

OUTPUT FORMAT:
- Return ONLY valid JSON in the exact shape: {"deltas":["...","...","..."]}.
- The "deltas" array must contain exactly ${deltaCount} strings.

DELTA RULES:
- Each delta is a single still-image edit instruction for img2img.
- Make small, visual changes only.
- Preserve character identity, wardrobe, scene, lighting, and style.
- Maintain continuity and do not introduce new characters or locations.
- Favor a camera progression (wide -> medium -> close -> wide or over-the-shoulder) unless the prompt implies otherwise.
- Avoid temporal language like "then", "sequence", "montage", or "frame 2".
- Each delta must stand alone as a still-image instruction.`;

const buildRepairSystemPrompt = (deltaCount: number): string => `${buildSystemPrompt(deltaCount)}

REPAIR MODE:
- The previous response was invalid JSON or did not match the schema.
- Return ONLY valid JSON with the exact schema and array length.`;

const FALLBACK_DELTAS = [
  'Reframe to a slightly wider establishing shot of the same scene.',
  'Reframe to a medium shot centered on the main subject.',
  'Reframe to a close-up on the main subject.',
  'Reframe to an over-the-shoulder view of the main subject.',
  'Reframe back to a wider shot to re-establish the scene.',
];

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

    const normalizedFrameCount = Number.isFinite(frameCount) ? Math.floor(frameCount) : 0;
    const expectedCount = Math.max(0, normalizedFrameCount - 1);
    if (expectedCount === 0) {
      return [];
    }

    const systemPrompt = buildSystemPrompt(expectedCount);
    const response = await this.llmClient.complete(systemPrompt, {
      userMessage: trimmed,
      maxTokens: 400,
      temperature: 0.4,
      timeout: this.timeoutMs,
      jsonMode: true,
    });
    const responseText = extractResponseText(response);

    try {
      return this.parseDeltas(responseText, expectedCount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Storyboard plan parse failed; attempting repair', {
        error: errorMessage,
        responsePreview: responseText.substring(0, 200),
      });

      const repairResponse = await this.llmClient.complete(
        buildRepairSystemPrompt(expectedCount),
        {
          userMessage: `Base prompt:\n${trimmed}\n\nInvalid response:\n${responseText}`,
          maxTokens: 400,
          temperature: 0,
          timeout: this.timeoutMs,
          jsonMode: true,
        }
      );
      const repairText = extractResponseText(repairResponse);

      try {
        return this.parseDeltas(repairText, expectedCount);
      } catch (repairError) {
        const repairErrorMessage =
          repairError instanceof Error ? repairError.message : String(repairError);
        this.log.error('Storyboard plan parse failed after repair; using fallback deltas', repairError as Error, {
          error: repairErrorMessage,
          responsePreview: repairText.substring(0, 200),
        });
        return this.buildFallbackDeltas(expectedCount);
      }
    }
  }

  private parseDeltas(responseText: string, expectedCount: number): string[] {
    const attempts: string[][] = [];

    try {
      const parsed = extractAndParse<StoryboardPlan>(responseText, false);
      attempts.push(this.normalizeDeltas(parsed.deltas));
    } catch {
      // continue to other parsing strategies
    }

    try {
      const parsed = extractAndParse<unknown>(responseText, true);
      if (Array.isArray(parsed)) {
        attempts.push(this.normalizeDeltas(parsed));
      }
    } catch {
      // continue to other parsing strategies
    }

    const lineDeltas = this.extractDeltasFromLines(responseText);
    if (lineDeltas.length > 0) {
      attempts.push(lineDeltas);
    }

    const normalized = attempts.find((candidate) => candidate.length >= expectedCount);
    if (normalized) {
      if (normalized.length > expectedCount) {
        this.log.warn('Storyboard planner returned extra deltas, truncating', {
          expectedCount,
          actualCount: normalized.length,
        });
      }
      return normalized.slice(0, expectedCount);
    }

    throw new Error(
      `Storyboard planner returned insufficient deltas, expected ${expectedCount}`
    );
  }

  private normalizeDeltas(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((delta): delta is string => typeof delta === 'string')
      .map((delta) => delta.trim())
      .filter((delta) => delta.length > 0);
  }

  private extractDeltasFromLines(responseText: string): string[] {
    const lines = responseText
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:-|\*|\d+\.)\s*/g, '').trim())
      .filter((line) => line.length > 0);

    return this.normalizeDeltas(lines);
  }

  private buildFallbackDeltas(expectedCount: number): string[] {
    if (expectedCount <= 0) {
      return [];
    }
    const deltas: string[] = [];
    for (let index = 0; index < expectedCount; index += 1) {
      deltas.push(FALLBACK_DELTAS[index % FALLBACK_DELTAS.length]);
    }
    return deltas;
  }
}
