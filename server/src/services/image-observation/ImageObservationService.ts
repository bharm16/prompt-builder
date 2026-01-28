/**
 * ImageObservationService
 *
 * Extracts lightweight observations from images for i2v filtering/warnings.
 * NOT for building prompts - just for constraining suggestions.
 */

import { logger } from '@infrastructure/Logger';
import { createHash } from 'crypto';
import { ObservationCache } from './cache/ObservationCache';
import {
  SHOT_MOVEMENT_COMPATIBILITY,
  POSITION_MOVEMENT_RISKS,
  type CameraMovement,
} from '@shared/cinematography';
import type { AIService } from '@services/prompt-optimization/types';
import type {
  ImageObservation,
  ImageObservationRequest,
  ImageObservationResult,
  SubjectObservation,
  FramingObservation,
  LightingObservation,
  MotionCompatibility,
} from './types';

export class ImageObservationService {
  private readonly ai: AIService;
  private readonly cache: ObservationCache;
  private readonly log = logger.child({ service: 'ImageObservationService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.cache = new ObservationCache();
  }

  /**
   * Observe an image and extract filtering/warning data
   */
  async observe(request: ImageObservationRequest): Promise<ImageObservationResult> {
    const startTime = performance.now();
    const imageHash = this.hashImage(request.image);

    if (!request.skipCache) {
      const cached = await this.cache.get(imageHash);
      if (cached) {
        return {
          success: true,
          observation: cached,
          cached: true,
          usedFastPath: false,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    if (request.sourcePrompt) {
      const observation = this.parseSourcePrompt(request.sourcePrompt, imageHash);
      await this.cache.set(imageHash, observation);
      return {
        success: true,
        observation,
        cached: false,
        usedFastPath: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const observation = await this.analyzeWithVision(request.image, imageHash);
      await this.cache.set(imageHash, observation);
      return {
        success: true,
        observation,
        cached: false,
        usedFastPath: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (error) {
      this.log.warn('Vision analysis unavailable, returning fallback observation', {
        error: (error as Error).message,
      });
      const fallback = this.buildFallbackObservation(imageHash);
      return {
        success: true,
        observation: fallback,
        cached: false,
        usedFastPath: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  private hashImage(image: string): string {
    return createHash('sha256').update(image).digest('hex');
  }

  /**
   * Fast path: parse observation from source prompt (no vision call)
   */
  private parseSourcePrompt(prompt: string, imageHash: string): ImageObservation {
    const lower = prompt.toLowerCase();

    const subject: SubjectObservation = {
      type: this.detectSubjectType(lower),
      description: this.extractSubjectDescription(prompt),
      position: 'center',
      confidence: 0.7,
    };

    const framing: FramingObservation = {
      shotType: this.detectShotType(lower),
      angle: this.detectAngle(lower),
      confidence: 0.6,
    };

    const lighting: LightingObservation = {
      quality: this.detectLightingQuality(lower),
      timeOfDay: this.detectTimeOfDay(lower),
      confidence: 0.6,
    };

    const motion = this.deriveMotionCompatibility(framing, subject.position);

    return {
      imageHash,
      observedAt: new Date(),
      subject,
      framing,
      lighting,
      motion,
      confidence: 0.6,
    };
  }

  /**
   * Vision path: analyze with multimodal model
   */
  private async analyzeWithVision(image: string, imageHash: string): Promise<ImageObservation> {
    const systemPrompt = [
      'Analyze this image for video generation constraints.',
      'Return JSON only (no markdown, no extra text).',
      '',
      '{',
      '  "subject": {',
      '    "type": "person|animal|object|scene|abstract",',
      '    "description": "brief description (10 words max)",',
      '    "position": "center|left|right|top|bottom|left-third|right-third"',
      '  },',
      '  "framing": {',
      '    "shotType": "extreme-close-up|close-up|medium-close-up|medium|medium-wide|wide|extreme-wide",',
      '    "angle": "eye-level|low-angle|high-angle|birds-eye|worms-eye|dutch|over-shoulder"',
      '  },',
      '  "lighting": {',
      '    "quality": "natural|artificial|dramatic|flat|mixed",',
      '    "timeOfDay": "day|night|golden-hour|blue-hour|indoor|unknown"',
      '  },',
      '  "confidence": 0.0-1.0',
      '}',
      '',
      'Be precise. Only describe what you clearly see.',
    ].join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze the image and return JSON.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ];

    const response = await this.ai.execute('image_observation', {
      systemPrompt,
      messages,
      maxTokens: 600,
      temperature: 0.1,
      jsonMode: true,
      enableBookending: false,
    });

    const parsed = this.parseJsonResponse(response.text);

    const subject: SubjectObservation = {
      type: parsed.subject?.type || 'object',
      description: parsed.subject?.description || 'subject',
      position: parsed.subject?.position || 'center',
      confidence: parsed.confidence || 0.8,
    };

    const framing: FramingObservation = {
      shotType: parsed.framing?.shotType || 'medium',
      angle: parsed.framing?.angle || 'eye-level',
      confidence: parsed.confidence || 0.8,
    };

    const lighting: LightingObservation = {
      quality: parsed.lighting?.quality || 'natural',
      timeOfDay: parsed.lighting?.timeOfDay || 'unknown',
      confidence: parsed.confidence || 0.8,
    };

    const motion = this.deriveMotionCompatibility(framing, subject.position);

    return {
      imageHash,
      observedAt: new Date(),
      subject,
      framing,
      lighting,
      motion,
      confidence: parsed.confidence || 0.8,
    };
  }

  private buildFallbackObservation(imageHash: string): ImageObservation {
    const framing: FramingObservation = {
      shotType: 'medium',
      angle: 'eye-level',
      confidence: 0.2,
    };
    const subject: SubjectObservation = {
      type: 'object',
      description: 'subject',
      position: 'center',
      confidence: 0.2,
    };
    const lighting: LightingObservation = {
      quality: 'natural',
      timeOfDay: 'unknown',
      confidence: 0.2,
    };
    const motion = this.deriveMotionCompatibility(framing, subject.position);
    return {
      imageHash,
      observedAt: new Date(),
      subject,
      framing,
      lighting,
      motion,
      confidence: 0.2,
    };
  }

  /**
   * Derive motion compatibility from framing and position
   */
  private deriveMotionCompatibility(
    framing: FramingObservation,
    position: SubjectObservation['position']
  ): MotionCompatibility {
    const compatible = SHOT_MOVEMENT_COMPATIBILITY[framing.shotType] || [];
    const positionRisks = POSITION_MOVEMENT_RISKS[position] || [];

    const recommended = compatible.filter((m) => !positionRisks.includes(m));
    const risky = positionRisks.filter((m) => compatible.includes(m));

    const risks = risky.map((movement) => ({
      movement,
      reason: `Subject is positioned ${position}, ${movement} may cut off subject`,
    }));

    return { recommended, risky, risks };
  }

  private detectSubjectType(text: string): SubjectObservation['type'] {
    if (/\b(man|woman|person|boy|girl|child|people)\b/.test(text)) return 'person';
    if (/\b(dog|cat|bird|animal|horse)\b/.test(text)) return 'animal';
    if (/\b(landscape|mountain|ocean|forest|city)\b/.test(text)) return 'scene';
    return 'object';
  }

  private extractSubjectDescription(text: string): string {
    const match = text.match(/^[^,\.]+/);
    return match ? match[0].slice(0, 50) : 'subject';
  }

  private detectShotType(text: string): FramingObservation['shotType'] {
    if (/extreme close[- ]?up|ecu\b/.test(text)) return 'extreme-close-up';
    if (/close[- ]?up|cu\b/.test(text)) return 'close-up';
    if (/medium close/.test(text)) return 'medium-close-up';
    if (/medium wide|mws/.test(text)) return 'medium-wide';
    if (/\bwide\b|ws\b|establishing/.test(text)) return 'wide';
    if (/extreme wide|ews/.test(text)) return 'extreme-wide';
    if (/\bmedium\b|ms\b/.test(text)) return 'medium';
    return 'medium';
  }

  private detectAngle(text: string): FramingObservation['angle'] {
    if (/low angle|worm/.test(text)) return 'low-angle';
    if (/high angle|bird/.test(text)) return 'high-angle';
    if (/dutch|tilted/.test(text)) return 'dutch';
    if (/over.?shoulder|ots/.test(text)) return 'over-shoulder';
    return 'eye-level';
  }

  private detectLightingQuality(text: string): LightingObservation['quality'] {
    if (/dramatic|chiaroscuro|contrast/.test(text)) return 'dramatic';
    if (/flat|soft|diffuse/.test(text)) return 'flat';
    if (/artificial|neon|fluorescent/.test(text)) return 'artificial';
    if (/natural|sun/.test(text)) return 'natural';
    return 'natural';
  }

  private detectTimeOfDay(text: string): LightingObservation['timeOfDay'] {
    if (/golden hour|sunset|sunrise/.test(text)) return 'golden-hour';
    if (/blue hour|dusk|dawn/.test(text)) return 'blue-hour';
    if (/night|dark|moon/.test(text)) return 'night';
    if (/indoor|interior|room/.test(text)) return 'indoor';
    if (/day|bright|sunny|midday/.test(text)) return 'day';
    return 'unknown';
  }

  private parseJsonResponse(text: string): Record<string, any> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }
}
