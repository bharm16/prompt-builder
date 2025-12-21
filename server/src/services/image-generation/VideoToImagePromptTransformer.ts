/**
 * Video-to-Image Prompt Transformer
 *
 * Uses LLM to intelligently convert video prompts into static image descriptions.
 * This handles the infinite variety of temporal language, camera movements, and
 * action descriptions that regex patterns cannot cover.
 */

import type { LLMClient } from '@clients/LLMClient';
import { logger } from '@infrastructure/Logger';

const TRANSFORMATION_SYSTEM_PROMPT = `You convert video prompts into static image descriptions for image generation models.

RULES:
1. Remove ALL temporal language: durations, "over X seconds", "gradually", "begins to", "slowly", timing references
2. Convert camera movements to static compositions:
   - "dolly in" → "close-up framing"
   - "pan left" → "left-weighted composition"
   - "crane shot" → "elevated perspective"
   - "tracking shot" → "dynamic composition"
   - "zoom in" → "close-up detail"
   - etc.
3. Convert actions-in-progress to states:
   - "begins to smile" → "smiling"
   - "starts walking" → "walking"
   - "continues to run" → "running"
4. KEEP all visual details: subject, lighting, environment, style, colors, mood, aesthetic
5. KEEP aspect ratio if mentioned (16:9, 9:16, etc.)
6. REMOVE frame rates (24fps, 60fps, etc.)
7. REMOVE duration references (5s, 10 seconds, etc.)

OUTPUT: Return ONLY the transformed prompt. No explanations, no quotes, no markdown.`;

export interface VideoToImageTransformerOptions {
  llmClient: LLMClient;
  timeoutMs?: number;
}

/**
 * LLM-powered video-to-image prompt transformer
 *
 * Uses Groq/Llama for fast, intelligent transformation that handles
 * any prompt format - not limited to predefined patterns.
 */
export class VideoToImagePromptTransformer {
  private readonly llmClient: LLMClient;
  private readonly timeoutMs: number;
  private readonly log = logger.child({ service: 'VideoToImagePromptTransformer' });

  constructor(options: VideoToImageTransformerOptions) {
    this.llmClient = options.llmClient;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Transform a video prompt into a static image description
   *
   * @param videoPrompt - The original video prompt with temporal/movement language
   * @returns Transformed prompt suitable for image generation
   */
  async transform(videoPrompt: string): Promise<string> {
    const trimmed = videoPrompt.trim();

    if (!trimmed) {
      return trimmed;
    }

    const startTime = performance.now();

    try {
      const response = await this.llmClient.complete(TRANSFORMATION_SYSTEM_PROMPT, {
        userMessage: trimmed,
        maxTokens: 500,
        temperature: 0.2, // Low temperature for consistent transformations
        timeout: this.timeoutMs,
        jsonMode: false,
      });

      const transformed = response.text.trim();
      const duration = Math.round(performance.now() - startTime);

      // Validate we got something back
      if (!transformed || transformed.length < 10) {
        this.log.warn('LLM returned empty or too-short transformation, using original', {
          originalLength: trimmed.length,
          transformedLength: transformed.length,
          duration,
        });
        return trimmed;
      }

      this.log.debug('Video prompt transformed for image generation', {
        originalLength: trimmed.length,
        transformedLength: transformed.length,
        duration,
      });

      return transformed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Math.round(performance.now() - startTime);

      this.log.warn('Video-to-image transformation failed, using original prompt', {
        error: errorMessage,
        duration,
        promptPreview: trimmed.substring(0, 100),
      });

      // Graceful fallback: return original prompt
      return trimmed;
    }
  }
}
