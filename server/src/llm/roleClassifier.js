// server/llm/roleClassifier.js
// LLM system prompt + validator + cache.
// Now uses unified taxonomy system with namespaced IDs.

import crypto from 'crypto';
import NodeCache from 'node-cache';
import { VALID_CATEGORIES, TAXONOMY } from '#shared/taxonomy.js';

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
 * @typedef {{ text: string, start: number, end: number }} InputSpan
 * @typedef {{ text: string, start: number, end: number, role: string, confidence: number }} LabeledSpan
 */

/**
 * @param {InputSpan[]} spans
 * @param {string} templateVersion
 * @param {Object} aiService - AI Model Service instance
 * @returns {Promise<LabeledSpan[]>}
 */
export async function roleClassify(spans, templateVersion, aiService) {
  if (!aiService) {
    throw new Error('aiService is required');
  }

  const key = hashKey(spans, templateVersion);
  const cached = cache.get(key);
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

    const raw = response.content[0]?.text || '';
    const parsed = safeParseJSON(raw);
    const labeled = validate(spans, parsed?.spans ?? []);
    cache.set(key, labeled);
    return labeled;
  } catch (error) {
    console.warn('roleClassify fallback to deterministic labels', {
      message: error?.message,
    });
    return spans.map((span) => ({
      ...span,
      role: TAXONOMY.SUBJECT.id,
      confidence: 0,
    }));
  }
}

/**
 * @param {InputSpan[]} spans
 * @param {string} ver
 * @returns {string}
 */
export function hashKey(spans, ver) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(spans) + '|' + ver + '|' + CACHE_VERSION)
    .digest('hex');
}

/**
 * Normalize and validate a role against the taxonomy
 * @param {string} role - Role to validate
 * @returns {string} Valid taxonomy ID
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') {
    console.warn('[roleClassifier] Invalid role type, defaulting to subject');
    return TAXONOMY.SUBJECT.id;
  }

  // Check if it's already a valid taxonomy ID
  if (ROLE_SET.has(role)) {
    return role;
  }

  // Log warning for unknown roles
  console.warn(`[roleClassifier] Unknown role "${role}", defaulting to subject`);
  return TAXONOMY.SUBJECT.id;
}

/**
 * @param {string} value
 * @returns {any}
 */
function safeParseJSON(value) {
  if (!value) return null;

  const trimmed = value.trim();
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');

  try {
    return JSON.parse(withoutFences);
  } catch {
    const match = withoutFences.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * @param {InputSpan[]} source
 * @param {any[]} labeled
 * @returns {LabeledSpan[]}
 */
export function validate(source, labeled) {
  const srcSet = new Set(source.map((s) => `${s.text}|${s.start}|${s.end}`));

  const out = [];
  for (const item of labeled) {
    if (!item || typeof item !== 'object') continue;
    const { text, start, end } = item;
    if (
      typeof text === 'string' &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      srcSet.has(`${text}|${start}|${end}`)
    ) {
      // Normalize role to valid taxonomy ID
      const role = normalizeRole(item.role);
      const confidence =
        typeof item.confidence === 'number'
          ? Math.max(0, Math.min(1, item.confidence))
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

  const final = [];
  for (const span of out) {
    const last = final[final.length - 1];
    if (last && span.start < last.end) {
      // Prefer technical specs and higher confidence
      const score = (candidate) =>
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
