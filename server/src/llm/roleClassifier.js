// server/llm/roleClassifier.js
// LLM system prompt + validator + cache.

import crypto from 'crypto';
import NodeCache from 'node-cache';
import { callOpenAI } from './openAIClient.js';

const cache = new NodeCache({ stdTTL: 120 });

const SYSTEM_PROMPT = `
You label short prompt spans for a video prompt editor.
Roles: Wardrobe, Appearance, Lighting, TimeOfDay, Action, CameraMove, Framing, Environment, Color, Technical, Descriptive.
Rules:
- Do not change "text", "start", or "end".
- Do not merge or split spans.
- Action = subject movement (NOT camera movement)
- CameraMove = camera movement (NOT subject movement)
- If unsure, use "Descriptive".
Return ONLY valid JSON: {"spans":[...]}.
`;

const ROLE_SET = new Set([
  'Wardrobe',
  'Appearance',
  'Lighting',
  'TimeOfDay',
  'Action',
  'CameraMove',
  'Framing',
  'Environment',
  'Color',
  'Technical',
  'Descriptive',
]);

/**
 * @typedef {{ text: string, start: number, end: number }} InputSpan
 * @typedef {{ text: string, start: number, end: number, role: string, confidence: number }} LabeledSpan
 */

/**
 * @param {InputSpan[]} spans
 * @param {string} templateVersion
 * @returns {Promise<LabeledSpan[]>}
 */
export async function roleClassify(spans, templateVersion) {
  const key = hashKey(spans, templateVersion);
  const cached = cache.get(key);
  if (cached) return cached;

  const userPayload = JSON.stringify({
    spans,
    templateVersion,
  });

  try {
    const raw = await callOpenAI({
      system: SYSTEM_PROMPT,
      user: userPayload,
      temperature: 0,
      max_tokens: 600,
    });

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
      role: 'Descriptive',
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
    .update(JSON.stringify(spans) + '|' + ver)
    .digest('hex');
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
      const role = ROLE_SET.has(item.role) ? item.role : 'Descriptive';
      const confidence =
        typeof item.confidence === 'number'
          ? Math.max(0, Math.min(1, item.confidence))
          : 0.7;

      const words = (text.match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
      if (role !== 'Technical' && words > 6) continue;

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
      const score = (candidate) =>
        (candidate.role === 'Technical' ? 2 : 0) + (candidate.confidence || 0);
      if (score(span) > score(last)) {
        final[final.length - 1] = span;
      }
    } else {
      final.push(span);
    }
  }

  return final;
}
