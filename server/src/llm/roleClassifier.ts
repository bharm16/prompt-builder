// server/llm/roleClassifier.ts
// LLM system prompt + validator + cache.
// Now uses unified taxonomy system with namespaced IDs.

import crypto from 'crypto';
import NodeCache from 'node-cache';
import { logger } from '@infrastructure/Logger';
import { VALID_CATEGORIES, TAXONOMY } from '#shared/taxonomy.js';
import type { InputSpan, LabeledSpan, AIService } from './types.js';

const cache = new NodeCache({ stdTTL: 120 });

// Cache version for taxonomy migration - bump to invalidate old cached responses
const CACHE_VERSION = 'v3-taxonomy';

const SYSTEM_PROMPT = `
You label short prompt spans for a video prompt editor using our hierarchical taxonomy system.

TAXONOMY CATEGORIES (use these exact IDs):

SHOT & CAMERA GROUP:
- shot: Shot type / framing
- shot.type: Shot type (wide, medium, close-up, bird's eye, dutch)
- camera: Camera operations
- camera.movement: Camera movement (dolly, pan, crane, handheld, static)
- camera.angle: Camera angle (low angle, overhead, eye level)
- camera.lens: Lens specification (35mm, anamorphic)

ENTITY GROUP (subject and attributes):
- subject: Main focal point (person, object, animal)
- subject.identity: Core identity ("a cowboy", "an alien")
- subject.appearance: Physical traits (face, body, build, features)
- subject.wardrobe: Clothing, costume, attire
- subject.emotion: Emotional state, expression

ACTION GROUP (One Clip, One Action):
- action: Subject action / motion
- action.movement: Movement or activity (running, floating, leaning)
- action.state: Static pose or state (standing, sitting, kneeling)
- action.gesture: Gesture/micro-action (raising hand, smiling softly)

SETTING GROUP (environment and lighting):
- environment: Location or setting
- environment.location: Specific place (diner, forest, Mars)
- environment.weather: Weather conditions (rainy, foggy, sunny)
- environment.context: Environmental context (crowded, empty, abandoned)
- lighting: Illumination and atmosphere
- lighting.source: Light source (neon sign, sun, candles)
- lighting.quality: Light quality (soft, hard, diffused)
- lighting.timeOfDay: Time of day (golden hour, dusk, dawn)

TECHNICAL GROUP (camera, style, specs):
- style: Visual treatment and aesthetic
- style.aesthetic: Aesthetic style (cyberpunk, noir, vintage)
- style.filmStock: Film medium (Kodak Portra, 35mm film, digital)
- technical: Technical specifications
- technical.aspectRatio: Aspect ratio (16:9, 2.39:1, 9:16)
- technical.frameRate: Frame rate (24fps, 30fps, 60fps)
- technical.resolution: Resolution (4K, 1080p, 8K)
- technical.duration: Duration or clip length
- audio: Audio elements
- audio.score: Music or score (orchestral, ambient)
- audio.soundEffect: Sound effects (footsteps, wind, traffic)

RULES:
- Use namespaced IDs exactly as shown above (e.g., "subject.wardrobe" not "wardrobe")
- Do not change "text", "start", or "end" values
- Do not merge or split spans
- Choose the most specific attribute when possible (prefer "subject.wardrobe" over "subject")
- For camera movement use "camera.movement"; for subject movement use "action.movement"
- Time of day goes under "lighting.timeOfDay"
- Check ALL categories before using generic parent categories

Return ONLY valid JSON: {"spans":[...]}.
`;

// Use taxonomy validation set directly
export const ROLE_SET = VALID_CATEGORIES;

/**
 * Normalize and validate a role against the taxonomy
 */
