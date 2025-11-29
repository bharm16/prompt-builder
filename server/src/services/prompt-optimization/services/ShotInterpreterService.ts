import { logger } from '@infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import type { AIService, ShotPlan } from '../types.js';

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

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Interpret a raw concept into a structured shot plan
   */
  async interpret(prompt: string): Promise<ShotPlan | null> {
    if (!prompt || !prompt.trim()) return null;

    const systemPrompt = this._buildSystemPrompt(prompt);

    // Lightweight schema to keep output predictable without blocking optional fields
    const schema = {
      type: 'object',
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
      const parsed = await StructuredOutputEnforcer.enforceJSON(this.ai, systemPrompt, {
        operation: 'optimize_shot_interpreter',
        schema,
        maxRetries: 1,
        temperature: 0,
        maxTokens: 400,
      });

      return parsed as ShotPlan;
    } catch (error) {
      logger.warn('Shot interpretation failed - continuing without structured plan', {
        error: (error as Error).message,
      });
      return null;
    }
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
- Keep everything optimized for the 100-150 word final prompt envelope.

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

