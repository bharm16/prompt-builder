/**
 * Video-to-Image Prompt Transformer
 *
 * Uses LLM to intelligently convert video prompts into static image descriptions.
 * This handles the infinite variety of temporal language, camera movements, and
 * action descriptions that regex patterns cannot cover.
 */

import type { LLMClient } from '@clients/LLMClient';
import { logger } from '@infrastructure/Logger';

const TRANSFORMATION_SYSTEM_PROMPT = `You convert video prompts into static image descriptions optimized for Flux Schnell.

Flux Schnell Prompting Rules:
1. STRUCTURE: Subject → Action/Pose → Environment → Lighting → Style/Modifiers
2. STYLE: Use natural language. Be descriptive but precise.
3. NO NEGATIVE PROMPTS: Describe what IS there, not what isn't.
4. TECHNICAL: Include camera settings (e.g., "f/2.8", "35mm lens", "photorealistic", "4k").
5. TEMPORAL: Remove ALL temporal language (durations, "begins to", "slowly", "pan left", "zoom in"). Convert movements to static framing.

CONVERSION GUIDELINES:
- "pan left" → "wide angle, left-weighted composition"
- "dolly in" → "close-up, intimate framing"
- "zoom in" → "macro detail"
- "begins to smile" → "smiling expression"
- "walking across" → "mid-stride pose"

EXAMPLE INPUT:
"Camera pans across a cyberpunk city at night. Neon lights reflect in rain puddles. A cyborg woman walks towards the camera, her mechanical arm glowing blue. 4k, cinematic."

EXAMPLE OUTPUT:
"A cyborg woman walking towards the camera, mid-stride, mechanical arm glowing blue. Cyberpunk city background at night, neon lights reflecting in rain puddles. Wide angle, cinematic lighting, photorealistic, 4k, f/1.8, 35mm lens, sharp focus."

OUTPUT: Return ONLY the transformed prompt. No explanations.`;

export interface VideoToImageTransformerOptions {
  llmClient: LLMClient;
  timeoutMs?: number;
}

/**
 * LLM-powered video-to-image prompt transformer
 *
 * Uses Gemini for fast, intelligent transformation that handles
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
