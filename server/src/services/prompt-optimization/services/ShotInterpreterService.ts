import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService, ShotPlan } from '../types';

/**
 * ShotInterpreterService
 *
 * Converts raw, unstructured user concepts into a flexible shot plan that the
 * optimizer can use without forcing the user through a rigid schema.
 *
 * Goals (aligned with "LLM Video Prompt Research and Template"):
 * - Infer a single clip intent (one clear action or one camera move)
 * - Keep everything visual and camera-observable
 * - Avoid inventing subjects/actions when the user provided none
 * - Provide structured hints for camera, lighting, and style without blocking missing fields
 */
export class ShotInterpreterService {
  private readonly ai: AIService;
  private readonly log: ILogger;
  private readonly cache = new Map<string, { value: ShotPlan | null; expiresAt: number }>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.log = logger.child({ service: 'ShotInterpreterService' });
    this.cacheTtlMs = Number.parseInt(process.env.SHOT_PLAN_CACHE_TTL_MS || '300000', 10);
    this.cacheMaxEntries = Number.parseInt(process.env.SHOT_PLAN_CACHE_MAX || '200', 10);
  }

  /**
   * Interpret a raw concept into a structured shot plan
   */
  async interpret(prompt: string, signal?: AbortSignal): Promise<ShotPlan | null> {
    const startTime = performance.now();
    const operation = 'interpret';
    
    if (!prompt || !prompt.trim()) {
      this.log.debug('Operation skipped.', {
        operation,
        reason: 'empty_prompt',
        duration: Math.round(performance.now() - startTime),
      });
      return null;
    }

    const cacheKey = this.getCacheKey(prompt);
    const cached = this.getCached(cacheKey);
    if (cached !== undefined) {
      this.log.debug('Cache hit.', {
        operation,
        promptLength: prompt.length,
      });
      return cached;
    }

    this.log.debug('Starting operation.', {
      operation,
      promptLength: prompt.length,
    });

    const systemPrompt = this._buildSystemPrompt(prompt);

    // Lightweight schema to keep output predictable without blocking optional fields
    const schema = {
      type: 'object' as const,
      required: ['shot_type', 'core_intent'],
      properties: {
        shot_type: { type: 'string' },
        core_intent: { type: 'string' },
        subject: { type: ['string', 'null'] },
        action: { type: ['string', 'null'] },
        visual_focus: { type: ['string', 'null'] },
        setting: { type: ['string', 'null'] },
        time: { type: ['string', 'null'] },
        mood: { type: ['string', 'null'] },
        style: { type: ['string', 'null'] },
        camera_move: { type: ['string', 'null'] },
        camera_angle: { type: ['string', 'null'] },
        lighting: { type: ['string', 'null'] },
        audio: { type: ['string', 'null'] },
        duration_hint: { type: ['string', 'null'] },
        risks: { type: 'array' },
        confidence: { type: 'number' },
      },
    };

    try {
      const parsed = await StructuredOutputEnforcer.enforceJSON<ShotPlan>(this.ai, systemPrompt, {
        operation: 'optimize_shot_interpreter',
        schema,
        maxRetries: 1,
        temperature: 0,
        maxTokens: 400,
        ...(signal ? { signal } : {}),
      });

      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        shotType: parsed.shot_type,
        confidence: parsed.confidence,
      });

      this.setCached(cacheKey, parsed as ShotPlan);
      return parsed as ShotPlan;
    } catch (error) {
      this.log.warn('Operation failed; continuing without structured plan.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        error: (error as Error).message,
      });
      this.setCached(cacheKey, null);
      return null;
    }
  }

  private getCacheKey(prompt: string): string {
    return prompt.trim().toLowerCase();
  }

  private getCached(cacheKey: string): ShotPlan | null | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }
    return entry.value;
  }

  private setCached(cacheKey: string, value: ShotPlan | null): void {
    if (this.cacheTtlMs <= 0 || this.cacheMaxEntries <= 0) {
      return;
    }

    if (this.cache.size >= this.cacheMaxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private _buildSystemPrompt(userPrompt: string): string {
    return `You are a SHOT INTERPRETER for text-to-video prompts.
Your job is to read the raw user concept and map it into a flexible shot plan.

Follow the research-backed best practices:
- Treat this like briefing a film crew (director's mindset).
- Enforce ONE CLIP, ONE ACTION. If no action exists, focus on camera movement or visual focus.
- Describe only what the camera can SEE. No internal emotions without visual evidence.
- Do not invent a subject/action if the user gave none; mark them null instead.
- Prefer concrete camera/lighting/style hints but keep fields nullable.
- Keep everything optimized for the 75-125 word final prompt envelope.

Classify shot_type using ONE of these buckets:
- action_shot: clear subject performing a physical action
- motion_only: camera move/establishing pan/tilt/track without a clearly acting subject
- environment_establishing: world-building or location-led shot
- artifact_storyboard: focus on object, storyboard panel, product, or medium reference
- abstract_mood: mood board / texture-driven / music-visual with no explicit subject

Output ONLY valid JSON with these keys:
{
  "shot_type": "action_shot|motion_only|environment_establishing|artifact_storyboard|abstract_mood",
  "core_intent": "one-sentence description of the clip",
  "subject": "main subject if present, else null",
  "action": "single, concrete action if present, else null",
  "visual_focus": "what the camera should stay locked on if no action/subject",
  "setting": "location or spatial context if present",
  "time": "time-of-day or era if stated",
  "mood": "emotional tone in visual terms",
  "style": "aesthetic reference if hinted (film stock/genre/medium)",
  "camera_move": "pan/tilt/dolly/truck/static if hinted; else null",
  "camera_angle": "Any specific angle from cinematic vocabulary (e.g., Low-Angle, High-Angle, Dutch, Bird's-Eye, Worm's-Eye, POV) if hinted; else null",
  "lighting": "lighting cue if hinted",
  "audio": "audio hint if explicitly provided; else null",
  "duration_hint": "duration if provided",
  "risks": ["problems to avoid (multiple actions, vagueness, etc.)"],
  "confidence": 0-1
}

User concept (verbatim): "${userPrompt}"`;
  }
}

export default ShotInterpreterService;