function normalizeRole(role: string | null | undefined): string {
  const log = logger.child({ service: 'roleClassifier' });
  
  if (!role || typeof role !== 'string') {
    log.warn('Invalid role type, defaulting to subject', {
      operation: 'normalizeRole',
      role: role || null,
    });
    return TAXONOMY.SUBJECT.id;
  }

  // Check if it's already a valid taxonomy ID
  if (ROLE_SET.has(role)) {
    return role;
  }

  // Log warning for unknown roles
  log.warn('Unknown role, defaulting to subject', {
    operation: 'normalizeRole',
    role,
  });
  return TAXONOMY.SUBJECT.id;
}

/**
 * Safely parse JSON from LLM response
 */
function safeParseJSON(value: string | null | undefined): { spans?: LabeledSpan[] } | null {
  if (!value) return null;

  const trimmed = value.trim();
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');

  try {
    return JSON.parse(withoutFences) as { spans?: LabeledSpan[] };
  } catch {
    const match = withoutFences.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as { spans?: LabeledSpan[] };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Classify spans with roles using LLM
 */
export async function roleClassify(
  spans: InputSpan[],
  templateVersion: string,
  aiService: AIService
): Promise<LabeledSpan[]> {
  if (!aiService) {
    throw new Error('aiService is required');
  }

  const key = hashKey(spans, templateVersion);
  const cached = cache.get<LabeledSpan[]>(key);
  if (cached) return cached;

  const userPayload = JSON.stringify({
    spans,
    templateVersion,
  });

  try {
    const response = await aiService.execute('role_classification', {
      systemPrompt: SYSTEM_PROMPT,
      userMessage: userPayload,
      // temperature and maxTokens are configured in modelConfig.js
    });

    const raw = response.text || response.content?.[0]?.text || '';
    const parsed = safeParseJSON(raw);
    const labeled = validate(spans, parsed?.spans ?? []);
    cache.set(key, labeled);
    return labeled;
  } catch (error) {
    const err = error as Error;
    const log = logger.child({ service: 'roleClassifier' });
    log.warn('roleClassify fallback to deterministic labels', {
      operation: 'roleClassify',
      error: err?.message,
    });
    return spans.map((span) => ({
      ...span,
      role: TAXONOMY.SUBJECT.id,
      confidence: 0,
    }));
  }
}

/**
 * Generate cache key from spans and version
 */
export function hashKey(spans: InputSpan[], ver: string): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(spans) + '|' + ver + '|' + CACHE_VERSION)
    .digest('hex');
}

/**
 * Validate labeled spans against source spans
 */
export function validate(source: InputSpan[], labeled: unknown[]): LabeledSpan[] {
  const srcSet = new Set(source.map((s) => `${s.text}|${s.start}|${s.end}`));

  const out: LabeledSpan[] = [];
  for (const item of labeled) {
    if (!item || typeof item !== 'object') continue;
    const itemObj = item as Record<string, unknown>;
    const { text, start, end } = itemObj;
    if (
      typeof text === 'string' &&
      typeof start === 'number' &&
      typeof end === 'number' &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      srcSet.has(`${text}|${start}|${end}`)
    ) {
      // Normalize role to valid taxonomy ID
      const role = normalizeRole(itemObj.role as string | undefined);
      const confidence =
        typeof itemObj.confidence === 'number'
          ? Math.max(0, Math.min(1, itemObj.confidence))
          : 0.7;

      const words = (text.match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
      // Skip very long spans unless they're technical specs
      if (role !== TAXONOMY.TECHNICAL.id && words > 6) continue;

      out.push({
        text,
        start,
        end,
        role,
        confidence,
      });
    }
  }

  out.sort((a, b) => a.start - b.start || b.end - a.end);

  const final: LabeledSpan[] = [];
  for (const span of out) {
    const last = final[final.length - 1];
    if (last && span.start < last.end) {
      // Prefer technical specs and higher confidence
      const score = (candidate: LabeledSpan) =>
        (candidate.role === TAXONOMY.TECHNICAL.id ? 2 : 0) + (candidate.confidence || 0);
      if (score(span) > score(last)) {
        final[final.length - 1] = span;
      }
    } else {
      final.push(span);
    }
  }

  return final;
}

